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

async function main() {
  await admins();
  await tags();
  await store();
}

main()
  .catch((error) => {
    // لا يوقف الإقلاع: التطبيق يعمل بلا مشرف، واللوحة وحدها تبقى محجوبة.
    console.error("تعذّر ضبط الافتراضيات:", error);
  })
  .finally(() => prisma.$disconnect());
