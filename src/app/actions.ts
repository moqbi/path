"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  createSession,
  destroySession,
  requireUser,
  verifyPassword,
} from "@/lib/auth";
import { assertRoomForBoth, circleIds } from "@/lib/circle";
import { reverseGeocode } from "@/lib/places";
import { openConversation } from "@/lib/dm";
import type { MomentKind, ReactionKind } from "@/generated/prisma/client";

// ───────────────────────────── الدخول والخروج ─────────────────────────────

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("بريد غير صالح"),
  password: z.string().min(1, "اكتب كلمة المرور"),
});

export async function signIn(
  _previous: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string }> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  // رسالة واحدة للحالتين حتى لا يكشف النموذج أي البُرد مسجَّلة.
  const ok = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
  if (!user || !ok) return { error: "البريد أو كلمة المرور غير صحيحة" };

  await createSession(user.id);
  redirect("/");
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/login");
}

// ───────────────────────────── اللحظات ─────────────────────────────

/** تدرّجات تقوم مقام رفع الصور في النموذج الأولي. */
const IMAGE_SPECS = [
  "linear-gradient(160deg,#ffb75e,#ff7a7a 55%,#7a3b52)",
  "linear-gradient(160deg,#ff9d6e,#8c3f5d 70%,#1e293b)",
  "linear-gradient(160deg,#f5efe7,#c08a6a 45%,#3b3049)",
  "linear-gradient(160deg,#6f8bb5,#334467 60%,#0f172a)",
  "linear-gradient(160deg,#ffcd8a,#b35f6b 55%,#2a2f45)",
];

const randomImage = () => IMAGE_SPECS[Math.floor(Math.random() * IMAGE_SPECS.length)];

/**
 * الإشارة «مع فلان» تظهر فوراً بلا موافقة.
 * اللحظة تُنشر في صفحة كاتبها وحده ولا تدخل صفحة المُشار إليه، وهذا سلوك
 * Path نفسه. ولا يُشار إلا لمن هو داخل الدائرة.
 */
async function attachTags(momentId: string, authorId: string, userIds: string[]): Promise<void> {
  const wanted = [...new Set(userIds)].filter((id) => id && id !== authorId);
  if (wanted.length === 0) return;

  const allowed = new Set(await circleIds(authorId));
  const data = wanted.filter((id) => allowed.has(id)).map((userId) => ({ momentId, userId }));
  if (data.length === 0) return;

  await prisma.momentTag.createMany({ data, skipDuplicates: true });
}

/** لحظة صورة أو فكرة: نص، وإشارة اختيارية. */
export async function postSimple(formData: FormData): Promise<void> {
  const user = await requireUser();

  const kind = String(formData.get("kind") ?? "");
  if (kind !== "PHOTO" && kind !== "THOUGHT") throw new Error("نوع غير صالح");

  const text = String(formData.get("text") ?? "").trim().slice(0, 400);
  if (!text && kind === "THOUGHT") throw new Error("اكتب شيئاً");

  const moment = await prisma.moment.create({
    data: {
      authorId: user.id,
      kind: kind as MomentKind,
      text: text || null,
      imageSpec: kind === "PHOTO" ? randomImage() : null,
    },
  });

  await attachTags(moment.id, user.id, formData.getAll("with").map(String));
  revalidatePath("/");
  redirect("/");
}

/** «نام» — بلا نص وبلا إشارة: النوم لا يكون «مع» أحد. */
export async function postSleep(): Promise<void> {
  const user = await requireUser();
  await prisma.moment.create({ data: { authorId: user.id, kind: "SLEEP" } });
  revalidatePath("/");
  redirect("/");
}

const placeInput = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

/**
 * المكان يأتي من إذن الموقع في الجهاز، لا من إدخال يدوي.
 * الاسم يُشتق من الإحداثيات على الخادم؛ وإن تعذّر، تبقى الإحداثيات وحدها.
 */
export async function postPlace(formData: FormData): Promise<void> {
  const user = await requireUser();

  const parsed = placeInput.safeParse({
    lat: formData.get("lat"),
    lng: formData.get("lng"),
  });
  if (!parsed.success) throw new Error("تعذّر تحديد موقعك");

  const { lat, lng } = parsed.data;
  const place = await reverseGeocode(lat, lng);

  const moment = await prisma.moment.create({
    data: {
      authorId: user.id,
      kind: "PLACE",
      lat,
      lng,
      placeName: place.name,
      placeCity: place.city ?? user.city,
      text: String(formData.get("text") ?? "").trim().slice(0, 200) || null,
    },
  });

  await attachTags(moment.id, user.id, formData.getAll("with").map(String));
  revalidatePath("/");
  redirect("/");
}

/**
 * الأغنية تُنشر من الحساب المربوط، لا بكتابة الاسم والفنان.
 * بلا ربط لا يوجد ما يُنشر، فيُوجَّه المستخدم إلى شاشة الربط.
 */
export async function postNowPlaying(): Promise<void> {
  const user = await requireUser();

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { musicProvider: true, musicAccessToken: true },
  });
  if (!account?.musicProvider) redirect("/music");

  const track = await currentTrack(user.id);
  if (!track) redirect("/music?empty=1");

  await prisma.moment.create({
    data: {
      authorId: user.id,
      kind: "MUSIC",
      musicTitle: track.title,
      musicArtist: track.artist,
    },
  });

  revalidatePath("/");
  redirect("/");
}

/**
 * ما يُسمع الآن من المزوّد المربوط.
 *
 * سبوتيفاي تتطلب SPOTIFY_CLIENT_ID و SPOTIFY_CLIENT_SECRET؛ بدونهما الربط
 * معطّل ولا يُدّعى خلافه. وأنغامي لا تفتح واجهتها إلا لشركاء معتمدين، فلا
 * تُنفَّذ هنا حتى يتوفر اعتماد حقيقي.
 */
async function currentTrack(
  userId: string,
): Promise<{ title: string; artist: string } | null> {
  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: { musicProvider: true, musicAccessToken: true },
  });
  if (account?.musicProvider !== "SPOTIFY" || !account.musicAccessToken) return null;

  try {
    const response = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
      headers: { Authorization: `Bearer ${account.musicAccessToken}` },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (response.status === 204 || !response.ok) return null;

    const data = (await response.json()) as {
      item?: { name?: string; artists?: { name?: string }[] };
    };
    const title = data.item?.name;
    const artist = data.item?.artists?.map((a) => a.name).filter(Boolean).join("، ");
    if (!title) return null;

    return { title, artist: artist || "" };
  } catch {
    return null;
  }
}

export async function disconnectMusic(): Promise<void> {
  const user = await requireUser();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      musicProvider: null,
      musicAccountName: null,
      musicAccessToken: null,
      musicRefreshToken: null,
      musicTokenExpires: null,
    },
  });
  revalidatePath("/music");
}

// ───────────────────────────── الدائرة ─────────────────────────────

/**
 * قبول الصداقة ينشئ لحظة «أضاف فلاناً» لكلا الطرفين — فالإضافة حدث في
 * حياة الدائرة يستحق أن يُرى، لا تغييراً صامتاً في جدول.
 */
export async function acceptFriend(friendshipId: string): Promise<void> {
  const user = await requireUser();

  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
    select: { id: true, requesterId: true, addresseeId: true, status: true },
  });
  if (!friendship || friendship.addresseeId !== user.id) throw new Error("غير مصرح");
  if (friendship.status === "ACCEPTED") return;

  await assertRoomForBoth(friendship.requesterId, friendship.addresseeId);

  const other = await prisma.user.findUnique({
    where: { id: friendship.requesterId },
    select: { name: true },
  });

  await prisma.$transaction([
    prisma.friendship.update({ where: { id: friendshipId }, data: { status: "ACCEPTED" } }),
    prisma.moment.create({
      data: { authorId: user.id, kind: "FRIEND_ADDED", text: other?.name ?? null },
    }),
    prisma.moment.create({
      data: { authorId: friendship.requesterId, kind: "FRIEND_ADDED", text: user.name },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/circle");
}

export async function requestFriend(email: string): Promise<void> {
  const user = await requireUser();

  const target = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true },
  });
  if (!target || target.id === user.id) throw new Error("لا يوجد حساب بهذا البريد");

  await assertRoomForBoth(user.id, target.id);
  await prisma.friendship.upsert({
    where: { requesterId_addresseeId: { requesterId: user.id, addresseeId: target.id } },
    create: { requesterId: user.id, addresseeId: target.id },
    update: {},
  });

  revalidatePath("/circle");
}

// ───────────────────────────── التفاعل ─────────────────────────────

export async function react(momentId: string, kind: string, emoji?: string): Promise<void> {
  const user = await requireUser();
  if (!(await canSee(user.id, momentId))) throw new Error("غير مصرح");

  // الإيموجي الحر ميزة اشتراك؛ الوجوه الخمسة مفتوحة للجميع دائماً.
  if (kind === "CUSTOM" && !user.isPlus) throw new Error("الإيموجي الحر لمشتركي أثر+");

  const existing = await prisma.reaction.findUnique({
    where: { momentId_userId: { momentId, userId: user.id } },
  });

  // الضغط على نفس التفاعل يلغيه — تفاعل واحد لكل شخص لكل لحظة.
  if (existing && existing.kind === kind && (existing.emoji ?? undefined) === emoji) {
    await prisma.reaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.reaction.upsert({
      where: { momentId_userId: { momentId, userId: user.id } },
      create: {
        momentId,
        userId: user.id,
        kind: kind as ReactionKind,
        emoji: kind === "CUSTOM" ? (emoji ?? null) : null,
      },
      update: {
        kind: kind as ReactionKind,
        emoji: kind === "CUSTOM" ? (emoji ?? null) : null,
      },
    });
  }

  revalidatePath("/");
  revalidatePath(`/m/${momentId}`);
}

export async function markSeen(momentId: string): Promise<void> {
  const user = await requireUser();
  if (!(await canSee(user.id, momentId))) return;

  await prisma.view.upsert({
    where: { momentId_userId: { momentId, userId: user.id } },
    create: { momentId, userId: user.id },
    update: {},
  });
}

export async function addComment(momentId: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!(await canSee(user.id, momentId))) throw new Error("غير مصرح");

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  await prisma.comment.create({ data: { momentId, userId: user.id, body: body.slice(0, 500) } });
  revalidatePath("/");
  revalidatePath(`/m/${momentId}`);
}

/** اللحظة مرئية لصاحبها ولمن في دائرته فقط — لا استكشاف عام في هذا التطبيق. */
async function canSee(userId: string, momentId: string): Promise<boolean> {
  const moment = await prisma.moment.findUnique({
    where: { id: momentId },
    select: { authorId: true },
  });
  if (!moment) return false;
  if (moment.authorId === userId) return true;

  const ids = await circleIds(userId);
  return ids.includes(moment.authorId);
}

// ───────────────────────────── المحادثات الخاصة ─────────────────────────────

export async function startConversation(otherId: string): Promise<void> {
  const user = await requireUser();
  const id = await openConversation(user.id, otherId);
  redirect(`/messages/${id}`);
}

export async function sendMessage(conversationId: string, formData: FormData): Promise<void> {
  const user = await requireUser();

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { aId: true, bId: true },
  });
  if (!conversation) throw new Error("المحادثة غير موجودة");
  if (conversation.aId !== user.id && conversation.bId !== user.id) throw new Error("غير مصرح");

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  await prisma.$transaction([
    prisma.message.create({
      data: { conversationId, senderId: user.id, body: body.slice(0, 2000) },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }),
  ]);

  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/messages");
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const user = await requireUser();
  await prisma.message.updateMany({
    where: { conversationId, senderId: { not: user.id }, readAt: null },
    data: { readAt: new Date() },
  });
}

// ───────────────────────────── المتجر والاشتراك ─────────────────────────────

const PLUS_DISCOUNT = 0.2;

export async function buyItem(itemId: string): Promise<void> {
  const user = await requireUser();

  const item = await prisma.storeItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error("الصنف غير موجود");
  if (item.plusOnly && !user.isPlus) throw new Error("هذا الصنف لمشتركي أثر+");

  if (item.earnedAfterDays !== null) {
    const days = Math.floor((Date.now() - user.createdAt.getTime()) / 86_400_000);
    if (days < item.earnedAfterDays) throw new Error("هذا الصنف يُكتسب بالوقت، لا يُشترى");
  }

  const price = user.isPlus
    ? Math.round(item.priceHalalas * (1 - PLUS_DISCOUNT))
    : item.priceHalalas;

  const owned = await prisma.purchase.findUnique({
    where: { userId_itemId: { userId: user.id, itemId } },
  });
  if (owned) return;

  if (user.storeCredit < price) throw new Error("رصيدك لا يكفي");

  // الخصم والشراء في معاملة واحدة حتى لا ينقص الرصيد بلا صنف والعكس.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { storeCredit: { decrement: price } },
    }),
    prisma.purchase.create({ data: { userId: user.id, itemId, paidHalalas: price } }),
  ]);

  revalidatePath("/store");
  revalidatePath("/me");
}

export async function equip(itemId: string): Promise<void> {
  const user = await requireUser();

  const purchase = await prisma.purchase.findUnique({
    where: { userId_itemId: { userId: user.id, itemId } },
    include: { item: { select: { kind: true } } },
  });
  if (!purchase) throw new Error("لا تملك هذا الصنف");

  await prisma.user.update({
    where: { id: user.id },
    data: purchase.item.kind === "FRAME" ? { frameId: itemId } : { backgroundId: itemId },
  });

  revalidatePath("/me");
  revalidatePath("/store");
  revalidatePath("/");
}

export async function unequip(kind: "FRAME" | "BACKGROUND"): Promise<void> {
  const user = await requireUser();
  await prisma.user.update({
    where: { id: user.id },
    data: kind === "FRAME" ? { frameId: null } : { backgroundId: null },
  });
  revalidatePath("/me");
}

/**
 * اشتراك تجريبي: يفعّل «أثر+» ويودع رصيد المتجر الشهري مباشرة.
 * الدفع الحقيقي يمر عبر IAP لآبل وGoogle Play — لا يمكن تنفيذه على الويب.
 */
export async function subscribe(plan: "MONTHLY" | "YEARLY"): Promise<void> {
  const user = await requireUser();

  const days = plan === "YEARLY" ? 365 : 30;
  await prisma.user.update({
    where: { id: user.id },
    data: {
      isPlus: true,
      plusUntil: new Date(Date.now() + days * 86_400_000),
      storeCredit: { increment: 3000 },
    },
  });

  revalidatePath("/subscribe");
  revalidatePath("/me");
  revalidatePath("/store");
  redirect("/me");
}

export async function cancelPlus(): Promise<void> {
  const user = await requireUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { isPlus: false, plusUntil: null },
  });
  revalidatePath("/me");
  revalidatePath("/subscribe");
}
