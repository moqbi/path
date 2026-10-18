import { prisma } from "@/lib/db";
import { ALL_COUNTRIES, COUNTRIES } from "@athar/shared";
import { createNationalDay, deleteNationalDay, updateNationalDay } from "@/app/actions";
import { ar } from "@/lib/format";
import { Saver } from "./saver";

const FIELD =
  "rounded-xl border border-line bg-card px-4 text-[13.5px] text-ink outline-none focus:border-clay";

const GREGORIAN = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const HIJRI = ["محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"];

const countryName = (code: string) =>
  code === ALL_COUNTRIES ? "الجميع" : (COUNTRIES.find((row) => row.code === code)?.name ?? code);

/** حقولُ المناسبة — واحدةٌ للإضافة والتعديل. */
function Fields({
  value,
}: {
  value?: { name: string; greeting: string | null; country: string; calendar: string; month: number; day: number };
}) {
  return (
    <>
      <label className="text-[11.5px] text-muted">
        الاسم
        <input name="name" required maxLength={60} defaultValue={value?.name} placeholder="اليوم الوطني" className={`mt-1 block w-full ${FIELD}`} style={{ height: 42 }} />
      </label>
      <label className="text-[11.5px] text-muted">
        سطرُ التنبيه (اختياري — وبلاه «اليوم …»)
        <input name="greeting" maxLength={120} defaultValue={value?.greeting ?? ""} className={`mt-1 block w-full ${FIELD}`} style={{ height: 42 }} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11.5px] text-muted">
          الدولة
          <select name="country" defaultValue={value?.country ?? "SA"} className={`mt-1 block w-full ${FIELD}`} style={{ height: 42 }}>
            <option value={ALL_COUNTRIES}>الجميع</option>
            {COUNTRIES.map((row) => (
              <option key={row.code} value={row.code}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11.5px] text-muted">
          التقويم
          <select name="calendar" defaultValue={value?.calendar ?? "GREGORIAN"} className={`mt-1 block w-full ${FIELD}`} style={{ height: 42 }}>
            <option value="GREGORIAN">ميلادي</option>
            <option value="HIJRI">هجري (أم القرى)</option>
          </select>
        </label>
        <label className="text-[11.5px] text-muted">
          الشهر (١–١٢)
          <input name="month" type="number" min={1} max={12} required defaultValue={value?.month} className={`mt-1 block w-full ${FIELD}`} style={{ height: 42 }} />
        </label>
        <label className="text-[11.5px] text-muted">
          اليوم
          <input name="day" type="number" min={1} max={31} required defaultValue={value?.day} className={`mt-1 block w-full ${FIELD}`} style={{ height: 42 }} />
        </label>
      </div>
    </>
  );
}

/**
 * قسمُ المناسبات الوطنيّة في اللوحة (القاعدة ٢٩٢): تُضاف بيومها وشهرها وتقويمها
 * ودولتها، وتظهر في تقويم «أنا» لمن موقعُه في دولتها، وتنبيهُها خلف `NATIONAL_BELL`.
 */
export async function OccasionsSection() {
  const rows = await prisma.nationalDay.findMany({ orderBy: [{ country: "asc" }, { calendar: "asc" }, { month: "asc" }, { day: "asc" }] });

  return (
    <>
      <h2 className="mb-1 text-[15px] font-bold">المناسبات الوطنية</h2>
      <p className="mb-3 text-[11.5px] leading-relaxed text-muted">
        تظهر في التقويم داخل «أنا» لمن موقعُه الحاليّ في دولتها، و«الجميع» تظهر لكلّ أحد. والهجريُّ
        بتقويم أم القرى، فيُحسب يومُه الميلاديّ كلّ سنة وحده. وتنبيهُ يومها يُرسل الساعة التاسعة صباحاً
        حين يكون `NATIONAL_BELL` على الخادم `staff` (لك وللمشرفين) أو `all` (للجميع).
      </p>

      <details className="mb-5 rounded-2xl border border-line bg-card p-4">
        <summary className="cursor-pointer text-[13.5px] font-bold">مناسبة جديدة</summary>
        <Saver action={createNationalDay} className="mt-3 flex flex-col gap-2">
          <Fields />
          <button
            type="submit"
            className="h-11 rounded-xl px-4 text-[13px] font-bold"
            style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
          >
            أضف المناسبة
          </button>
        </Saver>
      </details>

      <div className="mb-7 flex flex-col gap-2">
        {rows.map((row) => (
          <details key={row.id} className="rounded-2xl border border-line bg-card p-4">
            <summary className="flex cursor-pointer items-center justify-between gap-2">
              <span className="text-[13.5px] font-bold">
                {row.name}
                {row.hidden ? <span className="text-[11.5px] font-normal text-muted"> · مخفية</span> : null}
              </span>
              <span className="text-[11.5px] text-muted">
                {ar(row.day)} {(row.calendar === "HIJRI" ? HIJRI : GREGORIAN)[row.month - 1]} · {countryName(row.country)}
              </span>
            </summary>
            <Saver action={updateNationalDay.bind(null, row.id)} className="mt-3 flex flex-col gap-2">
              <Fields value={row} />
              <label className="flex items-center gap-2 text-[12.5px]">
                <input type="checkbox" name="hidden" defaultChecked={row.hidden} /> مخفيّة
              </label>
              <button type="submit" className="h-10 rounded-xl border border-line text-[12.5px] font-semibold">
                احفظ
              </button>
            </Saver>
            <form action={deleteNationalDay.bind(null, row.id)} className="mt-2">
              <button type="submit" className="text-[12px] font-semibold" style={{ color: "var(--color-live)" }}>
                احذف المناسبة
              </button>
            </form>
          </details>
        ))}
      </div>
    </>
  );
}
