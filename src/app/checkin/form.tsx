"use client";

import { useState } from "react";
import { postPresence } from "@/app/actions";
import { ScreenHeader } from "@/components/ui";
import { LockIcon, PinIcon, WithIcon, InfoIcon } from "@/components/icons";

const DURATIONS = [
  { hours: 1, label: "ساعة" },
  { hours: 3, label: "٣ ساعات" },
  { hours: 6, label: "الليلة" },
];

export function CheckinForm({
  friends,
  city,
  suggestions,
}: {
  friends: { id: string; name: string }[];
  city: string;
  suggestions: string[];
}) {
  const [place, setPlace] = useState("");
  const [hours, setHours] = useState(3);
  const [withIds, setWithIds] = useState<string[]>([]);

  const endsAt = new Date(Date.now() + hours * 3_600_000);
  const endsLabel = `${endsAt.getHours()}:${String(endsAt.getMinutes()).padStart(2, "0")}`;

  return (
    <form action={postPresence} className="flex min-h-dvh flex-col">
      <ScreenHeader title="وين أنت؟" back="/compose" />

      <div className="grow px-5 py-4">
        <div className="mb-2.5 flex items-center gap-3 rounded-2xl border border-line bg-card p-4">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "var(--color-clay-soft)", color: "var(--color-clay)" }}
          >
            <PinIcon size={20} />
          </span>
          <div className="grow">
            <input
              name="placeName"
              required
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="اسم المكان"
              className="w-full bg-transparent text-[15px] font-semibold outline-none placeholder:font-normal placeholder:text-[#c0b7ab]"
            />
            <p className="mt-0.5 text-[11.5px] text-muted">{city}</p>
          </div>
        </div>

        {suggestions.length > 0 ? (
          <div className="mb-6 flex flex-wrap gap-2">
            {suggestions.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setPlace(name)}
                className="min-h-11 rounded-full bg-chip px-3.5 text-[12.5px] text-ink-2"
              >
                {name}
              </button>
            ))}
          </div>
        ) : (
          <div className="mb-6" />
        )}

        <p className="mb-2.5 text-[11.5px] font-semibold tracking-wide text-faint">لين متى؟</p>
        <input type="hidden" name="hours" value={hours} />
        <div className="mb-6 flex gap-2">
          {DURATIONS.map((d) => {
            const on = hours === d.hours;
            return (
              <button
                key={d.hours}
                type="button"
                onClick={() => setHours(d.hours)}
                className="grow rounded-xl text-[13.5px] transition-colors"
                style={{
                  height: 46,
                  background: on ? "var(--color-live-soft)" : "var(--color-card)",
                  border: `${on ? 1.5 : 1}px solid ${on ? "var(--color-live)" : "var(--color-line)"}`,
                  color: on ? "var(--color-live)" : "var(--color-ink-2)",
                  fontWeight: on ? 600 : 400,
                }}
              >
                {d.label}
              </button>
            );
          })}
        </div>

        {friends.length > 0 ? (
          <>
            <p className="mb-2.5 flex items-center gap-2 text-[11.5px] font-semibold tracking-wide text-faint">
              <WithIcon size={14} /> مع مين؟
            </p>
            <div className="mb-2 flex flex-wrap gap-2">
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
            {withIds.map((id) => (
              <input key={id} type="hidden" name="with" value={id} />
            ))}
            <p className="mb-6 flex items-center gap-2 text-[11px] leading-relaxed text-faint">
              <InfoIcon size={14} />
              ما تظهر إلا بعد موافقتهم
            </p>
          </>
        ) : null}

        <textarea
          name="note"
          rows={2}
          placeholder="اكتب شي… «قهوة وسوالف، الباب مفتوح»"
          className="w-full resize-none rounded-2xl border border-line bg-card px-4 py-3.5 text-[13.5px] leading-relaxed outline-none focus:border-clay"
        />
      </div>

      <div className="px-5 pb-8">
        <div
          className="mb-3 flex items-center justify-between rounded-xl px-4 py-3.5"
          style={{ background: "var(--color-live-soft)" }}
        >
          <span className="text-[12.5px] leading-snug text-live">
            يشوفها دائرتك فقط · تختفي {endsLabel}
          </span>
          <LockIcon size={17} className="text-live" />
        </div>
        <button
          type="submit"
          className="w-full rounded-xl text-[15.5px] font-semibold text-card"
          style={{ height: 54, background: "var(--color-live)" }}
        >
          انشر حضورك
        </button>
      </div>
    </form>
  );
}
