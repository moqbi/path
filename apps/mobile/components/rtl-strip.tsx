import { Children, useRef } from "react";
import { ScrollView, View, type ScrollViewInstance, type StyleProp, type ViewStyle } from "react-native";

/**
 * صفٌّ أفقيٌّ يُفتح على أوّله من اليمين (القاعدة ٤٣٣).
 *
 * التمريرُ الأفقيّ في جذرٍ من اليمين يُفتح على الطرف الأيسر في بعض الأشجار —
 * يتبع اتجاهَ عقدته في Yoga والوراثةُ لا تصل كلَّ شجرة — فيُرى الأقدمُ أوّلاً
 * ويُسحب إلى الأحدث. فلا يُترك للاتجاه: الصفُّ من اليسار والعناصرُ معكوسة،
 * ويُمرَّر إلى آخره كلّما تغيّر عرضُه ما لم يُلمس. وكلُّ عنصرٍ يعود يمينيّاً في داخله.
 */
export function RtlStrip({
  children,
  style,
  contentContainerStyle,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const ref = useRef<ScrollViewInstance>(null);
  // ما دام صاحبُها لم يلمسها تبقى على أوّلها، ولو طالت حين وصلت بياناتٌ أخرى.
  const touched = useRef(false);
  const items = Children.toArray(children).reverse();
  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[style, { direction: "ltr" }]}
      contentContainerStyle={[contentContainerStyle, { flexDirection: "row", direction: "ltr" }]}
      onScrollBeginDrag={() => {
        touched.current = true;
      }}
      onContentSizeChange={(w) => {
        if (touched.current || w <= 0) return;
        ref.current?.scrollToEnd({ animated: false });
      }}
    >
      {items.map((item, i) => (
        <View key={(item as { key?: string | null }).key ?? i} style={{ direction: "rtl" }}>
          {item}
        </View>
      ))}
    </ScrollView>
  );
}
