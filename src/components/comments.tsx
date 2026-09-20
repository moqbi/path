import Link from "next/link";
import { Avatar, NameTag } from "@/components/ui";
import { relative } from "@/lib/format";

/**
 * التعليقات: كلّ تعليق في فقاعته — صورة صاحبه، ثم اسمه ووقته، ثم نصّه.
 *
 * قبلها كان الاسم يلتصق بالنص فلا يُعرف أين ينتهي تعليقٌ ويبدأ آخر:
 * الآن سطرٌ للاسم ووقته وسطرٌ لكلامه. بلا أرضيةٍ تحته — الطبقة الملوّنة
 * كانت تُظلم القراءة، والترتيب وحده يكفي. والصورة رابطٌ إلى ملف صاحبها.
 */
export type CommentShape = {
  id: string;
  body: string;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    avatarMediaId?: string | null;
    frame?: { spec: string; mediaId: string | null } | null;
    charm?: { spec: string; mediaId: string | null } | null;
    isPlus?: boolean;
    tag?: { name: string; bg: string; fg: string } | null;
  };
};

export function CommentList({
  comments,
  viewerId,
  size = 26,
}: {
  comments: CommentShape[];
  viewerId: string;
  size?: number;
}) {
  if (comments.length === 0) return null;

  return (
    <ul className="flex list-none flex-col gap-2">
      {comments.map((comment) => {
        const href = comment.user.id === viewerId ? "/me" : `/u/${comment.user.id}`;

        return (
          <li key={comment.id} className="flex items-start gap-2">
            <Link href={href} aria-label={`ملف ${comment.user.name}`} className="shrink-0">
              <Avatar
                name={comment.user.name}
                size={size}
                mediaId={comment.user.avatarMediaId ?? null}
                frame={comment.user.frame}
                charm={comment.user.charm}
              />
            </Link>

            <div className="min-w-0 grow pt-0.5">
              <div className="mb-0.5 flex items-center gap-1.5">
                {/* `dir=auto` لأن بعض الأسماء لاتينية: يبقى ترتيب الصفّ عربياً
                    ويُقرأ الاسم باتجاهه هو. */}
                <Link href={href} dir="auto" className="truncate text-[12px] font-semibold">
                  {comment.user.name}
                </Link>
                <NameTag isPlus={comment.user.isPlus} tag={comment.user.tag} size={9.5} />
                <span className="shrink-0 text-[10px] text-faint">
                  {relative(comment.createdAt)}
                </span>
              </div>
              <p className="break-words text-[12.5px] leading-relaxed text-ink-2">
                {comment.body}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
