import { prisma } from "@/lib/db";
import {
  createInterest,
  createInterestGroup,
  deleteInterest,
  deleteInterestGroup,
  updateInterest,
  updateInterestGroup,
} from "@/app/actions";
import { ar } from "@/lib/format";
import { Saver } from "./saver";

const FIELD =
  "rounded-xl border border-line bg-card px-4 text-[13.5px] text-ink outline-none focus:border-clay";

const DANGER = { color: "var(--color-live)" } as const;
const SOLID = { background: "var(--color-clay)", color: "var(--color-on-brand)" } as const;

/**
 * قسمُ الاهتمامات في اللوحة (القاعدة ٣٧٥): تصنيفاتٌ بإيموجي واسم وترتيب، وفي كلٍّ
 * بنودُه. تُضاف وتُعدَّل وتُحذف، ويقرؤها الخادمُ كلَّ دقيقة — فتصل إلى شاشة الاختيار
 * وملفّ الصديق بلا نشر نسخة.
 */
export async function InterestsSection() {
  const groups = await prisma.interestGroup.findMany({
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    include: { items: { orderBy: [{ sortOrder: "asc" }, { label: "asc" }] } },
  });
  const users = await prisma.$queryRaw<{ id: string; n: bigint }[]>`
    SELECT unnest(interests) AS id, count(*) AS n FROM "User" GROUP BY 1`;
  const usedBy = new Map(users.map((row) => [row.id, Number(row.n)]));

  return (
    <>
      <h2 className="mb-1 text-[15px] font-bold">الاهتمامات</h2>
      <p className="mb-3 text-[11.5px] leading-relaxed text-muted">
        يختار منها كلُّ مستخدمٍ من ٣ إلى ١٠ بعد الدخول، ويرى المشتركةَ مع صديقه في ملفّه. التعديلُ يصل
        إلى التطبيق خلال دقيقة. تغييرُ الاسم لا يمسّ من اختاره، وحذفُ اهتمامٍ يُسقطه من ملفّات أصحابه —
        والتصنيفُ بلا اهتماماتٍ لا يظهر في التطبيق.
      </p>

      <details className="mb-5 rounded-2xl border border-line bg-card p-4">
        <summary className="cursor-pointer text-[13.5px] font-bold">تصنيف جديد</summary>
        <Saver action={createInterestGroup} className="mt-3 flex flex-col gap-2">
          <div className="grid grid-cols-[88px_1fr] gap-2">
            <label className="text-[11.5px] text-muted">
              إيموجي
              <input name="emoji" required maxLength={16} placeholder="🎨" className={`mt-1 block w-full text-center ${FIELD}`} style={{ height: 42 }} />
            </label>
            <label className="text-[11.5px] text-muted">
              الاسم
              <input name="label" required maxLength={40} placeholder="الفن والإبداع" className={`mt-1 block w-full ${FIELD}`} style={{ height: 42 }} />
            </label>
          </div>
          <button type="submit" className="h-11 rounded-xl px-4 text-[13px] font-bold" style={SOLID}>
            أضف التصنيف
          </button>
        </Saver>
      </details>

      <div className="mb-7 flex flex-col gap-2">
        {groups.map((group) => (
          <details key={group.id} className="rounded-2xl border border-line bg-card p-4">
            <summary className="flex cursor-pointer items-center justify-between gap-2">
              <span className="text-[13.5px] font-bold">
                {group.emoji} {group.label}
              </span>
              <span className="text-[11.5px] text-muted">
                {group.items.length ? `${ar(group.items.length)} اهتمام` : "فارغ — لا يظهر"}
              </span>
            </summary>

            <Saver action={updateInterestGroup.bind(null, group.id)} className="mt-3 flex flex-col gap-2">
              <div className="grid grid-cols-[72px_1fr_72px] gap-2">
                <label className="text-[11.5px] text-muted">
                  إيموجي
                  <input name="emoji" required maxLength={16} defaultValue={group.emoji} className={`mt-1 block w-full text-center ${FIELD}`} style={{ height: 40 }} />
                </label>
                <label className="text-[11.5px] text-muted">
                  اسم التصنيف
                  <input name="label" required maxLength={40} defaultValue={group.label} className={`mt-1 block w-full ${FIELD}`} style={{ height: 40 }} />
                </label>
                <label className="text-[11.5px] text-muted">
                  الترتيب
                  <input name="sortOrder" inputMode="numeric" defaultValue={group.sortOrder} className={`mt-1 block w-full text-center ${FIELD}`} style={{ height: 40 }} />
                </label>
              </div>
              <button type="submit" className="h-10 rounded-xl border border-line text-[12.5px] font-semibold">
                احفظ التصنيف
              </button>
            </Saver>

            <div className="mt-4 flex flex-col gap-1.5">
              {group.items.map((item) => (
                <details key={item.id} className="rounded-xl border border-line px-3 py-2">
                  <summary className="flex cursor-pointer items-center justify-between gap-2 text-[13px]">
                    <span className="font-semibold">{item.label}</span>
                    <span className="text-[11px] text-muted">
                      {usedBy.get(item.id) ? `اختاره ${ar(usedBy.get(item.id)!)}` : "لم يختره أحد"}
                    </span>
                  </summary>
                  <Saver action={updateInterest.bind(null, item.id)} className="mt-2 flex flex-col gap-2">
                    <div className="grid grid-cols-[1fr_72px] gap-2">
                      <label className="text-[11.5px] text-muted">
                        الاسم
                        <input name="label" required maxLength={40} defaultValue={item.label} className={`mt-1 block w-full ${FIELD}`} style={{ height: 38 }} />
                      </label>
                      <label className="text-[11.5px] text-muted">
                        الترتيب
                        <input name="sortOrder" inputMode="numeric" defaultValue={item.sortOrder} className={`mt-1 block w-full text-center ${FIELD}`} style={{ height: 38 }} />
                      </label>
                    </div>
                    <label className="text-[11.5px] text-muted">
                      التصنيف
                      <select name="groupId" defaultValue={group.id} className={`mt-1 block w-full ${FIELD}`} style={{ height: 38 }}>
                        {groups.map((one) => (
                          <option key={one.id} value={one.id}>
                            {one.emoji} {one.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="submit" className="h-9 rounded-xl border border-line text-[12px] font-semibold">
                      احفظ
                    </button>
                  </Saver>
                  <Saver action={deleteInterest.bind(null, item.id)} className="mt-1">
                    <button type="submit" className="text-[12px] font-semibold" style={DANGER}>
                      احذف الاهتمام
                    </button>
                  </Saver>
                </details>
              ))}
            </div>

            <Saver action={createInterest.bind(null, group.id)} className="mt-3 flex gap-2">
              <input name="label" required maxLength={40} placeholder="اهتمام جديد في هذا التصنيف" className={`min-w-0 flex-1 ${FIELD}`} style={{ height: 40 }} />
              <button type="submit" className="h-10 shrink-0 rounded-xl px-4 text-[12.5px] font-bold" style={SOLID}>
                أضف
              </button>
            </Saver>

            <Saver action={deleteInterestGroup.bind(null, group.id)} className="mt-3">
              <button type="submit" className="text-[12px] font-semibold" style={DANGER}>
                احذف التصنيف واهتماماته
              </button>
            </Saver>
          </details>
        ))}
      </div>
    </>
  );
}
