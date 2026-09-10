import Link from "next/link";
import { Avatar } from "@/components/ui";
import { relative } from "@/lib/format";

/**
 * التعليقات: كلّ تعليق في فقاعته — صورة صاحبه، ثم اسمه ووقته، ثم نصّه.
 *
 * قبلها كانت أسطراً عاريةً يتداخل فيها الاسم بالنص فلا يُعرف أين ينتهي
 * تعليقٌ ويبدأ آخر. والصورة رابطٌ إلى ملف صاحبها: من كتب سطراً يستحقّ
 * أن يُعرف من هو بضغطة.
 */
export type CommentShape = {
  id: string;
  body: string;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    avatarMediaId?: string | null;
    frame?: { spec: string } | null;
    charm?: { spec: string; mediaId: string | null } | null;
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
                frameSpec={comment.user.frame?.spec}
                charm={comment.user.charm}
              />
            </Link>

            <div
              className="min-w-0 grow rounded-2xl px-3 py-2"
              style={{ background: "var(--color-paper)" }}
            >
              <div className="mb-0.5 flex items-baseline gap-2">
                <Link href={href} className="truncate text-[12px] font-semibold">
                  {comment.user.name}
                </Link>
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
