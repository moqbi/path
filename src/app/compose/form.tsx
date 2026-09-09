"use client";

import { useEffect, useState, useTransition } from "react";
import { postMusicLink, postPlace, postSimple } from "@/app/actions";
import { ImagePicker } from "@/components/image-picker";
import { ScreenHeader } from "@/components/ui";
import { CameraIcon, MusicIcon, PinIcon, TextIcon, WithIcon, LockIcon } from "@/components/icons";

type Kind = "PHOTO" | "THOUGHT" | "PLACE" | "MUSIC";
type Friend = { id: string; name: string };

const META: Record<Kind, { title: string; hint: string; Icon: typeof CameraIcon }> = {
  PHOTO: { title: "صورة", hint: "اكتب شي عن الصورة…", Icon: CameraIcon },
  THOUGHT: { title: "فكرة", hint: "وش في بالك؟", Icon: TextIcon },
  PLACE: { title: "مكان", hint: "اكتب شي عن المكان… (اختياري)", Icon: PinIcon },
  MUSIC: { title: "أغنية", hint: "", Icon: MusicIcon },
};

type Fix = { lat: number; lng: number };

export function ComposeForm({ kind, friends }: { kind: Kind; friends: Friend[] }) {
  const meta = META[kind];
  const [withIds, setWithIds] = useState<string[]>([]);
  const [fix, setFix] = useState<Fix | null>(null);
  const [picture, setPicture] = useState<{ dataUrl: string; width: number; height: number } | null>(null);
  const [musicUrl, setMusicUrl] = useState("");
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

  const ready =
    kind === "PLACE" ? fix !== null : kind === "MUSIC" ? musicUrl.trim().length > 8 : true;

  return (
    <form
      action={(data) => {
        if (kind === "MUSIC") {
          data.set("url", musicUrl.trim());
          start(() => void postMusicLink(data));
        } else if (kind === "PLACE") {
          if (!fix) return;
          data.set("lat", String(fix.lat));
          data.set("lng", String(fix.lng));
          start(() => void postPlace(data));
        } else {
          if (picture) {
            data.set("image", picture.dataUrl);
            data.set("imageWidth", String(picture.width));
            data.set("imageHeight", String(picture.height));
          }
          data.set("kind", kind);
          start(() => void postSimple(data));
        }
      }}
      className="screen"
    >
      <ScreenHeader title={meta.title} back="/" />

      <div className="scroll-area px-5 py-4">
        {kind === "PHOTO" ? (
          <div className="mb-4">
            <div
              className="mb-2.5 flex items-center justify-center overflow-hidden rounded-2xl border border-line"
              style={{
                height: 200,
                backgroundImage: picture ? `url(${picture.dataUrl})` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
                background: picture ? undefined : "var(--color-chip)",
              }}
            >
              {picture ? null : (
                <span className="text-[12.5px] text-muted">ما اخترت صورة بعد</span>
              )}
            </div>
            <ImagePicker
              label={picture ? "غيّر الصورة" : "اختر صورة"}
              maxSize={1600}
              onPicked={(dataUrl, width, height) => setPicture({ dataUrl, width, height })}
            />
          </div>
        ) : null}

        {kind === "MUSIC" ? (
          <div className="mb-4">
            <p className="mb-2.5 text-[13px] leading-relaxed text-muted">
              الصق رابط الأغنية من سبوتيفاي أو يوتيوب أو ساوندكلاود — يُقرأ اسمها تلقائياً،
              ومن يضغط عليها يسمعها.
            </p>
            <input
              name="url"
              type="url"
              dir="ltr"
              inputMode="url"
              value={musicUrl}
              onChange={(e) => setMusicUrl(e.target.value)}
              placeholder="https://open.spotify.com/track/..."
              className="w-full rounded-xl border border-line bg-card px-4 text-[13px] text-ink outline-none placeholder:text-faint focus:border-clay"
              style={{ height: 52 }}
            />
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

        {kind === "MUSIC" ? null : (
        <textarea
          name="text"
          rows={4}
          required={kind === "THOUGHT"}
          maxLength={400}
          placeholder={meta.hint}
          className="w-full resize-none rounded-2xl border border-line bg-card px-4 py-3.5 text-[13.5px] leading-relaxed text-ink outline-none placeholder:text-faint focus:border-clay"
        />
        )}

        {friends.length > 0 && kind !== "MUSIC" ? (
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
