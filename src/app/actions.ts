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
import { circleIds } from "@/lib/circle";
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

const KINDS = ["PHOTO", "PLACE", "THOUGHT", "MUSIC", "SLEEP"] as const;

/** تدرّجات جاهزة تقوم مقام رفع الصور في النموذج الأولي. */
const IMAGE_SPECS = [
  "linear-gradient(160deg,#c8a98a,#9e7b5f 55%,#6e5947)",
  "linear-gradient(160deg,#a9b8ae,#4e6b5c)",
  "linear-gradient(160deg,#d8c3a5,#8c6c4e)",
  "linear-gradient(160deg,#b5a8b8,#5f5464)",
  "linear-gradient(160deg,#e0cdb4,#a88558)",
];

const momentInput = z.object({
  kind: z.enum(KINDS),
  text: z.string().trim().max(400).optional(),
  placeName: z.string().trim().max(80).optional(),
  musicTitle: z.string().trim().max(80).optional(),
  musicArtist: z.string().trim().max(80).optional(),
});

export async function postMoment(formData: FormData): Promise<void> {
  const user = await requireUser();

  const parsed = momentInput.safeParse({
    kind: formData.get("kind"),
    text: formData.get("text") || undefined,
    placeName: formData.get("placeName") || undefined,
    musicTitle: formData.get("musicTitle") || undefined,
    musicArtist: formData.get("musicArtist") || undefined,
  });
  if (!parsed.success) throw new Error("لحظة غير صالحة");

  const { kind, text, placeName, musicTitle, musicArtist } = parsed.data;

  const moment = await prisma.moment.create({
    data: {
      authorId: user.id,
      kind: kind as MomentKind,
      text: text ?? null,
      placeName: kind === "PLACE" ? (placeName ?? null) : null,
      placeCity: kind === "PLACE" ? (user.city ?? null) : null,
      musicTitle: kind === "MUSIC" ? (musicTitle ?? null) : null,
      musicArtist: kind === "MUSIC" ? (musicArtist ?? null) : null,
      imageSpec:
        kind === "PHOTO"
          ? IMAGE_SPECS[Math.floor(Math.random() * IMAGE_SPECS.length)]
          : null,
    },
  });

  await attachTags(moment.id, user.id, formData.getAll("with").map(String));

  revalidatePath("/");
  redirect("/");
}

const presenceInput = z.object({
  placeName: z.string().trim().min(1, "اختر مكاناً").max(80),
  hours: z.coerce.number().int().min(1).max(12),
  note: z.string().trim().max(200).optional(),
});

export async function postPresence(formData: FormData): Promise<void> {
  const user = await requireUser();

  const parsed = presenceInput.safeParse({
    placeName: formData.get("placeName"),
    hours: formData.get("hours"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "حضور غير صالح");

  const { placeName, hours, note } = parsed.data;

  const moment = await prisma.moment.create({
    data: {
      authorId: user.id,
      kind: "PRESENCE",
      placeName,
      placeCity: user.city ?? null,
      text: note ?? null,
      expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
    },
  });

  await attachTags(moment.id, user.id, formData.getAll("with").map(String));

  revalidatePath("/");
  redirect("/");
}

/**
 * «مع فلان» تُنشأ غير معتمَدة دائماً.
 *
 * إعلان وجود شخص في مكان قد يورّطه، فالإشارة لا تظهر لأحد قبل موافقته —
 * وهذا قرار خصوصية لا خيار إعدادات. ولا يُشار إلا لمن هو داخل الدائرة.
 */
async function attachTags(momentId: string, authorId: string, userIds: string[]): Promise<void> {
  const wanted = [...new Set(userIds)].filter((id) => id && id !== authorId);
  if (wanted.length === 0) return;

  const allowed = new Set(await circleIds(authorId));
  const data = wanted
    .filter((id) => allowed.has(id))
    .map((userId) => ({ momentId, userId, approved: false }));
  if (data.length === 0) return;

  await prisma.momentTag.createMany({ data, skipDuplicates: true });
}

export async function approveTag(tagId: string): Promise<void> {
  const user = await requireUser();
  // الشرط على userId يمنع اعتماد إشارة تخص شخصاً آخر.
  await prisma.momentTag.updateMany({
    where: { id: tagId, userId: user.id },
    data: { approved: true },
  });
  revalidatePath("/");
  revalidatePath("/me");
}

export async function rejectTag(tagId: string): Promise<void> {
  const user = await requireUser();
  await prisma.momentTag.deleteMany({ where: { id: tagId, userId: user.id } });
  revalidatePath("/");
  revalidatePath("/me");
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
  revalidatePath(`/m/${momentId}`);
}

export async function toggleJoin(momentId: string): Promise<void> {
  const user = await requireUser();
  if (!(await canSee(user.id, momentId))) throw new Error("غير مصرح");

  const existing = await prisma.joining.findUnique({
    where: { momentId_userId: { momentId, userId: user.id } },
  });

  if (existing) {
    await prisma.joining.delete({ where: { id: existing.id } });
  } else {
    await prisma.joining.create({ data: { momentId, userId: user.id } });
  }

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
    data:
      purchase.item.kind === "FRAME" ? { frameId: itemId } : { backgroundId: itemId },
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
