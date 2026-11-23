import { BASE } from "@/lib/base";

/**
 * لوحةُ المود (القاعدة ٤٨٤): صورتُه تملأ أعلى البطاقة، وفوقها حجابٌ من لون شريط
 * الثيم (`--color-night`) يشتدّ نحو الأسفل فيُقرأ الوجهُ والاسمُ والعبارة.
 */
export function MoodArt({
  mood,
  text,
  className = "",
  style,
}: {
  mood: { emoji: string; name: string; color: string; mediaId: string | null };
  text: string | null;
  /** معاينةُ نافذة النشر: بحوافٍّ ونسبةٍ أعرض. */
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`relative max-h-[380px] w-full overflow-hidden ${className}`} style={{ aspectRatio: 1.25, background: mood.color, ...style }}>
      {mood.mediaId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`${BASE}/api/media/${mood.mediaId}`} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, color-mix(in srgb, var(--color-night) 12%, transparent), color-mix(in srgb, var(--color-night) 40%, transparent) 45%, color-mix(in srgb, var(--color-night) 85%, transparent))",
        }}
      />
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-[18px] text-white" style={{ textShadow: "0 1px 6px rgba(0,0,0,.35)" }}>
        <span className="text-[54px] leading-[64px]">{mood.emoji}</span>
        <span className="text-[12px] font-semibold opacity-85">مودي اليوم</span>
        <span className="font-display text-[24px] font-extrabold">{mood.name}</span>
        {text ? (
          <span dir="auto" className="text-[14.5px] leading-relaxed">
            {text}
          </span>
        ) : null}
      </div>
    </div>
  );
}
