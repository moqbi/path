"use client";

import Link from "next/link";
import { useTransition } from "react";
import { postStory } from "@/app/actions";
import { ImagePicker } from "@/components/image-picker";
import { Avatar } from "@/components/ui";
import { PlusIcon } from "@/components/icons";
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
  const [pending, start] = useTransition();
  const mine = rings.find((ring) => ring.userId === me.id) ?? null;
  const others = rings.filter((ring) => ring.userId !== me.id);

  return (
    <div className="no-bar flex gap-3.5 overflow-x-auto px-5 py-3">
      <div className="flex w-[68px] shrink-0 flex-col items-center gap-1.5">
        <ImagePicker
          label="قصة جديدة"
          maxSize={1400}
          onPicked={(dataUrl, width, height) =>
            start(() => void postStory(dataUrl, width, height))
          }
          className="flex h-[62px] w-[62px] items-center justify-center rounded-full border border-dashed"
        >
          <span
            className="flex h-full w-full items-center justify-center rounded-full"
            style={{
              border: "1.5px dashed var(--color-line)",
              background: "var(--color-card)",
              color: "var(--color-clay-ink)",
              opacity: pending ? 0.5 : 1,
            }}
          >
            <PlusIcon size={22} />
          </span>
        </ImagePicker>
        <span className="w-full truncate text-center text-[10.5px] text-muted">
          {pending ? "نرفع…" : "قصة جديدة"}
        </span>
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
          <Avatar name={ring.name} size={52} mediaId={ring.avatarMediaId} ring="transparent" />
        </span>
      </span>
      <span className="w-full truncate text-center text-[10.5px] text-ink-2">{label}</span>
    </Link>
  );
}
