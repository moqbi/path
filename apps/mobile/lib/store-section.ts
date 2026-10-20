import { create } from "zustand";

/**
 * قسمُ المتجر الذي فُتح بـ«عرض الكل» (القاعدة ٣١٠): عنوانُه ومعرّفاتُ أصنافه
 * تُسلَّم إلى صفحته في الذاكرة لا في العنوان — عشراتُ المعرّفات لا تُكتب رابطاً.
 * والأصنافُ نفسُها تُقرأ في الصفحة من استعلام المتجر، فيبقى الملكُ واللبسُ حيّين.
 */
export const useStoreSection = create<{ title: string; ids: string[] }>(() => ({ title: "", ids: [] }));

export function openStoreSection(title: string, ids: string[]) {
  useStoreSection.setState({ title, ids });
}
