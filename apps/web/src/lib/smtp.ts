import { connect as netConnect, type Socket } from "node:net";
import { connect as tlsConnect, type TLSSocket } from "node:tls";

/**
 * عميلُ SMTP صغير — مكتوبٌ بيدنا كتوقيع R2.
 *
 * بريفو تعطي مفتاحين: مفتاحَ واجهةٍ (`xkeysib`) ومفتاحَ SMTP
 * (`xsmtpsib`). الأوّل يمشي على `/v3/smtp/email`، والثاني **لا يمشي
 * عليها** — فمن عنده مفتاحُ SMTP وحده يحتاج من يتكلّم SMTP.
 *
 * وحزمةُ بريدٍ كاملة لأجل ثلاثة أفعالٍ (تحية، واستيثاق، وإرسال) اعتماديّةٌ
 * تُحدَّث ولا تُستعمل — والمنظومة كلُّها بلا اعتماديّاتٍ إضافية عمداً.
 *
 * والمنفذ ٥٨٧ يبدأ **عارياً** ثمّ يرتفع إلى TLS بـ`STARTTLS`: هكذا
 * يعمل تتابُعُ SMTP الحديث، ولا تُرسَل كلمةُ المرور قبل أن يرتفع.
 */

/** سطرُ ردٍّ من الخادم: رقمٌ ثمّ نصّ. */
type Reply = { code: number; text: string };

function reader(socket: Socket | TLSSocket) {
  let buffer = "";
  const waiting: { resolve: (reply: Reply) => void; reject: (error: Error) => void }[] = [];

  socket.setEncoding("utf8");
  socket.on("data", (chunk: string) => {
    buffer += chunk;
    // الردُّ يكتمل بسطرٍ رقمُه متبوعٌ بمسافة لا بشرطة (٢٥٠-… ثمّ ٢٥٠ ).
    for (;;) {
      const match = /^(\d{3}) [^\n]*\r?\n/m.exec(buffer);
      if (!match) return;
      const end = buffer.indexOf(match[0]) + match[0].length;
      const text = buffer.slice(0, end);
      buffer = buffer.slice(end);
      waiting.shift()?.resolve({ code: Number(match[1]), text });
    }
  });

  const fail = (error: Error) => {
    while (waiting.length) waiting.shift()?.reject(error);
  };
  socket.on("error", fail);
  socket.on("close", () => fail(new Error("أُغلق الاتّصال قبل تمام الإرسال")));

  return () =>
    new Promise<Reply>((resolve, reject) => {
      waiting.push({ resolve, reject });
    });
}

/** يرمز الرأسَ العربيّ بـ`=?UTF-8?B?…?=` — وإلّا خرج مربّعات. */
function header(value: string): string {
  // eslint-disable-next-line no-control-regex
  return /^[\x20-\x7E]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

/** جسدُ الرسالة base64 بأسطرٍ ٧٦ حرفاً كما يفرض MIME. */
function body(text: string): string {
  return (Buffer.from(text, "utf8").toString("base64").match(/.{1,76}/g) ?? []).join("\r\n");
}

export type SmtpLetter = {
  to: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  html: string;
  text: string;
};

export async function sendSmtp(letter: SmtpLetter): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT ?? 587);
  if (!host || !user || !pass) return false;

  let socket: Socket | TLSSocket = netConnect({ host, port });
  let next = reader(socket);

  const send = async (line: string, expect: number): Promise<Reply> => {
    socket.write(`${line}\r\n`);
    const reply = await next();
    if (Math.floor(reply.code / 100) !== expect) {
      throw new Error(`SMTP ${reply.code}: ${reply.text.trim()}`);
    }
    return reply;
  };

  try {
    await new Promise<void>((done, fail) => {
      socket.once("connect", () => done());
      socket.once("error", fail);
    });
    await next(); // ٢٢٠ ترحيب

    await send("EHLO athar", 2);
    await send("STARTTLS", 2);

    // الترقية إلى TLS: ما بعدها مشفَّر، والقارئُ يُعاد على المقبس الجديد.
    socket = tlsConnect({ socket: socket as Socket, servername: host });
    next = reader(socket);
    await new Promise<void>((done, fail) => {
      (socket as TLSSocket).once("secureConnect", () => done());
      socket.once("error", fail);
    });

    await send("EHLO athar", 2);

    // AUTH LOGIN: اسمٌ ثمّ كلمةٌ، كلٌّ منهما base64 في سطرٍ مستقلّ.
    await send("AUTH LOGIN", 3);
    await send(Buffer.from(user, "utf8").toString("base64"), 3);
    await send(Buffer.from(pass, "utf8").toString("base64"), 2);

    await send(`MAIL FROM:<${letter.fromEmail}>`, 2);
    await send(`RCPT TO:<${letter.to}>`, 2);
    await send("DATA", 3);

    const boundary = `athar_${Date.now().toString(36)}`;
    const message = [
      `From: ${header(letter.fromName)} <${letter.fromEmail}>`,
      `To: <${letter.to}>`,
      `Subject: ${header(letter.subject)}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      body(letter.text),
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      body(letter.html),
      `--${boundary}--`,
      "",
      ".", // نقطةٌ وحدها تُنهي المتن
    ].join("\r\n");

    await send(message, 2);
    await send("QUIT", 2).catch(() => undefined);
    socket.end();
    return true;
  } catch (problem) {
    console.error("[smtp] تعذّر الإرسال", problem);
    socket.destroy();
    return false;
  }
}
