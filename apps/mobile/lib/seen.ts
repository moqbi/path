import { api } from "./api";

/**
 * «شافها» لما مرّ على الشاشة من الخطّ الزمنيّ.
 *
 * لوحةُ صاحب اللحظة تعرض من شاهدها — والجوّالُ لم يكن يُرسل مشاهدةً قطّ،
 * فالويبُ وحده يكتبها عند فتح صفحة اللحظة. والمعرّفاتُ تُجمع وتُرسل دفعةً
 * بعد لحظة: تمريرةٌ واحدة تمرّ على عشر لحظات، وعشرةُ طلباتٍ لها ضجيج.
 * وما أُرسل في هذه الجلسة لا يُعاد.
 */
const sent = new Set<string>();
let queue: string[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

export function markSeen(ids: string[]) {
  for (const id of ids) {
    if (sent.has(id)) continue;
    sent.add(id);
    queue.push(id);
  }
  if (!queue.length || timer) return;
  timer = setTimeout(() => {
    const batch = queue.slice(0, 50);
    queue = queue.slice(50);
    timer = null;
    void api("/v1/moments/seen", { method: "POST", body: JSON.stringify({ ids: batch }) }).catch(() => {
      // فشلٌ يُعيدها إلى الانتظار في التمريرة القادمة لا يُعيد المحاولة الآن.
      for (const id of batch) sent.delete(id);
    });
    if (queue.length) markSeen([]);
  }, 1200);
}
