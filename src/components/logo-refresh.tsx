import { AthrMark } from "@/components/brand";

/**
 * مؤشّرُ التحديث شعارُ التطبيق (القاعدة ٣٢١) — **بقرار المالك**: العلامةُ تتنفّس
 * وقوسٌ باللمسة يدور حولها. نسخةُ `components/logo-refresh.tsx` في الجوّال.
 * ومن طلب «قلّل الحركة» يراهما ساكنين (`globals.css`).
 */
export function LogoRefresh({
  size = 32,
  turn,
}: {
  size?: number;
  /** زاويةٌ يتبعها القوسُ مع الإصبع وهو يسحب، بلا دورانٍ وحده (القاعدة ٣٤٢). */
  turn?: number;
}) {
  const held = turn !== undefined;
  return (
    <span
      role="progressbar"
      aria-label="يتم التحديث"
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <span
        className={`${held ? "" : "logo-arc "}absolute inset-0 rounded-full`}
        style={{
          transform: held ? `rotate(${turn}deg)` : undefined,
          borderWidth: Math.max(1.5, size / 16),
          borderStyle: "solid",
          borderColor: "transparent",
          borderTopColor: "var(--color-clay)",
          borderRightColor: "var(--color-clay)",
        }}
      />
      <span className={held ? "inline-flex" : "logo-breath"} style={held ? { transform: `scale(${0.8 + Math.min(1, turn / 300) * 0.2})` } : undefined}>
        <AthrMark size={Math.round(size * 0.64)} />
      </span>
    </span>
  );
}
