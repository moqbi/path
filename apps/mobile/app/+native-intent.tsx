/**
 * رابطُ المشاركة (`athar://dataUrl=…`) ليس مساراً في التطبيق: يحمله `expo-share-intent`
 * إلى `useShareIn` (القاعدة ٣٠٦)، والموجّهُ لو قرأه لفتح «غير موجود». فيُصرف إلى
 * اللحظات وتُفتح شاشةُ النشر فوقها، وما سواه يمضي كما هو.
 */
import { queuePush, readPushUrl } from "../lib/push-open";

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (path.includes("dataUrl=")) return "/";
  // ضغطةُ تنبيه هواوي (القاعدة ٤٤٦): تُفتح بمنطق ضغطة التنبيه في الجذر.
  const push = readPushUrl(path);
  if (push) {
    queuePush(push);
    return "/";
  }
  return path;
}
