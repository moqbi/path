import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * التحقّقُ الثنائيّ للّوحة (القاعدة ٤٩٣): رموزُ RFC 6238 — ستّةُ أرقامٍ كلَّ ثلاثين ثانية بـHMAC-SHA1،
 * وهي ما يقرؤه Google Authenticator و1Password وغيرُهما. من مكتبة Node القياسيّة بلا حزمة.
 */
const STEP = 30;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function unbase32(text: string): Buffer {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of text.replace(/=+$/, "").toUpperCase()) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** سرٌّ جديد: عشرون بايتاً كما في RFC 4226، مكتوباً base32 ليُكتب باليد إن تعذّر المسح. */
export function newSecret(): string {
  return base32(randomBytes(20));
}

function codeAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac("sha1", unbase32(secret)).update(counter).digest();
  const offset = mac[mac.length - 1] & 15;
  const number = (mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(number).padStart(6, "0");
}

/**
 * يردّ خطوةَ الرمز إن صحّ، أو `null`. خطوةٌ قبله وخطوةٌ بعده تُقبلان: ساعةُ الجوّال
 * قد تسبق الخادم أو تتأخّر عنه ثوانيَ. والمقارنةُ بوقتٍ ثابت.
 */
export function checkCode(secret: string, raw: string): number | null {
  const code = raw.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\D/g, "");
  if (code.length !== 6) return null;
  const now = Math.floor(Date.now() / 1000 / STEP);
  for (const step of [now, now - 1, now + 1]) {
    if (timingSafeEqual(Buffer.from(codeAt(secret, step)), Buffer.from(code))) return step;
  }
  return null;
}

/** رابطُ الإضافة في تطبيق الرموز — يُرسم رمزَ QR. */
export function otpauthUrl(secret: string, account: string): string {
  const label = encodeURIComponent(`ATHAR Moments:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent("ATHAR Moments")}&algorithm=SHA1&digits=6&period=${STEP}`;
}

/*
  السرُّ مشفّراً في القاعدة بـAES-256-GCM، ومفتاحُه مشتقٌّ من `AUTH_SECRET`: نسخةٌ احتياطيّةٌ
  تُقرأ أو قاعدةٌ تُسرَّق لا تُولّد رموزَ المشرفين. وتبديلُ `AUTH_SECRET` يُبطل الأسرارَ كلَّها —
  فيُضبط كلُّ مشرفٍ من جديد.
*/
function key(): Buffer {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET مطلوب");
  return createHash("sha256").update(`totp:${value}`).digest();
}

export function sealSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((part) => part.toString("base64url")).join(".");
}

export function openSecret(sealed: string): string | null {
  try {
    const [iv, tag, body] = sealed.split(".").map((part) => Buffer.from(part, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** بصمةُ السرّ في جلسة اللوحة: إعادةُ ضبطه تُخرج كلَّ جلسةٍ قبلها. */
export function totpMark(sealed: string | null): string {
  return createHash("sha256").update(sealed ?? "none").digest("base64url").slice(0, 16);
}
