/**
 * لوحة الرأس: سماءُ غروبٍ وحافةُ جبلٍ وأربعةُ جالسين.
 *
 * مرسومةٌ SVG لا صورةً مرفوعة — حتى تبقى حادّةً على كل شاشة، وتتبع
 * ألوان العلامة نفسها (الكهرماني إلى المرجاني) بدل أن تجاورها. ومتى
 * وصلت الصورة الفوتوغرافية تحلّ محلّها بلا لمس بقية الرأس.
 */
export function HeroArt() {
  return (
    <svg
      viewBox="0 0 640 400"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden
      className="absolute inset-0 h-full w-full"
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0e1a24" />
          <stop offset="46%" stopColor="#233240" />
          <stop offset="74%" stopColor="#7a4a3e" />
          <stop offset="100%" stopColor="#c9743f" />
        </linearGradient>
        <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#ffd27a" />
          <stop offset="55%" stopColor="#ff9a4d" />
          <stop offset="100%" stopColor="#ff7a5a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="haze" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#0e1a24" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#0e1a24" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="640" height="400" fill="url(#sky)" />
      <circle cx="132" cy="286" r="78" fill="url(#sun)" opacity="0.85" />
      <circle cx="132" cy="286" r="17" fill="#ffd9a0" opacity="0.9" />

      {/* نجومٌ قليلة: أعلى السماء وحده، فالضوء يغسل أسفلها. */}
      {[
        [64, 44], [148, 72], [232, 38], [318, 66], [402, 34],
        [486, 74], [560, 48], [604, 96], [96, 104], [268, 108],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" fill="#f7f5ef" opacity="0.55" />
      ))}

      {/* حافّتا جبلٍ متداخلتان: البعيدة أفتح، والقريبة تحمل الجالسين. */}
      <path d="M0 336 L86 282 L152 314 L226 266 L308 314 L392 276 L478 320 L560 282 L640 324 L640 400 L0 400 Z" fill="#1b2a36" opacity="0.85" />
      <path d="M0 372 L104 340 L206 366 L300 336 L404 368 L512 338 L640 370 L640 400 L0 400 Z" fill="#0e1a24" />

      {/* أربعةُ جالسين على الحافّة — ظلالٌ لا وجوه: اللحظة لهم لا لنا. */}
      <g fill="#0b141c">
        {[286, 340, 392, 446].map((x, index) => (
          <g key={x} transform={`translate(${x} ${352 + (index % 2) * 4}) scale(0.82)`}>
            <circle cx="0" cy="-16" r="8.5" />
            <path d="M-11 -8 q11 -6 22 0 l4 26 h-30 Z" />
            <rect x="-14" y="16" width="28" height="9" rx="4" />
          </g>
        ))}
      </g>

      <rect y="322" width="640" height="78" fill="url(#haze)" />
    </svg>
  );
}
