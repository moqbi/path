import { useEffect, useRef } from "react";
import { Platform, type TextStyle, type StyleProp } from "react-native";
import { Text, TextInput } from "./type";
import { DEV_FEATURES } from "../lib/dev-features";
import { onScrolled } from "../lib/scrolled";

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
 *
 * **وسحبةٌ تبدأ من النصّ ليست نقرة** (القاعدة ٣٧٢): القائمةُ تأخذ اللمسةَ من الحقل
 * حين تبدأ تمريرها فيصله `onPressOut` في أقلّ من ربع ثانية — فكانت كلُّ سحبةٍ سريعة
 * تبدأ من وسط اللحظة تفتحها. فالنقرةُ تُردّ إن تحرّك الإصبعُ أكثرَ من ثمانية، أو بدأ
 * تمريرٌ بعد النزول (`onScrolled`)، والقرارُ بعد إطارين يصل فيهما نداءُ التمرير.
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
  const downXY = useRef({ x: 0, y: 0 });
  const scrolledSince = useRef(false);
  useEffect(() => onScrolled(() => {
    scrolledSince.current = true;
  }), []);

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
      onPressIn={(event) => {
        downAt.current = Date.now();
        downXY.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
        scrolledSince.current = false;
      }}
      onPressOut={(event) => {
        if (!onTap || Date.now() - downAt.current >= 250) return;
        const moved = Math.hypot(
          event.nativeEvent.pageX - downXY.current.x,
          event.nativeEvent.pageY - downXY.current.y,
        );
        if (moved > 8) return;
        setTimeout(() => {
          if (!scrolledSince.current) onTap();
        }, 40);
      }}
      style={[style, { paddingTop: 0, paddingBottom: 0, paddingHorizontal: 0, backgroundColor: "transparent" }]}
    />
  );
}
