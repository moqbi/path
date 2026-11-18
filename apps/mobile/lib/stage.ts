import { useWindowDimensions } from "react-native";

/**
 * مسرحُ القصّة والكاميرا: لوحةٌ رأسيّة بنسبة الجوّال (القاعدة ٤٦٨).
 *
 * القصّةُ تُكتب وتُقرأ على لوحةٍ رأسيّة — مواضعُ نصوصها وملصقاتها نسبةٌ منها
 * (القاعدة ٢٠٥) — فعلى الشاشة الأفقيّة (آيفون مُدار، آيباد أفقيّ، جوّالٌ قابلٌ للطيّ
 * مفتوحاً) تُرسم لوحةً رأسيّةً في الوسط بارتفاع الشاشة، لا ممدودةً بعرضها فتُقصّ
 * الصورةُ وتتبعثر النصوص. وعلى الشاشة الرأسيّة هي الشاشةُ نفسُها.
 *
 * و`cramped`: لوحةٌ أضيقُ من ٣٢٠ — آيفون مُدار — لا تتّسع لأدوات المحرّر والكاميرا،
 * فتلك تطلب أن يُدار الجوّالُ عموديّاً بدل أن ترصّ أدواتها فوق بعضها.
 */
export const STAGE_RATIO = 9 / 16;

export type Stage = { width: number; height: number; window: { width: number; height: number }; cramped: boolean };

export function stageOf(width: number, height: number): Stage {
  const narrow = Math.round(height * STAGE_RATIO);
  const w = width / height > 0.75 ? Math.min(width, narrow) : width;
  return { width: w, height, window: { width, height }, cramped: w < 320 };
}

export function useStage(): Stage {
  const { width, height } = useWindowDimensions();
  return stageOf(width, height);
}

/**
 * `Modal` في آبل رأسيٌّ ما لم يُقل غيرُه: نافذةٌ تُفتح على آيفون مُدار أو آيباد أفقيّ
 * تُدير الشاشةَ كلّها قائمةً. فكلُّ `Modal` يحمل الاتجاهات كلّها، والنظامُ يأخذ منها
 * ما يسمح به الجهاز (القاعدة ٤٦٨).
 */
export const ORIENTATIONS: ("portrait" | "portrait-upside-down" | "landscape-left" | "landscape-right")[] = [
  "portrait",
  "portrait-upside-down",
  "landscape-left",
  "landscape-right",
];

/**
 * لوحٌ من الأسفل على الشاشة العريضة والمُدارة (القاعدة ٤٦٨): بعرض ٥٢٠ في الوسط وحوافّه
 * الأربع مستديرة، لا شريطٌ بعرض الآيباد أو الآيفون المُدار. وعلى الجوّال قائماً لا شيء.
 */
export function useSheetBox(): Record<string, number | string> {
  const { width, height } = useWindowDimensions();
  if (!(width > height || width >= 700)) return {};
  return {
    width: Math.min(width - 32, 520),
    alignSelf: "center",
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    marginBottom: 12,
  };
}
