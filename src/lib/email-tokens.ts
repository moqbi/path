import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/site-url";
import { letterHtml, sendMail } from "@/lib/mail";

/**
 * رموزُ البريد: تأكيدُ العنوان وإعادةُ ضبط كلمة المرور.
 *
 * **ما يُخزَّن تجزئةُ الرمز لا الرمز** (`sha256`): قاعدةٌ تُقرأ لا
 * تُعطي قارئَها مفاتيح الحسابات. والرمزُ نفسه يخرج إلى البريد مرّةً
 * ولا يُحفظ عندنا — كما لا تُحفظ كلمةُ المرور.
 *
 * و**عمرٌ قصيرٌ لإعادة الضبط** (ساعة) وأطولُ للتأكيد (يوم): الأوّل
 * يفتح الحساب لمن يملكه، والثاني يقول «هذا عنواني».
 */
const LIFE = { VERIFY: 24 * 60 * 60 * 1000, RESET: 60 * 60 * 1000 } as const;

/** أقلُّ ما بين رسالتين للحساب الواحد — كي لا يصير البابُ مِرشّة بريد. */
const COOLDOWN = 60 * 1000;

type Kind = "VERIFY" | "RESET";

function digest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** رمزٌ جديد: يُخزَّن مجزَّأً ويُردّ خاماً مرّةً واحدة. */
async function issue(userId: string, kind: Kind): Promise<string | null> {
  const recent = await prisma.emailToken.findFirst({
    where: { userId, kind, createdAt: { gt: new Date(Date.now() - COOLDOWN) } },
    select: { id: true },
  });
  if (recent) return null;

  const token = randomBytes(32).toString("base64url");
  await prisma.emailToken.create({
    data: {
      userId,
      kind,
      tokenHash: digest(token),
      expiresAt: new Date(Date.now() + LIFE[kind]),
    },
  });
  return token;
}

/**
 * قراءةُ رمزٍ واستهلاكُه.
 *
 * مرّةً واحدة: رابطٌ في بريدٍ قد يُعاد فتحه أو يمرّ بزاحف، فالاستعمال
 * يختمه. والمنتهي والمستعمَل يُقالان «انتهى» لا «غير موجود»: الفرقُ
 * يمنع صاحبه من أن يظنّ الرابط مكسوراً فيعيد الطلب بلا فائدة.
 */
export async function consume(
  token: string,
  kind: Kind,
): Promise<{ userId: string } | { error: string }> {
  if (!token) return { error: "الرابط ناقص" };

  const row = await prisma.emailToken.findUnique({
    where: { tokenHash: digest(token) },
    select: { id: true, userId: true, kind: true, expiresAt: true, usedAt: true },
  });
  if (!row || row.kind !== kind) return { error: "رابطٌ غير صحيح" };
  if (row.usedAt) return { error: "هذا الرابط استُعمل من قبل — اطلب رابطاً جديداً" };
  if (row.expiresAt < new Date()) return { error: "انتهت صلاحية الرابط — اطلب رابطاً جديداً" };

  await prisma.emailToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return { userId: row.userId };
}

/**
 * رسالةُ تأكيد البريد.
 *
 * تُرسَل عند التسجيل ومن الإعدادات، والفشلُ يُبتلع: حسابٌ يُنشأ لا
 * يُلغى لأنّ رسالةً لم تخرج.
 */
export async function sendVerify(userId: string, email: string, name: string): Promise<boolean> {
  if (!SITE_URL) return false;
  const token = await issue(userId, "VERIFY");
  if (!token) return false;

  const url = `${SITE_URL}/verify?token=${token}`;
  return sendMail({
    to: email,
    subject: "أكّد بريدك في آثار",
    text: `أهلاً ${name} — أكّد بريدك من هذا الرابط: ${url}`,
    html: letterHtml({
      title: `أهلاً ${name}`,
      intro:
        "أكّد أنّ هذا عنوانك حتى نستطيع أن نصل إليك إن نسيتَ كلمة مرورك. الرابط يعمل يوماً واحداً.",
      button: "أكّد بريدي",
      url,
      note: "إن لم تكن أنت من أنشأ الحساب، تجاهل هذه الرسالة ولا يحدث شيء.",
    }),
  });
}

/**
 * رسالةُ إعادة ضبط كلمة المرور.
 *
 * ولا يُقال للطالب أوُجد الحساب أم لا: الشاشة تردّ الجملة نفسها في
 * الحالين، وإلّا صار البابُ وسيلةً لمعرفة من عندنا حساب.
 */
export async function sendReset(userId: string, email: string, name: string): Promise<boolean> {
  if (!SITE_URL) return false;
  const token = await issue(userId, "RESET");
  if (!token) return false;

  const url = `${SITE_URL}/reset?token=${token}`;
  return sendMail({
    to: email,
    subject: "إعادة ضبط كلمة مرورك في آثار",
    text: `${name} — اضبط كلمة مرورك من هذا الرابط: ${url}`,
    html: letterHtml({
      title: "إعادة ضبط كلمة المرور",
      intro: `${name}، اضغط الزرّ لتختار كلمة مرورٍ جديدة. الرابط يعمل ساعةً واحدة ومرّةً واحدة.`,
      button: "اضبط كلمة المرور",
      url,
      note: "إن لم تطلب أنت هذا، تجاهل الرسالة — كلمةُ مرورك كما هي ولا أحد يستطيع تغييرها بلا هذا الرابط.",
    }),
  });
}
