import { SITE_URL } from "@/lib/site-url";

/**
 * البريد الصادر عبر بريفو.
 *
 * نداءٌ مباشر لواجهتها (`/v3/smtp/email`) لا حزمةُ SDK: فعلٌ واحد
 * برأسٍ ومفتاح، وحزمةٌ كاملةٌ لأجله اعتماديّةٌ تُحدَّث ولا تُستعمل.
 *
 * **وبلا مفتاحٍ يعمل كل شيء**: بيئةُ تطويرٍ لم تُربط بعد لا يتعطّل فيها
 * التسجيلُ ولا إعادةُ الضبط — يُكتب الرابط في السجلّ ويُقرأ من هناك،
 * ويُقال للمستخدم ما يُقال دائماً فلا يُعرف من الشاشة أنّ البريد لم
 * يُرسَل (ولو عُرف لصار بابَ كشفٍ عن الحسابات).
 */
const API = "https://api.brevo.com/v3/smtp/email";

/** اسمُ المرسِل كما يُقرأ في صندوق الوارد. */
const FROM_NAME = "آثار مومنتس";

export type Letter = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export async function sendMail(letter: Letter): Promise<boolean> {
  const key = process.env.BREVO_API_KEY;
  const from = process.env.MAIL_FROM;

  if (!key || !from) {
    // لا مفتاحَ ولا عنوانَ صادر: بيئةٌ لم تُربط. يُكتب ولا يُرسَل.
    // ويُكتب المتنُ معه: فيه الرابط، فتُجرَّب الدورة كاملةً بلا مفتاح.
    console.info(
      "[mail] لم يُرسَل (بلا BREVO_API_KEY أو MAIL_FROM):",
      letter.subject,
      letter.to,
      letter.text,
    );
    return false;
  }

  try {
    const response = await fetch(API, {
      method: "POST",
      headers: {
        "api-key": key,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: FROM_NAME, email: from },
        to: [{ email: letter.to }],
        subject: letter.subject,
        htmlContent: letter.html,
        textContent: letter.text,
      }),
    });

    if (!response.ok) {
      console.error("[mail] ردّت بريفو", response.status, await response.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (problem) {
    // فشلُ الإرسال لا يُسقط الفعل الذي معه: التسجيل يتمّ والرسالة تُعاد.
    console.error("[mail] تعذّر الإرسال", problem);
    return false;
  }
}

/**
 * قالبُ الرسالة: شعارٌ على شريطٍ داكن، ثمّ ورقةٌ فيها العنوان والمتن
 * وزرٌّ واحد، ثمّ الرابط نصّاً وذيلٌ صغير.
 *
 * **جداولٌ وأنماطٌ في السطر**: عملاءُ البريد (أوتلوك خاصّةً) لا يقرؤون
 * `flex` ولا ورقةَ أنماطٍ خارجية — وما يُكتب هنا بـ`div` يخرج مكسوراً
 * عند نصف الناس.
 *
 * والشعار صورةٌ على الموقع (`/athr-mark.png`) لا مرفقٌ ولا `data:`:
 * المرفقُ يُنزَّل مع كل رسالة، و`data:` تحجبها أكثرُ العملاء.
 */
export function letterHtml({
  title,
  intro,
  button,
  url,
  note,
}: {
  title: string;
  intro: string;
  button: string;
  url: string;
  note: string;
}): string {
  const mark = SITE_URL ? `${SITE_URL}/athr-mark.png` : "";

  return `<!doctype html>
<html dir="rtl" lang="ar">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#EAE5D9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EAE5D9;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;border-radius:18px;overflow:hidden;border:1px solid #E0D8C8;">

        <tr><td align="center" style="background:#0E1A24;padding:22px 20px;">
          ${mark ? `<img src="${mark}" width="44" height="44" alt="آثار" style="display:block;border:0;">` : ""}
          <div style="color:#FDFCF8;font-family:Tahoma,Arial,sans-serif;font-size:15px;font-weight:bold;letter-spacing:2px;padding-top:8px;">ATHAR</div>
        </td></tr>

        <tr><td style="background:#FDFCF8;padding:28px 24px;font-family:Tahoma,Arial,sans-serif;" dir="rtl">
          <h1 style="margin:0 0 12px;color:#14212b;font-size:19px;">${title}</h1>
          <p style="margin:0 0 20px;color:#4a5560;font-size:14px;line-height:26px;">${intro}</p>

          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 20px;">
            <tr><td align="center" style="border-radius:12px;background:#F6B93B;">
              <a href="${url}" style="display:block;padding:14px 34px;color:#14212b;font-size:15px;font-weight:bold;text-decoration:none;">${button}</a>
            </td></tr>
          </table>

          <p style="margin:0 0 6px;color:#8a9199;font-size:12px;line-height:22px;">أو انسخ هذا الرابط في متصفّحك:</p>
          <p style="margin:0 0 20px;word-break:break-all;" dir="ltr">
            <a href="${url}" style="color:#B07A16;font-size:12px;">${url}</a>
          </p>

          <p style="margin:0;color:#8a9199;font-size:12px;line-height:22px;border-top:1px solid #EFE9DC;padding-top:16px;">${note}</p>
        </td></tr>

        <tr><td align="center" style="background:#0E1A24;padding:14px 20px;font-family:Tahoma,Arial,sans-serif;">
          <div style="color:#8a9199;font-size:11px;">آثار مومنتس · لحظاتك، مع ناسك.</div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}
