import Link from "next/link";
import { prisma } from "@/lib/db";
import { createBlogPost, deleteBlogPost } from "@/app/actions";
import { readBlocks } from "@/lib/blog-blocks";
import { ar } from "@/lib/format";
import { BlogEditor } from "./blog-editor";
import { ConfirmDelete } from "./confirm-delete";

const SOLID = { background: "var(--color-clay)", color: "var(--color-on-brand)" } as const;

/**
 * قسمُ المدونة (القاعدة ٤٩٠): المقالاتُ بأحدثها، وما يُفتح منها يُحرَّر في مكانه.
 * المالكُ وممنوحُ اللوحة يحرّرون كلَّ مقال، وممنوحُ المدونة ما كتبه هو — والإجراءُ يفحص ذلك بنفسه.
 */
export async function BlogSection({ userId, all, open }: { userId: string; all: boolean; open?: string }) {
  const posts = await prisma.blogPost.findMany({
    where: all ? {} : { authorId: userId },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true, title: true, slug: true, excerpt: true, category: true, published: true,
      publishedAt: true, updatedAt: true, coverMediaId: true,
      author: { select: { name: true } },
    },
  });
  const editing = open ? await prisma.blogPost.findFirst({
    where: { id: open, ...(all ? {} : { authorId: userId }) },
  }) : null;

  if (editing) {
    return (
      <>
        <div className="mb-3 flex items-center gap-2">
          <Link href="/admin?s=blog" className="h-9 rounded-xl border border-line px-3 text-[12.5px] font-semibold leading-9">
            → المقالات
          </Link>
          <span className="grow" />
          {editing.published ? (
            <a href={`/blog/${encodeURIComponent(editing.slug)}`} target="_blank" rel="noopener" className="text-[12.5px] font-semibold text-clay-ink">
              افتح في المدونة ↗
            </a>
          ) : (
            <span className="text-[12px] text-muted">مسودة — لا تظهر في المدونة</span>
          )}
          <ConfirmDelete run={deleteBlogPost.bind(null, editing.id)} label="احذف المقال" />
        </div>
        <BlogEditor
          key={editing.id}
          post={{
            id: editing.id,
            title: editing.title,
            slug: editing.slug,
            excerpt: editing.excerpt,
            category: editing.category,
            published: editing.published,
            coverMediaId: editing.coverMediaId,
            blocks: readBlocks(editing.blocks),
          }}
        />
      </>
    );
  }

  return (
    <>
      <div className="mb-1 flex items-center gap-2">
        <h2 className="grow text-[15px] font-bold">المدونة</h2>
        <form action={createBlogPost}>
          <button type="submit" className="h-10 rounded-xl px-4 text-[12.5px] font-bold" style={SOLID}>
            ＋ مقال جديد
          </button>
        </form>
      </div>
      <p className="mb-4 text-[11.5px] leading-relaxed text-muted">
        شروحُ التطبيق على atharmts.com/blog. المقالُ مسودةٌ حتى يُعلَّم «منشور»، و«مقالات مشابهة» في آخره من
        تصنيفه نفسه ثمّ الأحدث.
      </p>
      {posts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-[13px] text-muted">لا مقالات بعد.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/admin?s=blog&open=${post.id}`}
              className="flex items-center gap-3 rounded-2xl border border-line bg-card p-2.5"
            >
              <div className="h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-chip">
                {post.coverMediaId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/site-media/${post.coverMediaId}`} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 grow">
                <p dir="auto" className="truncate text-[13.5px] font-bold">{post.title}</p>
                <p className="truncate text-[11.5px] text-muted">
                  {post.category || "بلا تصنيف"} · {post.author?.name ?? "—"} · عُدّل {post.updatedAt.toLocaleDateString("ar-SA-u-ca-gregory")}
                </p>
              </div>
              <span
                className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={post.published ? SOLID : { background: "var(--color-chip)", color: "var(--color-muted)" }}
              >
                {post.published ? "منشور" : "مسودة"}
              </span>
            </Link>
          ))}
          <p className="text-[11px] text-faint">{ar(posts.length)} مقال</p>
        </div>
      )}
    </>
  );
}
