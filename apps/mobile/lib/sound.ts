import { AccessibilityInfo } from "react-native";
import { Audio } from "expo-av";

/**
 * نغمات الواجهة.
 *
 * في الويب تُركَّب بـWebAudio بلا ملف (القاعدة ٣٦)، ولا WebAudio هنا —
 * فالموجات نفسها وُلِّدت بنفس المعادلة وحُفظت ملفّات: `refresh.wav`
 * و`open.wav` و`close.wav`، اثنا عشر كيلوبايت لكلٍّ منها. وهي النغمات
 * ذاتها لا بديلٌ عنها، فلا يختلف صوتُ الفعل الواحد بين جهازٍ ومتصفّح.
 *
 * وكانت نغمةً واحدة (`tap.wav`) لكلّ شيء — للتحديث ولفتح القوس
 * ولإغلاقه سواء — فلا تقول الأذن أيَّ فعلٍ وقع.
 *
 * وكلٌّ تُحمَّل مرّةً وتُعاد من مكانها (`replayAsync`) لا تُنشأ مع كل
 * ضغطة: إنشاءٌ في كل مرّة يتأخّر عن الإصبع فيُسمع بعد الفعل لا معه.
 *
 * **ولا يتداخل صوتان**: الجديد يُوقف ما قبله قبل أن يبدأ، ومعه فاصلٌ
 * أدنى (٦٠ مللي) يمنع ضغطتين في وميضٍ واحد من أن تُسمعا صوتين فوق
 * بعضهما.
 *
 * وإذا طلب الجهاز «قلّل الحركة» سكتنا — من يطلب هدوء الحركة يطلب هدوء
 * الصوت معه. والفشل يُبتلع: نغمةٌ لا تُسمع لا تُعطّل شاشة.
 */
type Cue = "refresh" | "open" | "close";

const FILES: Record<Cue, number> = {
  refresh: require("../assets/refresh.wav"),
  open: require("../assets/open.wav"),
  close: require("../assets/close.wav"),
};

const loaded: Partial<Record<Cue, Audio.Sound>> = {};
const loading: Partial<Record<Cue, Promise<void>>> = {};

/** آخر صوتٍ انطلق — يُوقَف قبل الذي بعده فلا يركبان. */
let playing: Audio.Sound | null = null;
let last = 0;
const GAP = 60;

let quiet: boolean | null = null;

async function ready(cue: Cue): Promise<Audio.Sound | null> {
  if (quiet === null) {
    quiet = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
  }
  if (quiet) return null;

  if (!loaded[cue] && !loading[cue]) {
    loading[cue] = (async () => {
      // صامتٌ مع مفتاح الصامت في آيفون: نغمةُ واجهةٍ لا موسيقى.
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: false });
      const made = await Audio.Sound.createAsync(FILES[cue], { volume: 0.35 });
      loaded[cue] = made.sound;
    })().catch(() => undefined);
  }

  await loading[cue];
  return loaded[cue] ?? null;
}

function play(cue: Cue): void {
  const now = Date.now();
  if (now - last < GAP) return;
  last = now;

  void ready(cue)
    .then(async (one) => {
      if (!one) return;
      // إيقافُ السابق أوّلاً: نغمتان معاً تُسمعان ضجيجاً لا مؤثّراً.
      if (playing && playing !== one) await playing.stopAsync().catch(() => undefined);
      playing = one;
      await one.replayAsync();
    })
    .catch(() => undefined);
}

/** يُسمع عند إفلات السحب للتحديث وعند ضغط زرّ التحديث — الفعل واحد. */
export function playRefresh(): void {
  play("refresh");
}

/** فتح قوس النشر. */
export function playOpen(): void {
  play("open");
}

/** إغلاقه. */
export function playClose(): void {
  play("close");
}

/** نقرةٌ عامّة لما ليس فتحاً ولا إغلاقاً ولا تحديثاً — كغالق الكاميرا. */
export function tap(): void {
  play("open");
}
