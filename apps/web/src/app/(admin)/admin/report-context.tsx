import { ar, dayLabel, timeOfDay } from "@/lib/format";

/**
 * سياقُ رسالةٍ مُبلَّغٍ عنها (القاعدة ١٩٥): ما قبلها وما بعدها من المحادثة،
 * منسوخاً من القاعدة ساعةَ البلاغ — فيحكم المشرف على ما قيل فعلاً لا على
 * لقطة شاشةٍ قد تُركَّب. والرسالةُ المُبلَّغ عنها مُعلَّمة.
 *
 * ولا بابَ هنا إلى المحادثة نفسها: ما يُرى هو ما نُسخ مع البلاغ وحده.
 */
type Line = {
  id: string;
  senderId: string;
  name: string;
  memberNo: number;
  body: string;
  kind: string;
  at: string;
  edited: boolean;
  reported: boolean;
};

const MEDIA: Record<string, string> = { PHOTO: "[صورة]", VOICE: "[مقطع صوتي]" };

function lines(context: unknown): Line[] {
  if (!context || typeof context !== "object") return [];
  const messages = (context as { messages?: unknown }).messages;
  return Array.isArray(messages) ? (messages as Line[]) : [];
}

export function ReportContext({ context }: { context: unknown }) {
  const rows = lines(context);
  if (rows.length === 0) return null;
  const first = rows[0].senderId;

  return (
    <details className="mt-2 rounded-xl border border-line">
      <summary className="cursor-pointer px-3 py-2 text-[11.5px] font-semibold text-ink-2">
        سياق المحادثة ({ar(rows.length)} رسالة — منسوخة وقت البلاغ)
      </summary>
      <div className="flex flex-col gap-1.5 px-3 pb-3">
        {rows.map((row) => {
          const at = new Date(row.at);
          return (
            <div
              key={row.id}
              className="rounded-xl px-3 py-2"
              style={{
                background: row.reported ? "var(--color-live-soft)" : "var(--color-chip)",
                border: row.reported ? "1.5px solid var(--color-live)" : "1px solid transparent",
                marginInlineStart: row.senderId === first ? 0 : 24,
              }}
            >
              <p className="text-[10.5px] text-muted">
                <bdi>{row.name}</bdi> ({ar(row.memberNo)}) · {dayLabel(at)} {timeOfDay(at)}
                {row.edited ? " · معدّلة" : ""}
                {row.reported ? " · المُبلَّغ عنها" : ""}
              </p>
              <p dir="auto" className="whitespace-pre-wrap text-[12.5px] leading-relaxed">
                {row.body || MEDIA[row.kind] || `[${row.kind}]`}
              </p>
            </div>
          );
        })}
      </div>
    </details>
  );
}
