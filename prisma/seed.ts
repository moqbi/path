import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

async function hash(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const PASSWORD = "athar1234";
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);

async function main() {
  // بذرة قابلة لإعادة التشغيل: تُمسح البيانات بترتيب يحترم المفاتيح الأجنبية.
  await prisma.$transaction([
    prisma.view.deleteMany(),
    prisma.reaction.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.joining.deleteMany(),
    prisma.momentTag.deleteMany(),
    prisma.moment.deleteMany(),
    prisma.friendship.deleteMany(),
    prisma.purchase.deleteMany(),
  ]);
  await prisma.user.updateMany({ data: { frameId: null, backgroundId: null } });
  await prisma.storeItem.deleteMany();
  await prisma.user.deleteMany();

  const items = await Promise.all(
    [
      {
        kind: "FRAME" as const,
        name: "ذهب",
        priceHalalas: 1500,
        spec: "linear-gradient(135deg,#c79a3e,#ebd9a4 40%,#9c7526)",
        sortOrder: 1,
      },
      {
        kind: "FRAME" as const,
        name: "نخيل",
        priceHalalas: 1200,
        spec: "linear-gradient(135deg,#7e9c8c,#c8ded2 40%,#43604f)",
        sortOrder: 2,
      },
      {
        kind: "FRAME" as const,
        name: "سنة كاملة",
        priceHalalas: 0,
        spec: "repeating-conic-gradient(#b0532f 0deg 18deg,#e8c9a8 18deg 36deg)",
        earnedAfterDays: 365,
        sortOrder: 3,
      },
      {
        kind: "BACKGROUND" as const,
        name: "ليل الرياض",
        priceHalalas: 2500,
        spec: "linear-gradient(140deg,#3d5a50,#22312b)",
        sortOrder: 4,
      },
      {
        kind: "BACKGROUND" as const,
        name: "غبار الظهيرة",
        priceHalalas: 2500,
        spec: "linear-gradient(140deg,#d8ae7e,#8a5334)",
        sortOrder: 5,
      },
    ].map((data) => prisma.storeItem.create({ data })),
  );

  const passwordHash = await hash(PASSWORD);

  const mohammed = await prisma.user.create({
    data: {
      email: "mohammed@athar.test",
      passwordHash,
      name: "محمد",
      city: "الرياض",
      storeCredit: 5000,
      createdAt: new Date(Date.now() - 190 * 86_400_000),
    },
  });

  const noura = await prisma.user.create({
    data: {
      email: "noura@athar.test",
      passwordHash,
      name: "نورة",
      city: "الرياض",
      storeCredit: 3000,
      isPlus: true,
      plusUntil: new Date(Date.now() + 30 * 86_400_000),
      createdAt: new Date(Date.now() - 120 * 86_400_000),
    },
  });

  const naif = await prisma.user.create({
    data: {
      email: "naif@athar.test",
      passwordHash,
      name: "نايف",
      city: "الرياض",
      createdAt: new Date(Date.now() - 80 * 86_400_000),
    },
  });

  const sultan = await prisma.user.create({
    data: {
      email: "sultan@athar.test",
      passwordHash,
      name: "سلطان",
      city: "جدة",
      createdAt: new Date(Date.now() - 60 * 86_400_000),
    },
  });

  // نورة تملك إطاراً ملبوساً حتى تظهر الإطارات في الخط الزمني من أول تشغيل.
  await prisma.purchase.create({
    data: { userId: noura.id, itemId: items[0].id, paidHalalas: 1200 },
  });
  await prisma.user.update({
    where: { id: noura.id },
    data: { frameId: items[0].id, backgroundId: null },
  });

  const circle = [
    [mohammed.id, noura.id],
    [mohammed.id, naif.id],
    [mohammed.id, sultan.id],
    [noura.id, naif.id],
  ];
  await prisma.friendship.createMany({
    data: circle.map(([requesterId, addresseeId]) => ({
      requesterId,
      addresseeId,
      status: "ACCEPTED" as const,
    })),
  });

  const presence = await prisma.moment.create({
    data: {
      authorId: naif.id,
      kind: "PRESENCE",
      placeName: "شارع التحلية",
      placeCity: "الرياض",
      text: "قهوة وسوالف، الباب مفتوح",
      expiresAt: new Date(Date.now() + 3 * 3_600_000),
      createdAt: hoursAgo(1),
    },
  });
  await prisma.joining.createMany({
    data: [
      { momentId: presence.id, userId: noura.id },
      { momentId: presence.id, userId: sultan.id },
    ],
  });
  await prisma.momentTag.create({
    data: { momentId: presence.id, userId: sultan.id, approved: true },
  });

  const photo = await prisma.moment.create({
    data: {
      authorId: noura.id,
      kind: "PHOTO",
      text: "آخر ضوء قبل ما نرجع من الغروب",
      imageSpec: "linear-gradient(160deg,#c8a98a,#9e7b5f 55%,#6e5947)",
      createdAt: hoursAgo(3),
    },
  });
  await prisma.reaction.createMany({
    data: [
      { momentId: photo.id, userId: mohammed.id, kind: "LOVE" },
      { momentId: photo.id, userId: naif.id, kind: "SMILE" },
    ],
  });
  await prisma.view.createMany({
    data: [
      { momentId: photo.id, userId: mohammed.id },
      { momentId: photo.id, userId: naif.id },
    ],
  });
  await prisma.comment.create({
    data: {
      momentId: photo.id,
      userId: naif.id,
      body: "الله يعطيك العافية، الصورة طلعت مثل اللوحة",
    },
  });

  await prisma.moment.create({
    data: {
      authorId: mohammed.id,
      kind: "PLACE",
      placeName: "الرياض",
      placeCity: "الرياض",
      createdAt: hoursAgo(5),
    },
  });

  await prisma.moment.create({
    data: {
      authorId: sultan.id,
      kind: "MUSIC",
      musicTitle: "وين رايح",
      musicArtist: "عبدالمجيد عبدالله",
      createdAt: hoursAgo(7),
    },
  });

  await prisma.moment.create({
    data: {
      authorId: mohammed.id,
      kind: "PHOTO",
      text: "أول قهوة في المكتب الجديد",
      imageSpec: "linear-gradient(160deg,#d8c3a5,#8c6c4e)",
      createdAt: hoursAgo(30),
    },
  });

  await prisma.moment.create({
    data: { authorId: noura.id, kind: "SLEEP", createdAt: hoursAgo(34) },
  });

  // إشارة معلّقة تنتظر موافقة محمد — تُظهر مسار الموافقة عند أول دخول.
  const tagged = await prisma.moment.create({
    data: {
      authorId: noura.id,
      kind: "THOUGHT",
      text: "أفضل عشاء هالأسبوع، وما كان مخطط له أصلاً",
      createdAt: hoursAgo(20),
    },
  });
  await prisma.momentTag.create({
    data: { momentId: tagged.id, userId: mohammed.id, approved: false },
  });

  console.log("تمت التهيئة:");
  console.log("  mohammed@athar.test / athar1234  (دائرته ٣، عنده إشارة معلّقة)");
  console.log("  noura@athar.test    / athar1234  (مشتركة في أثر+، تلبس إطار ذهب)");
  console.log("  naif@athar.test     / athar1234  (عنده حضور مؤقت فعّال)");
  console.log("  sultan@athar.test   / athar1234");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
