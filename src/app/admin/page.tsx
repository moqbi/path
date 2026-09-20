import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  closeTicket,
  createCategory,
  createStoreItem,
  createTag,
  deleteCategory,
  updateCategory,
  deleteStoreItem,
  deleteTag,
  replyTicket,
  setAdminScope,
  setUserTag,
  updateStoreItem,
  updateTag,
  moveMediaToCloud,
  storageState,
  testStorage,
} from "@/app/actions";
import { itemPaint, ScreenHeader, TagPill } from "@/components/ui";
import { Saver } from "./saver";
import { AdminEmail } from "./email";
import { Suspend } from "./suspend";
import { PlusGrant } from "./plus";
import { ItemImage } from "./item-image";
import { ItemCover } from "./item-cover";
import { coinText, ar, relative } from "@/lib/format";
import { parsePalette } from "@/lib/theme";

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

/** ألوان الثيم الافتراضية = ألوان التطبيق نفسها، فالمشرف يعدّل لا يبدأ من عدم. */
const PALETTE_FIELDS = [
  { key: "paper", label: "الأرضية", fallback: "#eae5d9" },
  { key: "card", label: "البطاقات", fallback: "#fdfcf8" },
  { key: "ink", label: "الحبر", fallback: "#14212b" },
  { key: "accent", label: "اللمسة", fallback: "#f6b93b" },
  { key: "onAccent", label: "فوق اللمسة", fallback: "#0e1a24" },
  { key: "chrome", label: "الشريطان", fallback: "#0e1a24" },
  { key: "chromeInk", label: "حبر الشريطين", fallback: "#f7f5ef" },
] as const;

/**
 * ألوان الثيم في اللوحة.
 *
 * الثيم ليس خلفيةً تتبدّل: من يشتريه يلبس التطبيقُ ألوانَه كلها. وسبعةُ
 * ألوانٍ تكفي — البقية تُشتقّ منها فلا يُسأل المشرف عن درجاتِ لونٍ واحد.
 */
function PaletteFields({ palette }: { palette: Record<string, string> | null }) {
  return (
    <details className="rounded-xl border border-line" open={!!palette}>
      <summary className="flex cursor-pointer list-none items-center justify-between p-3">
        <span className="text-[12.5px] font-semibold">ألوان الثيم</span>
        <span className="text-[11px] text-muted">
          {palette ? "مضبوطة" : "الافتراضية"}
        </span>
      </summary>
      <div className="flex flex-col gap-2 border-t border-line p-3">
        <Check
          name="hasPalette"
          label="هذا الثيم يغيّر ألوان التطبيق كلها"
          on={!!palette}
        />
        <div className="flex flex-wrap gap-2">
          {PALETTE_FIELDS.map((field) => (
            <Color
              key={field.key}
              name={`palette.${field.key}`}
              label={field.label}
              value={palette?.[field.key] ?? field.fallback}
            />
          ))}
        </div>
        <p className="text-[10.5px] leading-relaxed text-faint">
          بلا تفعيل يبقى الثيم خلفيةً فقط. وما عدا هذه السبعة يُشتقّ منها.
        </p>
      </div>
    </details>
  );
}

/**
 * شرطُ البحث في الحسابات.
 *
 * رقمُ العضوية أوّلاً وبالمطابقة التامّة: هو ما يُكتب في البلاغ ويُقال،
 * و«١٢» بالتضمين تجلب ١٢٠ و٣١٢ فيضيع المقصود بينهما. وما ليس رقماً
 * يُبحث به في الاسم والبريد.
 *
 * والأرقام العربية-الهندية تُحوَّل: من يقرأ رقمه «٤٢» في اللوحة ينسخه
 * كما رآه، ولو لم يُحوَّل لما طابق شيئاً.
 */
function search(q?: string) {
  const text = (q ?? "").trim();
  if (!text) return undefined;

  const latin = text.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  const number = Number(latin);
  if (Number.isInteger(number) && number > 0 && /^\d+$/.test(latin)) {
    return { memberNo: number };
  }

  // والمعرّف معهما: هو ما يُقال بين الناس حين لا يُحفظ الرقم.
  const handle = text.replace(/^@/, "").toLowerCase();

  return {
    OR: [
      { name: { contains: text, mode: "insensitive" as const } },
      { email: { contains: text, mode: "insensitive" as const } },
      { handle: { equals: handle } },
    ],
  };
}

const SECTIONS = [
  { key: "tags", label: "الوسوم", store: false },
  { key: "users", label: "الحسابات", store: false },
  { key: "store", label: "المتجر", store: true },
  { key: "team", label: "الصلاحيات", store: false, owner: true },
  { key: "files", label: "الملفات", store: false, owner: true },
  { key: "support", label: "الدعم", store: false },
] as const;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string; v?: string; q?: string }>;
}) {
  const { s: raw, v, q } = await searchParams;
  const view = v === "cats" ? "cats" : "items";
  const user = await currentUser();
  if (!user) redirect("/login");

  /*
    اللوحة ثلاث درجات: المالك (`ADMIN`)، وممنوحُ اللوحة كاملةً (`ALL`)،
    وممنوحُ المتجر وحده (`STORE`). الدرجة تُفحص هنا وفي كل إجراء —
    إخفاء القسم ليس حماية.
  */
  const owner = user.role === "ADMIN";
  const scope = owner ? "ALL" : user.adminScope;
  if (scope === "NONE") redirect("/");
  const sections = SECTIONS.filter(
    (item) => (scope === "ALL" || item.store) && (!("owner" in item && item.owner) || owner),
  );
  const section = sections.some((item) => item.key === raw) ? raw! : sections[0].key;

  const [items, tags, people, categories, tickets, userCount, staff] = await Promise.all([
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
    /*
      الحسابات: بحثٌ أوّلاً، لا قائمةٌ كاملة — عند ألفٍ من المستخدمين لا
      تُتصفَّح القائمة بالعين. بحثٌ برقم العضوية (وهو ما يُقال ويُكتب،
      القاعدة ١٥) أو بجزءٍ من الاسم أو البريد، وبلا بحثٍ أحدثُ خمسين.
    */
    prisma.user.findMany({
      where: search(q),
      orderBy: search(q) ? { memberNo: "asc" } : { memberNo: "desc" },
      take: 50,
      select: {
        id: true,
        memberNo: true,
        name: true,
        email: true,
        isPlus: true,
        plusUntil: true,
        role: true,
        adminScope: true,
        canModerate: true,
        suspendedUntil: true,
        suspendedReason: true,
        tag: { select: { name: true, bg: true, fg: true } },
        tagId: true,
      },
    }),
    prisma.storeCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { items: true } } },
    }),
    // المفتوحة أولاً: ما يحتاج ردّاً قبل ما رُدّ عليه.
    scope === "ALL"
      ? prisma.supportTicket.findMany({
          orderBy: [{ closed: "asc" }, { createdAt: "desc" }],
          take: 60,
          include: { user: { select: { name: true, memberNo: true } } },
        })
      : Promise.resolve([]),
    // عددُ المستخدمين كلّهم: قائمةُ الحسابات مقصوصةٌ بالبحث، وطولُها ليس عددَهم.
    prisma.user.count(),
    /*
      أصحابُ الصلاحيات: قسمُ «الصلاحيات» يُدير من مُنح لا من سُجّل، ولا
      يُقرأ من قائمة الحسابات — تلك مقصوصةٌ بخمسين، فمشرفٌ رقمُه ٣ يختفي
      من صفحته الخاصّة بمجرّد أن يُسجَّل بعده خمسون.
    */
    scope === "ALL"
      ? prisma.user.findMany({
          where: {
            OR: [{ role: "ADMIN" }, { adminScope: { not: "NONE" } }, { canModerate: true }],
          },
          orderBy: { memberNo: "asc" },
          select: {
            id: true, memberNo: true, name: true, email: true,
            role: true, adminScope: true, canModerate: true,
          },
        })
      : Promise.resolve([]),
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
            { value: userCount, label: "مستخدم" },
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
          {sections.map((item) => {
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
          تلقائياً لكل مشترك في آثار+ — يُقرأ من الاشتراك ولا يُكتب على الحساب،
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
            يُمنح تلقائياً لمشتركي آثار+
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
                  {tag.autoForPlus ? "تلقائي لمشتركي آثار+ · " : null}
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
                  يُمنح تلقائياً لمشتركي آثار+
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

        {/*
          البحث نموذج `GET` لا حقلٌ بجافاسكربت: نتيجتُه في العنوان، فتُحفظ
          وتُشارَك ويُرجَع إليها بزرّ الرجوع. و`s=users` مخفيٌّ معه وإلا
          عاد البحثُ إلى أوّل قسم.
        */}
        <form method="get" className="mb-3 flex gap-2">
          <input type="hidden" name="s" value="users" />
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="رقم العضوية، أو المعرّف، أو اسم، أو بريد"
            className="h-11 grow rounded-xl border border-line bg-paper px-3 text-[13px] text-ink outline-none placeholder:text-faint"
          />
          <button
            type="submit"
            className="h-11 shrink-0 rounded-xl px-4 text-[12.5px] font-bold"
            style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
          >
            ابحث
          </button>
          {q ? (
            <Link
              href="/admin?s=users"
              className="flex h-11 shrink-0 items-center px-2 text-[12.5px] font-semibold text-muted"
            >
              امسح
            </Link>
          ) : null}
        </form>

        <p className="mb-3 text-[11.5px] leading-relaxed text-muted">
          {q
            ? `نتائج البحث عن «${q}» — ${ar(people.length)} حساب.`
            : "أحدث خمسين حساباً. ابحث برقم العضوية للوصول إلى غيرهم."}
          {" "}امنح وسماً لحساب أو انزعه. الرقم على اليمين رقم العضوية.
          {owner ? " وتغييرُ البريد لك وحدك: من يبدّل بريد حسابٍ ينقله إلى عنوانه." : ""}
        </p>
        {people.length === 0 ? (
          <p className="mb-7 rounded-2xl border border-line bg-card p-5 text-center text-[12.5px] text-muted">
            لا حساب بهذا البحث.
          </p>
        ) : null}

        <div className="mb-7 flex flex-col gap-2">
          {people.map((person) => (
            /* البطاقة تحوي نموذجين: الوسم وطيّةُ البريد — ولا يتداخلان. */
            <div key={person.id} className="rounded-2xl border border-line bg-card">
              <form
                action={setUserTag.bind(null, person.id)}
                className="flex items-center gap-2 p-3"
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

              {/*
                وبابُ لحظاته لمن يملك صلاحية الإشراف وحده: البلاغ يصل على
                منشور، فيُفتح الحساب ليُرى ما حوله ثمّ يُحكم. والصفحة نفسها
                تفحص الصلاحية — إخفاءُ الرابط ليس حماية (القاعدة ١٣).
              */}
              {user.canModerate ? (
                <Link
                  href={`/admin/u/${person.id}`}
                  className="block border-t border-line px-3 py-2.5 text-[12px] font-semibold text-clay-ink"
                >
                  اقرأ لحظاته
                </Link>
              ) : null}

              {owner ? <AdminEmail userId={person.id} current={person.email} /> : null}

              {/* والإيقاف المؤقّت لمن يملك صلاحية الإشراف: من يقرأ البلاغ يتصرّف فيه. */}
              {user.canModerate ? (
                <Suspend
                  userId={person.id}
                  until={person.suspendedUntil}
                  reason={person.suspendedReason}
                />
              ) : null}

              {/* ومنحُ آثار+ حيث يُقرأ الحساب لا في شاشةٍ تعرض الناس كلَّهم. */}
              {scope === "ALL" ? <PlusGrant userId={person.id} until={person.plusUntil} /> : null}
            </div>
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
                  <Field label="السعر (نقاط)">
                    <input
                      name="priceCoins"
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
                  <Check name="plusOnly" label="حصري لمشتركي آثار+" />
                  <Check name="limited" label="حزمة محدودة — تظهر في صفّ «حزم محدودة»" />
                </div>

                <PaletteFields palette={null} />

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
                              {item.plusOnly ? <Chip gold>آثار+</Chip> : null}
                              {item.limited ? <Chip live>محدودة</Chip> : null}
                            </p>
                            <p className="truncate text-[11.5px] text-muted">
                              {item.earnedAfterDays
                                ? `يُكتسب بعد ${ar(item.earnedAfterDays)} يوم`
                                : coinText(item.priceCoins)}
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
                            الثيم يُلبَس خلفيةً للتطبيق، والتميمة شعاراً تحت صورة العرض،
                            والإطار حلقةً حولها. التميمة والإطار يُحفظان PNG بشفافيتهما.
                            بلا صورة يُرسم التدرّج.
                          </p>

                          {/*
                            وللثيم غلافٌ ثانٍ — و«الخلفية» نوعُه القديم في
                            القاعدة، فالصنفان واحدٌ في المتجر.
                            والإطار والتميمة لا خلفية لهما تُلبَس.
                          */}
                          {item.kind === "THEME" || item.kind === "BACKGROUND" ? (
                            <ItemCover itemId={item.id} mediaId={item.coverMediaId} />
                          ) : null}
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
                            <Field label="السعر (نقاط)">
                              <input
                                name="priceCoins"
                                type="number"
                                min={0}
                                step="1"
                                defaultValue={item.priceCoins}
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
                            <Check name="plusOnly" label="حصري لمشتركي آثار+" on={item.plusOnly} />
                            <Check name="limited" label="حزمة محدودة" on={item.limited} />
                          </div>

                          <PaletteFields palette={parsePalette(item.palette)} />

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

        {section === "team" ? (
          <>
            <h2 className="mb-1 text-[15px] font-bold">الصلاحيات</h2>
            <p className="mb-3 text-[11.5px] leading-relaxed text-muted">
              امنح حساباً صلاحية اللوحة: «المتجر» يفتح الأصناف والتصنيفات وحدها،
              و«اللوحة كاملة» يفتح كل شيء عدا هذه الصفحة — منحُ الصلاحيات لك وحدك.
              وما يُمنح يُسحب بضغطة.
              <br />
              و«إشراف» صلاحيةٌ مستقلّة: من يملكها يقرأ لحظات أيّ حساب بلا صداقة
              ويحذف ما يخالف منها — للتصرّف في البلاغات. تُمنح لمشرفٍ وتُمنع عن
              آخر، وكلُّ حذفٍ يُسجَّل باسم من حذفه.
            </p>

            <div className="mb-7 flex flex-col gap-2">
              {staff
                .filter((person) => person.id !== user.id)
                .map((person) => (
                  <form
                    key={person.id}
                    action={setAdminScope.bind(null, person.id)}
                    className="flex items-center gap-2 rounded-2xl border border-line bg-card p-3"
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                      style={{ background: "var(--color-chip)", color: "var(--color-muted)" }}
                    >
                      {ar(person.memberNo)}
                    </span>
                    <div className="min-w-0 grow">
                      <p dir="auto" className="flex items-center gap-1.5 truncate text-[13.5px] font-semibold">
                        {person.name}
                        {person.role === "ADMIN" ? <Chip gold>مالك</Chip> : null}
                        {person.adminScope !== "NONE" ? (
                          <Chip>{person.adminScope === "ALL" ? "اللوحة" : "المتجر"}</Chip>
                        ) : null}
                        {person.canModerate ? <Chip live>إشراف</Chip> : null}
                      </p>
                      <p dir="ltr" className="truncate text-right text-[11px] text-faint">
                        {person.email}
                      </p>
                    </div>
                    {/*
                      الإشراف صلاحيةٌ ثانية في النموذج نفسه: المالك يقرّر
                      الدرجتين لشخصٍ واحد في نظرةٍ واحدة. ومستقلّةٌ عن
                      المدى — مشرفٌ يملكها وآخر لا.
                    */}
                    <label className="flex shrink-0 items-center gap-1.5 text-[11.5px] font-semibold text-muted">
                      <input
                        type="checkbox"
                        name="moderate"
                        defaultChecked={person.canModerate}
                        className="h-4 w-4 accent-[var(--color-clay)]"
                      />
                      إشراف
                    </label>
                    <select
                      name="scope"
                      defaultValue={person.adminScope}
                      className="h-10 max-w-[130px] shrink-0 rounded-xl border border-line bg-paper px-2 text-[12px] text-ink outline-none"
                    >
                      <option value="NONE">بلا صلاحية</option>
                      <option value="STORE">المتجر فقط</option>
                      <option value="ALL">اللوحة كاملة</option>
                    </select>
                    <button
                      type="submit"
                      className="h-10 shrink-0 rounded-xl px-3 text-[12px] font-bold"
                      style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
                    >
                      احفظ
                    </button>
                  </form>
                ))}
            </div>
          </>
        ) : null}

        {section === "files" ? <Files /> : null}

        {section === "support" ? (
          <>
            <h2 className="mb-1 text-[15px] font-bold">الدعم</h2>
            <p className="mb-3 text-[11.5px] leading-relaxed text-muted">
              رسائل المستخدمين من «الدعم وتواصل معنا». الردّ يظهر لصاحب الرسالة
              في الصفحة نفسها، والإغلاق يعني أنّ المسألة انتهت.
            </p>

            {tickets.length === 0 ? (
              <p className="rounded-2xl border border-line bg-card px-4 py-6 text-center text-[12.5px] text-muted">
                لا رسائل.
              </p>
            ) : (
              <div className="mb-7 flex flex-col gap-2.5">
                {tickets.map((ticket) => (
                  <details
                    key={ticket.id}
                    className="rounded-2xl border border-line bg-card"
                    open={!ticket.closed && !ticket.reply}
                  >
                    <summary className="flex cursor-pointer list-none items-center gap-2 p-3.5">
                      <span className="min-w-0 grow">
                        <span dir="auto" className="flex items-center gap-1.5 truncate text-[13px] font-semibold">
                          {ticket.user?.name ?? ticket.name ?? "زائر"}
                          {ticket.user ? null : <Chip gold>من الموقع</Chip>}
                          {ticket.closed ? <Chip>مغلقة</Chip> : ticket.reply ? <Chip>رُدّ</Chip> : <Chip live>جديدة</Chip>}
                        </span>
                        <span className="mt-0.5 block truncate text-[11.5px] text-muted">
                          {ticket.body}
                        </span>
                      </span>
                      <span className="shrink-0 text-[10.5px] text-faint">
                        {relative(ticket.createdAt)}
                      </span>
                    </summary>

                    <div className="border-t border-line p-3.5">
                      {/*
                        رسالةُ الموقع بلا حساب، فلا مكان يقرأ فيه صاحبها
                        الردّ — بريده هو الطريق الوحيد إليه، فيُعرض هنا.
                      */}
                      {ticket.user ? null : (
                        <p dir="ltr" className="mb-2 text-[11.5px] font-semibold text-clay-ink">
                          {ticket.email}
                        </p>
                      )}

                      <p dir="auto" className="mb-3 whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink">
                        {ticket.body}
                      </p>

                      <Saver action={replyTicket.bind(null, ticket.id)} className="flex flex-col gap-2">
                        <textarea
                          name="reply"
                          rows={3}
                          maxLength={1200}
                          defaultValue={ticket.reply ?? ""}
                          placeholder="اكتب الردّ…"
                          className={`resize-none py-2.5 ${FIELD}`}
                        />
                        <button
                          type="submit"
                          className="rounded-xl text-[13px] font-bold"
                          style={{
                            height: 44,
                            background: "var(--color-clay)",
                            color: "var(--color-on-brand)",
                          }}
                        >
                          {ticket.reply ? "حدّث الردّ" : "أرسل الردّ"}
                        </button>
                      </Saver>

                      {ticket.closed ? null : (
                        <form action={closeTicket.bind(null, ticket.id)} className="pt-2.5">
                          <button
                            type="submit"
                            className="w-full rounded-xl border border-line text-[12.5px] font-semibold text-muted"
                            style={{ height: 42 }}
                          >
                            أغلق الرسالة
                          </button>
                        </form>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}

/** حجمٌ بالميغابايت بالأرقام العربية — الرقم وحده لا يقول شيئاً. */
function megabytes(bytes: number): string {
  if (bytes <= 0) return "٠";
  return ar((bytes / 1_048_576).toFixed(bytes < 1_048_576 ? 2 : 1));
}

/**
 * الملفات: أين تُخزَّن، وكم بقي منها في القاعدة.
 *
 * الرقمان يقولان حالَ النقل بلا تخمين، والزرّ لمن لا يريد انتظار
 * الكنسة — والنقل يجري وحده معها على كل حال.
 */
async function Files() {
  const state = await storageState();

  return (
    <>
      <h2 className="mb-1 text-[15px] font-bold">الملفات</h2>
      <p className="mb-3 text-[11.5px] leading-relaxed text-muted">
        الصور والأصوات ومقاطع الفيديو تُخزَّن في Cloudflare R2. وما رُفع قبل
        الربط بقي في القاعدة، ويُنقل دفعةً دفعة — والقاعدة تخفّ من نفسها.
      </p>

      <div className="mb-4 rounded-2xl border border-line bg-card p-4">
        <p className="mb-3 flex items-center gap-2 text-[13.5px] font-semibold">
          {state.cloud ? (
            <>
              <Chip gold>مربوطة</Chip>
              <span dir="ltr" className="text-[12px] text-faint">
                {state.bucket}
              </span>
            </>
          ) : (
            <Chip>غير مربوطة — المفاتيح ناقصة</Chip>
          )}
        </p>

        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-[12.5px]">
          <div>
            <dt className="text-[11px] text-faint">في السحابة</dt>
            <dd className="font-bold">{ar(state.inCloud)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-faint">باقٍ في القاعدة</dt>
            <dd className="font-bold">{ar(state.inDb)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-faint">حجمها</dt>
            <dd className="font-bold">{megabytes(state.dbBytes)} م.ب</dd>
          </div>
        </dl>
      </div>

      <Saver action={testStorage} className="mb-3 flex flex-col gap-2">
        <button
          type="submit"
          className="h-11 rounded-xl border border-line text-[13px] font-semibold"
        >
          افحص الاتصال بالدلو
        </button>
      </Saver>

      {state.cloud && state.inDb > 0 ? (
        <Saver action={moveMediaToCloud} className="mb-7 flex flex-col gap-2">
          <button
            type="submit"
            className="h-11 rounded-xl px-4 text-[13px] font-bold"
            style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
          >
            انقل دفعةً الآن
          </button>
        </Saver>
      ) : null}
    </>
  );
}
