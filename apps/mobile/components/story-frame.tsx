import { useMemo, useRef, type ReactNode } from "react";
import { PanResponder, View, type GestureResponderEvent } from "react-native";

/**
 * موضعُ صورة القصّة في الشاشة (القاعدة ٢٩٦): `z` تقريبٌ نسبةً إلى ملء الشاشة (١ = تملؤها
 * بلا فراغ)، و`x`/`y` إزاحةٌ بنسبة عرض الشاشة وارتفاعها — فتقع عند المشاهد حيث وضعها
 * صاحبُها مهما اختلف مقاسُ جهازه. ولا تُحرق في الصورة (القاعدة ٩٧).
 */
export type StoryFrame = {
  z: number;
  x: number;
  y: number;
  /**
   * نسبةُ الصورة (عرضٌ ÷ ارتفاع) — بها يُبنى صندوقُها بنسبتها هي لا بنسبة الشاشة، فيُرى
   * طرفاها حين تُبعَد. بلاها (قصصٌ قبل القاعدة ٣٠٢) الصندوقُ بمقاس الشاشة كما كان.
   */
  a?: number;
};

export const NO_FRAME: StoryFrame = { z: 1, x: 0, y: 0 };
/** أدنى التقريب ٠٫٢: صورةٌ عرضيّة كاملةً على شاشةٍ طوليّة تحتاج نحو ربع ملئها. */
export const FRAME_ZOOM = { min: 0.2, max: 4 } as const;

/**
 * الصورةُ كاملةً بلا قصّ — **بقرار المالك**: صورةٌ من الاستديو بنسبةٍ غير نسبة الشاشة كانت
 * تملؤها فيذهب طرفاها. فتبدأ داخلها كلَّها (`z` = نسبةُ الاحتواء إلى الملء)، وحولها نسخةٌ
 * مغبّشةٌ منها (`backdrop`)، ولصاحبها أن يقرّبها حتى تملأ. وما قارب نسبةَ الشاشة يملؤها.
 */
export function fitFrame(width: number, height: number, screenWidth: number, screenHeight: number): StoryFrame {
  if (!width || !height) return NO_FRAME;
  const sx = screenWidth / width;
  const sy = screenHeight / height;
  const z = Math.min(sx, sy) / Math.max(sx, sy);
  const a = width / height;
  return z > 0.97 ? { ...NO_FRAME, a } : { z: Math.max(FRAME_ZOOM.min, z), x: 0, y: 0, a };
}

/** صندوقُ الصورة بنسبتها يملأ الشاشة (`cover`)، أو الشاشةُ نفسها حين لا نسبة. */
export function coverBox(a: number | undefined, width: number, height: number) {
  if (!a) return { w: width, h: height };
  return a > width / height ? { w: height * a, h: height } : { w: width, h: width / a };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * اللوحةُ بمقاس الشاشة، والصورةُ داخلها بتقريبها وإزاحتها، وما خرج يُقصّ.
 * **مطلقةُ الموضع** في أعلى أبيها: طبقةٌ تحت الرأس والنصوص لا تأخذ مكاناً في التدفّق —
 * على الجهاز كان رأسُ القصّة يُرسم تحتها فينزل الاسمُ والشريطُ إلى أسفل الشاشة.
 */
export function FramedMedia({
  frame,
  width,
  height,
  backdrop,
  children,
}: {
  frame: StoryFrame | null | undefined;
  width: number;
  height: number;
  /** ما يملأ الفراغ حول صورةٍ أصغر من الشاشة — نسخةٌ مغبّشةٌ منها. */
  backdrop?: ReactNode;
  /** الصورةُ بمقاس صندوقها — يُرسم بالمقاس المعطى. */
  children: (w: number, h: number) => ReactNode;
}) {
  const f = frame ?? NO_FRAME;
  const box = coverBox(f.a, width, height);
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width, height, overflow: "hidden" }}>
      {backdrop && f.z < 1 ? (
        <View style={{ position: "absolute", left: 0, top: 0, width, height }}>
          {backdrop}
          <View style={{ position: "absolute", left: 0, top: 0, width, height, backgroundColor: "rgba(11,18,25,.35)" }} />
        </View>
      ) : null}
      <View
        style={{
          position: "absolute",
          left: (width - box.w) / 2,
          top: (height - box.h) / 2,
          width: box.w,
          height: box.h,
          transform: [{ translateX: f.x * width }, { translateY: f.y * height }, { scale: f.z }],
        }}
      >
        {children(box.w, box.h)}
      </View>
    </View>
  );
}

function spread(event: GestureResponderEvent): number | null {
  const touches = event.nativeEvent.touches;
  if (touches.length < 2) return null;
  const [a, b] = touches;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

/**
 * إصبعٌ يسحب الصورة، وإصبعان يقرّبانها ويبعدانها، ونقرتان تبدّلان بين الصورة كاملةً
 * (`home`) وملء الشاشة. يُركَّب على طبقةٍ تحت النصوص والملصقات: ما لم يأخذه أحدُها يصل إليها.
 */
export function useFrameGesture(
  frame: StoryFrame,
  onChange: (next: StoryFrame) => void,
  width: number,
  height: number,
  home: StoryFrame = NO_FRAME,
) {
  const homeRef = useRef(home);
  homeRef.current = home;
  const live = useRef(frame);
  live.current = frame;
  const change = useRef(onChange);
  change.current = onChange;
  const start = useRef({ frame: NO_FRAME, spread: 0, cx: 0, cy: 0, fingers: 1, moved: false });
  const lastTap = useRef(0);

  return useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          const fingers = event.nativeEvent.touches.length || 1;
          start.current = { frame: live.current, spread: spread(event) ?? 0, cx: 0, cy: 0, fingers, moved: false };
        },
        onPanResponderMove: (event, gesture) => {
          const fingers = event.nativeEvent.touches.length || 1;
          // نزل إصبعٌ أو رُفع: يُقاس من تلك اللحظة، وإلّا قفزت الصورة.
          if (fingers !== start.current.fingers) {
            start.current = {
              frame: live.current,
              spread: spread(event) ?? 0,
              cx: gesture.dx,
              cy: gesture.dy,
              fingers,
              moved: true,
            };
            return;
          }
          const begin = start.current;
          if (Math.abs(gesture.dx - begin.cx) + Math.abs(gesture.dy - begin.cy) > 4) begin.moved = true;
          const now = spread(event);
          const z = now !== null && begin.spread ? clamp(begin.frame.z * (now / begin.spread), FRAME_ZOOM.min, FRAME_ZOOM.max) : begin.frame.z;
          if (z !== begin.frame.z) begin.moved = true;
          change.current({
            a: begin.frame.a,
            z,
            x: clamp(begin.frame.x + (gesture.dx - begin.cx) / width, -1, 1),
            y: clamp(begin.frame.y + (gesture.dy - begin.cy) / height, -1, 1),
          });
        },
        onPanResponderRelease: () => {
          if (start.current.moved) return;
          const at = Date.now();
          if (at - lastTap.current < 300) {
            const back = homeRef.current;
            const atHome = Math.abs(live.current.z - back.z) < 0.01 && !live.current.x && !live.current.y;
            change.current(atHome ? { ...NO_FRAME, a: back.a } : back);
            lastTap.current = 0;
          } else {
            lastTap.current = at;
          }
        },
      }),
    [width, height],
  );
}
