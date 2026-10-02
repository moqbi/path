/**
 * «بدأ التمرير» — نداءٌ واحد تسمعه لوحاتُ التفاعل المفتوحة فتُطوى.
 *
 * من فتح لوحةً ثمّ مرّر عنها لا يريدها، والعودةُ إليها لإغلاقها ضغطةٌ لا
 * داعي لها. والقوائمُ تنادي `scrolled()` من `onScrollBeginDrag` — سحبُ
 * الإصبع وحده، لا ما تحرّكه آبل حين يصعد الكيبورد.
 */
const listeners = new Set<() => void>();

export function scrolled() {
  for (const listen of listeners) listen();
}

export function onScrolled(listen: () => void) {
  listeners.add(listen);
  return () => {
    listeners.delete(listen);
  };
}
