/**
 * رابطُ المشاركة (`athar://dataUrl=…`) ليس مساراً في التطبيق: يحمله `expo-share-intent`
 * إلى `useShareIn` (القاعدة ٣٠٦)، والموجّهُ لو قرأه لفتح «غير موجود». فيُصرف إلى
 * اللحظات وتُفتح شاشةُ النشر فوقها، وما سواه يمضي كما هو.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (path.includes("dataUrl=")) return "/";
  return path;
}
