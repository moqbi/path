import { useRef, useState } from "react";
import { View, Image, PanResponder } from "react-native";
import { Text } from "./type";
import { colors } from "../theme/tokens";

/**
 * إطارُ صورة اللحظة — **بقرار المالك**: نسبةٌ واحدة في البطاقة والمحرّر
 * (`PHOTO_RATIO`)، فما ضبطه صاحبُها قبل النشر هو ما يُرى في الخطّ الزمنيّ.
 * والصورة تملأ الإطار (`cover`) ويُختار موضعُها بالسحب يميناً ويساراً
 * وأعلى وأسفل، ويُحفظ نسبةً (٠–١٠٠) لا بكسلات: البطاقةُ أعرضُ على جهازٍ
 * وأضيق على آخر.
 */
export const PHOTO_RATIO = 5 / 4;

type Pos = { x: number; y: number };

/**
 * ما يزيد من الصورة عن إطارها في كلّ اتّجاه، بالبكسل — هو مدى السحب.
 * صورةٌ أعرضُ من الإطار تُسحب أفقياً وحده، وأطولُ منه رأسياً وحده.
 */
function spare(frameW: number, frameH: number, imgW: number, imgH: number) {
  const scale = Math.max(frameW / imgW, frameH / imgH);
  return { x: imgW * scale - frameW, y: imgH * scale - frameH };
}

export function PhotoFrameEditor({
  uri,
  width,
  height,
  value,
  onChange,
  frameWidth,
  onActive,
}: {
  uri: string;
  width: number;
  height: number;
  value: Pos;
  onChange: (next: Pos) => void;
  frameWidth: number;
  /** سحبٌ جارٍ: الشاشةُ توقف تمريرها — تمريرُ آبل يأخذ السحبة قبل الإطار (القاعدة ١٤٠). */
  onActive?: (active: boolean) => void;
}) {
  const frameHeight = frameWidth / PHOTO_RATIO;
  const extra = spare(frameWidth, frameHeight, width || frameWidth, height || frameHeight);
  const latest = useRef({ value, extra, onChange, onActive });
  latest.current = { value, extra, onChange, onActive };
  const start = useRef(value);
  const [dragging, setDragging] = useState(false);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        start.current = latest.current.value;
        setDragging(true);
        latest.current.onActive?.(true);
      },
      onPanResponderMove: (_event, gesture) => {
        const { extra: room } = latest.current;
        // الإصبعُ يجرّ الصورة: سحبُها يساراً يُظهر ما على يمينها، فالموضعُ يزيد.
        const x = room.x > 0 ? start.current.x - (gesture.dx / room.x) * 100 : 50;
        const y = room.y > 0 ? start.current.y - (gesture.dy / room.y) * 100 : 50;
        latest.current.onChange({
          x: Math.round(Math.max(0, Math.min(100, x))),
          y: Math.round(Math.max(0, Math.min(100, y))),
        });
      },
      onPanResponderRelease: () => {
        setDragging(false);
        latest.current.onActive?.(false);
      },
      onPanResponderTerminate: () => {
        setDragging(false);
        latest.current.onActive?.(false);
      },
    }),
  ).current;

  // الصورةُ تُرسم بمقاسها المكبَّر وتُزاح بالموضع — كـ`object-position` في الويب.
  const scale = Math.max(frameWidth / (width || frameWidth), frameHeight / (height || frameHeight));
  const drawnW = (width || frameWidth) * scale;
  const drawnH = (height || frameHeight) * scale;

  return (
    <View>
      <View
        {...pan.panHandlers}
        style={{
          width: frameWidth,
          height: frameHeight,
          borderRadius: 14,
          overflow: "hidden",
          backgroundColor: colors.chip,
          borderWidth: 1,
          borderColor: dragging ? colors.clay : colors.line,
        }}
      >
        <Image
          source={{ uri }}
          style={{
            position: "absolute",
            width: drawnW,
            height: drawnH,
            left: -extra.x * (value.x / 100),
            top: -extra.y * (value.y / 100),
          }}
        />
      </View>
      {extra.x > 1 || extra.y > 1 ? (
        <Text style={{ color: colors.faint, fontSize: 11, textAlign: "center", marginTop: 6 }}>
          اسحب الصورة لتضبط ما يظهر منها في البطاقة
        </Text>
      ) : null}
    </View>
  );
}
