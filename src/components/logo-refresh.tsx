import { AthrMark } from "@/components/brand";

/**
 * مؤشّرُ التحديث شعارُ التطبيق (القاعدة ٣٢١) — **بقرار المالك**: العلامةُ تتنفّس
 * وقوسٌ باللمسة يدور حولها. نسخةُ `components/logo-refresh.tsx` في الجوّال.
 * ومن طلب «قلّل الحركة» يراهما ساكنين (`globals.css`).
 */
export function LogoRefresh({
  size = 32,
  held = false,
}: {
  size?: number;
  /**
   * الإصبعُ يسحب ولم يُفلت: **العلامةُ ثابتةٌ والقوسُ وحده يدور** (القاعدة ٣٤٧) —
   * **بقرار المالك**: كان الشعارُ كلُّه يدور مع الإصبع. وتتنفّس العلامةُ مع الجلب وحده.
   */
  held?: boolean;
}) {
  return (
    <span
      role="progressbar"
      aria-label="يتم التحديث"
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <span
        className="logo-arc absolute inset-0 rounded-full"
        style={{
          borderWidth: Math.max(1.5, size / 16),
          borderStyle: "solid",
          borderColor: "transparent",
          borderTopColor: "var(--color-clay)",
          borderRightColor: "var(--color-clay)",
        }}
      />
      <span className={held ? "inline-flex" : "logo-breath"}>
        <AthrMark size={Math.round(size * 0.64)} />
      </span>
    </span>
  );
}
