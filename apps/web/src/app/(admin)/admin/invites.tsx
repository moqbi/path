import { prisma } from "@/lib/db";
import { saveInvites } from "@/app/actions";
import { ar, coinText } from "@/lib/format";
import { Saver } from "./saver";

const FIELD =
  "h-11 rounded-xl border border-line bg-card px-4 text-[13.5px] text-ink outline-none focus:border-clay";

/**
 * برنامجُ الدعوات في اللوحة (القاعدة ٢٤٣): تفعيلٌ وإيقاف ورقمان، وما جرى
 * حتى الآن — كم سجّل بدعوة، وكم نشر منهم، وكم أُعطي.
 */
export async function InvitesView() {
  const [program, invited, posted, paid] = await Promise.all([
    prisma.inviteProgram.findUnique({ where: { id: "main" } }),
    prisma.user.count({ where: { invitedById: { not: null } } }),
    prisma.user.count({
      where: {
        invitedById: { not: null },
        moments: { some: { kind: { in: ["PHOTO", "PLACE", "THOUGHT", "MUSIC", "SLEEP", "WAKE"] } } },
      },
    }),
    prisma.coinGrant.aggregate({ where: { invites: { not: null } }, _sum: { coins: true }, _count: true }),
  ]);
  const p = program ?? { enabled: false, every: 10, coins: 500, announcedAt: null };

  return (
    <div className="flex flex-col gap-4 pb-4">
      <p className="px-1 text-[11.5px] leading-relaxed text-muted">
        من دعا أصدقاءه ينال نقاطاً: كل «عدد» مدعوّين = «النقاط». المدعوّ يكتب رقم عضوية من دعاه
        عند التسجيل (أو خلال أسبوع من «أنا» ← المشاركة)، ويُعدّ حين ينشر أوّل لحظةٍ له — حسابٌ فارغ
        لا يُعدّ. التفعيل يُرسل تنبيهاً للجميع مرّةً، والإيقاف يوقف المكافآت الجديدة ولا يسحب ما أُعطي.
      </p>

      <Saver action={saveInvites} className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-3.5">
        <label className="flex items-center gap-2.5 px-1 text-[13.5px] font-bold">
          <input name="enabled" type="checkbox" defaultChecked={p.enabled} className="h-4 w-4 accent-[#f6b93b]" />
          البرنامج مفعّل
        </label>
        <div className="flex gap-2.5">
          <label className="flex min-w-0 grow flex-col gap-1">
            <span className="px-1 text-[11.5px] font-semibold text-muted">عدد المدعوّين</span>
            <input name="every" type="number" min={1} max={1000} defaultValue={p.every} className={FIELD} />
          </label>
          <label className="flex min-w-0 grow flex-col gap-1">
            <span className="px-1 text-[11.5px] font-semibold text-muted">النقاط لكل دفعة</span>
            <input name="coins" type="number" min={1} max={50000} defaultValue={p.coins} className={FIELD} />
          </label>
        </div>
        <button
          type="submit"
          className="brand-gradient rounded-xl text-[14px] font-bold"
          style={{ height: 48, color: "var(--color-on-brand)" }}
        >
          احفظ
        </button>
      </Saver>

      <div className="grid grid-cols-3 gap-2">
        {[
          ["سجّلوا بدعوة", ar(invited)],
          ["نشروا منهم", ar(posted)],
          ["أُعطي", `${coinText(paid._sum.coins ?? 0)} · ${ar(paid._count)} دفعة`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-line bg-card p-3 text-center">
            <div className="text-[15px] font-bold">{value}</div>
            <div className="text-[11px] text-muted">{label}</div>
          </div>
        ))}
      </div>
      {p.enabled && p.announcedAt ? (
        <p className="px-1 text-[11px] text-faint">أُعلن للجميع — {p.announcedAt.toLocaleString("ar-SA-u-ca-gregory")}</p>
      ) : null}
    </div>
  );
}
