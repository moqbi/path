"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  deleteNote,
  findSongs,
  myNoteViewers,
  playNote,
  postNote,
  reactNote,
  seeNote,
  songPreview,
} from "@/app/actions";
import { GlassSheet } from "@/components/glass-sheet";
import { StoryComposer } from "@/components/story-composer";
import { REACTION_SRC } from "@/components/reactions";
import { Avatar } from "@/components/ui";
import {
  CameraIcon,
  CheckIcon,
  EyeIcon,
  LockIcon,
  MusicIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  SearchIcon,
  TextIcon,
  TrashIcon,
} from "@/components/icons";
import type { StoryRing } from "@/lib/stories";
import { ar, relative } from "@/lib/format";

/** طولُ ما يُسمع من الأغنية، وطولُ المعاينة كلّها — كالخادم (القاعدة ٢٦٩). */
const NOTE_SECONDS = 20;
const PREVIEW_SECONDS = 30;
/** أقصرُ مقطعٍ يُقصّ — كـ`CLIP_MIN_SECONDS` في الخادم (القاعدة ٣٠٣). */
const CLIP_MIN = 3;
const TEXT_MAX = 60;
const FACES = ["SMILE", "LAUGH", "GASP", "SAD", "LOVE"] as const;

export type StripNote = {
  id: string;
  authorId: string;
  text: string | null;
  trackId: string | null;
  trackTitle: string | null;
  trackArtist: string | null;
  trackCover: string | null;
  createdAt: Date;
  groupName: string | null;
  seen: boolean;
  myReaction: string | null;
  author: { id: string; name: string; avatarMediaId: string | null };
};

type Me = { id: string; name: string; avatarMediaId: string | null };
type Group = { id: string; name: string };
type Track = { id: string; title: string; artist: string; cover: string | null; duration: number; source?: "deezer" | "apple" };

/**
 * شريطُ الدائرة: القصصُ والنوت في صفٍّ واحد — كتبويب الأصدقاء في الجوّال
 * (القاعدة ٢٦٩). صورتُك أوّلاً وفوقها نوتُك أو «نوت +»، وضغطُ صورتك يسأل:
 * قصةٌ أم نوت. ثمّ من عندهم قصّةٌ لم تُرَ، فالبقيّة، فمن عنده نوتٌ وحدها.
 */
export function CircleStrip({
  rings,
  notes,
  me,
  groups,
}: {
  rings: StoryRing[];
  notes: StripNote[];
  me: Me;
  groups: Group[];
}) {
  const [menu, setMenu] = useState(false);
  const [composing, setComposing] = useState(false);
  const [open, setOpen] = useState<StripNote | null>(null);

  const myRing = rings.find((ring) => ring.userId === me.id) ?? null;
  const myNote = notes.find((note) => note.authorId === me.id) ?? null;
  const noteOf = new Map(notes.map((note) => [note.authorId, note]));
  const others = rings.filter((ring) => ring.userId !== me.id);
  const ringIds = new Set(rings.map((ring) => ring.userId));
  const noteOnly = notes.filter((note) => note.authorId !== me.id && !ringIds.has(note.authorId));

  return (
    <>
      <div className="circle-strip no-bar">
        <div className="circle-strip-item">
          <button
            type="button"
            className="circle-bubble-slot"
            onClick={() => (myNote ? setOpen(myNote) : setComposing(true))}
            aria-label={myNote ? "نوتك" : "نوت جديدة"}
          >
            <Bubble note={myNote} empty={!myNote} />
          </button>
          <StoryComposer
            trigger={(pickStory) => (
              <>
                <button
                  type="button"
                  aria-label="قصة أو نوت"
                  onClick={() => setMenu(true)}
                  className="relative"
                >
                  <RingFace
                    name={me.name}
                    mediaId={me.avatarMediaId}
                    state={myRing ? (myRing.fresh ? "fresh" : "seen") : "none"}
                  />
                  <span className="circle-plus" aria-hidden="true">
                    <PlusIcon size={12} />
                  </span>
                </button>
                {menu ? (
                  <CreateMenu
                    hasStory={Boolean(myRing)}
                    meId={me.id}
                    onStory={() => {
                      setMenu(false);
                      pickStory();
                    }}
                    onNote={() => {
                      setMenu(false);
                      setComposing(true);
                    }}
                    onClose={() => setMenu(false)}
                  />
                ) : null}
              </>
            )}
          />
          <span className="circle-strip-name">قصتك</span>
        </div>

        {others.map((ring) => (
          <Person
            key={ring.userId}
            name={ring.name}
            mediaId={ring.avatarMediaId}
            href={`/stories/${ring.userId}`}
            state={ring.fresh ? "fresh" : "seen"}
            locked={ring.private}
            note={noteOf.get(ring.userId) ?? null}
            onNote={setOpen}
          />
        ))}
        {noteOnly.map((note) => (
          <Person
            key={note.authorId}
            name={note.author.name}
            mediaId={note.author.avatarMediaId}
            href={null}
            state="none"
            note={note}
            onNote={setOpen}
          />
        ))}
      </div>

      {open ? (
        <NoteSheet
          note={open}
          mine={open.authorId === me.id}
          onClose={() => setOpen(null)}
          onReplace={() => {
            setOpen(null);
            setComposing(true);
          }}
        />
      ) : null}
      {composing ? <NoteComposer groups={groups} onClose={() => setComposing(false)} /> : null}
    </>
  );
}

function Person({
  name,
  mediaId,
  href,
  state,
  locked = false,
  note,
  onNote,
}: {
  name: string;
  mediaId: string | null;
  href: string | null;
  state: "fresh" | "seen" | "none";
  locked?: boolean;
  note: StripNote | null;
  onNote: (note: StripNote) => void;
}) {
  const face = (
    <span className="relative block">
      <RingFace name={name} mediaId={mediaId} state={state} />
      {locked ? (
        <span aria-label="قصة خاصة" className="circle-lock">
          <LockIcon size={10} />
        </span>
      ) : null}
    </span>
  );
  return (
    <div className="circle-strip-item">
      <span className="circle-bubble-slot">
        {note ? (
          <button type="button" onClick={() => onNote(note)} aria-label={`نوت ${name}`}>
            <Bubble note={note} />
          </button>
        ) : null}
      </span>
      {href ? (
        <Link href={href} aria-label={`قصة ${name}`}>
          {face}
        </Link>
      ) : note ? (
        <button type="button" onClick={() => onNote(note)} aria-label={`نوت ${name}`}>
          {face}
        </button>
      ) : (
        face
      )}
      <span dir="auto" className="circle-strip-name">
        {name}
      </span>
    </div>
  );
}

/** الحلقة: ملوّنةٌ لما لم يُرَ، رماديّةٌ لما رُئي، ولا حلقةَ بلا قصّة. */
function RingFace({ name, mediaId, state }: { name: string; mediaId: string | null; state: "fresh" | "seen" | "none" }) {
  return (
    <span
      className="flex h-[60px] w-[60px] items-center justify-center rounded-full"
      style={{
        padding: 2.5,
        background:
          state === "fresh"
            ? "linear-gradient(140deg,#f6b93b,#ff7a5a)"
            : state === "seen"
              ? "var(--color-line)"
              : "transparent",
      }}
    >
      <span className="flex h-full w-full items-center justify-center rounded-full" style={{ background: "var(--color-card)", padding: 2 }}>
        <Avatar name={name} size={state === "none" ? 55 : 50} mediaId={mediaId} />
      </span>
    </span>
  );
}

/** فقاعةُ النوت فوق الصورة — سطرُ الأغنية ثمّ العبارة، وذيلٌ ينزل إلى الصورة. */
function Bubble({ note, empty = false, large = false }: { note: StripNote | null; empty?: boolean; large?: boolean }) {
  return (
    <span className={large ? "note-bubble note-bubble-large" : "note-bubble"}>
      <span className="note-bubble-body">
        {empty || !note ? (
          <span className="flex items-center gap-1 text-muted">
            <PlusIcon size={10} />
            نوت
          </span>
        ) : (
          <>
            {note.trackTitle ? (
              <span className="flex min-w-0 max-w-full items-center gap-1 font-bold">
                <MusicIcon size={large ? 13 : 10} className="shrink-0 text-clay-ink" />
                <span dir="auto" className="truncate">
                  {note.trackTitle}
                </span>
              </span>
            ) : null}
            {note.trackTitle && note.trackArtist && (large || !note.text) ? (
              <span dir="auto" className="block max-w-full truncate text-muted" style={{ fontSize: large ? 12 : 9 }}>
                {note.trackArtist}
              </span>
            ) : null}
            {note.text ? (
              <span dir="auto" className={large ? "note-bubble-text" : note.trackTitle ? "line-clamp-1" : "line-clamp-2"}>
                {note.text}
              </span>
            ) : null}
          </>
        )}
      </span>
      <span className="note-bubble-tail" aria-hidden="true" />
    </span>
  );
}

/** قصةٌ أم نوت — نافذةٌ زجاجيّة بخيارين (القاعدة ٢٦٩). */
function CreateMenu({
  hasStory,
  meId,
  onStory,
  onNote,
  onClose,
}: {
  hasStory: boolean;
  meId: string;
  onStory: () => void;
  onNote: () => void;
  onClose: () => void;
}) {
  return (
    <GlassSheet title="ماذا تشارك؟" onClose={onClose}>
      <div className="grid grid-cols-2 gap-2.5 px-[18px] pb-5">
        <button type="button" onClick={onStory} className="glass-choice">
          <CameraIcon size={24} />
          <span className="text-[14px] font-bold">قصة</span>
          <span className="text-[11.5px] opacity-70">صورة أو فيديو ليوم</span>
        </button>
        <button type="button" onClick={onNote} className="glass-choice">
          <TextIcon size={24} />
          <span className="text-[14px] font-bold">نوت</span>
          <span className="text-[11.5px] opacity-70">سطرٌ أو أغنية فوق صورتك</span>
        </button>
      </div>
      {hasStory ? (
        <Link href={`/stories/${meId}`} onClick={onClose} className="mx-[18px] mb-5 block text-center text-[13px] font-semibold" style={{ color: "#F6B93B" }}>
          شاهد قصتك
        </Link>
      ) : null}
    </GlassSheet>
  );
}

/** مشغّلُ المقطع: من بدايته إلى عشرين ثانيةً بعدها، ثمّ يقف. */
function useClip() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const span = useRef({ start: 0, seconds: NOTE_SECONDS });

  useEffect(() => {
    return () => {
      audio.current?.pause();
      audio.current = null;
    };
  }, []);

  function stop() {
    audio.current?.pause();
    setPlaying(false);
    setProgress(0);
  }

  function play(url: string, start: number, seconds = NOTE_SECONDS) {
    stop();
    const el = audio.current ?? new Audio();
    audio.current = el;
    span.current = { start, seconds };
    el.src = url;
    el.ontimeupdate = () => {
      const done = (el.currentTime - span.current.start) / span.current.seconds;
      setProgress(Math.max(0, Math.min(1, done)));
      if (done >= 1) stop();
    };
    el.onended = stop;
    el.onloadedmetadata = () => {
      el.currentTime = start;
    };
    el.currentTime = start;
    void el.play().then(
      () => setPlaying(true),
      () => setPlaying(false),
    );
  }

  return { playing, progress, play, stop };
}

function NoteSheet({
  note,
  mine,
  onClose,
  onReplace,
}: {
  note: StripNote;
  mine: boolean;
  onClose: () => void;
  onReplace: () => void;
}) {
  const clip = useClip();
  const [reaction, setReaction] = useState<string | null>(note.myReaction);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewers, setViewers] = useState<Awaited<ReturnType<typeof myNoteViewers>>["rows"] | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (mine) void myNoteViewers(note.id).then((said) => setViewers(said.rows));
    else void seeNote(note.id);
  }, [mine, note.id]);

  async function toggle() {
    if (clip.playing) return clip.stop();
    setLoading(true);
    setError(null);
    const said = await playNote(note.id);
    setLoading(false);
    if (!said.url) return setError(said.error ?? "تعذّر التشغيل");
    clip.play(said.url, said.start ?? 0, said.seconds ?? NOTE_SECONDS);
    if (!mine) void seeNote(note.id, true);
  }

  function pick(kind: string) {
    const next = reaction === kind ? null : kind;
    setReaction(next);
    void reactNote(note.id, next).then((said) => said.error && setError(said.error));
  }

  return (
    <GlassSheet
      title={mine ? "نوتك" : note.author.name}
      subtitle={`${relative(note.createdAt)}${mine && note.groupName ? ` · لتصنيف ${note.groupName}` : mine ? " · للدائرة كلها" : ""}`}
      onClose={onClose}
    >
      <div className="flex flex-col items-center gap-4 px-[18px] pb-5">
        <div className="flex flex-col items-center">
          <Bubble note={note} large />
          <Avatar name={note.author.name} size={64} mediaId={note.author.avatarMediaId} />
        </div>

        {note.trackId ? (
          <div className="glass-row w-full">
            {note.trackCover ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={note.trackCover} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg" style={{ background: "rgba(255,255,255,.12)" }}>
                <MusicIcon size={18} />
              </span>
            )}
            <span className="min-w-0 grow">
              <span dir="auto" className="block truncate text-[13.5px] font-bold">{note.trackTitle}</span>
              <span dir="auto" className="block truncate text-[11.5px] opacity-70">{note.trackArtist}</span>
              <span className="mt-1.5 block h-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,.18)" }}>
                <span className="block h-full rounded-full" style={{ width: `${clip.progress * 100}%`, background: "#F6B93B" }} />
              </span>
            </span>
            <button
              type="button"
              onClick={() => void toggle()}
              disabled={loading}
              aria-label={clip.playing ? "إيقاف" : "تشغيل"}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-60"
              style={{ background: "#F6B93B", color: "#14212b" }}
            >
              {clip.playing ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
            </button>
          </div>
        ) : null}

        {!mine ? (
          <div className="flex justify-center gap-2">
            {FACES.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => pick(kind)}
                aria-pressed={reaction === kind}
                className="flex h-12 w-12 items-center justify-center rounded-full transition-transform"
                style={{
                  background: reaction === kind ? "rgba(246,185,59,.28)" : "rgba(255,255,255,.08)",
                  transform: reaction === kind ? "scale(1.1)" : undefined,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={REACTION_SRC[kind]} alt={kind} width={36} height={36} />
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="w-full">
              <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold opacity-70">
                <EyeIcon size={14} />
                {viewers === null ? "…" : viewers.length ? `شاهدها ${ar(viewers.length)}` : "ما شاهدها أحد بعد"}
              </p>
              <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                {(viewers ?? []).map((row) => (
                  <div key={row.id} className="flex items-center gap-2.5 py-1">
                    <Avatar name={row.name} size={34} mediaId={row.avatarMediaId} frame={row.frame} />
                    <span dir="auto" className="min-w-0 grow truncate text-[13px] font-semibold">{row.name}</span>
                    {row.listened ? <MusicIcon size={13} className="opacity-60" /> : null}
                    {row.reaction && REACTION_SRC[row.reaction] ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={REACTION_SRC[row.reaction]} alt="" width={22} height={22} />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
            <div className="grid w-full grid-cols-2 gap-2">
              <button type="button" onClick={onReplace} className="glass-btn">
                نوت جديدة
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await deleteNote();
                    onClose();
                  })
                }
                className="glass-btn"
                style={{ color: "#ff9c85" }}
              >
                <TrashIcon size={15} />
                احذفها
              </button>
            </div>
          </>
        )}
        {error ? (
          <p role="alert" className="text-[12px]" style={{ color: "#ff9c85" }}>
            {error}
          </p>
        ) : null}
      </div>
    </GlassSheet>
  );
}

function NoteComposer({ groups, onClose }: { groups: Group[]; onClose: () => void }) {
  const clip = useClip();
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [track, setTrack] = useState<Track | null>(null);
  // البدايةُ والنهايةُ بحرّيّة صاحبها، لا نافذةُ عشرين (القاعدة ٣٠٣).
  const [startAt, setStartAt] = useState(0);
  const [endAt, setEndAt] = useState(PREVIEW_SECONDS);
  // كاملةً افتراضاً، ومن أراد قصّ سحب طرفي الشريط — بلا زرٍّ يختار بينهما (القاعدة ٣٠٥).
  const full = startAt === 0 && endAt === PREVIEW_SECONDS;
  const [groupId, setGroupId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  // القصُّ بعد اختيار الأغنية مباشرةً، لا في شاشة النشر (القاعدة ٣٠٥).
  const [trimming, setTrimming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // القائمةُ الأولى عربيّةٌ رائجة، والبحثُ بعد أن يتوقّف الكاتب لحظة.
  useEffect(() => {
    if (!picking) return;
    const timer = setTimeout(() => {
      void findSongs(query).then((said) => {
        setTracks(said.tracks);
        if (said.error) setError(said.error);
      });
    }, query ? 400 : 0);
    return () => clearTimeout(timer);
  }, [picking, query]);

  async function listen(from = startAt, to = endAt) {
    if (!track) return;
    const said = await songPreview(track.id);
    if (!said.url) return setError(said.error ?? "تعذّر التشغيل");
    clip.play(said.url, from, to - from);
  }

  function publish() {
    setError(null);
    start(async () => {
      clip.stop();
      const said = await postNote({ text, trackId: track?.id ?? null, trackStart: full ? 0 : startAt, trackSeconds: full ? PREVIEW_SECONDS : endAt - startAt, trackFull: full, groupId });
      if (said.error) setError(said.error);
      else onClose();
    });
  }

  const ready = Boolean(text.trim() || track);

  return (
    <GlassSheet title="نوت جديدة" subtitle="تبقى يوماً ثمّ تذهب" onClose={onClose} keep={ready}>
      <div className="flex flex-col gap-3.5 px-[18px] pb-5">
        <label className="block">
          <span className="glass-field flex items-center gap-2">
            <input
              value={text}
              maxLength={TEXT_MAX}
              onChange={(event) => setText(event.target.value)}
              placeholder="بماذا تفكّر؟"
              dir="auto"
              className="min-w-0 grow bg-transparent text-[15px] outline-none placeholder:text-white/50"
            />
            <span className="shrink-0 text-[11px] tabular-nums opacity-60">{ar(TEXT_MAX - text.length)}</span>
          </span>
        </label>

        {track ? (
          <div className="glass-row">
            {track.cover ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={track.cover} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
            ) : null}
            <span className="min-w-0 grow">
              <span dir="auto" className="block truncate text-[13.5px] font-bold">{track.title}</span>
              <span dir="auto" className="block truncate text-[11.5px] opacity-70">{track.artist}</span>
              {trimming ? null : (
                <span className="block text-[11px]" style={{ color: "#F6B93B" }}>
                  {full ? "الأغنية كاملة" : `مقطع ${ar(endAt - startAt)} ثانية`}
                </span>
              )}
            </span>
            <button
              type="button"
              aria-label={clip.playing ? "إيقاف" : "اسمع المقطع"}
              onClick={() => (clip.playing ? clip.stop() : void listen())}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{ background: "#F6B93B", color: "#14212b" }}
            >
              {clip.playing ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
            </button>
            <button
              type="button"
              onClick={() => {
                clip.stop();
                setTrack(null);
                setTrimming(false);
              }}
              className="shrink-0 text-[12px] font-semibold opacity-70"
            >
              إزالة
            </button>
          </div>
        ) : null}

        {track && trimming ? (
          <div>
            <span className="mb-1.5 flex justify-between text-[11.5px] opacity-70">
              <span>
                {full ? "الأغنية كاملة — اسحب الطرفين لتقصّ منها" : `المقطع: من الثانية ${ar(startAt)} إلى ${ar(endAt)} — ${ar(endAt - startAt)} ثانية`}
              </span>
              {full ? null : (
                <button
                  type="button"
                  onClick={() => {
                    setStartAt(0);
                    setEndAt(PREVIEW_SECONDS);
                    void listen(0, PREVIEW_SECONDS);
                  }}
                  className="font-extrabold"
                  style={{ color: "#F6B93B" }}
                >
                  كاملة
                </button>
              )}
            </span>
            {/* مقبضان على شريطٍ واحد: البدايةُ والنهايةُ، وبينهما ثلاثُ ثوانٍ على الأقلّ. */}
            <div className="dual-range" dir="ltr">
              <span
                className="dual-range-fill"
                style={{ left: `${(startAt / PREVIEW_SECONDS) * 100}%`, right: `${100 - (endAt / PREVIEW_SECONDS) * 100}%` }}
              />
              <input
                type="range"
                aria-label="البداية"
                min={0}
                max={PREVIEW_SECONDS}
                value={startAt}
                onChange={(event) => setStartAt(Math.min(Number(event.target.value), endAt - CLIP_MIN))}
                onPointerUp={() => void listen()}
              />
              <input
                type="range"
                aria-label="النهاية"
                min={0}
                max={PREVIEW_SECONDS}
                value={endAt}
                onChange={(event) => setEndAt(Math.max(Number(event.target.value), startAt + CLIP_MIN))}
                onPointerUp={() => void listen(Math.max(startAt, endAt - 3), endAt)}
              />
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  clip.stop();
                  setTrack(null);
                  setTrimming(false);
                  setPicking(true);
                }}
                className="glass-btn grow"
              >
                أغنية أخرى
              </button>
              <button
                type="button"
                onClick={() => {
                  clip.stop();
                  setTrimming(false);
                }}
                className="grow rounded-xl text-[13.5px] font-extrabold"
                style={{ background: "#F6B93B", color: "#14212b", height: 44 }}
              >
                تمّ
              </button>
            </div>
          </div>
        ) : track ? null : picking ? (
          <div>
            <span className="glass-field mb-2 flex items-center gap-2">
              <SearchIcon size={16} className="opacity-60" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ابحث عن أغنية أو فنان"
                dir="auto"
                autoFocus
                className="min-w-0 grow bg-transparent text-[14px] outline-none placeholder:text-white/50"
              />
            </span>
            <div className="flex max-h-60 flex-col overflow-y-auto">
              {tracks === null ? (
                <p className="py-6 text-center text-[12px] opacity-60">…</p>
              ) : tracks.length === 0 ? (
                <p className="py-6 text-center text-[12px] opacity-60">ما وجدنا شيئاً بهذا الاسم.</p>
              ) : (
                tracks.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => {
                      setTrack(row);
                      setStartAt(0);
                      setEndAt(PREVIEW_SECONDS);
                      setPicking(false);
                      setTrimming(true);
                    }}
                    className="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-start hover:bg-white/10"
                  >
                    {row.cover ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={row.cover} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
                    ) : null}
                    <span className="min-w-0 grow">
                      <span dir="auto" className="block truncate text-[13px] font-semibold">{row.title}</span>
                      <span dir="auto" className="block truncate text-[11px] opacity-65">{row.artist}</span>
                    </span>
                    {/* شرطُ آبل لما يُعرض من كتالوجها: اسمُها بجانب الأغنية (القاعدة ٣٠٤). */}
                    {row.source === "apple" ? <AppleMusicTag /> : null}
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setPicking(true)} className="glass-btn">
            <MusicIcon size={16} />
            أضف أغنية
          </button>
        )}

        <div>
          <p className="mb-1.5 text-[11.5px] font-semibold opacity-70">من يراها</p>
          <div className="no-bar flex gap-2 overflow-x-auto">
            {[{ id: "", name: "الدائرة كلها" }, ...groups].map((option) => {
              const on = (groupId ?? "") === option.id;
              return (
                <button
                  key={option.id || "all"}
                  type="button"
                  onClick={() => setGroupId(option.id || null)}
                  className="flex shrink-0 items-center gap-1 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold"
                  style={{
                    background: on ? "#F6B93B" : "rgba(255,255,255,.1)",
                    color: on ? "#14212b" : "#fff",
                  }}
                >
                  {on ? <CheckIcon size={12} /> : null}
                  {option.name}
                </button>
              );
            })}
          </div>
        </div>

        {error ? (
          <p role="alert" className="text-center text-[12px]" style={{ color: "#ff9c85" }}>
            {error}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!ready || pending || trimming}
          onClick={publish}
          className="brand-gradient rounded-xl text-[15px] font-bold disabled:opacity-40"
          style={{ height: 50, color: "var(--color-on-brand)" }}
        >
          {pending ? "ننشر…" : "انشر النوت"}
        </button>
      </div>
    </GlassSheet>
  );
}

function AppleMusicTag() {
  return (
    <span className="latin shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(255,255,255,.14)" }}>
      Apple Music
    </span>
  );
}
