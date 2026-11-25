"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { create } from "qrcode/lib/core/qrcode";
import { prisma } from "@/lib/db";
import { PANEL_DEVICE_COOKIE, PANEL_HOURS, createPanelSession, currentUser } from "@/lib/auth";
import { checkCode, newSecret, openSecret, otpauthUrl, sealSecret } from "@/lib/totp";
import { hit, TOO_MANY } from "@/lib/rate-limit";

/*
  التحقّقُ الثنائيّ للّوحة (القاعدة ٤٩٣). يمرّ به كلُّ من له صلاحية — المالكُ وممنوحو اللوحة
  والإشرافِ والمدونة — بعد كلمة المرور أو رابطِ التطبيق، وكلَّ اثنتي عشرة ساعة.
  والسرُّ الجديد ينتظر في كوكي قصيرٍ موقَّع حتى يُكتب أوّلُ رمزٍ صحيح منه: سرٌّ يُحفظ قبل أن
  يُمسح يُقفل صاحبَه خارج لوحته.
*/
const SETUP_COOKIE = "athar_totp_setup";

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET مطلوب");
  return new TextEncoder().encode(value);
}

/** المستخدمُ الذي ينتظر التحقّق — أو تحويلٌ إلى حيث يجب. */
async function pending() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!user.panelPending) redirect("/admin");
  return user;
}

export type Setup = { secret: string; path: string; size: number };

/** يولّد سرّاً جديداً لمن لم يضبط بعد، ويردّ رمزَ QR مرسوماً. */
export async function startSetup(): Promise<Setup | { error: string }> {
  const user = await pending();
  if (user.hasTotp) return { error: "ضبطت التحقّق من قبل — اكتب الرمز" };

  const fresh = newSecret();
  const token = await new SignJWT({ sub: user.id, s: fresh })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret());
  (await cookies()).set(SETUP_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/login",
    maxAge: 15 * 60,
  });

  const account = user.email ?? `#${user.memberNo}`;
  const { modules } = create(otpauthUrl(fresh, account), { errorCorrectionLevel: "M" });
  const n = modules.size;
  let d = "";
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (modules.get(x, y)) d += `M${x} ${y}h1v1h-1z`;
  return { secret: fresh, path: d, size: n };
}

/** الرمزُ: يُكمل الضبطَ لمن يضبط، ويفتح اللوحةَ لمن ضبط. */
export async function verifyCode(_prev: { error?: string } | null, formData: FormData): Promise<{ error?: string }> {
  const user = await pending();
  const code = String(formData.get("code") ?? "");
  // خمسُ محاولاتٍ في ربع ساعة لكلّ حساب: مليونُ رمزٍ لا يُجرَّب بيد.
  if (!hit(`totp:${user.id}`, 5, 15 * 60_000)) return { error: TOO_MANY };

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true, totpSecret: true, totpStep: true },
  });
  if (!row) redirect("/login");

  let sealed = row.totpSecret;
  let plain = sealed ? openSecret(sealed) : null;
  const store = await cookies();

  if (!sealed) {
    // ضبطٌ أوّل: السرُّ من الكوكي، ولصاحب الجلسة نفسه.
    const raw = store.get(SETUP_COOKIE)?.value;
    if (!raw) return { error: "انتهت مهلة الضبط — حدّث الصفحة وامسح الرمز من جديد" };
    try {
      const { payload } = await jwtVerify(raw, secret(), { algorithms: ["HS256"] });
      if (payload.sub !== user.id || typeof payload.s !== "string") throw new Error();
      plain = payload.s;
    } catch {
      return { error: "انتهت مهلة الضبط — حدّث الصفحة وامسح الرمز من جديد" };
    }
  }
  if (!plain) return { error: "تعذّر قراءة سرّ التحقّق — اطلب من المالك إعادة ضبطه" };

  const step = checkCode(plain, code);
  if (step === null) return { error: "الرمز غير صحيح" };

  if (!sealed) {
    sealed = sealSecret(plain);
    // «لم يُضبط بعد» شرطٌ في الكتابة: طلبان معاً لا يكتبان سرّين.
    const saved = await prisma.user.updateMany({
      where: { id: user.id, totpSecret: null },
      data: { totpSecret: sealed, totpStep: step },
    });
    if (!saved.count) return { error: "ضُبط التحقّق من نافذةٍ أخرى — حدّث الصفحة" };
    store.delete({ name: SETUP_COOKIE, path: "/login" });
  } else {
    // رمزٌ قُبل لا يُقبل ثانيةً: من التقطه من فوق الكتف لا يدخل به في نصف دقيقته.
    const used = await prisma.user.updateMany({
      where: { id: user.id, OR: [{ totpStep: null }, { totpStep: { lt: step } }] },
      data: { totpStep: step },
    });
    if (!used.count) return { error: "استُعمل هذا الرمز — انتظر الرمز التالي" };
  }

  await createPanelSession(user.id, row.passwordHash, sealed);
  // جاء من زرّ اللوحة في التطبيق: جوّالُه موثوقٌ اثنتي عشرة ساعة (`/login/enter`).
  const device = store.get(PANEL_DEVICE_COOKIE)?.value;
  if (device) {
    await prisma.user.update({
      where: { id: user.id },
      data: { panelDevice: device, panelUntil: new Date(Date.now() + PANEL_HOURS * 60 * 60 * 1000) },
    });
    store.delete({ name: PANEL_DEVICE_COOKIE, path: "/login" });
  }
  redirect("/admin");
}
