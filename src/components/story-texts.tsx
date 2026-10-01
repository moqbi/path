/**
 * نصوصُ القصة على الويب — للعرض وحده، والكتابةُ في التطبيق.
 *
 * الموضعُ نسبةٌ من اللوحة، والمقاسُ بنقاطِ شاشةٍ عرضُها ٣٩٠ — فيُرسم هنا
 * بوحدة عرض الحاوية (`cqw`) ويكبر ويصغر معها بلا قياسٍ في جافاسكربت.
 * ونسخةُ الثوابت من `packages/shared` لأنّ مشروع الجذر لا يرى الحزم.
 */
export type StoryText = { t: string; x: number; y: number; size: number; color: string; bg?: boolean };

const BASE = 390;

export function StoryTexts({ texts }: { texts: StoryText[] | null | undefined }) {
  if (!texts?.length) return null;
  return (
    <div className="pointer-events-none absolute inset-0" style={{ containerType: "inline-size" }}>
      {texts.map((item, i) => (
        <span
          key={i}
          dir="auto"
          className="absolute whitespace-pre-wrap text-center font-bold"
          style={{
            left: `${item.x * 100}%`,
            top: `${item.y * 100}%`,
            transform: "translate(-50%, -50%)",
            maxWidth: "90%",
            width: "max-content",
            color: item.color,
            fontSize: `${(item.size / BASE) * 100}cqw`,
            lineHeight: 1.35,
            padding: item.bg ? `${(4 / BASE) * 100}cqw ${(10 / BASE) * 100}cqw` : 0,
            borderRadius: `${(10 / BASE) * 100}cqw`,
            background: item.bg ? (item.color === "#0E1A24" ? "rgba(255,255,255,.85)" : "rgba(14,26,36,.62)") : "transparent",
            textShadow: item.bg ? "none" : "0 1px 4px rgba(0,0,0,.45)",
          }}
        >
          {item.t}
        </span>
      ))}
    </div>
  );
}
