import type { WSContext } from "hono/ws";

/**
 * من هو متصلٌ الآن.
 *
 * الرسالة تُدفع إلى المستلم إن كان على الخط، وتُحفظ في القاعدة دائماً:
 * الدفع تسريعٌ لا تخزين. ومن أغلق التطبيق يقرأها حين يفتحه.
 *
 * وجهازٌ واحدٌ لا يكفي: قد يكون الشخص على الجوّال والحاسوب معاً، فلكلّ
 * مستخدمٍ مجموعةُ وصلات لا وصلة.
 *
 * وهذا في ذاكرة العملية: خادمٌ واحد يكفي اليوم. ويوم يصير خادمين يوضع
 * Redis مكان هذا الملف وحده — البقية لا تتغيّر لأنها لا تعرف كيف يصل.
 */
type Socket = WSContext<unknown>;

const live = new Map<string, Set<Socket>>();

export function join(userId: string, socket: Socket): void {
  const sockets = live.get(userId) ?? new Set<Socket>();
  sockets.add(socket);
  live.set(userId, sockets);
}

export function leave(userId: string, socket: Socket): void {
  const sockets = live.get(userId);
  if (!sockets) return;
  sockets.delete(socket);
  if (sockets.size === 0) live.delete(userId);
}

export const isOnline = (userId: string): boolean => (live.get(userId)?.size ?? 0) > 0;

/**
 * يدفع حدثاً إلى كل وصلات شخص.
 *
 * والفشل لا يُرمى: وصلةٌ ماتت في الطريق لا تُفشل إرسال رسالةٍ حُفظت
 * فعلاً — تُنزع وحدها ويمضي الباقي.
 */
export function push(userId: string, event: string, data: unknown): void {
  const sockets = live.get(userId);
  if (!sockets) return;

  const payload = JSON.stringify({ event, data });
  for (const socket of sockets) {
    try {
      socket.send(payload);
    } catch {
      sockets.delete(socket);
    }
  }
  if (sockets.size === 0) live.delete(userId);
}

/** يدفع إلى الطرفين معاً — الصدى إلى المرسل يُزامن أجهزته الأخرى. */
export function pushBoth(a: string, b: string, event: string, data: unknown): void {
  push(a, event, data);
  if (a !== b) push(b, event, data);
}
