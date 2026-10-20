import { create } from "zustand";

/** قسمٌ في صفحة «عرض الكل»: عنوانُه ومعرّفاتُ أصنافه بترتيبها. */
export type StoreSectionPart = { title: string; ids: string[] };

/**
 * قسمُ المتجر الذي فُتح بـ«عرض الكل» (القاعدة ٣١٠): عنوانُه وأقسامُه — مجموعةً مجموعة
 * حين يكون نوعاً (القاعدة ٣١٣) — تُسلَّم إلى صفحته في الذاكرة لا في العنوان: عشراتُ
 * المعرّفات لا تُكتب رابطاً. والأصنافُ نفسُها تُقرأ في الصفحة من استعلام المتجر، فيبقى
 * الملكُ واللبسُ حيّين.
 */
export const useStoreSection = create<{ title: string; parts: StoreSectionPart[] }>(() => ({ title: "", parts: [] }));

export function openStoreSection(title: string, parts: StoreSectionPart[]) {
  useStoreSection.setState({ title, parts });
}
