import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * عميل Prisma واحد لكل عملية، يُنشأ عند أول استعلام.
 *
 * خادم التطوير في Next يعيد تقييم الوحدات عند كل تعديل، وبدون التخزين في
 * globalThis يُفتح مجمّع اتصالات جديد مع كل إعادة تحميل حتى ترفض القاعدة
 * الاتصال. والإنشاء مؤجَّل عمداً حتى لا يفشل `next build` على مسار لا يحتاج
 * القاعدة أصلاً حين تغيب DATABASE_URL.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL مطلوب للاتصال بقاعدة البيانات");
  }

  const adapter = new PrismaPg({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

function client(): PrismaClient {
  globalForPrisma.prisma ??= createClient();
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const instance = client();
    const value = Reflect.get(instance, property, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
  has(_target, property) {
    return Reflect.has(client(), property);
  },
}) as PrismaClient;
