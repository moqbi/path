import { randomUUID } from "node:crypto";
import { cloudReady, putObject } from "@athar/storage";
import { prisma } from "@athar/db";

/**
 * مرفقاتُ رسالة الدعم من التطبيق — صورٌ بحدود الموقع نفسها (القاعدة ١٧٩):
 * ثلاثٌ بخمسة ميغا لكلٍّ، والصيغةُ من أوّل البايتات لا من الاسم ولا من
 * النوع المُرسل — كلاهما يكتبه المرسل.
 */
export const TICKET_FILES = { max: 3, bytes: 5 * 1024 * 1024 } as const;

const MIME = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;
type Kind = keyof typeof MIME;

function sniff(bytes: Uint8Array): Kind | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "webp";
  }
  return null;
}

export type ReadyFile = { name: string; mime: string; bytes: Uint8Array };

/** يفحص الملفّات ويردّ نصَّ الخطأ لا يرميه. */
export async function readTicketFiles(
  picked: File[],
): Promise<{ files: ReadyFile[] } | { error: string }> {
  const real = picked.filter((file) => file.size > 0);
  if (real.length > TICKET_FILES.max) return { error: "ثلاث صور بحدٍّ أقصى" };

  const files: ReadyFile[] = [];
  for (const file of real) {
    if (file.size > TICKET_FILES.bytes) return { error: "كل صورة حتى ٥ ميغا" };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = sniff(bytes);
    if (!kind) return { error: "المرفق ليس صورة" };
    const name = (file.name || `image.${kind}`).replace(/[\\/\r\n"]/g, "_").slice(0, 120);
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
