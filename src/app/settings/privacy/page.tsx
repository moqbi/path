import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createGroup, deleteGroup, savePrivacy } from "@/app/actions";
import { ScreenHeader } from "@/components/ui";
import { LifeIcon } from "@/components/icons";
import { DeleteAccount } from "@/app/me/delete";
import { ShieldIcon } from "@/components/icons";
import { ar } from "@/lib/format";

/**
 * الخصوصية في شاشة واحدة: من يرى، ومن يتفاعل، والموقع، وإشعار الإشارة،
 * والمحظورون — ومعها التصنيفات لأن كل حدٍّ هنا يُقاس بتصنيف.
 */
export default async function PrivacyPage() {
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
        viewGroupId: true,
        interactGroupId: true,
        shareLocation: true,
        notifyOnTag: true,
      },
    }),
    prisma.block.count({ where: { blockerId: user.id } }),
  ]);

  const select =
    "h-11 w-full rounded-xl border border-line bg-paper px-3 text-[13px] text-ink outline-none";

  return (
    <div className="screen">
      <ScreenHeader title="الخصوصية" back="/me" />

      <main className="scroll-area px-5 py-4">
        <form action={savePrivacy} className="mb-6 flex flex-col gap-3">
          <div className="rounded-2xl border border-line bg-card p-4">
            <label className="mb-2 block text-[13.5px] font-semibold">
              من يمكنه رؤية لحظاتي؟
            </label>
            <p className="mb-2.5 text-[11.5px] leading-relaxed text-muted">
              الافتراضي لكل لحظة جديدة. تقدر تغيّره لكل لحظة عند نشرها.
            </p>
            <select name="viewGroupId" defaultValue={settings?.viewGroupId ?? ""} className={select}>
              <option value="">كل أصدقائي</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} ({ar(group._count.members)})
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl border border-line bg-card p-4">
            <label className="mb-2 block text-[13.5px] font-semibold">من يمكنه التفاعل معك؟</label>
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

          <div className="overflow-hidden rounded-2xl border border-line bg-card">
            <label className="flex items-center justify-between gap-3 p-4">
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
            <label className="flex items-center justify-between gap-3 border-t border-line p-4">
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold">إشعارات الإشارة</span>
                <span className="block text-[11.5px] text-muted">
                  حين يشير إليك أحدٌ في لحظة «مع فلان»
                </span>
              </span>
              <input
                name="notifyOnTag"
                type="checkbox"
                defaultChecked={settings?.notifyOnTag !== false}
                className="h-6 w-6 shrink-0 accent-[#f6b93b]"
              />
            </label>
          </div>

          <button
            type="submit"
            className="brand-gradient rounded-xl text-[14.5px] font-bold"
            style={{ height: 50, color: "var(--color-on-brand)" }}
          >
            احفظ
          </button>
        </form>

        <h2 className="mb-2 text-[14.5px] font-bold">تصنيفات أصدقائك</h2>
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

        <div className="mb-6 flex flex-col gap-2">
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

        {/* الدعم داخل الخصوصية: هنا يبحث الناس عمّن يكلّمونه. */}
        <Link
          href="/settings/support"
          className="mb-3 flex items-center justify-between rounded-2xl border border-line bg-card p-4"
        >
          <span>
            <span className="block text-[13.5px] font-semibold">الدعم الفني وتواصل معنا</span>
            <span className="block text-[11.5px] text-muted">
              مشكلة أو اقتراح أو بلاغ — نردّ عليك داخل التطبيق
            </span>
          </span>
          <span className="shrink-0 text-clay-ink">
            <LifeIcon size={18} />
          </span>
        </Link>

        <Link
          href="/settings/blocked"
          className="mb-6 flex items-center justify-between rounded-2xl border border-line bg-card p-4"
        >
          <span className="text-[13.5px] font-semibold">حظر المستخدمين</span>
          <span className="text-[12px] text-muted">{ar(blocked)} محظور</span>
        </Link>

        {/* حذف الحساب في الخصوصية: هنا يُبحث عنه، لا في أسفل الملف. */}
        <DeleteAccount />

        <p className="flex items-center justify-center gap-2 pb-4 text-[11.5px] text-muted">
          <ShieldIcon size={15} />
          ما يُنشر لأصدقائك لا يخرج عنهم.
        </p>
      </main>
    </div>
  );
}
