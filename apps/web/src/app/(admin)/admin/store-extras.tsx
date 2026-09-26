import { prisma } from "@/lib/db";
import {
  addItemPlan,
  createCollection,
  deleteCollection,
  dropItemPlan,
  setItemCollection,
} from "@/app/actions";
import { ar, coinText } from "@/lib/format";

const INPUT =
  "block w-full rounded-xl border border-line bg-card px-3 text-[13px] text-ink outline-none";

const KIND_NAME: Record<string, string> = { CHARM: "التمائم", FRAME: "الإطارات", THEME: "الثيمات" };

/** «يوم»، «يومان»، «٥ أيام»، «شهر» — كما يقرؤها المشتري. */
export function daysLabel(days: number): string {
  if (days === 1) return "يوم";
  if (days === 2) return "يومان";
  if (days === 7) return "أسبوع";
  if (days === 30) return "شهر";
  if (days === 90) return "٣ أشهر";
  if (days === 365) return "سنة";
  return days <= 10 ? `${ar(days)} أيام` : `${ar(days)} يوماً`;
}

/** مجموعةُ الصنف داخل نوعه — قائمةٌ بمجموعات نوعه وحده. */
export async function ItemCollection({
  itemId,
  kind,
  collectionId,
}: {
  itemId: string;
  kind: string;
  collectionId: string | null;
}) {
  const normalized = kind === "BACKGROUND" ? "THEME" : kind;
  if (!KIND_NAME[normalized]) return null;
  const collections = await prisma.storeCollection.findMany({
    where: { kind: normalized as "CHARM" | "FRAME" | "THEME" },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true },
  });

  return (
    <form action={setItemCollection.bind(null, itemId)} className="mt-3 flex items-end gap-2">
      <label className="grow text-[11.5px] text-muted">
        المجموعة
        <select name="collectionId" defaultValue={collectionId ?? ""} className={`${INPUT} mt-1`} style={{ height: 40 }}>
          <option value="">بلا مجموعة ({KIND_NAME[normalized]} الأخرى)</option>
          {collections.map((one) => (
            <option key={one.id} value={one.id}>
              {one.name}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="rounded-xl border border-line px-3 text-[12px] font-semibold text-ink-2" style={{ height: 40 }}>
        احفظ
      </button>
    </form>
  );
}

/** مُدَدُ الصنف وأسعارُها — وبلا مُددٍ يُشترى مرّةً ويبقى بسعره. */
export async function ItemPlans({ itemId }: { itemId: string }) {
  const plans = await prisma.storeItemPlan.findMany({ where: { itemId }, orderBy: { days: "asc" } });

  return (
    <div className="mt-3 rounded-xl border border-line p-3">
      <p className="text-[12px] font-semibold text-ink-2">مُدَد الشراء</p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
        بمُددٍ يُشترى لمدّةٍ ويُنزع بعدها ويُشترى ثانيةً — وسعرُ الصنف أعلاه لا يُستعمل. بلا مُددٍ
        يُشترى مرّةً ويبقى.
      </p>
      {plans.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1.5">
          {plans.map((plan) => (
            <li key={plan.id} className="flex items-center justify-between rounded-lg bg-paper px-3 py-2 text-[12.5px]">
              <span>
                {daysLabel(plan.days)} · {coinText(plan.priceCoins)}
              </span>
              <form action={dropItemPlan.bind(null, plan.id)}>
                <button type="submit" className="text-[12px] font-semibold" style={{ color: "var(--color-live)" }}>
                  احذف
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : null}
      <form action={addItemPlan.bind(null, itemId)} className="mt-2 flex items-end gap-2">
        <label className="grow text-[11px] text-muted">
          المدّة (يوم)
          <input name="days" type="number" min={1} max={3650} required className={`${INPUT} mt-1`} style={{ height: 40 }} />
        </label>
        <label className="grow text-[11px] text-muted">
          السعر (نقاط)
          <input name="priceCoins" type="number" min={1} required className={`${INPUT} mt-1`} style={{ height: 40 }} />
        </label>
        <button type="submit" className="rounded-xl px-3 text-[12px] font-bold" style={{ height: 40, background: "var(--color-clay)", color: "var(--color-on-brand)" }}>
          أضف
        </button>
      </form>
    </div>
  );
}

/** بابُ «المجموعات» في لوحة المتجر: تُضاف وتُحذف، وتُعرض بعدد أصنافها. */
export async function CollectionsView() {
  const collections = await prisma.storeCollection.findMany({
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, kind: true, sortOrder: true, _count: { select: { items: true } } },
  });

  return (
    <>
      <p className="mb-3 px-1 text-[11.5px] leading-relaxed text-muted">
        المجموعة تجمع أصنافاً من نوعٍ واحد تحت اسم — «مجموعة الورود» في التمائم. في المتجر تُعرض كلُّ
        مجموعةٍ قسماً، وما بلا مجموعةٍ تحت «التمائم الأخرى». والصنفُ يُضمّ إليها من صفحة تعديله.
      </p>
      <form action={createCollection} className="mb-4 flex flex-wrap items-end gap-2 rounded-2xl border border-line bg-card p-3">
        <label className="grow text-[11.5px] text-muted">
          الاسم
          <input name="name" required maxLength={40} className={`${INPUT} mt-1`} style={{ height: 42 }} />
        </label>
        <label className="text-[11.5px] text-muted">
          النوع
          <select name="kind" className={`${INPUT} mt-1`} style={{ height: 42 }}>
            <option value="CHARM">تمائم</option>
            <option value="FRAME">إطارات</option>
            <option value="THEME">ثيمات</option>
          </select>
        </label>
        <label className="w-20 text-[11.5px] text-muted">
          الترتيب
          <input name="sortOrder" type="number" defaultValue={0} className={`${INPUT} mt-1`} style={{ height: 42 }} />
        </label>
        <button type="submit" className="rounded-xl px-4 text-[12.5px] font-bold" style={{ height: 42, background: "var(--color-clay)", color: "var(--color-on-brand)" }}>
          أضف مجموعة
        </button>
      </form>
      <ul className="flex flex-col gap-2">
        {collections.map((one) => (
          <li key={one.id} className="flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3">
            <div>
              <p className="text-[13.5px] font-semibold">{one.name}</p>
              <p className="text-[11.5px] text-muted">
                {KIND_NAME[one.kind] ?? one.kind} · {ar(one._count.items)} أصناف · ترتيب {ar(one.sortOrder)}
              </p>
            </div>
            <form action={deleteCollection.bind(null, one.id)}>
              <button type="submit" className="text-[12px] font-semibold" style={{ color: "var(--color-live)" }}>
                احذف
              </button>
            </form>
          </li>
        ))}
        {collections.length === 0 ? <li className="px-1 text-[12px] text-muted">لا مجموعات بعد.</li> : null}
      </ul>
    </>
  );
}
