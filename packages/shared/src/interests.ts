/**
 * الاهتمامات (القاعدة ٣٧٤): قائمةٌ مغلقة بتصنيفاتها، يختار منها صاحبُ الحساب
 * من ثلاثة إلى عشرة، وتُرى المشتركةُ بينه وبين صديقه في ملفّه.
 *
 * يُحفظ **المعرّف** لا الاسم (`music.pop`): الاسمُ يُصحَّح ويُترجَم والمعرّفُ
 * لا يتغيّر. ومعرّفٌ حُذف من هنا يُتجاهل عند القراءة ولا يُكسر به شيء — فلا
 * يُعاد استعمالُ معرّفٍ قديمٍ لمعنىً آخر.
 */
export type InterestGroup = {
  id: string;
  emoji: string;
  label: string;
  items: { id: string; label: string }[];
};

const group = (id: string, emoji: string, label: string, items: [string, string][]): InterestGroup => ({
  id,
  emoji,
  label,
  items: items.map(([key, name]) => ({ id: `${id}.${key}`, label: name })),
});

export const INTERESTS: InterestGroup[] = [
  group("music", "🎵", "الموسيقى", [
    ["pop", "البوب"],
    ["rock", "الروك"],
    ["rap", "الراب"],
    ["hiphop", "الهيب هوب"],
    ["tarab", "الطرب العربي"],
    ["khaleeji", "الموسيقى الخليجية"],
    ["jazz", "الجاز"],
  ]),
  group("fun", "🎬", "الترفيه", [
    ["movies", "الأفلام"],
    ["series", "المسلسلات"],
    ["anime", "الأنمي"],
    ["comedy", "الكوميديا"],
    ["drama", "الدراما"],
    ["horror", "الرعب"],
    ["scifi", "الخيال العلمي"],
    ["games", "الألعاب"],
  ]),
  group("art", "📷", "الفن والإبداع", [
    ["photo", "التصوير"],
    ["drawing", "الرسم"],
    ["design", "التصميم"],
    ["writing", "الكتابة"],
    ["poetry", "الشعر"],
    ["content", "صناعة المحتوى"],
    ["editing", "المونتاج"],
  ]),
  group("travel", "✈️", "السفر", [
    ["travel", "السفر"],
    ["cities", "استكشاف المدن"],
    ["camping", "التخييم"],
    ["adventure", "المغامرات"],
    ["roadtrips", "الرحلات البرية"],
    ["beaches", "الشواطئ"],
    ["nature", "الطبيعة"],
    ["climbing", "تسلق الجبال"],
  ]),
  group("cars", "🏍️", "المركبات", [
    ["motorbikes", "الدراجات النارية"],
    ["sports", "السيارات الرياضية"],
    ["classic", "السيارات الكلاسيكية"],
    ["modified", "السيارات المعدلة"],
    ["racing", "السباقات"],
    ["offroad", "الدفع الرباعي"],
  ]),
  group("sport", "⚽", "الرياضة", [
    ["football", "كرة القدم"],
    ["basketball", "كرة السلة"],
    ["tennis", "التنس"],
    ["swimming", "السباحة"],
    ["running", "الجري"],
    ["cycling", "ركوب الدراجات"],
    ["boxing", "الملاكمة"],
    ["fitness", "اللياقة البدنية"],
  ]),
  group("life", "☕", "الطعام ونمط الحياة", [
    ["coffee", "القهوة"],
    ["tea", "الشاي"],
    ["cooking", "الطبخ"],
    ["restaurants", "المطاعم"],
    ["sweets", "الحلويات"],
    ["fashion", "الموضة"],
    ["perfume", "العطور"],
    ["watches", "الساعات"],
  ]),
  group("mind", "📚", "المعرفة والثقافة", [
    ["reading", "القراءة"],
    ["history", "التاريخ"],
    ["philosophy", "الفلسفة"],
    ["psychology", "علم النفس"],
    ["languages", "اللغات"],
    ["cultures", "الثقافات"],
    ["heritage", "الآثار"],
    ["museums", "المتاحف"],
  ]),
  group("animals", "🐾", "الحيوانات", [
    ["cats", "القطط"],
    ["birds", "الطيور"],
    ["horses", "الخيول"],
    ["wild", "الحيوانات البرية"],
  ]),
  group("hobby", "🧩", "الهوايات", [
    ["chess", "الشطرنج"],
    ["puzzles", "الألغاز"],
    ["collecting", "جمع المقتنيات"],
    ["pets", "الحيوانات"],
    ["plants", "النباتات"],
    ["farming", "الزراعة"],
    ["crafts", "الأعمال اليدوية"],
    ["boardgames", "الألعاب اللوحية"],
  ]),
];

/** أقلُّ ما يُحفظ وأكثرُه — والصفرُ مقبولٌ أيضاً: من أراد أن يمحوها كلَّها. */
export const INTERESTS_MIN = 3;
export const INTERESTS_MAX = 10;

const BY_ID = new Map(INTERESTS.flatMap((g) => g.items.map((item) => [item.id, { ...item, emoji: g.emoji, group: g.id }])));

/** الاهتمامُ بمعرّفه، وما ليس في القائمة `undefined`. */
export function interestOf(id: string) {
  return BY_ID.get(id);
}

/** ما في القائمة وحده، بلا تكرار، بترتيبه. */
export function cleanInterests(ids: readonly string[]): string[] {
  return [...new Set(ids)].filter((id) => BY_ID.has(id));
}
