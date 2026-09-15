import { AccessibilityInfo } from "react-native";
import { Audio } from "expo-av";

/**
 * نغمة اللمسة.
 *
 * في الويب تُركَّب بـWebAudio بلا ملف (القاعدة ٣٦)، ولا WebAudio هنا —
 * فالموجة نفسها (٨٨٠ هرتز تخفت في عُشر ثانية) وُلِّدت مرّةً وحُفظت في
 * `assets/tap.wav`: ثمانيةُ كيلوبايت، وهي نفس النغمة لا بديلٌ عنها.
 *
 * وتُحمَّل مرّةً وتُعاد من مكانها (`replayAsync`) لا تُنشأ مع كل ضغطة:
 * إنشاءٌ في كل مرّة يتأخّر عن الإصبع فيُسمع بعد الفعل لا معه.
 *
 * وإذا طلب الجهاز «قلّل الحركة» سكتنا — من يطلب هدوء الحركة يطلب هدوء
 * الصوت معه. والفشل يُبتلع: نغمةٌ لا تُسمع لا تُعطّل شاشة.
 */
let sound: Audio.Sound | null = null;
let loading: Promise<void> | null = null;
let quiet: boolean | null = null;

async function ready(): Promise<Audio.Sound | null> {
  if (quiet === null) {
    quiet = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
  }
  if (quiet) return null;

  if (!sound && !loading) {
    loading = (async () => {
      // صامتٌ مع مفتاح الصامت في آيفون: نغمةُ واجهةٍ لا موسيقى.
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: false });
      const made = await Audio.Sound.createAsync(require("../assets/tap.wav"), {
        volume: 0.35,
      });
      sound = made.sound;
    })().catch(() => undefined);
  }

  await loading;
  return sound;
}

/** يُسمع عند إفلات السحب للتحديث، وعند فتح قوس النشر وإغلاقه. */
export function tap(): void {
  void ready()
    .then((one) => one?.replayAsync())
    .catch(() => undefined);
}
