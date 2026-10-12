import { BASE } from "@/lib/base";
import { WithIcon } from "@/components/icons";

/** صورةُ المجموعة (القاعدة ٢٤١)، وبلاها رمزُ «مع» — كالجوّال. */
export function GroupFace({ photoMediaId, size = 48 }: { photoMediaId: string | null; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        background: photoMediaId ? `center / cover no-repeat url(${BASE}/api/media/${photoMediaId})` : "var(--color-clay-soft)",
        color: "var(--color-clay-ink)",
      }}
    >
      {photoMediaId ? null : <WithIcon size={Math.round(size * 0.48)} />}
    </span>
  );
}
