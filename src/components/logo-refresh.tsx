import { AthrMark } from "@/components/brand";

/**
 * مؤشّرُ التحديث شعارُ التطبيق (القاعدة ٣٢١) — **بقرار المالك**: العلامةُ تتنفّس
 * وقوسٌ باللمسة يدور حولها. نسخةُ `components/logo-refresh.tsx` في الجوّال.
 * ومن طلب «قلّل الحركة» يراهما ساكنين (`globals.css`).
 */
export function LogoRefresh({ size = 32 }: { size?: number }) {
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
      <span className="logo-breath">
        <AthrMark size={Math.round(size * 0.64)} />
      </span>
    </span>
  );
}
