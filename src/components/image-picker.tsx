"use client";

import { useRef, useState, useTransition } from "react";
import { CameraIcon } from "@/components/icons";

/**
 * يصغّر الصورة في المتصفح قبل رفعها.
 *
 * الرفع الخام لصورة هاتف حديث يعني عدة ميغابايتات لكل لحظة؛ التصغير إلى
 * ١٦٠٠ بكسل بجودة ٠٫٨ يبقيها واضحة على الشاشة ويهبط بالحجم إلى مئات
 * الكيلوبايتات، وهو الفرق بين قاعدة تتحمّل وقاعدة تنفجر.
 */
async function shrink(
  file: File,
  max: number,
  keepAlpha: boolean,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("تعذّر تجهيز الصورة");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // JPEG يمحو الشفافية بخلفيةٍ سوداء — والتميمة شعارٌ شفّاف، فتبقى PNG.
  return {
    dataUrl: keepAlpha ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.82),
    width,
    height,
  };
}

/** شروط الصورة المتحركة — تُعرض للمستخدم ويُفحص بها الملف. */
export const ANIMATED = {
  maxBytes: 3_000_000,
  minSide: 120,
  maxSide: 1024,
  rule: "GIF أو WebP متحركة · من ١٢٠×١٢٠ إلى ١٠٢٤×١٠٢٤ · حتى ٣ ميغابايت",
};

/**
 * مقاس الصورة يُقرأ بعنصر `img` لا بـ`createImageBitmap`.
 *
 * `createImageBitmap` لا يفكّ الـGIF في كل المتصفحات، فيرمي خطأً يُقرأ
 * «الصورة كبيرة» وهي ليست كبيرة — وهذا ما كان يمنع رفع صورةٍ سليمة.
 */
function measure(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("تعذّر قراءة الصورة"));
    };
    image.src = url;
  });
}

/**
 * الصورة المتحركة تُرفع بملفها لا برسمها.
 *
 * `canvas` يرسم الإطار الأول وحده، فأيّ تصغيرٍ يقتل الحركة. ولذلك يُرفع
 * الملف كما هو، ويُقاس مقاسه ليُحفظ معه.
 */
async function asIs(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
  if (file.size > ANIMATED.maxBytes) {
    throw new Error(`حجم الصورة ${(file.size / 1_000_000).toFixed(1)} ميغا — الحدّ ٣ ميغابايت.`);
  }

  const { width, height } = await measure(file);
  const side = Math.max(width, height);
  if (side > ANIMATED.maxSide) {
    throw new Error(`مقاس الصورة ${width}×${height} — الحدّ ١٠٢٤×١٠٢٤.`);
  }
  if (Math.min(width, height) < ANIMATED.minSide) {
    throw new Error(`مقاس الصورة ${width}×${height} — الأقل ١٢٠×١٢٠.`);
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("تعذّر قراءة الملف"));
    reader.readAsDataURL(file);
  });

  return { dataUrl, width, height };
}

export function ImagePicker({
  onPicked,
  maxSize = 1600,
  keepAlpha = false,
  animated = false,
  accept = "image/jpeg,image/png,image/webp",
  label,
  onError,
  className,
  children,
}: {
  /** يردّ نصّاً حين يفشل الحفظ على الخادم، فيُعرض تحت الزرّ. */
  onPicked: (
    dataUrl: string,
    width: number,
    height: number,
  ) => void | string | Promise<void | string>;
  maxSize?: number;
  /** يُبقي الشفافية (PNG): للشعارات التي تُعلَّق على صورةٍ تحتها. */
  keepAlpha?: boolean;
  /** يقبل صورةً متحركة ويرفعها بملفها — لمشتركي أثر+. */
  animated?: boolean;
  /** الصيغ المقبولة — الشعار الشفّاف لا يأتي من JPEG أصلاً. */
  accept?: string;
  label: string;
  /** يتسلّم الخطأ بدل عرضه هنا — حين يكون الزرّ قرصاً صغيراً لا مكان تحته. */
  onError?: (message: string | null) => void;
  className?: string;
  children?: React.ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [own, setOwn] = useState<string | null>(null);
  const error = onError ? null : own;
  const setError = (message: string | null) => (onError ? onError(message) : setOwn(message));

  return (
    <>
      <input
        ref={input}
        type="file"
        accept={animated ? `${accept},image/gif` : accept}
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;

          setError(null);
          const moving = animated && (file.type === "image/gif" || file.type === "image/webp");
          try {
            const image = moving ? await asIs(file) : await shrink(file, maxSize, keepAlpha);
            // الخطأ الذي يردّه الخادم يُعرض كما هو: «فشل صامت» أسوأ من رسالة.
            const said = await onPicked(image.dataUrl, image.width, image.height);
            if (typeof said === "string") setError(said);
          } catch (problem) {
            // السبب يُقال كما هو: «كبيرة» عن صورةٍ ليست كبيرة تُضيّع وقت صاحبها.
            setError(
              problem instanceof Error && problem.message
                ? problem.message
                : "تعذّر قراءة الصورة. جرّب صورة ثانية.",
            );
          }
        }}
      />
      <button
        type="button"
        aria-label={label}
        disabled={pending}
        onClick={() => input.current?.click()}
        className={className ?? "flex items-center gap-2 rounded-xl border border-line bg-card px-4 text-[13.5px] font-medium disabled:opacity-60"}
        style={className ? undefined : { height: 46 }}
      >
        {children ?? (
          <>
            <CameraIcon size={18} />
            {pending ? "نرفع…" : label}
          </>
        )}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-[12px]" style={{ color: "var(--color-live)" }}>
          {error}
        </p>
      ) : null}
    </>
  );
}
