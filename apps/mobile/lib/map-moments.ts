import { create } from "zustand";

/**
 * «عرض جميع لحظاتي في …» من «خريطتي» (القاعدة ٣٨٤): العنوانُ ومعرّفاتُ اللحظات تُسلَّم إلى
 * صفحتها في الذاكرة لا في الرابط — مئاتُ المعرّفات لا تُكتب عنواناً (كالقاعدة ٣١٠).
 */
export const useMapMoments = create<{ title: string; ids: string[] }>(() => ({ title: "", ids: [] }));

export function openMapMoments(title: string, ids: string[]) {
  useMapMoments.setState({ title, ids });
}
