import { Linking } from "react-native";
import { api } from "./api";
import { deleteItem, getItem, setItem } from "./store";

/**
 * الدعوةُ بالرابط وحده (القاعدة ٢٤٣) — بقرار المالك: لا حقلَ يُكتب فيه رقمُ
 * الداعي، فمن يُنشئ حساباتٍ وهميّة لا يكتب فيها رقمَ حسابه الأساسيّ.
 *
 * رابطُ الملف `/u/<رقم العضوية>` يفتح التطبيق (القاعدة ٢٢٥)، فيُحفظ صاحبُه
 * هنا قبل أن يُسجَّل — وأوّلُ رابطٍ يبقى: من دعاك هو من أوصلك أوّلاً. ثمّ
 * بعد الدخول يُرسَل مرّةً ويُمحى، والخادمُ يقبله لحسابٍ عمرُه أسبوع بلا داعٍ
 * ويردّ ما سواه بصمت.
 */
const KEY = "athr.ref";

function memberNoOf(url: string | null): number | null {
  const match = url?.match(/\/u\/(\d{1,9})(?:[/?#]|$)/);
  return match ? Number(match[1]) : null;
}

async function remember(url: string | null) {
  const no = memberNoOf(url);
  if (!no) return;
  const kept = await getItem(KEY).catch(() => null);
  if (!kept) await setItem(KEY, String(no)).catch(() => {});
}

/** يلتقط رابط الإقلاع وما يصل بعده — يُنادى مرّةً من الجذر. */
export function watchInviteLinks(): () => void {
  void Linking.getInitialURL().then(remember).catch(() => {});
  const sub = Linking.addEventListener("url", ({ url }) => void remember(url));
  return () => sub.remove();
}

/** رقمُ الداعي المحفوظ — للتسجيل بالبريد قبل أن يوجد الحساب. */
export async function savedInviter(): Promise<number | undefined> {
  const kept = await getItem(KEY).catch(() => null);
  const no = Number(kept);
  return kept && Number.isInteger(no) && no > 0 ? no : undefined;
}

/** بعد الدخول: يُرسَل الداعي مرّةً ويُمحى، قُبل أو رُدّ. */
export async function claimSavedInviter(): Promise<void> {
  const no = await savedInviter();
  if (!no) return;
  await api("/v1/invites/claim", { method: "POST", body: JSON.stringify({ memberNo: no }) }).catch(() => {});
  await deleteItem(KEY).catch(() => {});
}
