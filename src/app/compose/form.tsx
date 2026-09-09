"use client";

import { useEffect, useState, useTransition } from "react";
import { postPlace, postSimple } from "@/app/actions";
import { ScreenHeader } from "@/components/ui";
import { CameraIcon, PinIcon, TextIcon, WithIcon, LockIcon } from "@/components/icons";

type Kind = "PHOTO" | "THOUGHT" | "PLACE";
type Friend = { id: string; name: string };

const META: Record<Kind, { title: string; hint: string; Icon: typeof CameraIcon }> = {
  PHOTO: { title: "صورة", hint: "اكتب شي عن الصورة…", Icon: CameraIcon },
  THOUGHT: { title: "فكرة", hint: "وش في بالك؟", Icon: TextIcon },
  PLACE: { title: "مكان", hint: "اكتب شي عن المكان… (اختياري)", Icon: PinIcon },
};

type Fix = { lat: number; lng: number };

export function ComposeForm({ kind, friends }: { kind: Kind; friends: Friend[] }) {
  const meta = META[kind];
  const [withIds, setWithIds] = useState<string[]>([]);
  const [fix, setFix] = useState<Fix | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(kind === "PLACE");
  const [pending, start] = useTransition();

  /**
   * المكان يأتي من الجهاز لا من لوحة المفاتيح، فيُطلب الإذن فور فتح الشاشة.
   * الرفض ليس خطأً يُخفى: تُعرض الرسالة ويُعطَّل النشر، لأن لحظة مكان بلا
   * إحداثيات ليست لحظة مكان.
   */
  useEffect(() => {
    if (kind !== "PLACE") return;

    if (!("geolocation" in navigator)) {
      setLocating(false);
      setGeoError("جهازك لا يدعم تحديد الموقع.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFix({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocating(false);
      },
      (error) => {
        setLocating(false);
        setGeoError(
          error.code === error.PERMISSION_DENIED
            ? "لازم تسمح بالوصول لموقعك عشان تنشر مكاناً."
            : "تعذّر تحديد موقعك. جرّب مرة ثانية.",
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }, [kind]);

  const ready = kind !== "PLACE" || fix !== null;

  return (
    <form
      action={(data) => {
        if (kind === "PLACE") {
          if (!fix) return;
          data.set("lat", String(fix.lat));
          data.set("lng", String(fix.lng));
          start(() => void postPlace(data));
        } else {
          data.set("kind", kind);
          start(() => void postSimple(data));
        }
      }}
      className="flex min-h-dvh flex-col"
    >
      <ScreenHeader title={meta.title} back="/" />

      <div className="grow px-5 py-4">
        {kind === "PHOTO" ? (
          <div
            className="mb-4 flex items-center justify-center rounded-2xl border border-line"
            style={{
              height: 150,
              background: "linear-gradient(160deg,#ffb75e,#ff7a7a 55%,#7a3b52)",
            }}
          >
            <span className="rounded-full bg-black/35 px-3.5 py-2 text-[11.5px] text-ink">
              صورة تجريبية — الرفع الحقيقي لاحقاً
            </span>
          </div>
        ) : null}

        {kind === "PLACE" ? (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-line bg-card p-4">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "var(--color-live-soft)", color: "var(--color-live)" }}
            >
              <PinIcon size={20} />
            </span>
            <div className="grow">
              {locating ? (
                <p className="text-[13.5px] text-muted">نحدّد موقعك…</p>
              ) : fix ? (
                <>
                  <p className="text-[14px] font-semibold">تم تحديد موقعك</p>
                  <p className="mt-0.5 text-[11.5px] text-muted">
                    اسم المكان يُحدَّد تلقائياً عند النشر
                  </p>
                </>
              ) : (
                <p className="text-[13px] leading-relaxed" style={{ color: "var(--color-live)" }}>
                  {geoError}
                </p>
              )}
            </div>
          </div>
        ) : null}

        <textarea
          name="text"
          rows={4}
          required={kind === "THOUGHT"}
          maxLength={400}
          placeholder={meta.hint}
          className="w-full resize-none rounded-2xl border border-line bg-card px-4 py-3.5 text-[13.5px] leading-relaxed text-ink outline-none placeholder:text-faint focus:border-clay"
        />

        {friends.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2.5 flex items-center gap-2 text-[11.5px] font-semibold tracking-wide text-faint">
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
                    className="min-h-11 rounded-full border px-4 text-[13px] font-medium"
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
          </div>
        ) : null}
      </div>

      <div className="px-5 pb-8">
        <p className="mb-3 flex items-center justify-center gap-2 text-[11.5px] text-faint">
          <LockIcon size={14} />
          يشوفها دائرتك فقط
        </p>
        <button
          type="submit"
          disabled={!ready || pending}
          className="brand-gradient w-full rounded-xl text-[15.5px] font-bold disabled:opacity-45"
          style={{ height: 54, color: "var(--color-on-brand)" }}
        >
          {pending ? "ننشر…" : "انشر"}
        </button>
      </div>
    </form>
  );
}
