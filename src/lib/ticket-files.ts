import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { TICKET_FILES } from "@/lib/topics";
import { cloudReady, putObject } from "@/lib/storage";

/**
 * مرفقاتُ رسائل الموقع: صورٌ لرسالة الدعم، وصورٌ أو PDF لطلب الوظيفة.
 *
 * **الصيغةُ من البايتات لا من الاسم ولا من `type`**: كلاهما يكتبه المرسل،
 * و«cv.pdf» قد يكون أيَّ شيء. فتُقرأ الأربعُ الأولى من الملف — توقيعُ
 * الصيغة — ويُرفض ما لم يطابق.
 *
 * والحدود ثلاثة ملفّات وخمسة ميغا لكلٍّ: صورتان للمشكلة وسيرةٌ ذاتية
 * تكفي، وحدُّ إجراء الخادم ١٦ ميغا للطلب كلّه (`next.config.ts`).
 */

type Kind = "jpeg" | "png" | "webp" | "pdf";

const MIME: Record<Kind, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

function sniff(bytes: Uint8Array): Kind | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "webp";
  }
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "pdf";
  return null;
}

export type ReadyFile = { name: string; mime: string; bytes: Uint8Array };

/**
 * يقرأ الملفّات من النموذج ويفحصها — ويردّ نصَّ الخطأ لا يرميه (القاعدة ٩٠).
 * `pdf` يسمح بها لطلب الوظيفة وحده.
 */
export async function readTicketFiles(
  formData: FormData,
  allowPdf: boolean,
): Promise<{ files: ReadyFile[] } | { error: string }> {
  // المتصفّح يرسل حقلاً فارغاً باسمٍ فارغ حين لا يُختار شيء.
  const picked = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (picked.length > TICKET_FILES.max) {
    return { error: `ثلاثة مرفقات بحدٍّ أقصى` };
  }

  const files: ReadyFile[] = [];
  for (const file of picked) {
    if (file.size > TICKET_FILES.bytes) {
      return { error: `«${file.name}» أكبر من ٥ ميغا` };
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = sniff(bytes);
    if (!kind || (kind === "pdf" && !allowPdf)) {
      return { error: allowPdf ? `«${file.name}» ليس صورةً ولا PDF` : `«${file.name}» ليس صورة` };
    }
    // الاسمُ يُقصّ ويُنظَّف: يُعرض في اللوحة ويُنزَّل به.
    const name = file.name.replace(/[\\/\r\n"]/g, "_").slice(0, 120) || `file.${kind}`;
    files.push({ name, mime: MIME[kind], bytes });
  }
  return { files };
}

/** يحفظها على الرسالة: في R2 إن رُبط، وإلا في القاعدة (القاعدة ١٠٢). */
export async function saveTicketFiles(ticketId: string, files: ReadyFile[]): Promise<void> {
  for (const file of files) {
    let key: string | null = null;
    if (cloudReady()) {
      key = `tickets/${ticketId}/${randomUUID()}`;
      await putObject(key, file.bytes, file.mime);
    }
    await prisma.ticketFile.create({
      data: {
        ticketId,
        name: file.name,
        mime: file.mime,
        size: file.bytes.length,
        key,
        bytes: key ? null : Buffer.from(file.bytes),
      },
    });
  }
}
