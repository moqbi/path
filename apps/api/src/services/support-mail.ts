import { letterHtml, sendMail } from "./mail";

/**
 * بريدُ الدعم: خبرٌ إلينا حين تصل رسالة، وردٌّ إلى من لا شاشةَ له.
 *
 * **إلينا**: صندوقُ `SUPPORT_EMAIL` — ولوحةُ التحكّم تبقى مكان الحسم،
 * والرسالةُ تنبيهٌ كي لا يبقى سؤالُ أحدهم أسبوعاً بلا أن يفتح أحدٌ
 * اللوحة.
 *
 * **وإليه**: من كتب من الموقع بلا حساب ليس له شاشةٌ يقرأ فيها الردّ
 * (القاعدة ٧٤)، فيذهب إلى بريده. ومن كتب من داخل التطبيق يقرؤه في
 * مكان سؤاله، فلا يُرسَل له شيء — رسالةٌ تقول «افتح التطبيق لتقرأ» لا
 * تفعل شيئاً.
 *
 * والفشلُ يُبتلع في الحالين: رسالةُ دعمٍ تُحفظ وإن لم يخرج بريد.
 */
export async function tellSupport(input: {
  from: string;
  body: string;
  replyTo?: string | null;
}): Promise<void> {
  const inbox = process.env.SUPPORT_EMAIL;
  if (!inbox) return;

  await sendMail({
    to: inbox,
    subject: `رسالة دعم جديدة — ${input.from}`,
    text: `${input.from}${input.replyTo ? ` <${input.replyTo}>` : ""}\n\n${input.body}`,
    html: letterHtml({
      title: "رسالة دعم جديدة",
      intro: `من: ${input.from}${input.replyTo ? ` (${input.replyTo})` : ""}<br><br>${input.body.replace(/</g, "&lt;").replace(/\n/g, "<br>")}`,
      button: "افتح اللوحة",
      url: `${process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? ""}/admin?s=support`,
      note: "الردّ يُكتب من اللوحة، ومنها يصل صاحبَه.",
    }),
  }).catch(() => false);
}

/** ردُّ المشرف إلى من كتب من الموقع بلا حساب. */
export async function mailReply(input: {
  to: string;
  name: string | null;
  question: string;
  reply: string;
}): Promise<void> {
  await sendMail({
    to: input.to,
    subject: "ردٌّ على رسالتك — آثار مومنتس",
    text: `${input.reply}\n\n— على سؤالك: ${input.question}`,
    html: letterHtml({
      title: `${input.name ? `أهلاً ${input.name}` : "أهلاً بك"}`,
      intro: `${input.reply.replace(/</g, "&lt;").replace(/\n/g, "<br>")}<br><br><span style="color:#8a9199">على سؤالك: ${input.question.slice(0, 300).replace(/</g, "&lt;")}</span>`,
      button: "افتح آثار",
      url: process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "",
      note: "إن بقي عندك سؤال، اكتب إلينا مرّةً أخرى من صفحة «تواصل معنا».",
    }),
  }).catch(() => false);
}
