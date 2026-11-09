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
  onEnd,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** بلغ الإصبعُ آخرَ الصفّ (طرفَه الأيسر) — لجلب ما بعده (القاعدة ٤٥٠). */
  onEnd?: () => void;
}) {
  const ref = useRef<ScrollViewInstance>(null);
  // ما دام صاحبُها لم يلمسها تبقى على أوّلها، ولو طالت حين وصلت بياناتٌ أخرى.
  const touched = useRef(false);
  // موضعُ التمرير وعرضُ المحتوى: ما يُضاف في آخر الصفّ يُضاف يساراً، فيُزاح الموضعُ بقدره
  // ليبقى ما تحت الإصبع في مكانه.
  const x = useRef(0);
  const width = useRef(0);
  const items = Children.toArray(children).reverse();
  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[style, { direction: "ltr" }]}
      /*
        صفٌّ أقصرُ من الشاشة يجلس يميناً (القاعدة ٤٥٠): `flexGrow` يمدّ المحتوى بعرض الصفّ و`flex-end`
        يدفع ما فيه إلى طرفه الأيمن — كان يجلس يساراً فيُقرأ أوّلُ المتفاعلين آخرَهم.
      */
      contentContainerStyle={[contentContainerStyle, { flexDirection: "row", direction: "ltr", flexGrow: 1, justifyContent: "flex-end" }]}
      scrollEventThrottle={64}
      onScroll={(event) => {
        x.current = event.nativeEvent.contentOffset.x;
        if (onEnd && touched.current && x.current < 80) onEnd();
      }}
      onScrollBeginDrag={() => {
        touched.current = true;
      }}
      onContentSizeChange={(w) => {
        const grew = w - width.current;
        width.current = w;
        if (w <= 0) return;
        if (!touched.current) {
          ref.current?.scrollToEnd({ animated: false });
          return;
        }
        if (grew > 0) ref.current?.scrollTo({ x: x.current + grew, animated: false });
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
