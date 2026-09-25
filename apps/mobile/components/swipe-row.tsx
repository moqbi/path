import { useRef, useState } from "react";
import { View, Pressable, Animated, PanResponder } from "react-native";
import { Text } from "./type";
import { CloseIcon } from "./icons";
import { colors } from "../theme/tokens";

const REVEAL = 88;

/**
 * صفٌّ يكشف زرّ الحذف بالسحب.
 *
 * والالتقاط لا يقع قبل أن يثبت السحب أفقياً: التقاطُه عند أوّل لمسة
 * يحوّل الضغطة كلها إلى الصفّ، فلا يصل النقر إلى ما بداخله — وبه كانت
 * صفوف الأصدقاء والمحادثات لا تُفتح بالضغط أصلاً. ولذلك
 * `onMoveShouldSetPanResponder` لا `onStartShouldSetPanResponder`،
 * وشرطُها أن تكون الحركة أفقيةً أكثر منها رأسية حتى لا تُبتلع القائمة.
 */
export function SwipeRow({
  onDelete,
  confirmLabel = "حذف",
  onSecond,
  secondLabel,
  surface,
  width = REVEAL,
  lead,
  radius = 0,
  children,
}: {
  onDelete: () => void | Promise<void>;
  confirmLabel?: string;
  /** فعلٌ ثانٍ يظهر بجانب الأول — الحظر مثلاً بجانب الإزالة. */
  onSecond?: () => void | Promise<void>;
  secondLabel?: string;
  /**
   * لونُ ما يُزاح: الصفُّ يغطّي الزرّ تحته بأرضيّته، فيجب أن تكون أرضيّةَ
   * مكانه — الورقُ في القوائم، والبطاقةُ في التعليقات. وإلّا ظهر شريطٌ
   * بلونٍ غريب تحت كلّ تعليق.
   */
  surface?: string;
  /** عرضُ الزرّ المكشوف — «حذف بصلاحية الإشراف» أطولُ من «حذف». */
  width?: number;
  /**
   * فعلٌ لا يقطع يسبق الفعلين: «محادثة» في صفّ الصديق. يجلس أبعدَ عن
   * الصفّ، وبلونٍ غير لون القطع — فلا يُضغط «إزالة» وهو يريد الكلام.
   */
  lead?: { label: string; run: () => void | Promise<void> };
  /** انحناءُ الحواف حين يكون الصفّ قالباً لا سطراً. */
  radius?: number;
  children: React.ReactNode;
}) {
  const second = onSecond && secondLabel ? { run: onSecond, label: secondLabel } : null;
  const reveal = width * (1 + (second ? 1 : 0) + (lead ? 1 : 0));

  const [busy, setBusy] = useState(false);
  /*
    درعٌ فوق الصفّ ما دام مفتوحاً.

    الصفّ رابطٌ يُفتح بالضغط، والسحبة تنتهي بضغطةٍ يقرؤها الرابط نقراً
    فيسافر بصاحبها وهو يريد الحذف. والدرع يبتلع تلك الضغطة ويُعيد الصفّ
    مكانه — وهو أيضاً ما يتوقّعه من فتح صفّاً ثم غيّر رأيه.
  */
  const [revealed, setRevealed] = useState(false);
  const shift = useRef(new Animated.Value(0)).current;
  const open = useRef(false);
  const from = useRef(0);

  const settle = (to: number) => {
    open.current = to > 0;
    setRevealed(to > 0);
    Animated.timing(shift, { toValue: to, duration: 220, useNativeDriver: true }).start();
  };

  const pan = useRef(
    PanResponder.create({
      /*
        الالتقاط في طور الالتقاط (capture) لا الفقاعة: الضغطة تبدأ عند
        الرابط أو الزرّ داخل الصفّ فيصير هو المستجيب، ولا يتنازل. والشرط
        يبقى هو الشرط — ستّ بكسلاتٍ أفقيةً أكثر منها رأسية — فالنقرة
        الساكنة لا تُلتقط وتبقى للرابط.
      */
      onMoveShouldSetPanResponderCapture: (_event, gesture) =>
        Math.abs(gesture.dx) > 6 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderGrant: () => {
        from.current = open.current ? reveal : 0;
        // الدرع يُنصب مع أوّل حركة لا بعد الإفلات: الضغطة التي تختم
        // السحبة تصل إلى الرابط قبل أن يتحرّك شيء إن تأخّر.
        setRevealed(true);
      },
      onPanResponderMove: (_event, gesture) => {
        // السحب إلى اليمين يزيح الصفّ فتنكشف حافته اليسرى وزرّها.
        shift.setValue(Math.max(0, Math.min(reveal, from.current + gesture.dx)));
      },
      onPanResponderRelease: (_event, gesture) => {
        const at = Math.max(0, Math.min(reveal, from.current + gesture.dx));
        settle(at > reveal / 2 ? reveal : 0);
      },
      onPanResponderTerminate: () => settle(open.current ? reveal : 0),
    }),
  ).current;

  function fire(run: () => void | Promise<void>) {
    settle(0);
    setBusy(true);
    void Promise.resolve(run()).finally(() => setBusy(false));
  }

  return (
    <View style={{ position: "relative", overflow: "hidden", borderRadius: radius }}>
      <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: reveal, flexDirection: "row" }}>
        {lead ? (
          <Pressable
            disabled={busy}
            onPress={() => fire(lead.run)}
            style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, backgroundColor: colors.clay, opacity: busy ? 0.6 : 1 }}
          >
            <Text style={{ color: colors.onBrand, fontSize: 13, fontWeight: "700" }}>{lead.label}</Text>
          </Pressable>
        ) : null}
        {second ? (
          <Pressable
            disabled={busy}
            onPress={() => fire(second.run)}
            style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, backgroundColor: colors.night, opacity: busy ? 0.6 : 1 }}
          >
            <Text style={{ color: "#f7f5ef", fontSize: 13, fontWeight: "700" }}>{second.label}</Text>
          </Pressable>
        ) : null}

        <Pressable
          disabled={busy}
          onPress={() => fire(onDelete)}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 8, backgroundColor: colors.live, opacity: busy ? 0.6 : 1 }}
        >
          <CloseIcon size={16} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>{confirmLabel}</Text>
        </Pressable>
      </View>

      <Animated.View
        {...pan.panHandlers}
        style={{ backgroundColor: surface ?? colors.paper, transform: [{ translateX: shift }] }}
      >
        {children}

        {revealed ? (
          <Pressable
            onPress={() => settle(0)}
            style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
          />
        ) : null}
      </Animated.View>
    </View>
  );
}
