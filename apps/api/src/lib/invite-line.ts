/**
 * سطرُ برنامج الدعوات (القاعدة ٢٤٣) — في الجرس والإشعار ونافذة المشاركة.
 * نسختُه في الويب `src/lib/invite-line.ts` حرفاً بحرف.
 */
export function inviteLine(every: number, coins: number) {
  const n = (v: number) => v.toLocaleString("ar-SA");
  return `كل ${n(every)} أصدقاء يسجّلون برقم عضويتك وينشرون أوّل لحظة = ${n(coins)} نقطة لك`;
}
