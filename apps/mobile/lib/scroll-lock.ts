import { create } from "zustand";

/**
 * قفلُ تمرير القائمة ما دام شيءٌ فيها يُسحب أفقياً — صورُ اللحظة متعدّدة الصور
 * (`PhotoCarousel`). تمريرُ آبل الأصليّ لا يسأل مستجيبَ جافاسكربت، فيأخذ ما مال
 * من السحبة فتتحرّك الشاشةُ كلُّها والصورُ معها (كالقاعدة ١٦١ في صفوف السحب).
 */
export const useScrollLock = create<{ locked: boolean }>(() => ({ locked: false }));
export const lockScroll = (locked: boolean) => {
  if (useScrollLock.getState().locked !== locked) useScrollLock.setState({ locked });
};
