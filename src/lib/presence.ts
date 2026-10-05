/**
 * نسخةُ `apps/api/src/lib/presence.ts` لمشروع الجذر.
 *
 * وضعُ التخفّي (القاعدة ٢٥١): من فعّله وهو مشتركٌ في آثار+ لا يُرسَل حضورُه —
 * لا «متصل» ولا «آخر ظهور». **يُحجب في الخادم** لا في الشاشة: نسخةٌ قديمة من
 * التطبيق أو طلبٌ بيد يقرأ ما يُرسَل لا ما يُرسم.
 *
 * يمشي الردَّ كلّه: كلُّ كائنٍ فيه `lastSeenAt` و`hideOnline` يُفرَّغ حضورُه إن
 * كان صاحبُه متخفّياً ومشتركاً، و`hideOnline` نفسه لا يخرج — إعدادُ غيرك ليس
 * لك. والاشتراكُ شرطٌ لا الحقلُ وحده: من انتهى اشتراكُه يعود حضورُه ظاهراً.
 */
export function maskPresence<T>(value: T): T {
  if (Array.isArray(value)) return value.map(maskPresence) as T;
  if (!value || typeof value !== "object" || value instanceof Date) return value;
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) out[key] = maskPresence(inner);
  if ("hideOnline" in out) {
    if (out.hideOnline && out.isPlus && "lastSeenAt" in out) out.lastSeenAt = null;
    delete out.hideOnline;
  }
  return out as T;
}
