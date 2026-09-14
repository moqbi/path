import Svg, { Circle, Path } from "react-native-svg";

/**
 * الأيقونات — نفس المسارات التي في `src/components/icons.tsx` حرفاً
 * بحرف، على شبكة ٢٤ وبحدٍّ واحد. ولا إيموجي في الواجهة: الإيموجي محتوى
 * (تفاعلات) لا عنصرَ واجهة.
 */
type Props = { size?: number; color?: string };

const stroke = (size: number, color: string) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: color,
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const HomeIcon = ({ size = 20, color = "currentColor" }: Props) => (
  <Svg {...stroke(size, color)}>
    <Path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8.5Z" />
  </Svg>
);

export const CircleIcon = ({ size = 20, color = "currentColor" }: Props) => (
  <Svg {...stroke(size, color)}>
    <Path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" />
    <Circle cx={10} cy={7.5} r={3.2} />
    <Path d="M19 19v-1.4a3.4 3.4 0 0 0-2.4-3.2M15.4 4.9a3.2 3.2 0 0 1 0 5.4" />
  </Svg>
);

export const BellIcon = ({ size = 20, color = "currentColor" }: Props) => (
  <Svg {...stroke(size, color)}>
    <Path d="M18 15.6V10a6 6 0 1 0-12 0v5.6L4.4 18h15.2L18 15.6Z" />
    <Path d="M10 21h4" />
  </Svg>
);

export const StoreIcon = ({ size = 20, color = "currentColor" }: Props) => (
  <Svg {...stroke(size, color)}>
    <Path d="M4 9h16l-1 11H5L4 9Z" />
    <Path d="M8.5 9V6.8a3.5 3.5 0 0 1 7 0V9" />
  </Svg>
);

export const UserIcon = ({ size = 20, color = "currentColor" }: Props) => (
  <Svg {...stroke(size, color)}>
    <Path d="M18 19.5v-1.6a4 4 0 0 0-4-4h-4a4 4 0 0 0-4 4v1.6" />
    <Circle cx={12} cy={7.8} r={3.6} />
  </Svg>
);

export const PinIcon = ({ size = 20, color = "currentColor" }: Props) => (
  <Svg {...stroke(size, color)}>
    <Path d="M12 21s7-5.8 7-11a7 7 0 1 0-14 0c0 5.2 7 11 7 11Z" />
    <Circle cx={12} cy={10} r={2.4} />
  </Svg>
);

export const MessageIcon = ({ size = 20, color = "currentColor" }: Props) => (
  <Svg {...stroke(size, color)}>
    <Path d="M20 15.5a2.5 2.5 0 0 1-2.5 2.5H8l-4 3V6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5Z" />
  </Svg>
);

export const PlayIcon = ({ size = 20, color = "currentColor" }: Props) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M8 5.4c0-.8.9-1.3 1.6-.9l8.4 5.6c.6.4.6 1.4 0 1.8l-8.4 5.6c-.7.4-1.6-.1-1.6-.9V5.4Z" />
  </Svg>
);

export const ShieldIcon = ({ size = 20, color = "currentColor" }: Props) => (
  <Svg {...stroke(size, color)}>
    <Path d="M12 3l7.5 3v5.5c0 4.4-3 8.2-7.5 9.5-4.5-1.3-7.5-5.1-7.5-9.5V6L12 3Z" />
  </Svg>
);

export const StarIcon = ({ size = 20, color = "currentColor" }: Props) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M12 3.6l2.5 5.3 5.6.8-4.1 4 1 5.7-5-2.7-5 2.7 1-5.7-4.1-4 5.6-.8L12 3.6Z" />
  </Svg>
);
