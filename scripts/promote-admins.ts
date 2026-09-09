import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * يضبط المشرفين عند كل إقلاع.
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

async function main() {
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

main()
  .catch((error) => {
    // لا يوقف الإقلاع: التطبيق يعمل بلا مشرف، واللوحة وحدها تبقى محجوبة.
    console.error("تعذّر ضبط المشرفين:", error);
  })
  .finally(() => prisma.$disconnect());
