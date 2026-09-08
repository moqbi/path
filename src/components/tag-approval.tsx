"use client";

import { useTransition } from "react";
import { approveTag, rejectTag } from "@/app/actions";
import { WithIcon } from "@/components/icons";

type PendingTag = {
  id: string;
  moment: { kind: string; placeName: string | null; author: { name: string } };
};

/**
 * موافقة الإشارة قبل ظهورها.
 * تُعرض أعلى الخط الزمني لأنها تخصّ المستخدم مباشرة ولا تحتمل التأجيل.
 */
export function TagApproval({ tags }: { tags: PendingTag[] }) {
  const [pending, start] = useTransition();

  return (
    <div className="mt-4 flex flex-col gap-2">
      {tags.map((tag) => (
        <div
          key={tag.id}
          className="rounded-2xl border p-4"
          style={{ background: "var(--color-gold-soft)", borderColor: "var(--color-gold-line)" }}
        >
          <div className="mb-3 flex items-start gap-2.5">
            <span className="text-gold">
              <WithIcon size={18} />
            </span>
            <p className="text-[13px] leading-relaxed">
              <span className="font-semibold">{tag.moment.author.name}</span> أشار إلى أنك معه
              {tag.moment.placeName ? ` في ${tag.moment.placeName}` : null}. ما تظهر لأحد قبل
              موافقتك.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => start(() => void approveTag(tag.id))}
              className="h-11 grow rounded-xl text-[13.5px] font-semibold text-card disabled:opacity-60"
              style={{ background: "var(--color-gold)" }}
            >
              أوافق
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => start(() => void rejectTag(tag.id))}
              className="h-11 grow rounded-xl border border-line bg-card text-[13.5px] font-semibold text-ink-2 disabled:opacity-60"
            >
              أرفض
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
