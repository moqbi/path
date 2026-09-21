import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createGroup, deleteGroup, savePrivacy } from "@/app/actions";
import { ScreenHeader } from "@/components/ui";
import { BookIcon, LifeIcon, ShieldIcon } from "@/components/icons";
import { DeleteAccount } from "@/app/me/delete";
import { ChangeEmail } from "@/app/settings/email";
import { ChangePassword } from "@/app/settings/password";
import { Notifications } from "@/app/settings/notifications";
import { VerifyEmail } from "@/app/settings/verify-email";
import { ar } from "@/lib/format";

/**
 * الإعدادات والخصوصية: شاشةٌ واحدة بأقسامٍ تُفتح.
 *
 * ثلاثةُ أقسامٍ تُطوى — الحساب والتنبيهات والخصوصية — وبابان يخرجان
 * منها: سياسةُ الخصوصية والدعم. وأقسامٌ تُطوى لا صفحاتٌ متسلسلة:
 * الإعداد يُقرأ مرّةً ويُغيَّر نادراً، وصفحةٌ لكل بندٍ تجعل تغييرَ
 * مفتاحٍ رحلةً من ثلاث ضغطات.
 */
export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const [groups, settings, blocked] = await Promise.all([
    prisma.friendGroup.findMany({
      where: { ownerId: user.id },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { members: true } } },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        emailVerifiedAt: true,
        passwordHash: true,
        viewGroupId: true,
        interactGroupId: true,
        shareLocation: true,
        notifyOnTag: true,
        notifyDm: true,
        notifyFriend: true,
        notifyReaction: true,
        notifyComment: true,
        notifyStoreNew: true,
        notifyStoreDeals: true,
        quietFrom: true,
        quietTo: true,
      },
    }),
    prisma.block.count({ where: { blockerId: user.id } }),
  ]);

  const select =
    "h-11 w-full rounded-xl border border-line bg-paper px-3 text-[13px] text-ink outline-none";

  // من دخل بمزوّدٍ لا كلمةَ له: يضعها بلا قديمة، ويربط بريده بلا كلمة.
  const hasPassword = Boolean(settings?.passwordHash);

  return (
    <div className="screen">
      <ScreenHeader title="الإعدادات والخصوصية" back="/me" />

      <main className="scroll-area px-5 py-4">
        {/* ── الحساب ── */}
        <Section title="الحساب" note="بريدك وكلمتك، ومن منعتَه، وبابُ الخروج الأخير">
          <div className="flex flex-col gap-3">
            <VerifyEmail
              verified={Boolean(settings?.emailVerifiedAt)}
              hasEmail={Boolean(user.email)}
            />
            <ChangePassword hasPassword={hasPassword} />
            <ChangeEmail current={user.email} hasPassword={hasPassword} />

            <Link
              href="/settings/blocked"
              className="flex items-center justify-between rounded-2xl border border-line bg-card p-4"
            >
              <span className="text-[13.5px] font-semibold">قائمة الحظر</span>
              <span className="text-[12px] text-muted">{ar(blocked)} محظور</span>
            </Link>

            {/* حذف الحساب هنا يُبحث عنه، لا في أسفل الملف. */}
            <DeleteAccount />
          </div>
        </Section>

        {/* ── التنبيهات ── */}
        <Section title="التنبيهات" note="ما يصل جهازك، ومتى يسكت">
          <Notifications
            prefs={{
              on: {
                notifyDm: settings?.notifyDm !== false,
                notifyFriend: settings?.notifyFriend !== false,
                notifyOnTag: settings?.notifyOnTag !== false,
                notifyReaction: settings?.notifyReaction !== false,
                notifyComment: settings?.notifyComment !== false,
                notifyStoreNew: settings?.notifyStoreNew !== false,
                notifyStoreDeals: settings?.notifyStoreDeals !== false,
              },
              quietFrom: settings?.quietFrom ?? null,
              quietTo: settings?.quietTo ?? null,
            }}
          />
        </Section>

        {/* ── الخصوصية ── */}
        <Section title="الخصوصية" note="من يرى، ومن يتفاعل، وأين أنت">
          <form action={savePrivacy} className="mb-4 flex flex-col gap-3">
            <div className="rounded-2xl border border-line bg-card p-4">
              <label className="mb-2 block text-[13.5px] font-semibold">
                من يمكنه رؤية لحظاتي؟
              </label>
              <p className="mb-2.5 text-[11.5px] leading-relaxed text-muted">
                الافتراضي لكل لحظة جديدة. تقدر تغيّره لكل لحظة عند نشرها.
              </p>
              <select
                name="viewGroupId"
                defaultValue={settings?.viewGroupId ?? ""}
                className={select}
              >
                <option value="">كل أصدقائي</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name} ({ar(group._count.members)})
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl border border-line bg-card p-4">
              <label className="mb-2 block text-[13.5px] font-semibold">
                من يمكنه التفاعل معك؟
              </label>
              <p className="mb-2.5 text-[11.5px] leading-relaxed text-muted">
                التفاعل والتعليق على لحظاتك. الخادم يفحصه، لا إخفاء الأزرار.
              </p>
              <select
                name="interactGroupId"
                defaultValue={settings?.interactGroupId ?? ""}
                className={select}
              >
                <option value="">كل أصدقائي</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name} ({ar(group._count.members)})
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4">
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold">إظهار موقعي</span>
                <span className="block text-[11.5px] text-muted">
                  مطفأً تُنشر المدينة وحدها بلا اسم المكان ولا إحداثياته
                </span>
              </span>
              <input
                name="shareLocation"
                type="checkbox"
                defaultChecked={settings?.shareLocation !== false}
                className="h-6 w-6 shrink-0 accent-[#f6b93b]"
              />
            </label>

            <button
              type="submit"
              className="brand-gradient rounded-xl text-[14.5px] font-bold"
              style={{ height: 50, color: "var(--color-on-brand)" }}
            >
              احفظ
            </button>
          </form>

          <h3 className="mb-2 text-[13.5px] font-bold">تصنيفات أصدقائك</h3>
          <p className="mb-3 text-[11.5px] leading-relaxed text-muted">
            التصنيف لك وحدك: من صنّفته «عائلة» لا يرى تصنيفك ولا يراه غيرك.
          </p>

          <form action={createGroup} className="mb-3 flex gap-2">
            <input
              name="name"
              required
              maxLength={20}
              placeholder="اسم التصنيف (العائلة، الزملاء…)"
              className="h-11 min-w-0 grow rounded-xl border border-line bg-card px-3.5 text-[13px] text-ink outline-none focus:border-clay"
            />
            <button
              type="submit"
              className="h-11 shrink-0 rounded-xl px-4 text-[13px] font-bold"
              style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
            >
              أضف
            </button>
          </form>

          <div className="flex flex-col gap-2">
            {groups.length === 0 ? (
              <p className="rounded-2xl border border-line bg-card px-4 py-5 text-center text-[12.5px] text-muted">
                لا تصنيفات بعد.
              </p>
            ) : null}
            {groups.map((group) => (
              <div
                key={group.id}
                className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3"
              >
                <span className="min-w-0 grow">
                  <span className="block text-[13.5px] font-semibold">{group.name}</span>
                  <span className="block text-[11.5px] text-muted">
                    {ar(group._count.members)} من أصدقائك
                  </span>
                </span>
                <form action={deleteGroup.bind(null, group.id)}>
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
        </Section>

        {/* ── بابان يخرجان من الإعدادات ── */}
        {/*
           الوثيقتان صفحتان في التطبيق نفسه لا رابطٌ إلى نطاقٍ خارجيّ:
           بلا بيئةٍ مضبوطة كان الصفّان يختفيان تماماً — والمتجران
           يشترطان أن يجدهما المستخدم.
        */}
        <Link
          href="/legal/privacy"
          className="mb-3 flex items-center justify-between rounded-2xl border border-line bg-card p-4"
        >
          <span>
            <span className="block text-[13.5px] font-semibold">سياسة الخصوصية</span>
            <span className="block text-[11.5px] text-muted">ما نجمعه وما لا نجمعه</span>
          </span>
          <span className="shrink-0 text-clay-ink">
            <BookIcon size={18} />
          </span>
        </Link>

        <Link
          href="/legal/terms"
          className="mb-3 flex items-center justify-between rounded-2xl border border-line bg-card p-4"
        >
          <span>
            <span className="block text-[13.5px] font-semibold">شروط الاستخدام</span>
            <span className="block text-[11.5px] text-muted">ما لك وما عليك في آثار</span>
          </span>
          <span className="shrink-0 text-clay-ink">
            <BookIcon size={18} />
          </span>
        </Link>

        <Link
          href="/settings/support"
          className="mb-6 flex items-center justify-between rounded-2xl border border-line bg-card p-4"
        >
          <span>
            <span className="block text-[13.5px] font-semibold">الدعم الفني — تواصل معنا</span>
            <span className="block text-[11.5px] text-muted">
              مشكلة أو اقتراح أو بلاغ — نردّ عليك داخل التطبيق
            </span>
          </span>
          <span className="shrink-0 text-clay-ink">
            <LifeIcon size={18} />
          </span>
        </Link>

        <p className="flex items-center justify-center gap-2 pb-4 text-[11.5px] text-muted">
          <ShieldIcon size={15} />
          ما يُنشر لأصدقائك لا يخرج عنهم.
        </p>
      </main>
    </div>
  );
}

/** قسمٌ يُطوى: عنوانه وسطرُ وصفٍ تحته، وما فيه يُفتح بضغطة. */
function Section({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <details className="mb-3 overflow-hidden rounded-2xl border border-line bg-paper">
      <summary className="flex cursor-pointer list-none items-center justify-between p-4">
        <span className="min-w-0">
          <span className="block text-[14.5px] font-bold">{title}</span>
          <span className="block text-[11.5px] text-muted">{note}</span>
        </span>
        <span className="shrink-0 text-[11.5px] text-clay-ink">افتح</span>
      </summary>
      <div className="border-t border-line p-4">{children}</div>
    </details>
  );
}
