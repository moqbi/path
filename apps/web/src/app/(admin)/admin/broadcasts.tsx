import { prisma } from "@/lib/db";
import { ar } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { BroadcastComposer } from "./broadcast-composer";

/**
 * قسمُ التنبيهات في اللوحة (القاعدة ٣٦٣): تنبيهٌ لكلّ مستخدم، ومن ضغطه رأى
 * بطاقةً بصورةٍ وعبارةٍ ونصّ. وتحته آخرُ ما أُرسل وكم جهازاً وصل إليه.
 */
export async function BroadcastsSection() {
  const recent = await prisma.broadcast.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, title: true, body: true, cardTitle: true, mediaId: true, createdAt: true, pushedAt: true, sentCount: true },
  });

  return (
    <>
      <h2 className="mb-1 text-[15px] font-bold">التنبيهات</h2>
      <p className="mb-3 text-[11.5px] leading-relaxed text-muted">
        تنبيهٌ يصل إلى جوّال كلّ مستخدم: عنوانٌ ونصٌّ تحته. ومن ضغطه تُفتح له نافذةٌ بصورةٍ
        وعبارةٍ ونصّ. يُرسل خلال دقيقة، والوضعُ الهادئ لكلّ مستخدمٍ يسري عليه — لا يصل لمن هو فيه.
        ولا تراجع بعد الإرسال.
      </p>

      <BroadcastComposer />

      <h3 className="mb-2 mt-6 text-[13.5px] font-bold">ما أُرسل</h3>
      {recent.length === 0 ? (
        <p className="rounded-2xl border border-line bg-card p-5 text-center text-[12.5px] text-muted">لم يُرسل شيءٌ بعد.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {recent.map((row) => (
            <div key={row.id} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3">
              {row.mediaId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl(row.mediaId) ?? ""} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
              ) : null}
              <div className="min-w-0 grow">
                <p className="truncate text-[13.5px] font-bold">{row.title}</p>
                <p className="truncate text-[12px] text-muted">{row.body}</p>
              </div>
              <span className="shrink-0 text-[11.5px] text-muted">
                {row.pushedAt
                  ? `${ar(row.sentCount ?? 0)} جهاز · ${row.pushedAt.toLocaleDateString("ar-SA-u-ca-gregory", { day: "numeric", month: "short" })}`
                  : "بانتظار الإرسال"}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
