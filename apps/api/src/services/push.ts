import { prisma } from "@athar/db";
import { forgetNotifications } from "./notifications";

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
    /*
       وخبيئةُ الإشعارات تُنسى لصاحبها أوّلاً — قبل أبواب التفضيلات
       والوضع الهادئ: من أطفأ تنبيهَ التفاعلات ما زال يرى التفاعل في
       تبويبه، فالتبويبُ سجلٌّ لا جرس.
    */
    forgetNotifications(message.userId);

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

type Ticket = { status: string; message?: string; details?: { error?: string } };

/** يرسل الدفعة ويمسح ما ردّته الخدمةُ «جهازٌ لم يعد مسجّلاً». */
async function deliver(messages: Record<string, unknown>[]): Promise<Ticket[]> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(messages),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error("[push] ردّت الخدمة", response.status, text.slice(0, 500));
    return [{ status: "error", message: `HTTP ${response.status} ${text.slice(0, 200)}` }];
  }

  const payload = (await response.json()) as { data?: Ticket[] };

  /*
     كلُّ تذكرةٍ خاطئة تُكتب في السجلّ باسمها: `InvalidCredentials` تعني
     مفتاح APNs غير مرفوعٍ لهذا المعرّف، و`MismatchSenderId` مفتاح FCM.
     وكانت تُبلع كلُّها إلا «غير مسجّل»، فلا يُعرف لماذا لم يصل شيء.
  */
  for (const ticket of payload.data ?? []) {
    if (ticket.status !== "ok") {
      console.error("[push] رُفضت", ticket.details?.error ?? "", ticket.message ?? "");
    }
  }

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
  return payload.data ?? [];
}

/**
 * تنبيهٌ تجريبيّ لصاحب الجلسة — بلا أبواب التفضيل والوضع الهادئ.
 *
 * يردّ ما قالته خدمة Expo لكل جهاز، فيُعرف من الشاشة نفسها أين انقطع
 * الطريق: لا جهاز مسجّل، أو مفتاح آبل ناقص، أو وصل.
 */
export async function testPush(userId: string) {
  const devices = await prisma.deviceToken.findMany({ where: { userId }, select: { token: true, platform: true } });
  if (devices.length === 0) return { devices: 0, results: [] as string[] };
  const tickets = await deliver(
    devices.map((device) => ({
      to: device.token,
      title: "آثار مومنتس",
      body: "تنبيهٌ تجريبيّ — التنبيهات تعمل",
      sound: "default",
      data: {},
    })),
  );
  return {
    devices: devices.length,
    results: tickets.map((ticket) =>
      ticket.status === "ok" ? "ok" : `${ticket.details?.error ?? "error"}: ${ticket.message ?? ""}`.trim(),
    ),
  };
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
