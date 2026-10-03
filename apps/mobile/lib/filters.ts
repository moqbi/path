/**
 * فلاتر القصة — نفسها التي في الويب، بنفس مفاتيحها وأسمائها.
 *
 * الويب يكتبها `filter` في CSS، ولا CSS في الموبايل. فتُبنى مصفوفةَ ألوان
 * تُمرَّر إلى Skia: وهذه ليست محاكاةً بالتقريب — مصفوفات `saturate`
 * و`sepia` و`hue-rotate` و`brightness` و`contrast` معرّفةٌ في مواصفة
 * Filter Effects نفسها التي يطبّقها المتصفّح، فضربُها بالترتيب نفسه
 * يعطي النتيجة نفسها بكسلاً ببكسل.
 */

/** مصفوفة ٤×٥ كما يقرؤها Skia: صفٌّ لكل قناة، وآخر عمودٍ إزاحة. */
type Matrix = number[];

const IDENTITY: Matrix = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
];

/** ضربُ مصفوفتين: الصفُّ الخامس ضمنيٌّ [0,0,0,0,1]. */
function multiply(a: Matrix, b: Matrix): Matrix {
  const out: Matrix = new Array(20).fill(0);
  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 5; column++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[row * 5 + k] * b[k * 5 + column];
      // العمود الخامس يجمع إزاحة `a` نفسها.
      if (column === 4) sum += a[row * 5 + 4];
      out[row * 5 + column] = sum;
    }
  }
  return out;
}

const saturate = (s: number): Matrix => [
  0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0, 0,
  0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0, 0,
  0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s, 0, 0,
  0, 0, 0, 1, 0,
];

const grayscale = (amount: number): Matrix => saturate(1 - amount);

const sepia = (amount: number): Matrix => [
  0.393 + 0.607 * (1 - amount), 0.769 - 0.769 * (1 - amount), 0.189 - 0.189 * (1 - amount), 0, 0,
  0.349 - 0.349 * (1 - amount), 0.686 + 0.314 * (1 - amount), 0.168 - 0.168 * (1 - amount), 0, 0,
  0.272 - 0.272 * (1 - amount), 0.534 - 0.534 * (1 - amount), 0.131 + 0.869 * (1 - amount), 0, 0,
  0, 0, 0, 1, 0,
];

const brightness = (value: number): Matrix => [
  value, 0, 0, 0, 0,
  0, value, 0, 0, 0,
  0, 0, value, 0, 0,
  0, 0, 0, 1, 0,
];

/** التباين يضرب ويُزيح: `c·x + (1−c)/2` — كما في المواصفة. */
const contrast = (c: number): Matrix => {
  const shift = (1 - c) / 2;
  return [
    c, 0, 0, 0, shift,
    0, c, 0, 0, shift,
    0, 0, c, 0, shift,
    0, 0, 0, 1, 0,
  ];
};

const hueRotate = (degrees: number): Matrix => {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return [
    0.213 + cos * 0.787 - sin * 0.213, 0.715 - cos * 0.715 - sin * 0.715, 0.072 - cos * 0.072 + sin * 0.928, 0, 0,
    0.213 - cos * 0.213 + sin * 0.143, 0.715 + cos * 0.285 + sin * 0.140, 0.072 - cos * 0.072 - sin * 0.283, 0, 0,
    0.213 - cos * 0.213 - sin * 0.787, 0.715 - cos * 0.715 + sin * 0.715, 0.072 + cos * 0.928 + sin * 0.072, 0, 0,
    0, 0, 0, 1, 0,
  ];
};

const chain = (...matrices: Matrix[]): Matrix =>
  matrices.reduce((left, right) => multiply(right, left), IDENTITY);

/**
 * كما في `src/components/story-composer.tsx` حرفاً بحرف:
 * المفتاح والاسم واحدان، والتركيبة ترجمةُ سلسلة CSS نفسها.
 *
 * و`vignette` إعتامُ الأطراف (٠–١) — ما يجعل الصورة «مصوَّرة» لا «ملوَّنة»:
 * مصفوفةُ الألوان وحدها تغيّر كلَّ بكسلٍ بالقدر نفسه فتُقرأ طبقةً فوق الصورة،
 * والأطرافُ الداكنة تشدّ العين إلى الوسط كعدسةٍ حقيقيّة. يُرسم تدرّجاً
 * دائريّاً فوق الصورة هنا، وفي الويب طبقةً بالتدرّج نفسه.
 */
export type Filter = { key: string; name: string; matrix: Matrix; vignette?: number };

export const FILTERS: Filter[] = [
  { key: "", name: "بلا", matrix: IDENTITY },
  // sepia(.35) saturate(1.25) contrast(1.03)
  { key: "warm", name: "دافئ", matrix: chain(sepia(0.35), saturate(1.25), contrast(1.03)) },
  // sepia(.25) saturate(1.4) hue-rotate(-8deg) brightness(1.05) contrast(1.05)
  { key: "gold", name: "ذهبي", matrix: chain(sepia(0.25), saturate(1.4), hueRotate(-8), brightness(1.05), contrast(1.05)), vignette: 0.25 },
  // sepia(.3) saturate(1.6) hue-rotate(-20deg) contrast(1.1)
  { key: "dusk", name: "غروب", matrix: chain(sepia(0.3), saturate(1.6), hueRotate(-20), contrast(1.1)), vignette: 0.35 },
  // sepia(.5) saturate(1.5) hue-rotate(-12deg) brightness(1.06)
  { key: "desert", name: "صحراء", matrix: chain(sepia(0.5), saturate(1.5), hueRotate(-12), brightness(1.06)), vignette: 0.2 },
  // sepia(.6) saturate(1.1) brightness(1.05)
  { key: "sand", name: "رملي", matrix: chain(sepia(0.6), saturate(1.1), brightness(1.05)) },
  // saturate(1.5) contrast(1.1)
  { key: "vivid", name: "زاهي", matrix: chain(saturate(1.5), contrast(1.1)) },
  // saturate(1.8) contrast(1.2) brightness(1.03)
  { key: "pop", name: "نابض", matrix: chain(saturate(1.8), contrast(1.2), brightness(1.03)) },
  // contrast(1.25) saturate(1.3) brightness(.97)
  { key: "chrome", name: "كروم", matrix: chain(contrast(1.25), saturate(1.3), brightness(0.97)), vignette: 0.2 },
  // brightness(1.12) contrast(1.05) saturate(1.15)
  { key: "noon", name: "ظهيرة", matrix: chain(brightness(1.12), contrast(1.05), saturate(1.15)) },
  // hue-rotate(-12deg) saturate(1.1) brightness(1.04)
  { key: "cool", name: "بارد", matrix: chain(hueRotate(-12), saturate(1.1), brightness(1.04)) },
  // hue-rotate(-25deg) saturate(1.3) contrast(1.1) brightness(1.02)
  { key: "teal", name: "فيروزي", matrix: chain(hueRotate(-25), saturate(1.3), contrast(1.1), brightness(1.02)) },
  // hue-rotate(-40deg) saturate(1.2) brightness(1.04) contrast(1.05)
  { key: "ocean", name: "بحر", matrix: chain(hueRotate(-40), saturate(1.2), brightness(1.04), contrast(1.05)) },
  // hue-rotate(12deg) saturate(1.2) brightness(1.03)
  { key: "rose", name: "وردي", matrix: chain(hueRotate(12), saturate(1.2), brightness(1.03)) },
  // hue-rotate(20deg) saturate(1.5) brightness(1.08) contrast(.95)
  { key: "candy", name: "حلوى", matrix: chain(hueRotate(20), saturate(1.5), brightness(1.08), contrast(0.95)) },
  // saturate(.75) brightness(1.08) contrast(.92)
  { key: "fade", name: "باهت", matrix: chain(saturate(0.75), brightness(1.08), contrast(0.92)) },
  // brightness(1.15) contrast(.8) saturate(.7)
  { key: "mist", name: "ضباب", matrix: chain(brightness(1.15), contrast(0.8), saturate(0.7)) },
  // contrast(1.2) saturate(.85) sepia(.15)
  { key: "film", name: "فيلم", matrix: chain(contrast(1.2), saturate(0.85), sepia(0.15)), vignette: 0.3 },
  // sepia(.45) contrast(.9) brightness(1.1) saturate(.8)
  { key: "retro", name: "قديم", matrix: chain(sepia(0.45), contrast(0.9), brightness(1.1), saturate(0.8)), vignette: 0.45 },
  // brightness(.9) contrast(1.15) hue-rotate(-8deg) saturate(.9)
  { key: "night", name: "ليلي", matrix: chain(brightness(0.9), contrast(1.15), hueRotate(-8), saturate(0.9)), vignette: 0.3 },
  // grayscale(1) contrast(1.08)
  { key: "mono", name: "رمادي", matrix: chain(grayscale(1), contrast(1.08)) },
  // grayscale(1) brightness(1.12) contrast(.95)
  { key: "silver", name: "فضي", matrix: chain(grayscale(1), brightness(1.12), contrast(0.95)) },
  // grayscale(1) contrast(1.35) brightness(.95)
  { key: "ink", name: "حبر", matrix: chain(grayscale(1), contrast(1.35), brightness(0.95)) },
  // grayscale(1) contrast(1.6) brightness(.9)
  { key: "noir", name: "نوار", matrix: chain(grayscale(1), contrast(1.6), brightness(0.9)), vignette: 0.5 },
];

export const filterOf = (key: string | null | undefined): Filter =>
  FILTERS.find((item) => item.key === (key ?? "")) ?? FILTERS[0];

export const filterMatrix = (key: string | null | undefined): Matrix => filterOf(key).matrix;
