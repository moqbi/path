import { api } from "./api";

/**
 * رفعُ ملفٍ في خطوتين — كما يشترطه الخادم.
 *
 * رابطٌ مؤقّت إلى الدلو، ثم رفعٌ مباشرٌ إليه، ثم اعتماد. والبايتات لا
 * تمرّ بخادمنا: ميغاباياتٌ لا تُنقل مرّتين، وجوّالٌ على شبكةٍ ضعيفة لا
 * ينتظر وسيطاً.
 */
export type Purpose = "AVATAR" | "COVER" | "MOMENT" | "STORY" | "MESSAGE" | "VOICE";

export async function uploadFile(
  uri: string,
  mime: string,
  purpose: Purpose,
  size: { width: number; height: number } = { width: 0, height: 0 },
): Promise<string> {
  const blob = await (await fetch(uri)).blob();

  const ticket = await api<{ mediaId: string; url: string; headers: Record<string, string> }>(
    "/v1/media/presign",
    {
      method: "POST",
      body: JSON.stringify({
        mime,
        bytes: blob.size,
        width: Math.round(size.width),
        height: Math.round(size.height),
        purpose,
      }),
    },
  );

  const put = await fetch(ticket.url, {
    method: "PUT",
    headers: { ...ticket.headers, "content-type": mime },
    body: blob,
  });
  if (!put.ok) throw new Error("تعذّر رفع الملف");

  // الاعتماد يفحص البايتات: ما لم يُعتمد لا يُربط بلحظةٍ ولا يُقدَّم.
  await api(`/v1/media/${ticket.mediaId}/commit`, { method: "POST" });
  return ticket.mediaId;
}
