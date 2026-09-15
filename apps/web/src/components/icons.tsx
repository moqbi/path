/**
 * أيقونات مرسومة كـ SVG بحد (stroke) على شبكة ٢٤ بكسل بأسلوب واحد.
 * لا إيموجي في واجهة التطبيق — الإيموجي محتوى (تفاعلات)، لا عناصر واجهة.
 */
type IconProps = { size?: number; className?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const SearchIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="M16.5 16.5 21 21" />
  </svg>
);

export const CircleIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" />
    <circle cx="10" cy="7.5" r="3.2" />
    <path d="M19 19v-1.4a3.4 3.4 0 0 0-2.4-3.2M15.4 4.9a3.2 3.2 0 0 1 0 5.4" />
  </svg>
);

export const PinIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 21s7-5.8 7-11a7 7 0 1 0-14 0c0 5.2 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.4" />
  </svg>
);

export const MusicIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M9 18V6.5l10-2V16" />
    <ellipse cx="6.6" cy="18" rx="2.6" ry="2.3" />
    <ellipse cx="16.6" cy="16" rx="2.6" ry="2.3" />
  </svg>
);

export const MoonIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M20 14.5A8.2 8.2 0 0 1 9.5 4 8.4 8.4 0 1 0 20 14.5Z" />
  </svg>
);

export const CameraIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="3" y="6.5" width="18" height="13.5" rx="3" />
    <circle cx="12" cy="13.2" r="3.6" />
    <path d="M8.6 6.5 9.8 4h4.4l1.2 2.5" />
  </svg>
);

export const TextIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4.5 6.5h15M4.5 11.5h15M4.5 16.5h9" />
  </svg>
);

export const WithIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M15.5 19v-1.4a3.5 3.5 0 0 0-3.5-3.5H7a3.5 3.5 0 0 0-3.5 3.5V19" />
    <circle cx="9.5" cy="7.6" r="3.2" />
    <path d="M18 8.5v5M20.5 11h-5" />
  </svg>
);

export const ClockIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="8.4" />
    <path d="M12 7.6V12l3 1.8" />
  </svg>
);

export const EyeIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className} strokeWidth={1.6}>
    <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
    <circle cx="12" cy="12" r="2.6" />
  </svg>
);

export const LockIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="5" y="10.5" width="14" height="9.5" rx="2.4" />
    <path d="M8.4 10.5V8a3.6 3.6 0 0 1 7.2 0v2.5" />
  </svg>
);

export const CheckIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className} strokeWidth={2}>
    <path d="M5 12.5 10 17.5 19 7" />
  </svg>
);

export const PlusIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className} strokeWidth={2}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const CloseIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className} strokeWidth={1.8}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const BackIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className} strokeWidth={1.8}>
    <path d="M15 5 8 12l7 7" />
  </svg>
);

/**
 * علامة آثار+: نجمة خماسية مملوءة.
 *
 * كانت تاجاً، والتاج يُقرأ رتبةً على الناس. والنجمة تُقرأ في كل لغة
 * ولا تحتاج ترجمةً بجانب اسمٍ لاتيني.
 */
export const SparkIcon = ({ size = 20, className }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 2.6l2.76 5.92 6.24.78-4.6 4.33 1.2 6.37L12 16.86l-5.6 3.14 1.2-6.37-4.6-4.33 6.24-.78L12 2.6Z" />
  </svg>
);

export const BookIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M5 19.5V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v13.5M5 19.5A1.5 1.5 0 0 0 6.5 21H19M5 19.5A1.5 1.5 0 0 1 6.5 18H19" />
  </svg>
);

export const InfoIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className} strokeWidth={1.6}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.8v.2" />
  </svg>
);

export const StoreIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 9h16l-1 11H5L4 9Z" />
    <path d="M8.5 9V6.8a3.5 3.5 0 0 1 7 0V9" />
  </svg>
);

export const HomeIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8.5Z" />
  </svg>
);

export const PlayIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className} fill="currentColor" stroke="none">
    <path d="M8 5.4c0-.8.9-1.3 1.6-.9l8.4 5.6c.6.4.6 1.4 0 1.8l-8.4 5.6c-.7.4-1.6-.1-1.6-.9V5.4Z" />
  </svg>
);

export const MessageIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M20 15.5a2.5 2.5 0 0 1-2.5 2.5H8l-4 3V6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5Z" />
  </svg>
);

export const UserIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M18 19.5v-1.6a4 4 0 0 0-4-4h-4a4 4 0 0 0-4 4v1.6" />
    <circle cx="12" cy="7.8" r="3.6" />
  </svg>
);

export const RefreshIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M20 12a8 8 0 1 1-2.6-5.9" />
    <path d="M20 4.4V9h-4.6" />
  </svg>
);

export const PlaneIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M10.5 19.5 12 21l2-4.6 5.2-1.6a2 2 0 0 0 1.3-2.4l-.3-1-6 1.8-3.2-3.4 4.7-1.4a2 2 0 0 0 1.3-2.5l-.3-1L3.6 8.2a2 2 0 0 0-1.3 2.5l.3 1 3.6-1.1 2.6 4-2.4.7-1.4-1.2-1.3.4 1 3.3 1.3-.4.3-1.8 2.6-.8Z" />
  </svg>
);

export const BellIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M18 15.6V10a6 6 0 1 0-12 0v5.6L4.4 18h15.2L18 15.6Z" />
    <path d="M10 21h4" />
  </svg>
);

export const ShieldIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3l7.5 3v5.5c0 4.4-3 8.2-7.5 9.5-4.5-1.3-7.5-5.1-7.5-9.5V6L12 3Z" />
  </svg>
);

export const GearIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.5 1.5M16.5 16.5 18 18M18 6l-1.5 1.5M7.5 16.5 6 18" />
  </svg>
);

export const TagIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M3.5 11.5 11 4h7.5V11L11 18.5l-7.5-7Z" />
    <circle cx="15" cy="8" r="1.3" />
  </svg>
);

export const ExitIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M14.5 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5h8" />
    <path d="M17.5 15.5 21 12l-3.5-3.5M21 12h-9" />
  </svg>
);

export const FlameIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3.5s5 4 5 8.2a5 5 0 0 1-10 0c0-1.7 1-3.2 1.9-4.2.2 1.1.9 1.9 1.8 1.9 1.2 0 1.9-1 1.6-2.6-.2-1.2-.3-2.3-.3-3.3Z" />
  </svg>
);

export const SunIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="4.4" />
    <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4 17 7M7 17l-1.6 1.6" />
  </svg>
);

export const GiftIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 11h16v9H4z" />
    <path d="M3 7.5h18V11H3zM12 7.5V20" />
    <path d="M12 7.5S10.6 4 8.8 4a2.1 2.1 0 0 0 0 3.5zM12 7.5s1.4-3.5 3.2-3.5a2.1 2.1 0 0 1 0 3.5z" />
  </svg>
);

/** طوق النجاة: باب الدعم. */
export const LifeIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="3.6" />
    <path d="m5.6 5.6 3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9" />
  </svg>
);

export const ShareIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 15.5V4m0 0L8.2 7.8M12 4l3.8 3.8" />
    <path d="M5.5 12.5v5A2.5 2.5 0 0 0 8 20h8a2.5 2.5 0 0 0 2.5-2.5v-5" />
  </svg>
);

export const MicIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
  </svg>
);

export const PauseIcon = ({ size = 20, className }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
    className={className}
    aria-hidden="true"
  >
    <rect x="7" y="5" width="3.4" height="14" rx="1.2" />
    <rect x="13.6" y="5" width="3.4" height="14" rx="1.2" />
  </svg>
);
