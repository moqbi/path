import { prisma } from "@/lib/db";
import { createMood, deleteMood, updateMood } from "@/app/actions";
import { ar } from "@/lib/format";
import { Saver } from "./saver";
import { MoodImage } from "./mood-image";

const FIELD =
  "rounded-xl border border-line bg-card px-4 text-[13.5px] text-ink outline-none focus:border-clay";
const DANGER = { color: "var(--color-live)" } as const;
const SOLID = { background: "var(--color-clay)", color: "var(--color-on-brand)" } as const;

/** معاينةُ لوحة المود كما تُرى في الخطّ الزمنيّ: الصورةُ وحجابُ الثيم والوجهُ والاسم. */
function Preview({ emoji, name, color, mediaId }: { emoji: string; name: string; color: string; mediaId: string | null }) {
  return (
    <div className="relative h-24 w-[120px] shrink-0 overflow-hidden rounded-xl" style={{ background: color }}>
      {mediaId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/media/${mediaId}`} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to bottom, rgba(14,26,36,.1), rgba(14,26,36,.8))" }}
      />
      <div className="absolute inset-x-0 bottom-0 p-2 text-white">
        <div className="text-[26px] leading-none">{emoji}</div>
        <div className="mt-1 text-[12px] font-extrabold">{name}</div>
      </div>
    </div>
  );
}

/**
 * قسمُ المودات (القاعدة ٤٨٤): وجهٌ واسمٌ ولونٌ وصورةٌ تملأ لوحتَه في الخطّ الزمنيّ.
 * يقرؤها التطبيقُ من `/v1/site/moods`، فالمضافُ يصل بلا نشر نسخة. والمستعمَلُ يُخفى ولا يُحذف.
 */
export async function MoodsSection() {
  const moods = await prisma.mood.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { moments: true } } },
  });

  return (
    <>
      <h2 className="mb-1 text-[15px] font-bold">المودات</h2>
      <p className="mb-3 text-[11.5px] leading-relaxed text-muted">
        تظهر في «مود» بقوس النشر. الصورةُ تملأ لوحةَ المود وفوقها حجابٌ من لون شريط الثيم، وبلا صورةٍ
        لونُ المود. الإيموجي من كيبورد الجهاز (يونيكود ١١ فما دون — القاعدة ٨٥ج). المودُ المستعمَل في لحظاتٍ
        يُخفى ولا يُحذف.
      </p>

      <details className="mb-5 rounded-2xl border border-line bg-card p-4">
        <summary className="cursor-pointer text-[13.5px] font-bold">مود جديد</summary>
        <Saver action={createMood} className="mt-3 flex flex-col gap-2">
          <div className="grid grid-cols-[72px_1fr_88px] gap-2">
            <label className="text-[11.5px] text-muted">
              إيموجي
              <input name="emoji" required maxLength={16} placeholder="😌" className={`mt-1 block w-full text-center ${FIELD}`} style={{ height: 42 }} />
            </label>
            <label className="text-[11.5px] text-muted">
              الاسم
              <input name="name" required maxLength={24} placeholder="رايق" className={`mt-1 block w-full ${FIELD}`} style={{ height: 42 }} />
            </label>
            <label className="text-[11.5px] text-muted">
              اللون
              <input name="color" type="color" defaultValue="#F6B93B" className="mt-1 block w-full rounded-xl border border-line" style={{ height: 42 }} />
            </label>
          </div>
          <button type="submit" className="h-11 rounded-xl px-4 text-[13px] font-bold" style={SOLID}>
            أضف المود
          </button>
        </Saver>
      </details>

      <div className="flex flex-col gap-2">
        {moods.map((mood) => (
          <details key={mood.id} className="rounded-2xl border border-line bg-card p-4" style={mood.hidden ? { opacity: 0.6 } : undefined}>
            <summary className="flex cursor-pointer items-center justify-between gap-2">
              <span className="text-[13.5px] font-bold">
                {mood.emoji} {mood.name}
                {mood.hidden ? <span className="ms-2 text-[11px] text-muted">مخفي</span> : null}
              </span>
              <span className="text-[11.5px] text-muted">
                {mood._count.moments ? `${ar(mood._count.moments)} لحظة` : "لم يُستعمل"}
                {mood.mediaId ? " · بصورة" : " · بلا صورة"}
              </span>
            </summary>

            <div className="mt-3 flex flex-wrap items-start gap-3">
              <Preview emoji={mood.emoji} name={mood.name} color={mood.color} mediaId={mood.mediaId} />
              <div className="min-w-0 flex-1">
                <MoodImage id={mood.id} hasImage={Boolean(mood.mediaId)} />
              </div>
            </div>

            <Saver action={updateMood.bind(null, mood.id)} className="mt-3 flex flex-col gap-2">
              <div className="grid grid-cols-[64px_1fr_72px_64px] gap-2">
                <label className="text-[11.5px] text-muted">
                  إيموجي
                  <input name="emoji" required maxLength={16} defaultValue={mood.emoji} className={`mt-1 block w-full text-center ${FIELD}`} style={{ height: 40 }} />
                </label>
                <label className="text-[11.5px] text-muted">
                  الاسم
                  <input name="name" required maxLength={24} defaultValue={mood.name} className={`mt-1 block w-full ${FIELD}`} style={{ height: 40 }} />
                </label>
                <label className="text-[11.5px] text-muted">
                  اللون
                  <input name="color" type="color" defaultValue={mood.color} className="mt-1 block w-full rounded-xl border border-line" style={{ height: 40 }} />
                </label>
                <label className="text-[11.5px] text-muted">
                  الترتيب
                  <input name="sortOrder" inputMode="numeric" defaultValue={mood.sortOrder} className={`mt-1 block w-full text-center ${FIELD}`} style={{ height: 40 }} />
                </label>
              </div>
              <label className="flex items-center gap-2 text-[12.5px]">
                <input type="checkbox" name="hidden" defaultChecked={mood.hidden} />
                مخفي — لا يظهر في التطبيق، ولحظاتُه باقية
              </label>
              <button type="submit" className="h-10 rounded-xl border border-line text-[12.5px] font-semibold">
                احفظ المود
              </button>
            </Saver>
            <Saver action={deleteMood.bind(null, mood.id)} className="mt-2">
              <button type="submit" className="text-[12px] font-semibold" style={DANGER}>
                {mood._count.moments ? "أخفِ المود (مستعمَل)" : "احذف المود"}
              </button>
            </Saver>
          </details>
        ))}
      </div>
    </>
  );
}
