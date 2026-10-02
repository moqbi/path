import { onScrolled } from "./scrolled";

/**
 * صفٌّ مسحوبٌ واحدٌ مفتوح في التطبيق كلّه (القاعدة ٢١٣).
 *
 * كانت الأزرارُ المكشوفة تبقى ثابتةً والقائمةُ تمرّ تحتها، وضغطةٌ في مكانٍ آخر
 * لا تطويها — فيبقى «حظر» أحمرُ مكشوفاً تحت إصبعٍ ذهب يقرأ. فالصفُّ المفتوح
 * يُسجَّل هنا، ويُطوى إذا فُتح غيرُه، أو بدأ التمرير، أو لُمست الشاشة خارجه.
 */
type Row = {
  close: () => void;
  /** حدودُ الصفّ في النافذة ساعةَ انفتح — اللمسةُ داخلها تخصّه. */
  rect: { x: number; y: number; width: number; height: number } | null;
};

let current: Row | null = null;

export function claimOpen(row: Row) {
  if (current && current !== row) current.close();
  current = row;
}

export function releaseOpen(row: Row) {
  if (current === row) current = null;
}

/** يطوي المفتوحَ إلّا أن تكون اللمسةُ داخله — أزرارُه تُضغط ولا تطويه قبل فعلها. */
export function dismissOpen(x?: number, y?: number) {
  const row = current;
  if (!row) return;
  const rect = row.rect;
  if (
    x !== undefined &&
    y !== undefined &&
    rect &&
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  ) {
    return;
  }
  current = null;
  row.close();
}

onScrolled(() => dismissOpen());
