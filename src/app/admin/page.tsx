import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createCategory,
  createStoreItem,
  createTag,
  deleteCategory,
  updateCategory,
  deleteStoreItem,
  deleteTag,
  setUserTag,
  updateStoreItem,
  updateTag,
} from "@/app/actions";
import { itemPaint, ScreenHeader, TagPill } from "@/components/ui";
import { Saver } from "./saver";
import { ItemImage } from "./item-image";
import { riyals, ar } from "@/lib/format";

const FIELD =
  "rounded-xl border border-line bg-card px-4 text-[13.5px] text-ink outline-none focus:border-clay";

/** حقل لون: منتقي النظام ومعه القيمة نصاً، فتُنسخ وتُلصق كما هي. */
function Color({ name, label, value }: { name: string; label: string; value: string }) {
  return (
    <label className="flex grow items-center gap-2 rounded-xl border border-line bg-card px-3" style={{ height: 48 }}>
      <span className="shrink-0 text-[12px] text-muted">{label}</span>
      <input
        type="color"
        name={name}
        defaultValue={value}
        className="h-7 w-9 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
      />
      <span dir="ltr" className="min-w-0 grow truncate text-[11px] text-faint">
        {value}
      </span>
    </label>
  );
}


const SELECT =
  "w-full rounded-xl border border-line bg-card px-3 text-[13.5px] text-ink outline-none focus:border-clay";

const KINDS = [
  { value: "FRAME", label: "إطار" },
  { value: "THEME", label: "ثيم" },
  { value: "CHARM", label: "تميمة" },
  { value: "BACKGROUND", label: "خلفية" },
] as const;

const KIND_LABEL: Record<string, string> = {
  FRAME: "إطار",
  THEME: "ثيم",
  CHARM: "تميمة",
  BACKGROUND: "خلفية",
};

const STORE_VIEWS = [
  { key: "items", label: "الأصناف" },
  { key: "cats", label: "التصنيفات" },
] as const;

/** حقلٌ باسمه: الصفّ العاري من الحقول لا يقول ما يُكتب فيه. */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-0 grow flex-col gap-1">
      <span className="px-1 text-[11.5px] font-semibold text-muted">{label}</span>
      {children}
      {hint ? <span className="px-1 text-[10.5px] text-faint">{hint}</span> : null}
    </label>
  );
}

function Check({ name, label, on }: { name: string; label: string; on?: boolean }) {
  return (
    <label className="flex items-center gap-2.5 px-1 text-[12.5px]">
      <input
        name={name}
        type="checkbox"
        defaultChecked={on}
        className="h-4 w-4 accent-[#f6b93b]"
      />
      {label}
    </label>
  );
}

/** شارة صغيرة تصف الصنف بكلمة: نوعه، أو حصريّته، أو محدوديّته. */
function Chip({
  children,
  gold = false,
  live = false,
}: {
  children: React.ReactNode;
  gold?: boolean;
  live?: boolean;
}) {
  return (
    <span
      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{
        background: gold
          ? "var(--color-gold-soft)"
          : live
            ? "var(--color-live-soft)"
            : "var(--color-chip)",
        color: gold
          ? "var(--color-gold-ink)"
          : live
            ? "var(--color-live)"
            : "var(--color-muted)",
      }}
    >
      {children}
    </span>
  );
}

const SECTIONS = [
  { key: "tags", label: "الوسوم" },
  { key: "users", label: "الحسابات" },
  { key: "store", label: "المتجر" },
] as const;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string; v?: string }>;
}) {
  const { s: raw, v } = await searchParams;
  const section = SECTIONS.some((item) => item.key === raw) ? raw! : "tags";
  const view = v === "cats" ? "cats" : "items";
  const user = await currentUser();
  if (!user) redirect("/login");
  // الدور يُفحص هنا وفي كل إجراء — إخفاء الرابط ليس حماية.
  if (user.role !== "ADMIN") redirect("/");

  const [items, tags, people, categories] = await Promise.all([
    prisma.storeItem.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        _count: { select: { purchases: true } },
        media: { select: { mime: true } },
      },
    }),
    prisma.tag.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { users: true } } },
    }),
    prisma.user.findMany({
      orderBy: { memberNo: "asc" },
      select: {
        id: true,
        memberNo: true,
        name: true,
        email: true,
        isPlus: true,
        role: true,
        tag: { select: { name: true, bg: true, fg: true } },
        tagId: true,
      },
    }),
    prisma.storeCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { items: true } } },
    }),
  ]);

  // الأصناف مرصوفة تحت تصنيفاتها كما تُرى في المتجر، وما بلا تصنيف في آخرها.
  const groups = [
    ...categories.map((category) => ({
      id: category.id,
      name: category.name,
      items: items.filter((item) => item.categoryId === category.id),
    })),
    { id: "none", name: "بلا تصنيف", items: items.filter((item) => !item.categoryId) },
  ].filter((group) => group.id !== "none" || group.items.length > 0);

  return (
    <div className="screen">
      <ScreenHeader title="لوحة التحكم" back="/me" />

      <main className="scroll-area px-5 py-5">
        <div className="mb-6 grid grid-cols-4 gap-2">
          {[
            { value: people.length, label: "مستخدم" },
            { value: items.length, label: "صنف" },
            { value: tags.length, label: "وسم" },
            { value: items.reduce((sum, i) => sum + i._count.purchases, 0), label: "شراء" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-line bg-card px-1 py-3.5 text-center"
            >
              <p className="text-[22px] font-bold">{ar(stat.value)}</p>
              <p className="text-[10.5px] text-muted">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* أقسام بدل جدارٍ واحد: قسمٌ في الشاشة لا ثلاثة فوق بعضها. */}
        <div className="no-bar mb-5 flex gap-2 overflow-x-auto">
          {SECTIONS.map((item) => {
            const on = section === item.key;
            return (
              <Link
                key={item.key}
                href={`/admin?s=${item.key}`}
                className="shrink-0 rounded-full px-4 py-2 text-[12.5px] font-semibold"
                style={{
                  background: on ? "var(--color-clay)" : "var(--color-card)",
                  color: on ? "var(--color-on-brand)" : "var(--color-ink-2)",
                  border: `1px solid ${on ? "var(--color-clay)" : "var(--color-line)"}`,
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {section === "tags" ? (
        <>
        <h2 className="mb-1 text-[15px] font-bold">الوسوم</h2>
        <p className="mb-3 text-[11.5px] leading-relaxed text-muted">
          الوسم كلمة تظهر بجانب الاسم بلونين تختارهما. وسمٌ واحد يمكن أن يُمنح
          تلقائياً لكل مشترك في أثر+ — يُقرأ من الاشتراك ولا يُكتب على الحساب،
          فينتهي بانتهائه.
        </p>

        <Saver action={createTag} className="mb-4 flex flex-col gap-2.5">
          <div className="flex gap-2.5">
            <input
              name="name"
              required
              maxLength={20}
              placeholder="اسم الوسم (داعم، مؤسّس…)"
              className={`grow ${FIELD}`}
              style={{ height: 48 }}
            />
          </div>
          <div className="flex gap-2.5">
            <Color name="bg" label="خلفية" value="#f6b93b" />
            <Color name="fg" label="نص" value="#3b2a05" />
          </div>
          <label className="flex items-center gap-2.5 px-1 text-[13px]">
            <input name="autoForPlus" type="checkbox" className="h-4 w-4 accent-[#f6b93b]" />
            يُمنح تلقائياً لمشتركي أثر+
          </label>
          <button
            type="submit"
            className="brand-gradient rounded-xl text-[14px] font-bold"
            style={{ height: 48, color: "var(--color-on-brand)" }}
          >
            أضف الوسم
          </button>
        </Saver>

        <div className="mb-7 flex flex-col gap-2">
          {tags.length === 0 ? (
            <p className="rounded-2xl border border-line bg-card px-4 py-5 text-center text-[12.5px] text-muted">
              لا وسوم بعد.
            </p>
          ) : null}
          {tags.map((tag) => (
            <details key={tag.id} className="rounded-2xl border border-line bg-card">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-3">
                <TagPill tag={tag} size={12} />
                <span className="grow text-[11.5px] text-muted">
                  {tag.autoForPlus ? "تلقائي لمشتركي أثر+ · " : null}
                  {ar(tag._count.users)} حساب
                </span>
                <span className="text-[12px] font-semibold text-clay-ink">تعديل</span>
              </summary>

              <Saver
                action={updateTag.bind(null, tag.id)}
                className="flex flex-col gap-2.5 border-t border-line p-3"
              >
                <input
                  name="name"
                  required
                  maxLength={20}
                  defaultValue={tag.name}
                  className={FIELD}
                  style={{ height: 46 }}
                />
                <div className="flex gap-2.5">
                  <Color name="bg" label="خلفية" value={tag.bg} />
                  <Color name="fg" label="نص" value={tag.fg} />
                </div>
                <label className="flex items-center gap-2.5 px-1 text-[13px]">
                  <input
                    name="autoForPlus"
                    type="checkbox"
                    defaultChecked={tag.autoForPlus}
                    className="h-4 w-4 accent-[#f6b93b]"
                  />
                  يُمنح تلقائياً لمشتركي أثر+
                </label>
                <div className="flex gap-2.5">
                  <button
                    type="submit"
                    className="grow rounded-xl text-[13.5px] font-bold"
                    style={{ height: 46, background: "var(--color-clay)", color: "var(--color-on-brand)" }}
                  >
                    احفظ
                  </button>
                </div>
              </Saver>

              <form action={deleteTag.bind(null, tag.id)} className="px-3 pb-3">
                <button
                  type="submit"
                  className="w-full rounded-xl border border-line text-[12.5px] font-semibold"
                  style={{ height: 42, color: "var(--color-live)" }}
                >
                  احذف الوسم
                </button>
              </form>
            </details>
          ))}
        </div>

        </>
        ) : null}

        {section === "users" ? (
        <>
        <h2 className="mb-1 text-[15px] font-bold">الحسابات</h2>
        <p className="mb-3 text-[11.5px] leading-relaxed text-muted">
          امنح وسماً لحساب أو انزعه. الرقم على اليمين رقم العضوية.
        </p>
        <div className="mb-7 flex flex-col gap-2">
          {people.map((person) => (
            <form
              key={person.id}
              action={setUserTag.bind(null, person.id)}
              className="flex items-center gap-2 rounded-2xl border border-line bg-card p-3"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                style={{ background: "var(--color-chip)", color: "var(--color-muted)" }}
              >
                {ar(person.memberNo)}
              </span>
              <div className="min-w-0 grow">
                <p className="flex items-center gap-1.5 truncate text-[13.5px] font-semibold">
                  {person.name}
                  <TagPill tag={person.tag} size={10} />
                </p>
                <p dir="ltr" className="truncate text-right text-[11px] text-faint">
                  {person.email}
                </p>
              </div>
              <select
                name="tagId"
                defaultValue={person.tagId ?? ""}
                className="h-10 max-w-[110px] shrink-0 rounded-xl border border-line bg-paper px-2 text-[12px] text-ink outline-none"
              >
                <option value="">بلا وسم</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="h-10 shrink-0 rounded-xl px-3 text-[12px] font-bold"
                style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
              >
                امنح
              </button>
            </form>
          ))}
        </div>

        </>
        ) : null}

        {section === "store" ? (
        <>
        {/* المتجر بابان: الأصناف والتصنيفات — لا جدارٌ واحد يُمرَّر طويلاً. */}
        <div className="mb-4 flex gap-2">
          {STORE_VIEWS.map((tab) => {
            const on = view === tab.key;
            return (
              <Link
                key={tab.key}
                href={tab.key === "items" ? "/admin?s=store" : `/admin?s=store&v=${tab.key}`}
                className="grow rounded-xl py-2.5 text-center text-[12.5px] font-semibold"
                style={{
                  background: on ? "var(--color-night)" : "var(--color-card)",
                  color: on ? "#f7f5ef" : "var(--color-ink-2)",
                  border: `1px solid ${on ? "var(--color-night)" : "var(--color-line)"}`,
                }}
              >
                {tab.label}
                <span className="mr-1.5 text-[11px] opacity-70">
                  {ar(tab.key === "items" ? items.length : categories.length)}
                </span>
              </Link>
            );
          })}
        </div>

        {view === "items" ? (
          <>
            <details className="mb-4 rounded-2xl border border-line bg-card">
              <summary className="flex cursor-pointer list-none items-center justify-between p-3.5">
                <span className="text-[13.5px] font-bold">أضف صنفاً</span>
                <span className="text-[12px] font-semibold text-clay-ink">افتح</span>
              </summary>

              <Saver action={createStoreItem} className="flex flex-col gap-3 border-t border-line p-3.5">
                <Field label="النوع">
                  <select name="kind" className={SELECT} style={{ height: 46 }}>
                    {KINDS.map((kind) => (
                      <option key={kind.value} value={kind.value}>
                        {kind.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="الاسم">
                  <input
                    name="name"
                    required
                    maxLength={40}
                    placeholder="كهرمان"
                    className={FIELD}
                    style={{ height: 46 }}
                  />
                </Field>

                <div className="flex gap-2.5">
                  <Field label="السعر (ر.س)">
                    <input
                      name="priceRiyals"
                      type="number"
                      min={0}
                      step="1"
                      defaultValue={15}
                      className={FIELD}
                      style={{ height: 46 }}
                    />
                  </Field>
                  <Field label="يُكتسب بعد (يوم)" hint="اتركه فارغاً إن كان يُشترى">
                    <input
                      name="earnedAfterDays"
                      type="number"
                      min={0}
                      max={3650}
                      className={FIELD}
                      style={{ height: 46 }}
                    />
                  </Field>
                </div>

                <Field label="التصنيف">
                  <select name="categoryId" defaultValue="" className={SELECT} style={{ height: 46 }}>
                    <option value="">بلا تصنيف</option>
                    {categories.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="تدرّج CSS" hint="يُرسم إن لم تُرفع صورة — الصورة تُضاف بعد الحفظ">
                  <input
                    name="spec"
                    required
                    dir="ltr"
                    defaultValue="linear-gradient(135deg,#f6b93b,#ff7a5a)"
                    className={FIELD}
                    style={{ height: 46 }}
                  />
                </Field>

                <div className="flex flex-col gap-2">
                  <Check name="plusOnly" label="حصري لمشتركي أثر+" />
                  <Check name="limited" label="حزمة محدودة — تظهر في صفّ «حزم محدودة»" />
                </div>

                <button
                  type="submit"
                  className="brand-gradient rounded-xl text-[14px] font-bold"
                  style={{ height: 48, color: "var(--color-on-brand)" }}
                >
                  أضف الصنف
                </button>
              </Saver>
            </details>

            {/* الأصناف مرصوفة تحت تصنيفاتها كما تُرى في المتجر. */}
            {groups.map((group) => (
              <section key={group.id} className="mb-5">
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <h2 className="text-[13.5px] font-bold">{group.name}</h2>
                  <span className="text-[11px] text-muted">{ar(group.items.length)} صنف</span>
                </div>

                {group.items.length === 0 ? (
                  <p className="rounded-2xl border border-line bg-card px-4 py-5 text-center text-[12px] text-muted">
                    لا أصناف في هذا التصنيف.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {group.items.map((item) => (
                      <details key={item.id} className="rounded-2xl border border-line bg-card">
                        <summary className="flex cursor-pointer list-none items-center gap-3 p-3">
                          <span className="h-11 w-11 shrink-0 rounded-full" style={itemPaint(item)} />
                          <div className="min-w-0 grow">
                            <p className="flex items-center gap-1.5 truncate text-[13.5px] font-semibold">
                              {item.name}
                              <Chip>{KIND_LABEL[item.kind]}</Chip>
                              {item.plusOnly ? <Chip gold>أثر+</Chip> : null}
                              {item.limited ? <Chip live>محدودة</Chip> : null}
                            </p>
                            <p className="truncate text-[11.5px] text-muted">
                              {item.earnedAfterDays
                                ? `يُكتسب بعد ${ar(item.earnedAfterDays)} يوم`
                                : riyals(item.priceHalalas)}
                              {item.mediaId ? " · بصورة" : ""}
                              {item._count.purchases > 0
                                ? ` · ${ar(item._count.purchases)} شراء`
                                : ""}
                            </p>
                          </div>
                          <span className="shrink-0 text-[12px] font-semibold text-clay-ink">تعديل</span>
                        </summary>

                        <div className="border-t border-line p-3.5">
                          <p className="mb-2 text-[12px] font-semibold text-muted">الصورة</p>
                          <ItemImage
                            itemId={item.id}
                            mediaId={item.mediaId}
                            kind={item.kind}
                            mime={item.media?.mime ?? null}
                          />
                          <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                            الثيم يُلبَس خلفيةً للتطبيق، والتميمة شعاراً تحت صورة العرض.
                            بلا صورة يُرسم التدرّج.
                          </p>
                        </div>

                        <Saver
                          action={updateStoreItem.bind(null, item.id)}
                          className="flex flex-col gap-3 border-t border-line p-3.5"
                        >
                          <div className="flex gap-2.5">
                            <Field label="النوع">
                              <select
                                name="kind"
                                defaultValue={item.kind}
                                className={SELECT}
                                style={{ height: 46 }}
                              >
                                {KINDS.map((kind) => (
                                  <option key={kind.value} value={kind.value}>
                                    {kind.label}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Field label="الاسم">
                              <input
                                name="name"
                                required
                                maxLength={40}
                                defaultValue={item.name}
                                className={FIELD}
                                style={{ height: 46 }}
                              />
                            </Field>
                          </div>

                          <div className="flex gap-2.5">
                            <Field label="السعر (ر.س)">
                              <input
                                name="priceRiyals"
                                type="number"
                                min={0}
                                step="1"
                                defaultValue={item.priceHalalas / 100}
                                className={FIELD}
                                style={{ height: 46 }}
                              />
                            </Field>
                            <Field label="يُكتسب بعد (يوم)">
                              <input
                                name="earnedAfterDays"
                                type="number"
                                min={0}
                                max={3650}
                                defaultValue={item.earnedAfterDays ?? undefined}
                                className={FIELD}
                                style={{ height: 46 }}
                              />
                            </Field>
                          </div>

                          <div className="flex gap-2.5">
                            <Field label="التصنيف">
                              <select
                                name="categoryId"
                                defaultValue={item.categoryId ?? ""}
                                className={SELECT}
                                style={{ height: 46 }}
                              >
                                <option value="">بلا تصنيف</option>
                                {categories.map((row) => (
                                  <option key={row.id} value={row.id}>
                                    {row.name}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Field label="الترتيب">
                              <input
                                name="sortOrder"
                                type="number"
                                min={0}
                                max={9999}
                                defaultValue={item.sortOrder}
                                className={FIELD}
                                style={{ height: 46, width: 88 }}
                              />
                            </Field>
                          </div>

                          <Field label="تدرّج CSS">
                            <input
                              name="spec"
                              required
                              dir="ltr"
                              defaultValue={item.spec}
                              className={FIELD}
                              style={{ height: 46 }}
                            />
                          </Field>

                          <div className="flex flex-col gap-2">
                            <Check name="plusOnly" label="حصري لمشتركي أثر+" on={item.plusOnly} />
                            <Check name="limited" label="حزمة محدودة" on={item.limited} />
                          </div>

                          <button
                            type="submit"
                            className="rounded-xl text-[13.5px] font-bold"
                            style={{
                              height: 46,
                              background: "var(--color-clay)",
                              color: "var(--color-on-brand)",
                            }}
                          >
                            احفظ
                          </button>
                        </Saver>

                        <form action={deleteStoreItem.bind(null, item.id)} className="px-3.5 pb-3.5">
                          <button
                            type="submit"
                            className="w-full rounded-xl border border-line text-[12.5px] font-semibold"
                            style={{ height: 42, color: "var(--color-live)" }}
                          >
                            احذف الصنف
                          </button>
                        </form>
                      </details>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </>
        ) : (
          <>
            <p className="mb-3 px-1 text-[11.5px] leading-relaxed text-muted">
              التصنيف شريحةٌ في أعلى المتجر. «المميز» واجهةٌ ثابتة تُبنى من الأصناف
              نفسها، وما تضيفه هنا يجلس بعدها بالترتيب.
            </p>

            <details className="mb-4 rounded-2xl border border-line bg-card">
              <summary className="flex cursor-pointer list-none items-center justify-between p-3.5">
                <span className="text-[13.5px] font-bold">أضف تصنيفاً</span>
                <span className="text-[12px] font-semibold text-clay-ink">افتح</span>
              </summary>

              <Saver action={createCategory} className="flex flex-col gap-3 border-t border-line p-3.5">
                <Field label="الاسم">
                  <input
                    name="name"
                    required
                    maxLength={30}
                    placeholder="الإطارات"
                    className={FIELD}
                    style={{ height: 46 }}
                  />
                </Field>
                <Field label="المعرّف" hint="إنجليزي صغير — يظهر في رابط المتجر">
                  <input
                    name="slug"
                    required
                    dir="ltr"
                    maxLength={24}
                    placeholder="frames"
                    className={FIELD}
                    style={{ height: 46 }}
                  />
                </Field>
                <button
                  type="submit"
                  className="brand-gradient rounded-xl text-[14px] font-bold"
                  style={{ height: 48, color: "var(--color-on-brand)" }}
                >
                  أضف التصنيف
                </button>
              </Saver>
            </details>

            <div className="flex flex-col gap-2 pb-4">
              {categories.map((row) => (
                <details key={row.id} className="rounded-2xl border border-line bg-card">
                  <summary className="flex cursor-pointer list-none items-center gap-3 p-3">
                    <div className="min-w-0 grow">
                      <p className="flex items-center gap-1.5 truncate text-[13.5px] font-semibold">
                        {row.name}
                        <span dir="ltr" className="text-[11px] font-normal text-faint">
                          {row.slug}
                        </span>
                        {row.active ? null : <Chip>مخفي</Chip>}
                      </p>
                      <p className="text-[11.5px] text-muted">
                        {ar(row._count.items)} صنف · ترتيب {ar(row.sortOrder)}
                      </p>
                    </div>
                    <span className="shrink-0 text-[12px] font-semibold text-clay-ink">تعديل</span>
                  </summary>

                  <Saver
                    action={updateCategory.bind(null, row.id)}
                    className="flex flex-col gap-3 border-t border-line p-3.5"
                  >
                    <div className="flex gap-2.5">
                      <Field label="الاسم">
                        <input
                          name="name"
                          required
                          maxLength={30}
                          defaultValue={row.name}
                          className={FIELD}
                          style={{ height: 46 }}
                        />
                      </Field>
                      <Field label="المعرّف">
                        <input
                          name="slug"
                          required
                          dir="ltr"
                          maxLength={24}
                          defaultValue={row.slug}
                          className={FIELD}
                          style={{ height: 46 }}
                        />
                      </Field>
                      <Field label="الترتيب">
                        <input
                          name="sortOrder"
                          type="number"
                          min={0}
                          max={999}
                          defaultValue={row.sortOrder}
                          className={FIELD}
                          style={{ height: 46, width: 82 }}
                        />
                      </Field>
                    </div>

                    <Check name="active" label="ظاهر في المتجر" on={row.active} />

                    <button
                      type="submit"
                      className="rounded-xl text-[13.5px] font-bold"
                      style={{
                        height: 46,
                        background: "var(--color-clay)",
                        color: "var(--color-on-brand)",
                      }}
                    >
                      احفظ
                    </button>
                  </Saver>

                  <form action={deleteCategory.bind(null, row.id)} className="px-3.5 pb-3.5">
                    <button
                      type="submit"
                      className="w-full rounded-xl border border-line text-[12.5px] font-semibold"
                      style={{ height: 42, color: "var(--color-live)" }}
                    >
                      احذف التصنيف — تبقى أصنافه بلا تصنيف
                    </button>
                  </form>
                </details>
              ))}
            </div>
          </>
        )}
        </>
        ) : null}
      </main>
    </div>
  );
}
