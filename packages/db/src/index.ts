import { PrismaClient } from "../../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * عميل Prisma لكل ما يقرأ القاعدة — الخادم واللوحة والسكربتات.
 *
 * المخطّط واحد (`prisma/schema.prisma`) ويبقى في الجذر حتى يكتمل
 * الترحيل: مخطّطان لقاعدةٍ واحدة يعني هجرتين تتعاركان على نفس الجدول.
 *
 * والموبايل لا يستورد هذا الملف أبداً — ولا يستطيع: لا وصول للقاعدة من
 * جهازٍ في يد مستخدم، بل HTTPS إلى الخادم وحده.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export * from "../../../src/generated/prisma/client";
