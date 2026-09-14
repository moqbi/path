"use client";

import { useEffect, useState, useTransition } from "react";
import { postMusicLink, postPlace, postSimple } from "@/app/actions";
import { ImagePicker } from "@/components/image-picker";
import { Avatar, ScreenHeader } from "@/components/ui";
import {
  CheckIcon,
  CloseIcon,
  LockIcon,
  PinIcon,
  SearchIcon,
  WithIcon,
} from "@/components/icons";
import { ar } from "@/lib/format";

type Kind = "PHOTO" | "THOUGHT" | "PLACE" | "MUSIC";

/** مكانٌ حول المستخدم، كما تردّه `/api/places`. */
type Spot = { id: string; name: string; kind: string | null; meters: number };
type Friend = { id: string; name: string; avatarMediaId: string | null };
type Group = { id: string; name: string; count: number };

/** حدّ نصّ اللحظة: ما زاد عن هذا يصير مقالاً لا لحظة. */
const TEXT_MAX = 250;

const HINT: Record<Kind, string> = {
  PHOTO: "اكتب شي عن الصورة…",
  THOUGHT: "وش في بالك؟",
  PLACE: "اكتب شي عن المكان… (اختياري)",
  MUSIC: "",
};

type Fix = { lat: number; lng: number };

export function ComposeForm({
  kind,
  friends,
  groups,
  defaultGroupId,
}: {
  kind: Kind;
  friends: Friend[];
  groups: Group[];
  /** تصنيف الخصوصية الافتراضي — «من يمكنه رؤية لحظاتي». */
  defaultGroupId: string | null;
}) {
  const [withIds, setWithIds] = useState<string[]>([]);
  // الجمهور: «CIRCLE»، أو معرّف تصنيف، أو «PICKED» ومعها المختارون.
  const [audience, setAudience] = useState<string>(defaultGroupId ?? "CIRCLE");
  const [viewers, setViewers] = useState<string[]>([]);
  // أيّ قائمةِ أشخاصٍ مفتوحة الآن — الاختيار في نافذة لا في جدارِ أزرار.
  const [sheet, setSheet] = useState<"with" | "viewers" | null>(null);
  const [wantPlace, setWantPlace] = useState(kind === "PLACE");
  const [fix, setFix] = useState<Fix | null>(null);
  const [picture, setPicture] = useState<{ dataUrl: string; width: number; height: number } | null>(null);
  const [musicUrl, setMusicUrl] = useState("");
  const [text, setText] = useState("");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(kind === "PLACE");
  const [spots, setSpots] = useState<Spot[] | null>(null);
  const [spot, setSpot] = useState<string | null>(null);
  const [pending, start] = useTransition();

  /**
   * المكان يأتي من الجهاز لا من لوحة المفاتيح.
   *
   * في لحظة المكان يُطلب الإذن فور فتح الشاشة — لحظةُ مكانٍ بلا إحداثيات
   * ليست لحظة مكان. وفي غيرها لا يُطلب إلا إذا ضغط صاحبها زرّ الموقع:
   * إذنٌ يُطلب بلا سبب يُرفض بلا تفكير.
   */
  useEffect(() => {
    if (!wantPlace || fix) return;

    if (!("geolocation" in navigator)) {
      setLocating(false);
      setGeoError("جهازك لا يدعم تحديد الموقع.");
      return;
    }

    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const here = { lat: position.coords.latitude, lng: position.coords.longitude };
        setFix(here);
        setLocating(false);
        // الأماكن حولك تُجلب بعد الإحداثيات: تختار أين أنت بالضبط.
        fetch(`/api/places?lat=${here.lat}&lng=${here.lng}`)
          .then((response) => (response.ok ? response.json() : { places: [] }))
          .then((data: { places: Spot[] }) => setSpots(data.places ?? []))
          .catch(() => setSpots([]));
      },
      (error) => {
        setLocating(false);
        setGeoError(
          error.code === error.PERMISSION_DENIED
            ? "لازم تسمح بالوصول لموقعك عشان تضيف مكاناً."
            : "تعذّر تحديد موقعك. جرّب مرة ثانية.",
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }, [wantPlace, fix]);

  const ready =
    (kind === "PLACE" ? fix !== null : kind === "MUSIC" ? musicUrl.trim().length > 8 : true) &&
    (audience !== "PICKED" || viewers.length > 0);

  const nameOf = (id: string) => friends.find((friend) => friend.id === id)?.name ?? "";
  /** «مع فلان»، «مع فلان و٢ آخرين» — لا جدار أسماء. */
  const summary = (ids: string[], empty: string) =>
    ids.length === 0
      ? empty
      : ids.length === 1
        ? nameOf(ids[0])
        : `${nameOf(ids[0])} و${ar(ids.length - 1)} آخرين`;

  const placeLine = spots?.find((item) => item.id === spot)?.name ?? null;

  return (
    <form
      action={(data) => {
        if (kind === "MUSIC") {
          data.set("url", musicUrl.trim());
          start(() => void postMusicLink(data));
          return;
        }

        // الموقع يُرسل في كل الأنواع حين يُختار: اللحظة والصورة كالمكان.
        if (fix) {
          data.set("lat", String(fix.lat));
          data.set("lng", String(fix.lng));
          const chosen = spots?.find((item) => item.id === spot);
          if (chosen) data.set("place", chosen.name);
        }

        if (kind === "PLACE") {
          if (!fix) return;
          start(() => void postPlace(data));
          return;
        }

        if (picture) {
          data.set("image", picture.dataUrl);
          data.set("imageWidth", String(picture.width));
          data.set("imageHeight", String(picture.height));
        }
        data.set("kind", kind);
        start(() => void postSimple(data));
      }}
      className="screen"
    >
      {/* الرأس كبقية الشاشات: العلامة ثم فاصل ثم «لحظة» — لا اسم نوعٍ عارٍ. */}
      <ScreenHeader title="لحظة" back="/" mark />

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

        {kind === "MUSIC" ? null : (
          <>
            <textarea
              name="text"
              rows={4}
              required={kind === "THOUGHT"}
              maxLength={TEXT_MAX}
              value={text}
              onChange={(event) => setText(event.target.value.slice(0, TEXT_MAX))}
              placeholder={HINT[kind]}
              className="w-full resize-none rounded-2xl border border-line bg-card px-4 py-3.5 text-[13.5px] leading-relaxed text-ink outline-none placeholder:text-faint focus:border-clay"
            />
            {/* العدّاد يظهر حين يقترب الحدّ: قبل ذلك رقمٌ لا يفيد. */}
            <p
              className="mt-1.5 text-left text-[11px]"
              style={{
                color:
                  text.length >= TEXT_MAX
                    ? "var(--color-live)"
                    : text.length > TEXT_MAX - 50
                      ? "var(--color-muted)"
                      : "transparent",
              }}
            >
              {ar(text.length)} / {ar(TEXT_MAX)}
            </p>
          </>
        )}

        {/*
          الموقع: إجباريٌّ في لحظة المكان، واختياريٌّ في اللحظة والصورة —
          زرٌّ يُضغط فيُطلب الإذن، ثم تُعرض الأماكن حولك لتختار أيّها أنت فيه.
        */}
        {kind === "MUSIC" ? null : !wantPlace ? (
          <button
            type="button"
            onClick={() => setWantPlace(true)}
            className="mt-4 flex min-h-11 items-center gap-2 rounded-full border border-line bg-card px-4 text-[13px] font-semibold text-ink-2"
          >
            <PinIcon size={15} />
            أضف موقعك
          </button>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-card">
            <div className="flex items-center gap-3 p-4">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "var(--color-live-soft)", color: "var(--color-live)" }}
              >
                <PinIcon size={20} />
              </span>
              <div className="min-w-0 grow">
                {locating ? (
                  <p className="text-[13.5px] text-muted">نحدّد موقعك…</p>
                ) : fix ? (
                  <>
                    <p className="text-[14px] font-semibold">
                      {placeLine ?? "وين أنت بالضبط؟"}
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-muted">
                      {spots === null
                        ? "نبحث عن الأماكن حولك…"
                        : spots.length === 0
                          ? "ما لقينا أماكن مسمّاة حولك — يُكتب أقرب عنوان."
                          : "اختر مكانك من حولك، أو اتركه لأقرب عنوان."}
                    </p>
                  </>
                ) : (
                  <p className="text-[13px] leading-relaxed" style={{ color: "var(--color-live)" }}>
                    {geoError}
                  </p>
                )}
              </div>
              {kind === "PLACE" ? null : (
                <button
                  type="button"
                  aria-label="احذف الموقع"
                  onClick={() => {
                    setWantPlace(false);
                    setFix(null);
                    setSpots(null);
                    setSpot(null);
                    setGeoError(null);
                    setLocating(false);
                  }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-muted"
                >
                  <CloseIcon size={15} />
                </button>
              )}
            </div>

            {spots && spots.length > 0 ? (
              <div className="max-h-[232px] overflow-y-auto border-t border-line">
                {spots.map((item) => {
                  const on = spot === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSpot(on ? null : item.id)}
                      className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-right last:border-b-0"
                      style={{ background: on ? "var(--color-clay-soft)" : "transparent" }}
                    >
                      <span className="min-w-0 grow">
                        <span dir="auto" className="block truncate text-[13.5px] font-semibold">
                          {item.name}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted">
                          {item.kind ? `${item.kind} · ` : ""}
                          {ar(item.meters)} متر
                        </span>
                      </span>
                      {on ? (
                        <span className="shrink-0 text-clay">
                          <CheckIcon size={17} />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        )}

        {/*
          «مع مين؟» زرٌّ يفتح القائمة، لا جدارُ أسماء: عند ١٥٠ صديقاً كان
          الجدار يبتلع الشاشة قبل أن يصل صاحبها إلى زرّ النشر.
        */}
        {friends.length > 0 && kind !== "MUSIC" ? (
          <div className="mt-5">
            <p className="mb-2.5 flex items-center gap-2 text-[11.5px] font-semibold tracking-wide text-faint">
              <WithIcon size={14} /> مع مين؟
            </p>
            <PickerButton
              label={summary(withIds, "اختر من أصدقائك")}
              count={withIds.length}
              onOpen={() => setSheet("with")}
            />
            {withIds.map((id) => (
              <input key={id} type="hidden" name="with" value={id} />
            ))}
          </div>
        ) : null}

        {/*
          من يراها: كل أصدقائك، أو تصنيف منهم، أو أشخاص بأعيانهم.
          الاختيار هنا يسبق النشر لأن الخصوصية لا تُصلَّح بعده.
        */}
        <div className="mt-5">
          <p className="mb-2.5 flex items-center gap-2 text-[11.5px] font-semibold tracking-wide text-faint">
            <LockIcon size={14} /> مين يشوفها؟
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { id: "CIRCLE", label: "كل أصدقائي" },
              ...groups.map((group) => ({ id: group.id, label: group.name })),
              { id: "PICKED", label: "أشخاص أختارهم" },
            ].map((option) => {
              const on = audience === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setAudience(option.id);
                    if (option.id === "PICKED") setSheet("viewers");
                  }}
                  className="min-h-11 rounded-full border px-4 text-[13px] font-medium"
                  style={{
                    background: on ? "var(--color-clay-soft)" : "var(--color-card)",
                    borderColor: on ? "var(--color-clay)" : "var(--color-line)",
                    color: on ? "var(--color-clay)" : "var(--color-ink)",
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          {audience === "PICKED" ? (
            <div className="mt-3">
              <PickerButton
                label={summary(viewers, "اختر من يراها")}
                count={viewers.length}
                onOpen={() => setSheet("viewers")}
              />
            </div>
          ) : null}

          <input type="hidden" name="audience" value={audience} />
          {audience === "PICKED"
            ? viewers.map((id) => <input key={id} type="hidden" name="viewer" value={id} />)
            : null}
        </div>
      </div>

      <div className="px-5 pb-8">
        <p className="mb-3 flex items-center justify-center gap-2 text-[11.5px] text-faint">
          <LockIcon size={14} />
          {audience === "CIRCLE"
            ? "يشوفها أصدقاؤك فقط"
            : audience === "PICKED"
              ? `يشوفها ${viewers.length ? `${ar(viewers.length)} اخترتهم` : "من تختارهم"}`
              : `يشوفها تصنيف ${groups.find((group) => group.id === audience)?.name ?? ""}`}
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

      {sheet ? (
        <PeopleSheet
          title={sheet === "with" ? "مع مين؟" : "مين يشوفها؟"}
          friends={friends}
          picked={sheet === "with" ? withIds : viewers}
          onToggle={(id) =>
            sheet === "with"
              ? setWithIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
              : setViewers((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
          }
          onClose={() => setSheet(null)}
        />
      ) : null}
    </form>
  );
}

/** زرُّ فتح القائمة: يقول من اخترت وكم، فلا يُفتح ليُتذكَّر. */
function PickerButton({
  label,
  count,
  onOpen,
}: {
  label: string;
  count: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-2 rounded-xl border border-line bg-card px-4 text-right text-[13.5px]"
      style={{ minHeight: 48, color: count ? "var(--color-ink)" : "var(--color-faint)" }}
    >
      <span className="min-w-0 grow truncate" dir="auto">
        {label}
      </span>
      {count > 0 ? (
        <span
          className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold"
          style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
        >
          {ar(count)}
        </span>
      ) : null}
      <span className="shrink-0 text-faint">
        <WithIcon size={16} />
      </span>
    </button>
  );
}

/**
 * قائمة الأشخاص في نافذةٍ من الأسفل، ببحثٍ باسم الصديق.
 * مئةٌ وخمسون اسماً لا تُعرض دفعةً واحدة في صفحة النشر.
 */
function PeopleSheet({
  title,
  friends,
  picked,
  onToggle,
  onClose,
}: {
  title: string;
  friends: Friend[];
  picked: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  const [term, setTerm] = useState("");
  const shown = term.trim()
    ? friends.filter((friend) => friend.name.includes(term.trim()))
    : friends;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: "rgba(14,26,36,.42)" }}>
      <button type="button" aria-label="إغلاق" onClick={onClose} className="grow" />
      <div
        className="flex flex-col rounded-t-3xl bg-paper"
        style={{ maxHeight: "78%", borderTop: "1px solid var(--color-line)" }}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <p className="text-[15px] font-bold">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 text-[13px] font-bold"
            style={{ height: 36, background: "var(--color-clay)", color: "var(--color-on-brand)" }}
          >
            تم
          </button>
        </div>

        <div className="px-5 pb-3">
          <div
            className="flex items-center gap-2 rounded-xl px-3"
            style={{ background: "var(--color-chip)", height: 42 }}
          >
            <span className="text-faint">
              <SearchIcon size={16} />
            </span>
            <input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="ابحث باسم صاحبك"
              aria-label="ابحث"
              className="min-w-0 grow bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
            />
          </div>
        </div>

        <div className="min-h-0 grow overflow-y-auto px-5 pb-8">
          {shown.length === 0 ? (
            <p className="py-8 text-center text-[12.5px] text-muted">ما فيه أحد بهذا الاسم.</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line bg-card">
              {shown.map((friend, index) => {
                const on = picked.includes(friend.id);
                return (
                  <button
                    key={friend.id}
                    type="button"
                    onClick={() => onToggle(friend.id)}
                    className="flex w-full items-center gap-3 p-3 text-right"
                    style={{ borderTop: index === 0 ? "none" : "1px solid var(--color-line)" }}
                  >
                    <Avatar name={friend.name} size={38} mediaId={friend.avatarMediaId} />
                    <span dir="auto" className="min-w-0 grow truncate text-[14px] font-semibold">
                      {friend.name}
                    </span>
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                      style={{
                        background: on ? "var(--color-clay)" : "transparent",
                        border: on ? "none" : "1px solid var(--color-line)",
                        color: "var(--color-on-brand)",
                      }}
                    >
                      {on ? <CheckIcon size={14} /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
