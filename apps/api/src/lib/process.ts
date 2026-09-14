import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";

const run = promisify(execFile);

/**
 * معالجة ما رُفع على الخادم.
 *
 * الغرض الأول خصوصية لا جودة: صورة الجوّال تحمل في بياناتها الوصفية
 * إحداثيات التقاطها. ومستخدمٌ أطفأ «إظهار موقعي» ثم نشر صورةً كان
 * موقعُه يخرج معها رغم ذلك — فالبيانات الوصفية تُنزع هنا نزعاً، لا
 * يُعتمد على أن يفعل ذلك العميل.
 *
 * والغرض الثاني أن المقاس يُقرأ من البكسلات لا من كلام العميل: رقمٌ في
 * الطلب يُكتب بما شاء كاتبه.
 */

/** أقصى ضلعٍ للصورة المخزَّنة. ما فوقه يُصغَّر: لا شاشة تعرض أكثر. */
const MAX_SIDE = 1600;

export type Processed = {
  bytes: Uint8Array;
  mime: string;
  width: number;
  height: number;
};

/**
 * صورةٌ ثابتة: تُقرأ وتُنزع بياناتها وتُعاد كتابتها.
 *
 * `rotate()` بلا وسيط تطبّق دوران EXIF ثم تُسقطه — وإلا ظهرت الصورة
 * مقلوبةً بعد نزع البيانات. و`withMetadata` لا تُستدعى: الافتراض في
 * sharp ألّا تُكتب البيانات الوصفية، وهو المطلوب.
 */
export async function processImage(input: Uint8Array, mime: string): Promise<Processed> {
  const image = sharp(Buffer.from(input), { failOn: "error" }).rotate();
  const meta = await image.metadata();
  if (!meta.width || !meta.height) throw new Error("تعذّرت قراءة الصورة");

  const big = Math.max(meta.width, meta.height) > MAX_SIDE;
  const pipeline = big ? image.resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside" }) : image;

  // PNG يبقى PNG (الشفافية)، وما عداه يُكتب WebP: أصغر بنفس الوضوح.
  const out =
    mime === "image/png"
      ? await pipeline.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true })
      : await pipeline.webp({ quality: 82 }).toBuffer({ resolveWithObject: true });

  return {
    bytes: new Uint8Array(out.data),
    mime: mime === "image/png" ? "image/png" : "image/webp",
    width: out.info.width,
    height: out.info.height,
  };
}

/**
 * مقاس الصورة المتحركة بلا إعادة ترميز.
 *
 * المتحركة تُترك كما هي: إعادة كتابتها تكسر حلقتها أو تضاعف حجمها،
 * والمطلوب منها المقاس وحده — وهو يُقرأ من رأس الملف.
 */
export async function measure(input: Uint8Array): Promise<{ width: number; height: number }> {
  const meta = await sharp(Buffer.from(input), { animated: true }).metadata();
  if (!meta.width || !meta.height) throw new Error("تعذّرت قراءة الصورة");
  // ارتفاع المتحركة في sharp مجموع إطاراتها: الإطار الواحد هو المقاس.
  const height = meta.pages && meta.pages > 1 ? Math.round(meta.height / meta.pages) : meta.height;
  return { width: meta.width, height };
}

/** مدّة المقطع وأبعاده — من الملف لا من كلام العميل. */
export type Clip = { seconds: number; width: number; height: number };

/**
 * يقرأ المقطع بـffprobe.
 *
 * المدّة تُفحص على الخادم لأن الحدّ منتَج لا تجميل: عشرون ثانية للقصّة،
 * وعشرون للرسالة الصوتية ومئةٌ وعشرون لمشتركي أثر+. ورقمٌ يُرسله العميل
 * ليس حدّاً.
 */
export async function probeClip(input: Uint8Array, extension: string): Promise<Clip> {
  const folder = await mkdtemp(join(tmpdir(), "athr-"));
  const path = join(folder, `clip.${extension}`);
  try {
    await writeFile(path, input);
    const { stdout } = await run("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration:stream=width,height",
      "-of", "json",
      path,
    ]);
    const data = JSON.parse(stdout) as {
      format?: { duration?: string };
      streams?: { width?: number; height?: number }[];
    };
    const visual = data.streams?.find((stream) => stream.width && stream.height);
    return {
      seconds: Math.ceil(Number(data.format?.duration ?? 0)),
      width: visual?.width ?? 0,
      height: visual?.height ?? 0,
    };
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}
