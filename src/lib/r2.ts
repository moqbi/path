import { createHash, createHmac } from "node:crypto";

/**
 * تخزين الملفات في Cloudflare R2.
 *
 * الصور والأصوات ومقاطع الفيديو تُخزَّن كائناتٍ في R2 لا بايتاتٍ في
 * القاعدة: قاعدة بيانات تحمل الفيديو تكبر بلا سقف، ونسخُها الاحتياطي
 * يصير نسخاً للملفات. وR2 بلا رسوم خروج، فالبثّ منها لا يُحاسب بالغيغا.
 *
 * والاتصال بها بتوقيع SigV4 مباشرةً لا بحزمة AWS: ثلاثة أفعال فقط —
 * رفعٌ وقراءةٌ وحذف — ولا داعي لميغابايتات من اعتماديةٍ لأجلها.
 *
 * وما دامت المفاتيح غير مضبوطة يعمل التطبيق على القاعدة كما كان، فلا
 * يتعطّل الرفع في بيئةٍ لم تُربط بعد.
 *
 * وهذا الملف بلا حارس `server-only` عمداً: سكربت نقل الملفات القديمة
 * يستورده وهو يعمل خارج Next. وبابه إلى التطبيق `storage.ts` وعليه الحارس.
 */
type Bucket = { endpoint: string; bucket: string; key: string; secret: string };

/**
 * العنوان يُشتقّ من رقم الحساب، ويمكن كتابته صراحةً بـ`R2_ENDPOINT`:
 * أيّ تخزينٍ متوافق مع S3 يصلح — وهذا يهمّ لو لزم أن تبقى الملفات داخل
 * المملكة، فلا يُعاد بناء الطبقة لأجل مزوّدٍ آخر.
 */
function config(): Bucket | null {
  const account = process.env.R2_ACCOUNT_ID;
  const endpoint =
    process.env.R2_ENDPOINT?.replace(/\/+$/, "") ||
    (account ? `https://${account}.r2.cloudflarestorage.com` : "");
  const bucket = process.env.R2_BUCKET;
  const key = process.env.R2_ACCESS_KEY_ID;
  const secret = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !key || !secret) return null;
  return { endpoint, bucket, key, secret };
}

/** أمضبوطةٌ السحابة؟ عليها يتوقّف أين تُكتب الملفات الجديدة. */
export function cloudReady(): boolean {
  return config() !== null;
}

const sha256 = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");
const hmac = (key: Buffer | string, data: string) => createHmac("sha256", key).update(data).digest();

/** كل جزءٍ من المسار يُرمَّز، والشرطة المائلة تبقى فاصلاً. */
const encodePath = (path: string) =>
  path.split("/").map((part) => encodeURIComponent(part)).join("/");

/**
 * طلبٌ موقَّع بـSigV4.
 *
 * المنطقة `auto` والخدمة `s3` — هكذا تتوقّعهما R2. والحمولة تُلخَّص
 * فعلاً لا تُعلن «بلا توقيع»: الملخّص يمنع تغيير الملف في الطريق.
 */
/**
 * التوقيع نفسه، معزولاً عن الشبكة.
 *
 * معزولٌ ليُختبر: التوقيع إمّا يطابق حرفاً بحرف أو يُردّ الطلب كله، ولا
 * وسط بينهما — فيُقاس على أمثلة AWS المنشورة بدل أن يُجرَّب على الحساب.
 */
export function signRequest(input: {
  method: string;
  host: string;
  /** المسار كما يُرسل، مرمّزاً. */
  path: string;
  region: string;
  accessKey: string;
  secretKey: string;
  /** `YYYYMMDDTHHMMSSZ`. */
  stamp: string;
  payloadHash: string;
  headers?: Record<string, string>;
}): { authorization: string; headers: Record<string, string> } {
  const day = input.stamp.slice(0, 8);

  // الأسماء تُصغَّر وتُرتَّب، فالتوقيع والطلب يتّفقان حرفاً بحرف.
  const all = new Map<string, string>();
  all.set("host", input.host);
  all.set("x-amz-content-sha256", input.payloadHash);
  all.set("x-amz-date", input.stamp);
  for (const [name, value] of Object.entries(input.headers ?? {})) {
    all.set(name.toLowerCase(), value.trim());
  }

  const names = [...all.keys()].sort();
  const canonicalHeaders = names.map((name) => `${name}:${all.get(name)}\n`).join("");
  const signedHeaders = names.join(";");

  const canonical = [
    input.method,
    input.path,
    "",
    canonicalHeaders,
    signedHeaders,
    input.payloadHash,
  ].join("\n");

  const scope = `${day}/${input.region}/s3/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", input.stamp, scope, sha256(canonical)].join("\n");
  const signing = hmac(
    hmac(hmac(hmac(`AWS4${input.secretKey}`, day), input.region), "s3"),
    "aws4_request",
  );
  const signature = createHmac("sha256", signing).update(toSign).digest("hex");

  return {
    authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    headers: Object.fromEntries(all),
  };
}

async function signed(
  method: "GET" | "PUT" | "DELETE",
  objectKey: string,
  body?: Uint8Array,
  headers: Record<string, string> = {},
): Promise<Response> {
  const store = config();
  if (!store) throw new Error("تخزين الملفات غير مضبوط");

  const url = new URL(store.endpoint);
  const host = url.host;
  const path = `${url.pathname.replace(/\/+$/, "")}/${store.bucket}/${encodePath(objectKey)}`;
  const stamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");

  const signature = signRequest({
    method,
    host,
    path,
    region: "auto",
    accessKey: store.key,
    secretKey: store.secret,
    stamp,
    payloadHash: body ? sha256(body) : sha256(""),
    headers,
  });

  return fetch(`${url.protocol}//${host}${path}`, {
    method,
    headers: { ...signature.headers, Authorization: signature.authorization },
    body: body ? Buffer.from(body) : undefined,
    cache: "no-store",
  });
}

/** يرفع كائناً ويردّ مفتاحه. */
export async function putObject(
  objectKey: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  const response = await signed("PUT", objectKey, bytes, {
    "content-type": contentType,
    "content-length": String(bytes.length),
  });
  if (!response.ok) {
    throw new Error(`تعذّر رفع الملف (${response.status})`);
  }
}

/** يقرأ كائناً — ويمرّر طلب المدى كما هو ليعمل تشغيل الفيديو. */
export async function getObject(objectKey: string, range?: string | null): Promise<Response> {
  return signed("GET", objectKey, undefined, range ? { range } : {});
}

/**
 * يحذف كائنات — والحذف نهائيّ: «لا يُحتفظ بها» تعني ألّا تبقى في السحابة
 * أيضاً، لا في القاعدة وحدها.
 */
export async function deleteObjects(keys: string[]): Promise<void> {
  await Promise.all(
    keys.map(async (objectKey) => {
      try {
        await signed("DELETE", objectKey);
      } catch {
        // فشلُ حذف كائنٍ لا يمنع حذف البقية ولا يُسقط العملية.
      }
    }),
  );
}
