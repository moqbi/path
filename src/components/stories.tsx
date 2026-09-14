"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui";
import { StoryComposer } from "@/components/story-composer";
import type { StoryRing } from "@/lib/stories";

/**
 * شريط القصص.
 *
 * الحلقة الملوّنة تعني «فيها ما لم تره»، والرمادية «رأيتها كلها» — كما
 * تعوّد الناس. وأول الشريط زرّ قصتك، فالنشر أقرب من التصفّح.
 */
export function StoryStrip({
  rings,
  me,
}: {
  rings: StoryRing[];
  me: { id: string; name: string; avatarMediaId: string | null };
}) {
  const mine = rings.find((ring) => ring.userId === me.id) ?? null;
  const others = rings.filter((ring) => ring.userId !== me.id);

  return (
    <div className="no-bar flex gap-3.5 overflow-x-auto px-5 py-3">
      <div className="flex w-[68px] shrink-0 flex-col items-center gap-1.5">
        {/* الاختيار ثم المعاينة والفلتر ثم النشر — لا رفعٌ فوريّ. */}
        <StoryComposer />
        <span className="w-full truncate text-center text-[10.5px] text-muted">قصة جديدة</span>
      </div>

      {mine ? <Ring ring={mine} label="قصتي" /> : null}
      {others.map((ring) => (
        <Ring key={ring.userId} ring={ring} label={ring.name} />
      ))}
    </div>
  );
}

function Ring({ ring, label }: { ring: StoryRing; label: string }) {
  return (
    <Link
      href={`/stories/${ring.userId}`}
      className="flex w-[68px] shrink-0 flex-col items-center gap-1.5"
    >
      <span
        className="flex h-[62px] w-[62px] items-center justify-center rounded-full"
        style={{
          padding: 2.5,
          background: ring.fresh
            ? "linear-gradient(140deg,#f6b93b,#ff7a5a)"
            : "var(--color-line)",
        }}
      >
        <span
          className="flex h-full w-full items-center justify-center rounded-full"
          style={{ background: "var(--color-paper)", padding: 2 }}
        >
          <Avatar name={ring.name} size={52} mediaId={ring.avatarMediaId} />
        </span>
      </span>
      <span className="w-full truncate text-center text-[10.5px] text-ink-2">{label}</span>
    </Link>
  );
}
