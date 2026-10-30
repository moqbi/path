import { prisma } from "@athar/db";
import { INTERESTS, interestIndex, type InterestGroup, type InterestInfo } from "@athar/shared";

/**
 * قائمةُ الاهتمامات الحيّة (القاعدة ٣٧٥): تصنيفاتٌ وبنودٌ تُدار من اللوحة. تُقرأ
 * من القاعدة وتُحفظ دقيقةً في الذاكرة — اللوحةُ مشروعٌ آخر لا يستطيع أن يمسح
 * هذه الخبيئة، فتعديلُها يصل خلال دقيقة. وقاعدةٌ فارغة أو متعثّرة تعود إلى
 * القائمة المكتوبة في `@athar/shared`، فلا تسقط شاشةُ الاختيار.
 */
const TTL = 60_000;
let cached: { at: number; groups: InterestGroup[]; index: Map<string, InterestInfo> } | null = null;

export async function interestCatalog() {
  if (cached && Date.now() - cached.at < TTL) return cached;
  let groups: InterestGroup[] = INTERESTS;
  try {
    const rows = await prisma.interestGroup.findMany({
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      include: { items: { orderBy: [{ sortOrder: "asc" }, { label: "asc" }], select: { id: true, label: true } } },
    });
    if (rows.length) groups = rows.map(({ id, emoji, label, items }) => ({ id, emoji, label, items })).filter((g) => g.items.length);
  } catch (error) {
    console.error("[الاهتمامات] تعذّرت القراءة، والقائمةُ المكتوبة احتياط", error);
  }
  cached = { at: Date.now(), groups, index: interestIndex(groups) };
  return cached;
}
