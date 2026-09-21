import { prisma } from "@athar/db";

/**
 * تنبيهاتُ الجهاز عبر خدمة Expo.
 *
 * نرسل إلى `exp.host` لا إلى APNs وFCM مباشرةً: خدمةُ Expo تعرف أيُّ
 * رمزٍ لأيّ منصّة فتوصّله، فلا يحمل خادمُنا شهادةَ آبل ومفتاحَ قوقل ولا
 * يكتب بروتوكولين — والمفاتيح تُرفع مرّةً إلى EAS.
 *
 * **والإرسال لا يُنتظر ولا يُوقف شيئاً**: من علّق على لحظةٍ لا ينتظر
 * ردّ خادمِ تنبيهاتٍ ثالث، وفشلُ التنبيه لا يُلغي التعليق.
 */
const ENDPOINT = "https://exp.host/--/api/v2/push/send";

/** أنواعُ ما يُنبَّه عليه — ولكلٍّ مفتاحُه في تفضيلات صاحبه. */
export type PushKind =
  | "DM"
  | "FRIEND"
  | "TAG"
  | "REACTION"
  | "COMMENT"
  | "STORE";

/** أيُّ حقلٍ في `User` يحرس هذا النوع. */
const GATE: Record<PushKind, string> = {
  DM: "notifyDm",
  FRIEND: "notifyFriend",
  TAG: "notifyOnTag",
  REACTION: "notifyReaction",
  COMMENT: "notifyComment",
  STORE: "notifyStoreNew",
};

/**
 * هل نحن داخل وضعه الهادئ الآن؟
 *
 * الحسابُ بالدقائق من منتصف الليل، و`from > to` مدّةٌ تعبر منتصف الليل
 * (٢٢:٠٠ ← ٠٧:٠٠) وهي الحال الغالبة — فتُقرأ «بعد البداية **أو** قبل
 * النهاية» لا «بينهما».
 *
 * **والوقتُ وقتُ صاحبِ الجهاز لا وقتُ الخادم**: خادمٌ في فرانكفورت
 * يسكت الساعةَ العاشرة بتوقيته لا بتوقيت الرياض. فالإزاحة تُحفظ من
 * الجهاز وقت التسجيل — وحتى تُحفظ نستعمل توقيت الرياض (+٣)، فجمهورُ
 * التطبيق فيه.
 */
const RIYADH_OFFSET = 3 * 60;

export function inQuietHours(
  quietFrom: number | null,
  quietTo: number | null,
  now = new Date(),
): boolean {
  if (quietFrom === null || quietTo === null) return false;
  const minutes = (now.getUTCHours() * 60 + now.getUTCMinutes() + RIYADH_OFFSET) % 1440;
  return quietFrom > quietTo
    ? minutes >= quietFrom || minutes < quietTo
    : minutes >= quietFrom && minutes < quietTo;
}

export type PushMessage = {
  /** من يُنبَّه. */
  userId: string;
  kind: PushKind;
  title: string;
  body: string;
  /** ما تفتحه الضغطة: مسارٌ في التطبيق. */
  path?: string;
};

/**
 * يُرسل تنبيهاً واحداً — بعد ثلاثة أبواب: تفضيلُ النوع، والوضع الهادئ،
 * ووجودُ جهازٍ مسجّل.
 */
export async function push(message: PushMessage): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: message.userId },
      select: {
        notifyDm: true,
        notifyFriend: true,
        notifyOnTag: true,
        notifyReaction: true,
        notifyComment: true,
        notifyStoreNew: true,
        notifyStoreDeals: true,
        quietFrom: true,
        quietTo: true,
        devices: { select: { token: true } },
      },
    });
    if (!user) return;

    const allowed = (user as unknown as Record<string, boolean>)[GATE[message.kind]];
    if (allowed === false) return;
    if (inQuietHours(user.quietFrom, user.quietTo)) return;
    if (user.devices.length === 0) return;

    await deliver(
      user.devices.map((device) => ({
        to: device.token,
        title: message.title,
        body: message.body,
        sound: "default",
        data: message.path ? { path: message.path } : {},
      })),
    );
  } catch (problem) {
    // تنبيهٌ لم يخرج لا يُسقط الفعل الذي معه.
    console.error("[push] تعذّر الإرسال", problem);
  }
}

/** يرسل الدفعة ويمسح ما ردّته الخدمةُ «جهازٌ لم يعد مسجّلاً». */
async function deliver(messages: Record<string, unknown>[]): Promise<void> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(messages),
  });
  if (!response.ok) {
    console.error("[push] ردّت الخدمة", response.status);
    return;
  }

  const payload = (await response.json()) as {
    data?: { status: string; details?: { error?: string } }[];
  };

  /*
     الرمزُ يموت حين يُحذف التطبيق أو تُلغى صلاحيتُه، والخدمةُ تقولها
     `DeviceNotRegistered`. ومن لا يمسحه يُرسل إلى العدم كلَّ مرّة.
  */
  const dead = (payload.data ?? [])
    .map((row, index) =>
      row.details?.error === "DeviceNotRegistered" ? String(messages[index]?.to ?? "") : "",
    )
    .filter(Boolean);

  if (dead.length) {
    await prisma.deviceToken.deleteMany({ where: { token: { in: dead } } });
  }
}

/** تسجيلُ جهازٍ لصاحب الجلسة — والرمزُ ينتقل إليه إن كان لغيره. */
export async function registerDevice(userId: string, token: string, platform: string) {
  await prisma.deviceToken.upsert({
    where: { token },
    create: { userId, token, platform },
    update: { userId, platform, seenAt: new Date() },
  });
  return { ok: true };
}

/** نزعُ الجهاز عند الخروج: من خرج لا تصله تنبيهاتُ حسابه. */
export async function forgetDevice(userId: string, token: string) {
  await prisma.deviceToken.deleteMany({ where: { token, userId } });
  return { ok: true };
}
