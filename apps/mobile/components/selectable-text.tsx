import { useRef } from "react";
import { Platform, type TextStyle, type StyleProp } from "react-native";
import { Text, TextInput } from "./type";
import { DEV_FEATURES } from "../lib/dev-features";

/**
 * نصٌّ يُحدَّد ويُنسخ بقائمة آبل كاملةً (القاعدة ٣٦٦): نسخ، وتحديد الكل،
 * وترجمة، وبحث، ومشاركة — بالضغط المطوّل، ومعه مقبضا التحديد.
 *
 * **`selectable` على `Text` لا يكفي في آبل**: في المعمارية الجديدة
 * (`RCTParagraphComponentView`) يفتح قائمةً فيها «نسخ» وحدها للنصّ كلّه، بلا
 * مقابض ولا ترجمة. فالنصُّ هنا حقلٌ لا يُكتب فيه (`editable={false}`) — وهو
 * `UITextView` يملك قائمةَ النظام كلَّها — بلا وحدةٍ أصليّة، فيصل بتحديث.
 * وأندرويد على `Text selectable`: قائمتُه هناك قائمةُ النظام كاملة.
 *
 * **والنقرةُ تبقى نقرة** (`onTap`): الحقلُ يأخذ اللمسة من الغلاف تحته، فتُقاس
 * النقرةُ بنفسها — نزولٌ ورفعٌ في أقلّ من ربع ثانية — والضغطُ المطوّل للتحديد.
 * في نسخة التطوير وحدها (القاعدة ٢٩١)، والإنتاجُ على `Text` كما كان.
 */
export function SelectableText({
  text,
  style,
  onTap,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  onTap?: () => void;
}) {
  const downAt = useRef(0);

  if (!DEV_FEATURES) {
    return <Text style={style}>{text}</Text>;
  }

  if (Platform.OS !== "ios") {
    return (
      <Text selectable style={style} onPress={onTap} suppressHighlighting>
        {text}
      </Text>
    );
  }

  return (
    <TextInput
      value={text}
      editable={false}
      multiline
      scrollEnabled={false}
      // حقلٌ للقراءة: لا لوحةَ مفاتيح ولا تصحيحَ ولا روابطُ تفتح سفاري (القاعدة ٦٢).
      dataDetectorTypes="none"
      onPressIn={() => {
        downAt.current = Date.now();
      }}
      onPressOut={() => {
        if (onTap && Date.now() - downAt.current < 250) onTap();
      }}
      style={[style, { paddingTop: 0, paddingBottom: 0, paddingHorizontal: 0, backgroundColor: "transparent" }]}
    />
  );
}
