/**
 * ينقل ما في القاعدة من ملفات إلى Cloudflare R2.
 *
 * يُشغَّل مرةً بعد ضبط المفاتيح: كل صفٍّ يحمل بايتات ولا يحمل مفتاحاً
 * يُرفع كائناً، ثم يُكتب مفتاحه وتُفرَّغ بايتاته. ويمكن قطعه وإعادته —
 * ما نُقل لا يُعاد، فالشرط «بلا مفتاح» يستبعده.
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { cloudReady, putObject } from "../src/lib/r2";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/webm": "weba",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/aac": "aac",
  "video/webm": "webm",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  if (!cloudReady()) {
    console.error("المفاتيح غير مضبوطة: R2_ACCOUNT_ID و R2_BUCKET و R2_ACCESS_KEY_ID و R2_SECRET_ACCESS_KEY");
    process.exit(1);
  }

  let moved = 0;
  let failed = 0;

  for (;;) {
    const batch = await prisma.media.findMany({
      where: { key: null, NOT: { bytes: null } },
      select: { id: true, ownerId: true, mime: true, bytes: true },
      take: 20,
    });
    if (batch.length === 0) break;

    for (const row of batch) {
      if (!row.bytes) continue;
      const key = `${row.ownerId}/${randomUUID()}.${EXT[row.mime] ?? "bin"}`;
      try {
        await putObject(key, new Uint8Array(row.bytes), row.mime);
        await prisma.media.update({ where: { id: row.id }, data: { key, bytes: null } });
        moved++;
      } catch (problem) {
        failed++;
        console.error(`تعذّر نقل ${row.id}:`, problem instanceof Error ? problem.message : problem);
        if (failed > 5) {
          console.error("توقّفنا بعد فشلٍ متكرّر — راجع المفاتيح أو اسم الدلو.");
          await prisma.$disconnect();
          process.exit(1);
        }
      }
    }
    console.log(`نُقل ${moved}…`);
  }

  console.log(`تمّ. نُقل ${moved} ملفاً.`);
  await prisma.$disconnect();
}

void main();
