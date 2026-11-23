/**
 * حالُ تذكرة الدعم وما يُسمح فيها (القاعدة ٤٨٠) — نسختُه في الخادم
 * (`apps/api/src/services/profile.ts` ← `ticketState`) واللوحة.
 */
export type TicketState = "open" | "answered" | "closed" | "locked";

export function ticketState(closed: boolean, lockedAt: Date | null, lastFromStaff: boolean | null): TicketState {
  if (lockedAt) return "locked";
  if (closed) return "closed";
  return lastFromStaff ? "answered" : "open";
}

export const TICKET_STATE_LABEL: Record<TicketState, string> = {
  open: "قيد المراجعة",
  answered: "رُدّ عليها",
  closed: "مغلقة",
  locked: "مغلقة نهائياً",
};

/**
 * يعلّق صاحبُها بعد ردّ الموظّف وحده، والمغلقةُ تُفتح بتعليقه، والنهائيّةُ لا.
 * والقاعدةُ نفسُها في الشاشة وفي الإجراء — الشاشةُ تُخفي الحقل والإجراءُ يردّ.
 */
export function canComment(
  lockedAt: Date | null,
  closed: boolean,
  lastFromStaff: boolean | null,
): { ok: true } | { ok: false; why: string } {
  if (lockedAt) return { ok: false, why: "أُغلق هذا الطلب نهائياً — اكتب طلباً جديداً إن احتجت" };
  if (lastFromStaff === null) return { ok: false, why: "تقدر تعلّق بعد ردّ فريق الدعم" };
  if (!lastFromStaff && !closed) return { ok: false, why: "وصلنا تعليقك — انتظر الردّ عليه" };
  return { ok: true };
}
