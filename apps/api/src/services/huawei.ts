import { prisma } from "@athar/db";
import { PLUS_ENTITLEMENT } from "@athar/shared";
import { env } from "../env";
import { applyEvent, type RevenueCatEvent } from "./billing";

/**
 * خدماتُ هواوي على الخادم (القاعدة ٤٤٦): التنبيهاتُ عبر Push Kit، والتحقّقُ من الدفع.
 *
 * جوّالاتُ هواوي بلا خدمات قوقل، فلا FCM ولا خدمةُ Expo ولا RevenueCat (لا يدعم متجرَ هواوي).
 * فالخادمُ يكلّم هواوي بنفسه: رمزُ وصولٍ من حساب التطبيق (App ID + App secret) يُخبّأ حتى قبيل
 * انتهائه، وبه يُرسل التنبيه ويُسأل عن الشراء.
 *
 * **والجهازُ لا يُصدَّق**: يرسل ما ردّته نافذةُ الدفع، فيُؤخذ منه `purchaseToken` وحده ويُسأل
 * عنه هواوي، وما تقوله هواوي هو ما يُودَع. ثمّ يُحوَّل إلى حدثٍ بشكل RevenueCat ويمرّ بـ`applyEvent`
 * نفسها: النقاطُ والهديّةُ وآثار+ وسجلُّ `BillingEvent` — بابٌ واحد للمتاجر كلّها.
 */

let cached: { token: string; until: number } | null = null;

/** هل ضُبطت هواوي على هذا الخادم؟ */
export function huaweiReady(): boolean {
  return Boolean(env.HUAWEI_CLIENT_SECRET);
}

async function accessToken(force = false): Promise<string | null> {
  if (!env.HUAWEI_CLIENT_SECRET) return null;
  if (!force && cached && cached.until > Date.now()) return cached.token;
  const response = await fetch("https://oauth-login.cloud.huawei.com/oauth2/v3/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: env.HUAWEI_APP_ID,
      client_secret: env.HUAWEI_CLIENT_SECRET,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await response.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !body.access_token) {
    console.error("[huawei] تعذّر رمز الوصول", response.status, body.error_description ?? "");
    return null;
  }
  // قبل انتهائه بخمس دقائق يُجدَّد.
  cached = { token: body.access_token, until: Date.now() + ((body.expires_in ?? 3600) - 300) * 1000 };
  return cached.token;
}

/* ───────────────────────── التنبيهات (Push Kit) ───────────────────────── */

export type HuaweiNotice = {
  title: string;
  body: string;
  channelId: string;
  data: Record<string, unknown>;
  image?: string | null;
  badge?: number | null;
  /** يُرمى إن لم يصل في عشر دقائق (القاعدة ٤٦٠). */
  urgent?: boolean;
};

/**
 * ضغطةُ التنبيه رابطٌ إلى التطبيق (`athar://push?...`) — HMS Core يعرض التنبيهَ ويفتح الرابط،
 * و`+native-intent` في الجوّال يفتح موضعَه بمنطق ضغطة التنبيه نفسه.
 */
function clickIntent(data: Record<string, unknown>): string {
  const params = new URLSearchParams();
  if (typeof data.path === "string") params.set("path", data.path);
  if (typeof data.broadcast === "string") params.set("broadcast", data.broadcast);
  return `intent://push?${params.toString()}#Intent;scheme=athar;package=app.athar.mobile;launchFlags=0x4000000;end`;
}

/**
 * يرسل تنبيهاً واحداً إلى رموز هواوي — ألفٌ في الطلب الواحد — ويمسح ما ردّته «رمزٌ غير صالح».
 * ولا يرمي: تنبيهٌ لم يخرج لا يُسقط الفعل الذي معه.
 */
export async function pushHuawei(tokens: string[], notice: HuaweiNotice): Promise<void> {
  if (tokens.length === 0) return;
  let token = await accessToken();
  if (!token) {
    console.error("[huawei] لا سرَّ لهواوي (HUAWEI_CLIENT_SECRET) — التنبيهُ لم يخرج");
    return;
  }
  for (let index = 0; index < tokens.length; index += 1000) {
    const batch = tokens.slice(index, index + 1000);
    const message = {
      validate_only: false,
      message: {
        token: batch,
        android: {
          ...(notice.urgent ? { ttl: "600s" } : null),
          notification: {
            title: notice.title,
            body: notice.body,
            channel_id: notice.channelId,
            importance: "NORMAL",
            click_action: { type: 1, intent: clickIntent(notice.data) },
            ...(notice.image ? { image: notice.image } : null),
            ...(typeof notice.badge === "number"
              ? { badge: { set_num: notice.badge, class: "app.athar.mobile.MainActivity" } }
              : null),
          },
        },
      },
    };
    try {
      let result = await send(token, message);
      // رمزُ الوصول انتهى قبل موعده: يُجدَّد مرّةً ويُعاد.
      if (result.code === "80200001" || result.code === "80200003") {
        token = (await accessToken(true)) ?? token;
        result = await send(token, message);
      }
      await forgetDead(batch, result);
    } catch (problem) {
      console.error("[huawei] دفعةٌ لم تخرج", problem);
    }
  }
}

async function send(token: string, message: unknown): Promise<{ code: string; msg: string }> {
  const response = await fetch(`https://push-api.cloud.huawei.com/v1/${env.HUAWEI_APP_ID}/messages:send`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await response.json().catch(() => ({}))) as { code?: string; msg?: string };
  const code = body.code ?? String(response.status);
  if (code !== "80000000") console.error("[huawei] ردّت Push Kit", code, (body.msg ?? "").slice(0, 300));
  else console.log("[huawei] قبلت Push Kit التنبيه", (body as { requestId?: string }).requestId ?? "");
  return { code, msg: body.msg ?? "" };
}

/** «جزئيّ» (80100000) يقول في `msg` أيُّ الرموز غيرُ صالحة، و«كلُّها غيرُ صالحة» (80300007) يقولها كلَّها. */
async function forgetDead(batch: string[], result: { code: string; msg: string }) {
  let dead: string[] = [];
  if (result.code === "80300007") dead = batch;
  else if (result.code === "80100000") {
    try {
      dead = (JSON.parse(result.msg) as { illegal_tokens?: string[] }).illegal_tokens ?? [];
    } catch {
      dead = [];
    }
  }
  if (dead.length) await prisma.deviceToken.deleteMany({ where: { token: { in: dead } } });
}

/* ───────────────────────── الدفع (IAP) ───────────────────────── */

const ORDER_ROOT: Record<string, string> = {
  dra: "https://orders-dra.iap.cloud.huawei.asia",
  dre: "https://orders-dre.iap.cloud.huawei.eu",
  drru: "https://orders-drru.iap.cloud.huawei.ru",
  drcn: "https://orders-drcn.iap.cloud.huawei.com.cn",
  at: "https://orders-at-dre.iap.dbankcloud.com",
};
const SUB_ROOT: Record<string, string> = {
  dra: "https://subscr-dra.iap.cloud.huawei.asia",
  dre: "https://subscr-dre.iap.cloud.huawei.eu",
  drru: "https://subscr-drru.iap.cloud.huawei.ru",
  drcn: "https://subscr-drcn.iap.cloud.huawei.com.cn",
  at: "https://subscr-at-dre.iap.dbankcloud.com",
};

/** المواقعُ بترتيب التجربة: المضبوطُ أوّلاً — والحسابُ ذو `accountFlag` له موقعُه وحده. */
function sites(accountFlag?: number): string[] {
  if (accountFlag === 1) return ["at"];
  return [env.HUAWEI_IAP_SITE, ...["dra", "dre", "drru", "drcn"].filter((one) => one !== env.HUAWEI_IAP_SITE)];
}

type IapReply = { responseCode?: string; responseMessage?: string; purchaseTokenData?: string; inappPurchaseData?: string };

async function iapCall(root: string, path: string, body: unknown): Promise<IapReply> {
  const token = await accessToken();
  if (!token) throw new Error("الدفعُ من هواوي غير مضبوط على الخادم");
  const response = await fetch(`${root}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=UTF-8",
      authorization: `Basic ${Buffer.from(`APPAT:${token}`).toString("base64")}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12_000),
  });
  return (await response.json().catch(() => ({}))) as IapReply;
}

/** يسأل المواقعَ بالترتيب ويردّ أوّلَ جوابٍ ناجح وموقعَه. */
async function firstOk(
  roots: Record<string, string>,
  order: string[],
  path: string,
  body: unknown,
): Promise<{ reply: IapReply; site: string } | null> {
  let last: IapReply | null = null;
  for (const site of order) {
    try {
      const reply = await iapCall(roots[site], path, body);
      if (reply.responseCode === "0") return { reply, site };
      last = reply;
    } catch (problem) {
      console.error(`[huawei] ${site} لم يُجب`, problem instanceof Error ? problem.message : problem);
    }
  }
  if (last) console.error("[huawei] رُفض التحقّق", last.responseCode, last.responseMessage ?? "");
  return null;
}

type PurchaseData = {
  orderId?: string;
  productId?: string;
  purchaseToken?: string;
  purchaseState?: number;
  /** صفرٌ = شراءٌ تجريبيّ (Sandbox). */
  purchaseType?: number;
  developerPayload?: string;
  price?: number;
  currency?: string;
  purchaseTime?: number;
  subscriptionId?: string;
  subIsvalid?: boolean;
  expirationDate?: number;
  accountFlag?: number;
};

function parse(raw: string | undefined): PurchaseData | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PurchaseData;
  } catch {
    return null;
  }
}

export class HuaweiError extends Error {}

/**
 * شراءٌ عاد من نافذة هواوي: يُتحقَّق منه عند هواوي ويُطبَّق.
 * النوع: ٠ ما يُستهلك (نقاطٌ أو إهداءُ آثار+)، ٢ اشتراك.
 */
export async function claimHuawei(userId: string, raw: string, type: number): Promise<{ ok: string; plus: boolean }> {
  if (!huaweiReady()) throw new HuaweiError("الدفعُ من هواوي غير مضبوط على الخادم بعد");
  const said = parse(raw);
  if (!said?.purchaseToken || !said.productId) throw new HuaweiError("بياناتُ الشراء ناقصة");
  // دفعٌ بحمولة حسابٍ آخر لا يُفتح به هذا الحساب.
  if (said.developerPayload && said.developerPayload !== userId) throw new HuaweiError("هذا الشراءُ لحسابٍ آخر في آثار");
  return type === 2 ? claimSubscription(userId, said) : claimConsumable(userId, said);
}

async function claimConsumable(userId: string, said: PurchaseData): Promise<{ ok: string; plus: boolean }> {
  const body = { purchaseToken: said.purchaseToken, productId: said.productId };
  const found = await firstOk(ORDER_ROOT, sites(said.accountFlag), "/applications/purchases/tokens/verify", body);
  if (!found) throw new HuaweiError("لم تؤكّد هواوي هذا الشراء");
  const data = parse(found.reply.purchaseTokenData);
  if (!data || data.productId !== said.productId) throw new HuaweiError("الشراءُ لا يطابق المنتج");
  if (data.developerPayload && data.developerPayload !== userId) throw new HuaweiError("هذا الشراءُ لحسابٍ آخر في آثار");
  if (data.purchaseState !== undefined && data.purchaseState !== 0) throw new HuaweiError("الشراءُ لم يكتمل");

  const event: RevenueCatEvent = {
    id: `hw:${data.orderId ?? said.purchaseToken}`,
    type: "NON_RENEWING_PURCHASE",
    app_user_id: userId,
    product_id: data.productId,
    price_in_purchased_currency: typeof data.price === "number" ? data.price / 100 : null,
    event_timestamp_ms: data.purchaseTime ?? Date.now(),
    environment: data.purchaseType === 0 ? "SANDBOX" : "PRODUCTION",
    store: "HUAWEI",
  };
  const result = await applyEvent(event);

  // يُستهلك عند هواوي بعد أن طُبّق عندنا — فشراءٌ لم يصل يبقى «مملوكاً» فيُكمل لاحقاً.
  const confirm = await firstOk(ORDER_ROOT, [found.site], "/applications/v2/purchases/confirm", body);
  if (!confirm) console.error("[huawei] لم يُستهلك", data.orderId ?? "");
  return { ok: result.ok, plus: false };
}

async function claimSubscription(userId: string, said: PurchaseData): Promise<{ ok: string; plus: boolean }> {
  if (!said.subscriptionId) throw new HuaweiError("الاشتراكُ بلا معرّف");
  const owner = await prisma.huaweiSubscription.findUnique({
    where: { subscriptionId: said.subscriptionId },
    select: { userId: true },
  });
  if (owner && owner.userId !== userId)
    throw new HuaweiError("حسابُ هواوي هذا مشتركٌ من حسابٍ آخر في آثار. ادخل بذلك الحساب.");

  const body = { subscriptionId: said.subscriptionId, purchaseToken: said.purchaseToken };
  const found = await firstOk(SUB_ROOT, sites(said.accountFlag), "/sub/applications/v2/purchases/get", body);
  if (!found) throw new HuaweiError("لم تؤكّد هواوي هذا الاشتراك");
  const data = parse(found.reply.inappPurchaseData);
  if (!data?.expirationDate) throw new HuaweiError("الاشتراكُ بلا تاريخ انتهاء");
  if (data.developerPayload && data.developerPayload !== userId) throw new HuaweiError("هذا الاشتراكُ لحسابٍ آخر في آثار");

  await prisma.huaweiSubscription.upsert({
    where: { subscriptionId: said.subscriptionId },
    create: {
      subscriptionId: said.subscriptionId,
      userId,
      productId: data.productId ?? said.productId ?? "",
      purchaseToken: said.purchaseToken!,
      site: found.site,
      expiresAt: new Date(data.expirationDate),
    },
    update: { purchaseToken: said.purchaseToken!, site: found.site, expiresAt: new Date(data.expirationDate), checkedAt: new Date() },
  });

  return applySubscription(userId, said.subscriptionId, data, !owner);
}

/** يحوّل حالَ الاشتراك عند هواوي إلى حدثٍ بشكل RevenueCat. */
async function applySubscription(
  userId: string,
  subscriptionId: string,
  data: PurchaseData,
  first: boolean,
): Promise<{ ok: string; plus: boolean }> {
  const until = data.expirationDate ?? 0;
  const valid = data.subIsvalid !== false && until > Date.now();
  const event: RevenueCatEvent = {
    id: `hw:sub:${subscriptionId}:${until}:${valid ? "on" : "off"}`,
    type: valid ? (first ? "INITIAL_PURCHASE" : "RENEWAL") : "EXPIRATION",
    app_user_id: userId,
    entitlement_ids: [PLUS_ENTITLEMENT],
    expiration_at_ms: until,
    event_timestamp_ms: Date.now(),
    product_id: data.productId,
    environment: data.purchaseType === 0 ? "SANDBOX" : "PRODUCTION",
    store: "HUAWEI",
  };
  const result = await applyEvent(event);
  return { ok: result.ok, plus: valid };
}

/**
 * التجديدُ لا يصلنا حدثُه (لا RevenueCat): ما قارب موعدَه أو تجاوزه بيومين يُسأل عنه هواوي —
 * كلَّ نصف ساعةٍ للاشتراك الواحد على الأكثر — فيُمدَّد أو يُنهى.
 */
export async function sweepHuaweiSubs(limit = 50): Promise<void> {
  if (!huaweiReady()) return;
  const now = Date.now();
  const rows = await prisma.huaweiSubscription.findMany({
    where: {
      expiresAt: { lt: new Date(now + 10 * 60_000), gt: new Date(now - 2 * 86_400_000) },
      checkedAt: { lt: new Date(now - 30 * 60_000) },
    },
    take: limit,
  });
  for (const row of rows) {
    try {
      await prisma.huaweiSubscription.update({ where: { subscriptionId: row.subscriptionId }, data: { checkedAt: new Date() } });
      const found = await firstOk(SUB_ROOT, [row.site], "/sub/applications/v2/purchases/get", {
        subscriptionId: row.subscriptionId,
        purchaseToken: row.purchaseToken,
      });
      const data = found ? parse(found.reply.inappPurchaseData) : null;
      if (!data?.expirationDate) continue;
      await prisma.huaweiSubscription.update({
        where: { subscriptionId: row.subscriptionId },
        data: { expiresAt: new Date(data.expirationDate) },
      });
      // لم يتغيّر شيء ولم ينتهِ بعد: لا حدث.
      if (data.expirationDate === row.expiresAt.getTime() && data.subIsvalid !== false && data.expirationDate > Date.now()) continue;
      await applySubscription(row.userId, row.subscriptionId, data, false);
    } catch (problem) {
      console.error("[huawei] تجديدٌ لم يُفحص", row.subscriptionId, problem);
    }
  }
}
