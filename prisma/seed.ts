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
  // على الخادم يُستدعى هذا الملف عند كل إقلاع، فـ--if-empty يجعله بلا أثر
  // بعد أول مرة. بدونه كان كل نشر يمسح بيانات التجربة ويعيد بناءها.
  if (process.argv.includes("--if-empty")) {
    const existing = await prisma.user.count();
    if (existing > 0) {
      console.log(`القاعدة مأهولة (${existing} مستخدمين) — تخطّي البذر.`);
      return;
    }
  }

  // بذرة قابلة لإعادة التشغيل: تُمسح البيانات بترتيب يحترم المفاتيح الأجنبية.
  await prisma.$transaction([
    prisma.view.deleteMany(),
    prisma.reaction.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.message.deleteMany(),
    prisma.conversation.deleteMany(),
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
        name: "كهرمان",
        priceHalalas: 1500,
        spec: "linear-gradient(135deg,#ffb75e,#ffcd8a 40%,#d4903f)",
        sortOrder: 1,
      },
      {
        kind: "FRAME" as const,
        name: "مرجان",
        priceHalalas: 1200,
        spec: "linear-gradient(135deg,#ff7a7a,#ffb0a4 40%,#b8555c)",
        sortOrder: 2,
      },
      {
        kind: "FRAME" as const,
        name: "سنة كاملة",
        priceHalalas: 0,
        spec: "repeating-conic-gradient(#ffb75e 0deg 18deg,#ff7a7a 18deg 36deg)",
        earnedAfterDays: 365,
        sortOrder: 3,
      },
      {
        kind: "BACKGROUND" as const,
        name: "ليل الرياض",
        priceHalalas: 2500,
        spec: "linear-gradient(140deg,#1e293b,#0b1120)",
        sortOrder: 4,
      },
      {
        kind: "BACKGROUND" as const,
        name: "غبار الظهيرة",
        priceHalalas: 2500,
        spec: "linear-gradient(140deg,#ffb75e,#8a3f52)",
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

  const place = await prisma.moment.create({
    data: {
      authorId: naif.id,
      kind: "PLACE",
      placeName: "شارع التحلية",
      placeCity: "الرياض",
      lat: 24.6913,
      lng: 46.6853,
      text: "قهوة وسوالف",
      createdAt: hoursAgo(1),
    },
  });
  await prisma.momentTag.create({ data: { momentId: place.id, userId: sultan.id } });
  await prisma.comment.create({
    data: { momentId: place.id, userId: noura.id, body: "المكان هذا ما يمل" },
  });

  const photo = await prisma.moment.create({
    data: {
      authorId: noura.id,
      kind: "PHOTO",
      text: "آخر ضوء قبل ما نرجع من الغروب",
      imageSpec: "linear-gradient(160deg,#ffb75e,#ff7a7a 55%,#7a3b52)",
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
      imageSpec: "linear-gradient(160deg,#f5efe7,#c08a6a 45%,#3b3049)",
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
  await prisma.momentTag.create({ data: { momentId: tagged.id, userId: mohammed.id } });

  // لحظة «أضاف فلاناً» — تُنشأ تلقائياً عند قبول الصداقة في التطبيق.
  await prisma.moment.create({
    data: {
      authorId: mohammed.id,
      kind: "FRIEND_ADDED",
      text: "سلطان",
      createdAt: hoursAgo(50),
    },
  });

  // محادثة خاصة جاهزة بين محمد ونورة.
  const conversation = await prisma.conversation.create({
    data: { aId: mohammed.id < noura.id ? mohammed.id : noura.id, bId: mohammed.id < noura.id ? noura.id : mohammed.id },
  });
  await prisma.message.createMany({
    data: [
      { conversationId: conversation.id, senderId: noura.id, body: "وصلت البيت؟", createdAt: hoursAgo(2) },
      { conversationId: conversation.id, senderId: mohammed.id, body: "توّي، الله يسلمك", createdAt: hoursAgo(2) },
    ],
  });

  console.log("تمت التهيئة:");
  console.log("  mohammed@athar.test / athar1234  (دائرته ٣، وعنده محادثة مع نورة)");
  console.log("  noura@athar.test    / athar1234  (مشتركة في أثر+، تلبس إطار كهرمان)");
  console.log("  naif@athar.test     / athar1234  (نشر مكاناً بإحداثيات)");
  console.log("  sultan@athar.test   / athar1234");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
