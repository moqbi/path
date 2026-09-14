import Svg, { Path } from "react-native-svg";
import { colors } from "../theme/tokens";

export type Receipt = "sent" | "delivered" | "read";

export const receiptOf = (message: { deliveredAt: string | null; readAt: string | null }): Receipt =>
  message.readAt ? "read" : message.deliveredAt ? "delivered" : "sent";

/**
 * الإيصال: صحٌّ واحد خرجت من عندي، وصحّان وصلت جهازه، وملوّنان قرأها.
 * ثلاث حالاتٍ تُقرأ بلمحة بلا كلمة.
 */
export function Ticks({ state, size = 17 }: { state: Receipt; size?: number }) {
  const color = state === "read" ? colors.clay : colors.faint;

  return (
    <Svg width={size} height={(size * 12) / 17} viewBox="0 0 17 12" fill="none">
      <Path d="M1 6.6 4.2 10 10.6 2" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      {state !== "sent" ? (
        <Path d="M6.6 6.9 8.6 9.3 15.6 1.4" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
    </Svg>
  );
}
