import { prisma } from "@/lib/db";
import {
  addItemPlan,
  createCollection,
  deleteCollection,
  updateCollection,
  dropItemPlan,
  setItemHideAt,
} from "@/app/actions";
import { ar, coinText, untilDay } from "@/lib/format";
import { Saver } from "./saver";

const INPUT =
  "block w-full rounded-xl border border-line bg-card px-3 text-[13px] text-ink outline-none";

const KIND_NAME: Record<string, string> = { CHARM: "التشارمز", FRAME: "الإطارات", THEME: "الثيمات" };

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
/** أقسامُ المجموعات بترتيب المتجر — والمختلطةُ آخرُها (`kind` فارغ). */
const SECTIONS = [
  { key: "CHARM", label: "مجموعات التشارمز" },
  { key: "FRAME", label: "مجموعات الإطارات" },
  { key: "THEME", label: "مجموعات الثيمات" },
  { key: "MIXED", label: "المجموعات المختلطة" },
] as const;

export async function CollectionsView() {
  const collections = await prisma.storeCollection.findMany({
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, kind: true, sortOrder: true, _count: { select: { items: true } } },
  });

  return (
    <>
      <p className="mb-3 px-1 text-[11.5px] leading-relaxed text-muted">
        المجموعة تجمع أصنافاً تحت اسم — «مجموعة الورود» في التشارمز. في المتجر تُعرض كلُّ مجموعةٍ قسماً،
        وما بلا مجموعةٍ تحت «التشارمز الأخرى». و«المختلطة» تجمع تشارم وإطاراً وثيماً معاً: تظهر قسماً في
        شريحة كلّ نوعٍ فيها بأصنافه. والصنفُ يُضمّ إليها من صفحة تعديله.
      </p>
      <form action={createCollection} className="mb-4 flex flex-wrap items-end gap-2 rounded-2xl border border-line bg-card p-3">
        <label className="grow text-[11.5px] text-muted">
          الاسم
          <input name="name" required maxLength={40} className={`${INPUT} mt-1`} style={{ height: 42 }} />
        </label>
        <label className="text-[11.5px] text-muted">
          النوع
          <select name="kind" className={`${INPUT} mt-1`} style={{ height: 42 }}>
            <option value="MIXED">مختلطة (تشارمز وإطارات وثيمات)</option>
            <option value="CHARM">تشارمز</option>
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
      {/*
        كلُّ نوعٍ قسمٌ وحده — **بقرار المالك**: مجموعاتُ التشارمز، ثمّ الإطارات، ثمّ
        الثيمات، ثمّ المختلطة. كانت قائمةً واحدة تتداخل فيها الأنواع فلا يُعرف أين ينتهي نوع.
      */}
      {collections.length === 0 ? <p className="px-1 text-[12px] text-muted">لا مجموعات بعد.</p> : null}
      {SECTIONS.map((section) => {
        const rows = collections.filter((one) => (one.kind ?? "MIXED") === section.key);
        if (rows.length === 0) return null;
        return (
          <section key={section.key} className="mb-5">
            <h3 className="mb-2 flex items-baseline gap-2 px-1 text-[13.5px] font-extrabold">
              {section.label}
              <span className="text-[11.5px] font-semibold text-muted">{ar(rows.length)}</span>
            </h3>
            <ul className="flex flex-col gap-2">
              {rows.map((one) => (
                <li key={one.id}>
                  {/* المجموعةُ تُعدَّل في مكانها — اسمُها ونوعُها وترتيبُها (بقرار المالك). */}
                  <details className="rounded-2xl border border-line bg-card">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-semibold">{one.name}</p>
                        <p className="text-[11.5px] text-muted">
                          {one.kind ? (KIND_NAME[one.kind] ?? one.kind) : "مختلطة"} · {ar(one._count.items)} أصناف · ترتيب {ar(one.sortOrder)}
                        </p>
                      </div>
                      <span className="shrink-0 text-[12px] font-semibold text-clay-ink">تعديل</span>
                    </summary>
                    <Saver action={updateCollection.bind(null, one.id)} className="flex flex-wrap items-end gap-2 border-t border-line p-3">
                      <label className="grow text-[11.5px] text-muted">
                        الاسم
                        <input name="name" required maxLength={40} defaultValue={one.name} className={`${INPUT} mt-1`} style={{ height: 42 }} />
                      </label>
                      <label className="text-[11.5px] text-muted">
                        النوع
                        <select name="kind" defaultValue={one.kind ?? "MIXED"} className={`${INPUT} mt-1`} style={{ height: 42 }}>
                          <option value="MIXED">مختلطة</option>
                          <option value="CHARM">تشارمز</option>
                          <option value="FRAME">إطارات</option>
                          <option value="THEME">ثيمات</option>
                        </select>
                      </label>
                      <label className="w-20 text-[11.5px] text-muted">
                        الترتيب
                        <input name="sortOrder" type="number" defaultValue={one.sortOrder} className={`${INPUT} mt-1`} style={{ height: 42 }} />
                      </label>
                      <button type="submit" className="rounded-xl px-4 text-[12.5px] font-bold" style={{ height: 42, background: "var(--color-clay)", color: "var(--color-on-brand)" }}>
                        احفظ
                      </button>
                    </Saver>
                    <form action={deleteCollection.bind(null, one.id)} className="px-3 pb-3">
                      <button type="submit" className="text-[12px] font-semibold" style={{ color: "var(--color-live)" }}>
                        احذف المجموعة — أصنافُها تبقى وتعود إلى «الأخرى»
                      </button>
                    </form>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

/** مدّاتُ العرض المعروضة — قائمةٌ مغلقة لا حقلُ أيام (كالقاعدة ١١٦). */
const SHOW_DAYS = [1, 2, 3, 5, 7, 10, 14, 30];

/**
 * مدّةُ عرض الصنف في المتجر — **بقرار المالك**، للحزمة الموسميّة وغيرها: بعدها
 * يُخفى ويُرى «مخفي» هنا، وما اشتُري منه يبقى لأصحابه.
 */
export async function ItemHideAt({ itemId }: { itemId: string }) {
  const item = await prisma.storeItem.findUnique({ where: { id: itemId }, select: { hideAt: true, hidden: true } });
  if (!item) return null;
  return (
    <div className="mt-3 rounded-xl border border-line p-3">
      <p className="text-[12px] font-semibold text-ink-2">مدّة العرض في المتجر</p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
        {item.hideAt
          ? `يُخفى من المتجر ${untilDay(item.hideAt)}، ثمّ يظهر هنا «مخفي». ومن اشتراه يبقى له.`
          : item.hidden
            ? "مخفيٌّ الآن. ارفعه أوّلاً ثمّ اضبط مدّته."
            : "بلا مدّة: يبقى في المتجر حتى تخفيه بيدك."}
      </p>
      <form action={setItemHideAt.bind(null, itemId)} className="mt-2 flex items-end gap-2">
        <label className="grow text-[11px] text-muted">
          يُخفى بعد
          <select name="days" defaultValue="" required className={`${INPUT} mt-1`} style={{ height: 40 }}>
            <option value="" disabled>
              اختر المدّة
            </option>
            {SHOW_DAYS.map((days) => (
              <option key={days} value={days}>
                {daysLabel(days)}
              </option>
            ))}
            {item.hideAt ? <option value="0">بلا مدّة — ألغِ الموعد</option> : null}
          </select>
        </label>
        <button type="submit" className="rounded-xl px-3 text-[12px] font-bold" style={{ height: 40, background: "var(--color-clay)", color: "var(--color-on-brand)" }}>
          احفظ
        </button>
      </form>
    </div>
  );
}
