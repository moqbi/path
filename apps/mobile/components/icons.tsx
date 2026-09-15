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

export const MoonIcon = ({ size = 20, color = "currentColor" }: Props) => (
  <Svg {...stroke(size, color)}>
    <Path d="M20 14.5A8.2 8.2 0 0 1 9.5 4 8.4 8.4 0 1 0 20 14.5Z" />
  </Svg>
);

export const SunIcon = ({ size = 20, color = "currentColor" }: Props) => (
  <Svg {...stroke(size, color)}>
    <Circle cx={12} cy={12} r={4.4} />
    <Path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4 17 7M7 17l-1.6 1.6" />
  </Svg>
);

export const PlaneIcon = ({ size = 20, color = "currentColor" }: Props) => (
  <Svg {...stroke(size, color)}>
    <Path d="M10.5 19.5 12 21l2-4.6 5.2-1.6a2 2 0 0 0 1.3-2.4l-.3-1-6 1.8-3.2-3.4 4.7-1.4a2 2 0 0 0 1.3-2.5l-.3-1L3.6 8.2a2 2 0 0 0-1.3 2.5l.3 1 3.6-1.1 2.6 4-2.4.7-1.4-1.2-1.3.4 1 3.3 1.3-.4.3-1.8 2.6-.8Z" />
  </Svg>
);

export const WithIcon = ({ size = 20, color = "currentColor" }: Props) => (
  <Svg {...stroke(size, color)}>
    <Path d="M15.5 19v-1.4a3.5 3.5 0 0 0-3.5-3.5H7a3.5 3.5 0 0 0-3.5 3.5V19" />
    <Circle cx={9.5} cy={7.6} r={3.2} />
    <Path d="M18 8.5v5M20.5 11h-5" />
  </Svg>
);

/** الإشارة «مع فلان» — بطاقةُ وسمٍ بثقبها، كما في الويب. */
export const TagIcon = ({ size = 20, color = "currentColor" }: Props) => (
  <Svg {...stroke(size, color)}>
    <Path d="M3.5 11.5 11 4h7.5V11L11 18.5l-7.5-7Z" />
    <Circle cx={15} cy={8} r={1.3} />
  </Svg>
);

export const GiftIcon = ({ size = 20, color = "currentColor" }: Props) => (
  <Svg {...stroke(size, color)}>
    <Path d="M4 11h16v9H4z" />
    <Path d="M3 7.5h18V11H3zM12 7.5V20" />
    <Path d="M12 7.5S10.6 4 8.8 4a2.1 2.1 0 0 0 0 3.5zM12 7.5s1.4-3.5 3.2-3.5a2.1 2.1 0 0 1 0 3.5z" />
  </Svg>
);

export const BookIcon = ({ size = 20, color = "currentColor" }: Props) => (
  <Svg {...stroke(size, color)}>
    <Path d="M5 19.5V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v13.5M5 19.5A1.5 1.5 0 0 0 6.5 21H19M5 19.5A1.5 1.5 0 0 1 6.5 18H19" />
  </Svg>
);

export const RefreshIcon = ({ size = 20, color = "currentColor" }: Props) => (
  <Svg {...stroke(size, color)}>
    <Path d="M20 12a8 8 0 1 1-2.6-5.9" />
    <Path d="M20 4.4V9h-4.6" />
  </Svg>
);

export const ExitIcon = ({ size = 20, color = "currentColor" }: Props) => (
  <Svg {...stroke(size, color)}>
    <Path d="M14.5 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5h8" />
    <Path d="M17.5 15.5 21 12l-3.5-3.5M21 12h-9" />
  </Svg>
);

export const GearIcon = ({ size = 20, color = "currentColor" }: Props) => (
  <Svg {...stroke(size, color)}>
    <Circle cx={12} cy={12} r={3.2} />
    <Path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.5 1.5M16.5 16.5 18 18M18 6l-1.5 1.5M7.5 16.5 6 18" />
  </Svg>
);

export const ShareIcon = ({ size = 20, color = "currentColor" }: Props) => (
  <Svg {...stroke(size, color)}>
    <Path d="M12 15.5V4M8.5 7.5 12 4l3.5 3.5" />
    <Path d="M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" />
  </Svg>
);

/** «أثر+»: نجمةٌ ممتلئة — علامة الاشتراك أينما ظهرت. */
export const SparkIcon = ({ size = 20, color = "currentColor" }: Props) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M12 2.6l2.76 5.92 6.24.78-4.6 4.33 1.2 6.37L12 16.86l-5.6 3.14 1.2-6.37-4.6-4.33 6.24-.78L12 2.6Z" />
  </Svg>
);

export const EyeIcon = ({ size = 20, color = "currentColor" }: Props) => (
  <Svg {...stroke(size, color)}>
    <Path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
    <Circle cx={12} cy={12} r={3.2} />
  </Svg>
);

export const MicIcon = ({ size = 20, color = "currentColor" }: Props) => (
  <Svg {...stroke(size, color)}>
    <Path d="M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3Z" />
    <Path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
  </Svg>
);

export const CameraIcon = ({ size = 20, color = "currentColor" }: Props) => (
  <Svg {...stroke(size, color)}>
    <Path d="M3 9.5A2.5 2.5 0 0 1 5.5 7h1.8l1.2-2h6.8l1.2 2h1.8A2.5 2.5 0 0 1 21 9.5v8A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5Z" />
    <Circle cx={12} cy={13} r={3.6} />
  </Svg>
);

export const FlameIcon = ({ size = 20, color = "currentColor" }: Props) => (
  <Svg {...stroke(size, color)}>
    <Path d="M12 3s5 4.2 5 8.5a5 5 0 0 1-10 0C7 9 9 7 9 7s.5 2.5 2 2.5S12 3 12 3Z" />
    <Path d="M12 21a4.5 4.5 0 0 0 4.5-4.5c0-2-1.5-3.5-1.5-3.5s-.3 1.6-1.4 1.6S12 21 12 21Z" />
  </Svg>
);

export const InfoIcon = ({ size = 20, color = "currentColor" }: Props) => (
  <Svg {...stroke(size, color)}>
    <Circle cx={12} cy={12} r={9} />
    <Path d="M12 11v5M12 7.6v.6" />
  </Svg>
);

export const CheckIcon = ({ size = 20, color = "currentColor" }: Props) => (
  <Svg {...stroke(size, color)}>
    <Path d="m5 12.5 4.5 4.5L19 7.5" strokeWidth={2} />
  </Svg>
);

export const CloseIcon = ({ size = 20, color = "currentColor" }: Props) => (
  <Svg {...stroke(size, color)}>
    <Path d="M6 6l12 12M18 6 6 18" strokeWidth={2} />
  </Svg>
);

export const SearchIcon = ({ size = 20, color = "currentColor" }: Props) => (
  <Svg {...stroke(size, color)}>
    <Circle cx={11} cy={11} r={7} />
    <Path d="M16.5 16.5 21 21" />
  </Svg>
);

export const LockIcon = ({ size = 20, color = "currentColor" }: Props) => (
  <Svg {...stroke(size, color)}>
    <Path d="M6.5 10.5h11a1.5 1.5 0 0 1 1.5 1.5v6.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18.5V12a1.5 1.5 0 0 1 1.5-1.5Z" />
    <Path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
  </Svg>
);

export const PlusIcon = ({ size = 20, color = "currentColor" }: Props) => (
  <Svg {...stroke(size, color)}>
    <Path d="M12 5v14M5 12h14" strokeWidth={2} />
  </Svg>
);

export const StarIcon = ({ size = 20, color = "currentColor" }: Props) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M12 3.6l2.5 5.3 5.6.8-4.1 4 1 5.7-5-2.7-5 2.7 1-5.7-4.1-4 5.6-.8L12 3.6Z" />
  </Svg>
);

/** سهم الرجوع — يشير يساراً كما في الويب، ولا يُعكس مع RTL. */
export const BackIcon = ({ size = 20, color = "currentColor" }: Props) => (
  <Svg {...stroke(size, color)} strokeWidth={1.8}>
    <Path d="M15 5 8 12l7 7" />
  </Svg>
);
