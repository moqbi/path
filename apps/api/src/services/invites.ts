import { prisma } from "@athar/db";
import { badRequest, notFound } from "../lib/errors";
import { blockedWith } from "./visibility";
import { broadcast } from "./push";
import { inviteLine } from "../lib/invite-line";

/**
 * برنامجُ الدعوات (القاعدة ٢٤٣).
 *
 * من دعا أصدقاءه إلى آثار ينال نقاطاً: كلُّ `every` مدعوّين = `coins` نقطة.
 * والمشرفُ يفعّله ويوقفه ويضبط رقميه من اللوحة.
 *
 * **والمدعوُّ يُعدّ حين ينشر أوّل لحظةٍ له** لا حين يُنشئ حسابه: حسابٌ لا
 * يكتب شيئاً لا يُضيف إلى دائرة أحد، وعشرةُ حساباتٍ فارغة تُصنع في دقائق
 * فتصير النقاطُ مِنحةً لمن يعرف كيف يُنشئ بريداً. ولحظاتُ النظام
 * («انضم»، «غيّر صورته») ليست نشراً.
 */
const POSTED = ["PHOTO", "PLACE", "THOUGHT", "MUSIC", "SLEEP", "WAKE"] as const;

/** أيّامٌ يُقبل فيها «من دعاك؟» بعد التسجيل — لمن دخل بمزوّدٍ بلا نموذج. */
export const CLAIM_DAYS = 7;

export async function program() {
  return (
    (await prisma.inviteProgram.findUnique({ where: { id: "main" } })) ?? {
      id: "main",
      enabled: false,
      every: 10,
      coins: 500,
      announcedAt: null,
      updatedAt: new Date(0),
    }
  );
}

/**
 * يربط الحسابَ بمن دعاه — مرّةً واحدة. يُرمى خطأٌ يُقرأ حين يُطلب صراحةً،
 * ويُبلع عند التسجيل (`quiet`): رقمٌ خاطئ في نموذجٍ لا يُسقط حساباً قام.
 */
export async function linkInviter(userId: string, inviterNo: number, quiet = false): Promise<boolean> {
  try {
    const [me, inviter] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { invitedById: true, createdAt: true } }),
      prisma.user.findUnique({ where: { memberNo: inviterNo }, select: { id: true, createdAt: true } }),
    ]);
    if (!me) throw notFound("الحساب غير موجود");
    if (me.invitedById) throw badRequest("سجّلت من دعاك من قبل");
    if (!inviter) throw badRequest("لا عضوية بهذا الرقم");
    if (inviter.id === userId) throw badRequest("هذا رقم عضويتك أنت");
    // من سجّل بعدك لم يدعُك.
    if (inviter.createdAt >= me.createdAt) throw badRequest("هذا الحساب أحدث من حسابك");
    if ((await blockedWith(userId)).includes(inviter.id)) throw badRequest("لا عضوية بهذا الرقم");

    const { count } = await prisma.user.updateMany({
      where: { id: userId, invitedById: null },
      data: { invitedById: inviter.id },
    });
    return count > 0;
  } catch (error) {
    if (quiet) return false;
    throw error;
  }
}

/** «من دعاك؟» بعد التسجيل — في أيّامه الأولى وحدها. */
export async function claim(userId: string, inviterNo: number) {
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
  if (!me) throw notFound("الحساب غير موجود");
  if (Date.now() - me.createdAt.getTime() > CLAIM_DAYS * 86_400_000) {
    throw badRequest("انتهت مهلة تسجيل من دعاك");
  }
  await linkInviter(userId, inviterNo);
  return { ok: true };
}

/** عددُ من دعاهم ونشروا — ومن سجّلوا ولم ينشروا بعد. */
async function counts(userId: string) {
  const [joined, qualified] = await Promise.all([
    prisma.user.count({ where: { invitedById: userId } }),
    prisma.user.count({
      where: { invitedById: userId, moments: { some: { kind: { in: [...POSTED] } } } },
    }),
  ]);
  return { joined, qualified };
}

/** ما يعرضه التطبيق: البرنامج وتقدّمي فيه، وهل ما زال لي أن أقول من دعاني. */
export async function status(userId: string) {
  const [p, me, c] = await Promise.all([
    program(),
    prisma.user.findUnique({
      where: { id: userId },
      select: { memberNo: true, createdAt: true, inviteRewards: true, invitedById: true },
    }),
    counts(userId),
  ]);
  if (!me) throw notFound("الحساب غير موجود");
  const canClaim =
    !me.invitedById && Date.now() - me.createdAt.getTime() <= CLAIM_DAYS * 86_400_000;
  return {
    enabled: p.enabled,
    every: p.every,
    coins: p.coins,
    memberNo: me.memberNo,
    joined: c.joined,
    qualified: c.qualified,
    rewards: me.inviteRewards,
    // كم بقي على المكافأة التالية.
    left: p.every - (c.qualified % p.every),
    canClaim,
  };
}

/**
 * المكافآت المستحقّة — مع كنس الخمس دقائق.
 *
 * دفعةٌ لكل `every` مدعوّاً نشروا، و`inviteRewards` يعدّ ما نيل منها فلا
 * تُعطى مرّتين. والرصيدُ والسجلُّ (`CoinGrant` بـ`invites`) والعدّادُ في
 * معاملةٍ واحدة بشرط «العدّادُ ما قرأتُه» — كنسان معاً لا يُعطيان دفعتين.
 * والجرسُ والإشعارُ من صفّ `CoinGrant` كمنح الإدارة (القاعدة ١٩٨).
 */
export async function rewardInvites(): Promise<number> {
  const p = await program();
  if (!p.enabled || p.every < 1 || p.coins < 1) return 0;

  const rows = await prisma.$queryRaw<{ id: string; n: bigint; given: number }[]>`
    SELECT inviter."id", COUNT(*) AS n, inviter."inviteRewards" AS given
    FROM "User" invitee
    JOIN "User" inviter ON inviter."id" = invitee."invitedById"
    WHERE EXISTS (
      SELECT 1 FROM "Moment" m
      WHERE m."authorId" = invitee."id"
        AND m."kind"::text IN ('PHOTO', 'PLACE', 'THOUGHT', 'MUSIC', 'SLEEP', 'WAKE')
    )
    GROUP BY inviter."id", inviter."inviteRewards"
    HAVING COUNT(*) / ${p.every} > inviter."inviteRewards"
    LIMIT 200
  `;

  let paid = 0;
  for (const row of rows) {
    const reached = Math.floor(Number(row.n) / p.every);
    const due = reached - row.given;
    if (due <= 0) continue;
    await prisma
      .$transaction(async (tx) => {
        const { count } = await tx.user.updateMany({
          where: { id: row.id, inviteRewards: row.given },
          data: { inviteRewards: reached, coins: { increment: due * p.coins } },
        });
        if (count === 0) return;
        await tx.coinGrant.createMany({
          data: Array.from({ length: due }, (_, i) => ({
            userId: row.id,
            coins: p.coins,
            invites: (row.given + i + 1) * p.every,
          })),
        });
        paid += due;
      })
      .catch((error) => console.error("✗ مكافأة الدعوات", error));
  }
  return paid;
}

/** إعلانُ التفعيل للجميع — مرّةً لكل تفعيل، ويُختم قبل الإرسال. */
export async function announceInvites(): Promise<boolean> {
  const p = await program();
  if (!p.enabled || p.announcedAt) return false;
  const { count } = await prisma.inviteProgram.updateMany({
    where: { id: "main", enabled: true, announcedAt: null },
    data: { announcedAt: new Date() },
  });
  if (count === 0) return false;
  await broadcast("STORE", "ادعُ أصدقاءك إلى آثار", inviteLine(p.every, p.coins), "/me");
  return true;
}
