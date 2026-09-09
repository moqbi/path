import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createStoreItem, deleteStoreItem } from "@/app/actions";
import { ScreenHeader } from "@/components/ui";
import { riyals, ar } from "@/lib/format";

export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  // الدور يُفحص هنا وفي كل إجراء — إخفاء الرابط ليس حماية.
  if (user.role !== "ADMIN") redirect("/");

  const [items, users] = await Promise.all([
    prisma.storeItem.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { purchases: true } } },
    }),
    prisma.user.count(),
  ]);

  return (
    <div className="screen">
      <ScreenHeader title="لوحة التحكم" back="/me" />

      <main className="scroll-area px-5 py-5">
        <div className="mb-6 grid grid-cols-3 gap-2.5">
          {[
            { value: users, label: "مستخدم" },
            { value: items.length, label: "صنف" },
            { value: items.reduce((sum, i) => sum + i._count.purchases, 0), label: "عملية شراء" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-line bg-card px-2 py-3.5 text-center"
            >
              <p className="text-[24px] font-bold">{ar(stat.value)}</p>
              <p className="text-[11px] text-muted">{stat.label}</p>
            </div>
          ))}
        </div>

        <h2 className="mb-3 text-[15px] font-bold">أضف صنفاً للمتجر</h2>
        <form action={createStoreItem} className="mb-7 flex flex-col gap-2.5">
          <div className="flex gap-2.5">
            <select
              name="kind"
              className="grow rounded-xl border border-line bg-card px-3 text-[13.5px] text-ink outline-none"
              style={{ height: 48 }}
            >
              <option value="FRAME">إطار</option>
              <option value="BACKGROUND">خلفية</option>
            </select>
            <input
              name="name"
              required
              maxLength={40}
              placeholder="الاسم"
              className="grow rounded-xl border border-line bg-card px-4 text-[13.5px] text-ink outline-none focus:border-clay"
              style={{ height: 48 }}
            />
          </div>

          <div className="flex gap-2.5">
            <input
              name="priceRiyals"
              type="number"
              min={0}
              step="1"
              defaultValue={15}
              placeholder="السعر بالريال"
              className="grow rounded-xl border border-line bg-card px-4 text-[13.5px] text-ink outline-none focus:border-clay"
              style={{ height: 48 }}
            />
            <input
              name="earnedAfterDays"
              type="number"
              min={0}
              max={3650}
              placeholder="يُكتسب بعد (يوم)"
              className="grow rounded-xl border border-line bg-card px-4 text-[13px] text-ink outline-none focus:border-clay"
              style={{ height: 48 }}
            />
          </div>

          <input
            name="spec"
            required
            dir="ltr"
            defaultValue="linear-gradient(135deg,#f6b93b,#ff7a5a)"
            placeholder="تدرّج CSS"
            className="rounded-xl border border-line bg-card px-4 text-[12.5px] text-ink outline-none focus:border-clay"
            style={{ height: 48 }}
          />

          <label className="flex items-center gap-2.5 px-1 text-[13px]">
            <input name="plusOnly" type="checkbox" className="h-4 w-4 accent-[#f6b93b]" />
            حصري لمشتركي أثر+
          </label>

          <button
            type="submit"
            className="brand-gradient rounded-xl text-[14.5px] font-bold"
            style={{ height: 50, color: "var(--color-on-brand)" }}
          >
            أضف الصنف
          </button>
        </form>

        <h2 className="mb-3 text-[15px] font-bold">الأصناف الحالية</h2>
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3"
            >
              <span
                className="h-11 w-11 shrink-0 rounded-full"
                style={{ background: item.spec }}
              />
              <div className="grow">
                <p className="text-[13.5px] font-semibold">
                  {item.name}
                  <span className="mr-2 text-[11px] font-normal text-muted">
                    {item.kind === "FRAME" ? "إطار" : "خلفية"}
                  </span>
                </p>
                <p className="text-[11.5px] text-muted">
                  {item.earnedAfterDays
                    ? `يُكتسب بعد ${ar(item.earnedAfterDays)} يوم`
                    : riyals(item.priceHalalas)}
                  {item.plusOnly ? " · أثر+" : null}
                  {item._count.purchases > 0
                    ? ` · ${ar(item._count.purchases)} شراء`
                    : null}
                </p>
              </div>
              <form action={deleteStoreItem.bind(null, item.id)}>
                <button
                  type="submit"
                  className="h-10 rounded-xl border border-line px-3 text-[12px] font-semibold"
                  style={{ color: "var(--color-live)" }}
                >
                  حذف
                </button>
              </form>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
