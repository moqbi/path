import { forwardRef } from "react";
import {
  Text as RNText,
  TextInput as RNTextInput,
  StyleSheet,
  type TextProps as RNTextProps,
  type TextInputProps as RNTextInputProps,
  type TextStyle,
} from "react-native";
import { familyOf, type Face } from "../theme/fonts";

/**
 * كلّ نصٍّ في التطبيق يمرّ من هنا.
 *
 * السبب في `theme/fonts.ts`: العائلة المحمّلة بـ`useFonts` وزنٌ واحد،
 * فـ`fontWeight: "700"` فوقها لا يجلب الملفّ الثقيل — يتركه أندرويد
 * عادياً أو يصطنع عرضاً رديئاً. فيُترجَم الوزن هنا إلى اسم عائلة،
 * و**يُحذف `fontWeight`** بعدها حتى لا يصطنع الجهازُ شيئاً فوق ما رُسم.
 *
 * ومكانه غلافٌ واحد لا تعديلٌ في ستّين ملفاً: النمط في الشاشات مكتوبٌ
 * بـ`fontWeight` منذ بُني، وإعادةُ كتابته تعني نسيانَ موضعٍ أو موضعين
 * يبقيان بخطّ النظام فيُقرآن من تطبيقٍ آخر.
 *
 * و`face` يختار الوجه: المتن افتراضاً، و«display» للعناوين (Tajawal)،
 * و«latin» لما يُكتب بالحروف اللاتينية (Montserrat) — كصنف `.latin` في
 * الويب حرفاً بحرف.
 */
export type TextProps = RNTextProps & { face?: Face };

/**
 * ومعه اتّجاهُ النصّ.
 *
 * `swapLeftAndRightInRTL(false)` يمنع React Native من قلب `textAlign`
 * من نفسه (وهو لازمٌ: الشجرة مكتوبةٌ على مقاس الويب — انظر «اتجاه
 * التطبيق على الجوّال»)، لكنّه يُبقي `textAlign` الافتراضيّ على
 * اليسار. فخرج التطبيق كلّه على الجهاز بنصوصٍ من اليسار، والمعاينةُ
 * على الويب تعرضها يميناً لأنّ `direction: rtl` في CSS يُحاذي بنفسه.
 *
 * فالافتراضُ هنا **يمينٌ**، ولا يُكتب إلا حين لا يذكره النمط: ما كُتب
 * فيه `center` أو `left` يبقى كما كُتب. ومعه `writingDirection` فتُقرأ
 * الأرقامُ وعلاماتُ الترقيم في موضعها من السطر العربيّ.
 *
 * ومكانه هذا الغلاف لا ستّون ملفّاً: كلُّ نصٍّ يمرّ من هنا أصلاً.
 */
function paint(style: unknown, face: Face): TextStyle {
  const flat = (StyleSheet.flatten(style as never) ?? {}) as TextStyle;
  return {
    textAlign: "right",
    writingDirection: "rtl",
    ...flat,
    fontFamily: familyOf(face, flat.fontWeight),
    fontWeight: undefined,
  };
}

export const Text = forwardRef<RNText, TextProps>(function Text(
  { face = "body", style, ...rest },
  ref,
) {
  return <RNText ref={ref} {...rest} style={paint(style, face)} />;
});

export type TextInputProps = RNTextInputProps & { face?: Face };

/** وحقل الكتابة مثله: حقلٌ بخطّ النظام داخل شاشةٍ بخطّ العلامة يُرى دخيلاً. */
export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput(
  { face = "body", style, ...rest },
  ref,
) {
  return <RNTextInput ref={ref} {...rest} style={paint(style, face)} />;
});
