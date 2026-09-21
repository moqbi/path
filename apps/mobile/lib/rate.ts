import { Platform } from "react-native";
import * as StoreReview from "expo-store-review";
import { getItem, setItem } from "./store";

/**
 * طلبُ التقييم في المتجرين.
 *
 * ونافذةُ النظام لا شاشةٌ نرسمها: آبل تمنع أن نسأل «أعجبك التطبيق؟»
 * ثمّ نوجّه من قال نعم وحده إلى التقييم — وهذا سببُ ردٍّ في المراجعة.
 * و`requestReview` تعرض نافذة المتجر نفسها، **ولا نعرف أظهرها النظام
 * أم لا**: آبل تسمح بثلاث مرّاتٍ في السنة وتبتلع ما زاد بصمت. فالشروط
 * هنا احتياطٌ فوق احتياط، لا استبدالٌ لحدّها.
 *
 * ولا تُطلب عند الإقلاع: من فتح التطبيق لم يُعطَ شيئاً بعد. تُطلب
 * **بعد لحظةٍ طيّبة** — نشرُ لحظةٍ اكتمل — ومن سُئل وهو يفعل شيئاً
 * أحبّه أجاب، ومن سُئل وهو يبحث عن زرّ أغلق.
 *
 * والشروط ثلاثة:
 * ١. أسبوعٌ منذ أوّل فتحٍ: من نزّل اليوم لا رأيَ له بعد.
 * ٢. ثلاثُ لحظاتٍ منشورة على الأقلّ — استعمالٌ لا زيارة.
 * ٣. أربعة أشهر منذ آخر سؤال، فلا يُسأل مرّتين في موسم.
 *
 * والفشل يُبتلع كلّه: سؤالٌ لم يُعرض لا يُعطّل نشراً تمّ.
 */
const FIRST_SEEN = "athar.rate.first";
const ASKED_AT = "athar.rate.asked";
const GOOD = "athar.rate.good";

const DAY = 86_400_000;
/** أسبوعٌ منذ أوّل فتح، وأربعةُ أشهر بين سؤالٍ وسؤال. */
const SETTLE_DAYS = 7;
const AGAIN_DAYS = 120;
/** ثلاثُ لحظاتٍ منشورة: استعمالٌ لا زيارة. */
const GOOD_TIMES = 3;

const num = async (key: string): Promise<number> => {
  const raw = await getItem(key);
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
};

/** يُنادى عند الإقلاع: يختم أوّل مرّةٍ فُتح فيها التطبيق ولا يزيد. */
export async function markFirstSeen(): Promise<void> {
  try {
    if (!(await getItem(FIRST_SEEN))) await setItem(FIRST_SEEN, String(Date.now()));
  } catch {
    // ختمٌ لم يُكتب يؤجّل السؤال لا أكثر.
  }
}

/**
 * لحظةٌ طيّبة وقعت — يُسأل إن اكتملت الشروط.
 *
 * ويُعدّ العدّاد قبل الفحص: الثالثةُ نفسها تصلح أن تكون الطلب.
 */
export async function maybeAskToRate(): Promise<void> {
  // الويب معاينةُ تطويرٍ لا متجرَ لها.
  if (Platform.OS === "web") return;

  try {
    const good = (await num(GOOD)) + 1;
    await setItem(GOOD, String(good));
    if (good < GOOD_TIMES) return;

    const first = await num(FIRST_SEEN);
    if (!first || Date.now() - first < SETTLE_DAYS * DAY) return;

    const asked = await num(ASKED_AT);
    if (asked && Date.now() - asked < AGAIN_DAYS * DAY) return;

    // `hasAction` تقول إنّ للجهاز وجهةً أصلاً — محاكٍ بلا متجرٍ ليس له.
    if (!(await StoreReview.isAvailableAsync())) return;
    if (!(await StoreReview.hasAction())) return;

    // والختمُ يُكتب قبل الطلب: نافذةٌ ابتلعها النظام لا تُعاد غداً.
    await setItem(ASKED_AT, String(Date.now()));
    await StoreReview.requestReview();
  } catch {
    // سؤالٌ لم يُعرض لا يُعطّل ما قبله.
  }
}
