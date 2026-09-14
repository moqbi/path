import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * يضبط ما يحتاجه التطبيق عند كل إقلاع: المشرفون، ووسم الداعم الأول.
 *
 * لازم لأن البذرة المحمية لا تعمل على قاعدة مأهولة: نشرٌ أضاف عمود الدور
 * بعد إنشاء الحسابات ترك الجميع مستخدمين عاديين، فبدت لوحة التحكم
 * «لا تفتح» بينما كانت تحجب بحق.
 *
 * ADMIN_EMAILS قائمة مفصولة بفواصل. وإن لم تُضبط ولم يوجد أي مشرف، يُرقّى
 * حساب العرض وحده — لا مستخدم حقيقي يُرقّى بالصدفة.
 */
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEMO_ADMIN = "mohammed@athar.test";

async function admins() {
  const emails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (emails.length > 0) {
    const { count } = await prisma.user.updateMany({
      where: { email: { in: emails }, role: { not: "ADMIN" } },
      data: { role: "ADMIN" },
    });
    console.log(`المشرفون: ${emails.join("، ")} (رُقّي ${count})`);
    return;
  }

  const admins = await prisma.user.count({ where: { role: "ADMIN" } });
  if (admins > 0) {
    console.log(`المشرفون الحاليون: ${admins}`);
    return;
  }

  const { count } = await prisma.user.updateMany({
    where: { email: DEMO_ADMIN },
    data: { role: "ADMIN" },
  });
  console.log(
    count > 0
      ? `لا مشرف — رُقّي حساب العرض ${DEMO_ADMIN}`
      : "لا مشرف ولا حساب عرض. اضبط ADMIN_EMAILS.",
  );
}

/**
 * وسم واحد جاهز لأول إقلاع فقط: «داعم» لمشتركي أثر+.
 * لا يُنشأ إن وُجد أي وسم — المشرف يملك وسومه بعد ذلك، ولا يعيد سكربت
 * الإقلاع كتابة ما حذفه أو غيّره.
 */
async function tags() {
  const existing = await prisma.tag.count();
  if (existing > 0) {
    console.log(`الوسوم الحالية: ${existing}`);
    return;
  }

  await prisma.tag.create({
    data: { name: "داعم", bg: "#f6b93b", fg: "#3b2a05", autoForPlus: true, sortOrder: 1 },
  });
  console.log("أُنشئ وسم «داعم» لمشتركي أثر+");
}


/**
 * تصنيفات المتجر الأولى وأصنافها.
 *
 * تُكتب مرة واحدة: إن وُجد أي تصنيف فالمشرف يملك متجره، ولا يعيد سكربت
 * الإقلاع رصف ما رتّبه أو حذفه. والأصناف تُطابَق بالاسم فلا تتكرّر إن
 * أُضيف تصنيفٌ جديد لاحقاً.
 */
const CATEGORIES = [
  { name: "الإطارات", slug: "frames", sortOrder: 1 },
  { name: "الثيمات", slug: "themes", sortOrder: 2 },
  { name: "التمائم", slug: "charms", sortOrder: 3 },
] as const;

/**
 * ثوبُ كل ثيم: التطبيق كلّه يلبس ألوانه، لا خلفيتُه وحدها.
 * سبعة ألوان، وما عداها يُشتقّ منها في `themeVars`.
 */
const PALETTES: Record<string, Record<string, string>> = {
  Sunset: {
    paper: "#f7e7dd", card: "#fffaf6", ink: "#3b1f1a", accent: "#ff6f4d",
    onAccent: "#fffaf6", chrome: "#40211c", chromeInk: "#ffeee6",
  },
  Film: {
    paper: "#e4e8ea", card: "#fbfcfc", ink: "#1d272d", accent: "#6d8391",
    onAccent: "#ffffff", chrome: "#202b33", chromeInk: "#eef2f4",
  },
  Midnight: {
    paper: "#e6ecf2", card: "#fbfdff", ink: "#0e1a24", accent: "#2f6d9e",
    onAccent: "#ffffff", chrome: "#0b141c", chromeInk: "#e9f1f8",
  },
  Sand: {
    paper: "#efe4cf", card: "#fdf9f1", ink: "#3a2f1c", accent: "#c9a227",
    onAccent: "#2b2412", chrome: "#4a3d24", chromeInk: "#f6efdf",
  },
  Paper: {
    paper: "#f1efe9", card: "#ffffff", ink: "#1f2429", accent: "#7a8a99",
    onAccent: "#ffffff", chrome: "#2a3038", chromeInk: "#f4f5f7",
  },
  "رمضان": {
    paper: "#e3ece7", card: "#fafdfb", ink: "#12281f", accent: "#1f6f5c",
    onAccent: "#f3fbf7", chrome: "#10241d", chromeInk: "#e8f5ef",
  },
  "سفر": {
    paper: "#e2edf7", card: "#fbfdff", ink: "#13283c", accent: "#2b6cb0",
    onAccent: "#ffffff", chrome: "#12304c", chromeInk: "#e8f2fb",
  },
  Winter: {
    paper: "#e8f1f7", card: "#ffffff", ink: "#17313f", accent: "#4e94bf",
    onAccent: "#ffffff", chrome: "#1c3a4b", chromeInk: "#eef7fc",
  },
};

const STARTERS = [
  // وصل حديثاً
  { name: "Sunset", slug: "themes", kind: "THEME", price: 1500, spec: "linear-gradient(135deg,#ff9a4d,#ff5f6d)" },
  { name: "Film", slug: "themes", kind: "THEME", price: 1500, spec: "linear-gradient(135deg,#3a4a58,#8fa3b0)" },
  { name: "Premium", slug: "frames", kind: "FRAME", price: 2500, spec: "linear-gradient(135deg,#f6b93b,#d99b1f)", plusOnly: true },
  // ثيمات أثر
  { name: "Midnight", slug: "themes", kind: "THEME", price: 1200, spec: "linear-gradient(135deg,#0e1a24,#2b3f4f)" },
  { name: "Sand", slug: "themes", kind: "THEME", price: 1200, spec: "linear-gradient(135deg,#e9dcc3,#cbb28a)" },
  { name: "Paper", slug: "themes", kind: "THEME", price: 1200, spec: "linear-gradient(135deg,#f7f5ef,#e0dbd0)" },
  // حزم محدودة
  { name: "رمضان", slug: "frames", kind: "FRAME", price: 2000, spec: "linear-gradient(135deg,#1f6f5c,#c9a227)", limited: true },
  { name: "سفر", slug: "themes", kind: "THEME", price: 1800, spec: "linear-gradient(135deg,#2b6cb0,#63b3ed)", limited: true },
  { name: "Winter", slug: "themes", kind: "THEME", price: 1800, spec: "linear-gradient(135deg,#8ec5e6,#e8f4fb)", limited: true },
] as const;

async function store() {
  const existing = await prisma.storeCategory.count();
  if (existing > 0) {
    console.log(`تصنيفات المتجر الحالية: ${existing}`);
    return;
  }

  for (const category of CATEGORIES) {
    await prisma.storeCategory.create({ data: category });
  }

  const categories = await prisma.storeCategory.findMany({ select: { id: true, slug: true } });
  const idOf = new Map(categories.map((row) => [row.slug, row.id]));

  // الأوّل في القائمة هو الأحدث: صفّ «وصل حديثاً» يُبنى من التاريخ، فنكتبه
  // نازلاً بدل أن تتساوى الطوابع في الثانية نفسها فيختلط الترتيب.
  let order = 100;
  let minutes = 0;
  for (const item of STARTERS) {
    const found = await prisma.storeItem.findFirst({ where: { name: item.name } });
    if (found) continue;
    await prisma.storeItem.create({
      data: {
        kind: item.kind,
        name: item.name,
        priceHalalas: item.price,
        spec: item.spec,
        plusOnly: "plusOnly" in item ? item.plusOnly : false,
        limited: "limited" in item ? item.limited : false,
        categoryId: idOf.get(item.slug) ?? null,
        palette: PALETTES[item.name] ? JSON.stringify(PALETTES[item.name]) : null,
        sortOrder: order++,
        createdAt: new Date(Date.now() - minutes++ * 60_000),
      },
    });
  }

  // ما سبق من البذرة يُنسب إلى تصنيفه فلا يبقى صنفٌ بلا شريحة.
  await prisma.storeItem.updateMany({
    where: { kind: "FRAME", categoryId: null },
    data: { categoryId: idOf.get("frames") },
  });
  await prisma.storeItem.updateMany({
    where: { kind: { in: ["BACKGROUND", "THEME"] }, categoryId: null },
    data: { categoryId: idOf.get("themes") },
  });

  console.log("أُنشئت تصنيفات المتجر وأصنافها الأولى");
}

/** الثيمات المبذورة قبل الألوان تُكسى ثوبها — وإلا بقيت خلفيةً فقط. */
async function palettes() {
  let dressed = 0;
  for (const [name, palette] of Object.entries(PALETTES)) {
    const item = await prisma.storeItem.findFirst({ where: { name }, select: { id: true, palette: true } });
    if (!item || item.palette) continue;
    await prisma.storeItem.update({ where: { id: item.id }, data: { palette: JSON.stringify(palette) } });
    dressed++;
  }
  if (dressed > 0) console.log(`أُلبست ${dressed} ثيمات ألوانها`);
}


/**
 * تميمتان للتجربة: نجمة وهلال.
 *
 * تُنشآن إن لم توجد تميمةٌ واحدة — مستقلّتين عن حارس التصنيفات، فقاعدةٌ
 * أُنشئت قبل التمائم تنالهما عند أول إقلاع بعد التحديث. ورسمهما SVG داخل
 * `spec`، والمشرف يرفع صورةً حقيقية فوقهما من اللوحة متى شاء.
 */
const CHARMS = [
  {
    name: "نجمة",
    price: 800,
    spec: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="%230e1a24"/><path d="M12 5l2.1 4.3 4.7.7-3.4 3.3.8 4.7L12 15.8 7.8 18l.8-4.7L5.2 10l4.7-.7z" fill="%23f6b93b"/></svg>') center/cover no-repeat`,
  },
  {
    name: "هلال",
    price: 800,
    spec: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="%231f6f5c"/><path d="M15.6 5.4a7 7 0 1 0 3 8.9 5.6 5.6 0 0 1-3-8.9z" fill="%23f7f5ef"/></svg>') center/cover no-repeat`,
  },
] as const;

async function charms() {
  const existing = await prisma.storeItem.count({ where: { kind: "CHARM" } });
  if (existing > 0) {
    console.log(`التمائم الحالية: ${existing}`);
    return;
  }

  const category = await prisma.storeCategory.findUnique({ where: { slug: "charms" } });
  let order = 200;
  let minutes = 20;
  for (const charm of CHARMS) {
    await prisma.storeItem.create({
      data: {
        kind: "CHARM",
        name: charm.name,
        priceHalalas: charm.price,
        spec: charm.spec,
        categoryId: category?.id ?? null,
        sortOrder: order++,
        // تُؤرَّخ قبل أصناف الافتتاح كي يبقى صفّ «وصل حديثاً» كما رُسم.
        createdAt: new Date(Date.now() - minutes++ * 60_000),
      },
    });
  }
  console.log("أُنشئت تميمتا التجربة: نجمة وهلال");
}

async function main() {
  await admins();
  await tags();
  await store();
  await palettes();
  await charms();
}

main()
  .catch((error) => {
    // لا يوقف الإقلاع: التطبيق يعمل بلا مشرف، واللوحة وحدها تبقى محجوبة.
    console.error("تعذّر ضبط الافتراضيات:", error);
  })
  .finally(() => prisma.$disconnect());
