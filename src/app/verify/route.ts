import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { consume } from "@/lib/email-tokens";
import { activateSignup } from "@/lib/signup";
import { createSession } from "@/lib/auth";
import { appUrl } from "@/lib/site-url";

/**
 * رابطُ البريد: يفتح الحساب أو يختم العنوان، ثمّ يمضي بصاحبه.
 *
 * **ومسارٌ لا صفحة**: الجلسةُ تُفتح هنا، والكوكي لا تُكتب أثناء رسم
 * مكوّن خادم — تُكتب في مسارٍ أو إجراء وحدهما. وصفحةٌ تحاول ذلك تسقط
 * عند التشغيل لا عند البناء.
 *
 * ورابطٌ واحد لبابين: طلبُ تسجيلٍ ينتظر (فيُولَد الحساب ويأخذ رقمَ
 * عضويّته الآن)، أو حسابٌ قائمٌ يؤكّد عنواناً ربطه من الإعدادات.
 * والطلبُ يُجرَّب أوّلاً لأنّه الأكثر.
 *
 * **ولا شاشةَ «تمّ»**: من فُتح حسابه يجد نفسه في خطّه الزمنيّ، وذاك
 * أبلغُ من سطرٍ يقول «نجح» ثمّ يُطلب منه أن يضغط زرّاً.
 */
export async function GET(request: NextRequest) {
  const to = (path: string) => NextResponse.redirect(new URL(appUrl(path) || path, request.url));
  const token = request.nextUrl.searchParams.get("token") ?? "";

  const born = await activateSignup(token);
  if (!("error" in born)) {
    await createSession(born.userId);
    return to("/?welcome=1");
  }

  const read = await consume(token, "VERIFY");
  if (!("error" in read)) {
    await prisma.user.update({
      where: { id: read.userId },
      data: { emailVerifiedAt: new Date() },
    });
    return to("/settings?verified=1");
  }

  /*
     ورسالةُ الطلب أولى: من انقضت مهلتُه يُقال له «سجّل من جديد» لا
     «رابطٌ غير صالح» — والفرقُ بينهما أنّ الأولى تقول ماذا يفعل.
  */
  return to(`/login?verify=${encodeURIComponent(born.error)}`);
}
