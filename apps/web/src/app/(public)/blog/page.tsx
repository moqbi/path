import type { Metadata } from "next";
import { PageHero } from "@/components/page-shell";
import { BlogCardView } from "@/components/blog-card";
import { blogPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "المدونة · آثار مومنتس · ATHAR Moments",
  description: "شروح آثار مومنتس: كيف تنشر لحظاتك، وتبني دائرتك، وتستعمل كل ميزة.",
};

/** المدونة (القاعدة ٤٩٠): شروحُ التطبيق بطاقاتٍ، أحدثُها أوّلاً وأكبر. */
export default async function BlogPage() {
  const posts = await blogPosts();
  const [first, ...rest] = posts;
  return (
    <>
      <PageHero eyebrow="المدونة" title="شروح آثار" lead="كيف تنشر لحظاتك، وتبني دائرتك، وتستفيد من كل ميزة — خطوةً خطوة." />
      <div className="blog-wrap">
        {first ? (
          <div className="blog-grid">
            <BlogCardView post={first} lead />
            {rest.map((post) => (
              <BlogCardView key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <p className="doc-card text-center text-[14px] text-muted">أوّل المقالات في الطريق.</p>
        )}
      </div>
    </>
  );
}
