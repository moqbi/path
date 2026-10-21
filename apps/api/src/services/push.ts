import { prisma } from "@athar/db";
import { forgetAllNotifications, forgetNotifications, unseenCount } from "./notifications";

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
  | "STORE"
  /** منحٌ من الإدارة — يخصّ صاحبه وحده، فلا مفتاحَ يُطفئه (القاعدة ١٩٨). */
  | "GRANT"
  /** الذكرياتُ ومناسباتُ الصداقة وآثرك السنويّ (القاعدة ٢٣٥). */
  | "MEMORY"
  /** أحدٌ قريبٌ فتح «من حولك» (القاعدة ٢٨٢) — مطفأٌ حتى يفعّله صاحبُه. */
  | "NEARBY"
  /** صديقٌ اختاره صاحبُه نزّل قصّةً أو نوتاً (القاعدة ٣١٩) — الاختيارُ هو المفتاح. */
  | "STORY";

/**
 * صوتُ كلّ نوعٍ وقناتُه على أندرويد (القاعدة ٢٥٣): عامٌّ لما يفعله الأصدقاء،
 * وصوتٌ للمحادثات، وصوتٌ لما يأتي من آثار نفسها. والملفّاتُ في بناء الجوّال؛
 * بناءٌ قديمٌ بلاها يُسمع صوتَ النظام في آبل وقناتَه الافتراضيّة في أندرويد.
 */
const SOUNDS = {
  general: { sound: "athr_general.wav", channelId: "general" },
  dm: { sound: "athr_dm.wav", channelId: "dm" },
  athar: { sound: "athr_athar.wav", channelId: "athar" },
} as const;
const SOUND_OF: Record<PushKind, keyof typeof SOUNDS> = {
  DM: "dm",
  FRIEND: "general",
  TAG: "general",
  REACTION: "general",
  COMMENT: "general",
  STORE: "athar",
  GRANT: "athar",
  MEMORY: "athar",
  NEARBY: "general",
  STORY: "general",
};

/** أيُّ حقلٍ في `User` يحرس هذا النوع. */
const GATE: Record<PushKind, string | null> = {
  DM: "notifyDm",
  FRIEND: "notifyFriend",
  TAG: "notifyOnTag",
  REACTION: "notifyReaction",
  COMMENT: "notifyComment",
  STORE: "notifyStoreNew",
  GRANT: null,
  MEMORY: "notifyMemories",
  NEARBY: "notifyNearby",
  STORY: null,
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
        notifyMemories: true,
        notifyNearby: true,
        quietFrom: true,
        quietTo: true,
        devices: { select: { token: true } },
      },
    });
    if (!user) return;

    const gate = GATE[message.kind];
    const allowed = gate ? (user as unknown as Record<string, boolean>)[gate] : true;
    if (allowed === false) return;
    if (inQuietHours(user.quietFrom, user.quietTo)) return;
    if (user.devices.length === 0) return;

    const badge = await badgeOf(message.userId);
    await deliver(
      user.devices.map((device) => ({
        to: device.token,
        title: message.title,
        body: message.body,
        ...SOUNDS[SOUND_OF[message.kind]],
        ...(badge === null ? null : { badge }),
        data: message.path ? { path: message.path } : {},
      })),
    );
  } catch (problem) {
    // تنبيهٌ لم يخرج لا يُسقط الفعل الذي معه.
    console.error("[push] تعذّر الإرسال", problem);
  }
}

/**
 * الرقمُ على أيقونة التطبيق: الإشعاراتُ التي لم تُقرأ والرسائلُ التي لم تُقرأ —
 * ما تعرضه النقطتان في الشريط السفليّ نفسه. آبل لا تعدّ بنفسها: رقمٌ لا يُرسل
 * مع التنبيه لا يظهر أصلاً، والتطبيقُ يضبطه وهو مفتوح (`useAppBadge`).
 * والفشلُ يردّ «لا رقم» فيبقى ما كان على الأيقونة ولا يسقط التنبيه.
 */
async function badgeOf(userId: string): Promise<number | null> {
  try {
    const { unreadCount } = await import("./dm");
    const [notes, dm] = await Promise.all([unseenCount(userId), unreadCount(userId)]);
    return notes + dm.unread;
  } catch {
    return null;
  }
}

/**
 * خبرٌ للجميع — صنفٌ جديد في المتجر.
 *
 * لا `push()` لكلّ حساب: ذاك استعلامٌ لكل واحد. هنا صفحاتٌ من خمسمئة
 * حسابٍ فتح التنبيه ولديه جهاز، يُستثنى منها من في وضعه الهادئ، وتُرسل
 * دفعاتٍ من مئة — أقصى ما تقبله خدمة Expo في الطلب الواحد.
 */
export async function broadcast(kind: PushKind, title: string, body: string, path?: string): Promise<number> {
  // التبويبُ يُشتقّ من القاعدة، وخبيئتُه لا تعرف بالخبر حتى تُنسى.
  forgetAllNotifications();

  let cursor: string | undefined;
  let sent = 0;
  for (;;) {
    const users = await prisma.user.findMany({
      where: { ...(GATE[kind] ? { [GATE[kind]!]: true } : null), devices: { some: {} } },
      select: { id: true, quietFrom: true, quietTo: true, devices: { select: { token: true } } },
      orderBy: { id: "asc" },
      take: 500,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (users.length === 0) break;
    cursor = users[users.length - 1].id;

    const messages = users
      .filter((user) => !inQuietHours(user.quietFrom, user.quietTo))
      .flatMap((user) =>
        user.devices.map((device) => ({
          to: device.token,
          title,
          body,
          ...SOUNDS[SOUND_OF[kind]],
          data: path ? { path } : {},
        })),
      );
    for (let index = 0; index < messages.length; index += 100) {
      await deliver(messages.slice(index, index + 100)).catch((problem) =>
        console.error("[push] دفعةٌ لم تخرج", problem),
      );
    }
    sent += messages.length;
    if (users.length < 500) break;
  }
  return sent;
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
