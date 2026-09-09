"use client";

import { useState } from "react";
import Link from "next/link";
import { postMoment } from "@/app/actions";
import {
  CameraIcon,
  ClockIcon,
  LockIcon,
  MoonIcon,
  MusicIcon,
  PinIcon,
  TextIcon,
  WithIcon,
  BackIcon,
} from "@/components/icons";

type Friend = { id: string; name: string };
type Kind = "PHOTO" | "PLACE" | "THOUGHT" | "MUSIC" | "SLEEP" | "WITH";

const TYPES: { kind: Kind; label: string; Icon: typeof CameraIcon; tint: string }[] = [
  { kind: "PHOTO", label: "صورة", Icon: CameraIcon, tint: "var(--color-clay)" },
  { kind: "PLACE", label: "مكان", Icon: PinIcon, tint: "var(--color-live)" },
  { kind: "THOUGHT", label: "فكرة", Icon: TextIcon, tint: "var(--color-ink-2)" },
  { kind: "MUSIC", label: "أغنية", Icon: MusicIcon, tint: "var(--color-ink-2)" },
  { kind: "SLEEP", label: "نوم", Icon: MoonIcon, tint: "var(--color-ink-2)" },
  { kind: "WITH", label: "مع مين", Icon: WithIcon, tint: "var(--color-ink-2)" },
];

export function ComposeSheet({ friends }: { friends: Friend[] }) {
  const [kind, setKind] = useState<Kind | null>(null);
  const [withIds, setWithIds] = useState<string[]>([]);

  // «مع مين» ليست نوعاً مستقلاً بل طبقة فوق أي لحظة، فاختيارها يفتح قائمة
  // الأصدقاء ويترك النوع فكرةً — أبسط من نوع سادس في قاعدة البيانات.
  const effective = kind === "WITH" ? "THOUGHT" : kind;

  return (
    <div className="flex min-h-dvh flex-col justify-end" style={{ background: "var(--color-night)" }}>
      <div className="rounded-t-[26px] bg-paper px-5 pb-8 pt-3">
        <div className="mx-auto mb-5 h-1 w-9 rounded-full bg-line" />

        <div className="mb-5 flex items-start justify-between">
          <div>
            <h1 className="text-[21px]" style={{ fontFamily: "var(--font-display)" }}>
              وش صار اليوم؟
            </h1>
            <p className="mt-1 text-[12.5px] text-muted">اختر نوع اللحظة</p>
          </div>
          <Link
            href="/"
            aria-label="رجوع"
            className="-ml-2 flex h-11 w-11 items-center justify-center text-muted"
          >
            <BackIcon size={19} />
          </Link>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-2.5">
          {TYPES.map(({ kind: k, label, Icon, tint }) => {
            const on = kind === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKind(on ? null : k)}
                className="flex flex-col items-center gap-2.5 rounded-2xl border bg-card px-2.5 py-4 transition-colors"
                style={{ borderColor: on ? tint : "var(--color-line)", borderWidth: on ? 1.5 : 1 }}
              >
                <span style={{ color: tint }}>
                  <Icon size={24} />
                </span>
                <span className="text-[12.5px] font-medium">{label}</span>
              </button>
            );
          })}
        </div>

        {kind ? (
          <form action={postMoment} className="flex flex-col gap-3">
            <input type="hidden" name="kind" value={effective ?? "THOUGHT"} />
            {withIds.map((id) => (
              <input key={id} type="hidden" name="with" value={id} />
            ))}

            {kind === "PLACE" ? (
              <input
                name="placeName"
                required
                placeholder="وين وصلت؟"
                className="rounded-xl border border-line bg-card px-4 text-[14px] outline-none focus:border-clay"
                style={{ height: 50 }}
              />
            ) : null}

            {kind === "MUSIC" ? (
              <div className="flex gap-2">
                <input
                  name="musicTitle"
                  required
                  placeholder="الأغنية"
                  className="grow rounded-xl border border-line bg-card px-4 text-[14px] outline-none focus:border-clay"
                  style={{ height: 50 }}
                />
                <input
                  name="musicArtist"
                  placeholder="الفنان"
                  className="grow rounded-xl border border-line bg-card px-4 text-[14px] outline-none focus:border-clay"
                  style={{ height: 50 }}
                />
              </div>
            ) : null}

            {kind !== "SLEEP" ? (
              <textarea
                name="text"
                rows={3}
                required={kind === "THOUGHT" || kind === "WITH"}
                placeholder={kind === "PHOTO" ? "اكتب شي عن الصورة…" : "اكتب شي…"}
                className="resize-none rounded-2xl border border-line bg-card px-4 py-3 text-[13.5px] leading-relaxed outline-none focus:border-clay"
              />
            ) : null}

            {friends.length > 0 ? (
              <div>
                <p className="mb-2 flex items-center gap-2 text-[11.5px] font-semibold tracking-wide text-faint">
                  <WithIcon size={14} /> مع مين؟
                </p>
                <div className="flex flex-wrap gap-2">
                  {friends.map((friend) => {
                    const on = withIds.includes(friend.id);
                    return (
                      <button
                        key={friend.id}
                        type="button"
                        onClick={() =>
                          setWithIds((ids) =>
                            on ? ids.filter((i) => i !== friend.id) : [...ids, friend.id],
                          )
                        }
                        className="min-h-11 rounded-full border px-4 text-[13px] font-medium transition-colors"
                        style={{
                          background: on ? "var(--color-clay-soft)" : "var(--color-card)",
                          borderColor: on ? "var(--color-clay)" : "var(--color-line)",
                          color: on ? "var(--color-clay)" : "var(--color-ink)",
                        }}
                      >
                        {friend.name}
                      </button>
                    );
                  })}
                </div>
                {withIds.length > 0 ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-faint">
                    ما تظهر الإشارة إلا بعد موافقتهم.
                  </p>
                ) : null}
              </div>
            ) : null}

            <button
              type="submit"
              className="brand-gradient mt-1 rounded-xl text-[15px] font-bold"
              style={{ height: 52, color: "var(--color-on-brand)" }}
            >
              انشر
            </button>
          </form>
        ) : null}

        <Link
          href="/checkin"
          className="mt-2 flex items-center gap-3 rounded-2xl p-4"
          style={{ background: "var(--color-live-soft)" }}
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-card"
            style={{ background: "var(--color-live)" }}
          >
            <ClockIcon size={19} />
          </span>
          <span className="grow">
            <span className="block text-[13.5px] font-semibold text-live">حضور مؤقت</span>
            <span className="block text-[11.5px] text-muted">
              أنا هنا الآن · مين جاي؟
            </span>
          </span>
          <BackIcon size={17} className="text-live" />
        </Link>

        <p className="flex items-center justify-center gap-2 pt-4 text-[11.5px] text-faint">
          <LockIcon size={14} />
          كل لحظاتك تبقى داخل دائرتك
        </p>
      </div>
    </div>
  );
}
