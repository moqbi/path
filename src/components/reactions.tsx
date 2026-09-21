"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { deleteMoment, react, removeMomentAsAdmin } from "@/app/actions";
import { LockIcon } from "@/components/icons";
import Link from "next/link";
import { Avatar } from "@/components/ui";
import { ar } from "@/lib/format";
import { CUSTOM, EMOJI_GROUPS } from "@/lib/emoji";
import { asset } from "@/lib/base";

/**
 * ملفات التفاعلات في `public/reactions`. استبدال أيٍّ منها يغيّر شكله في
 * التطبيق كله بلا لمس الكود — ولذلك المفتاح هو الاسم لا رسم بداخل مكوّن.
 */
export const REACTION_SRC: Record<string, string> = {
  SMILE: asset("/reactions/smile.png"),
  LAUGH: asset("/reactions/laugh.png"),
  GASP: asset("/reactions/gasp.png"),
  SAD: asset("/reactions/sad.png"),
  LOVE: asset("/reactions/love.png"),
  SLEEPY: asset("/reactions/sleepy.png"),
};

/** الوجوه العامة، ثم النوم — يُعرض لكل اللحظات وهو الأنسب للحظة نوم. */
const OPEN_FACES = ["SMILE", "LAUGH", "GASP", "SAD", "LOVE"] as const;

/**
 * الوجوه المعروضة للحظة.
 *
 * وجه النوم للحظات النوم وحدها: «تصبح على خير» على صورة قهوة لا معنى
 * لها، ووجودُ خيارٍ لا يُستعمل يُضعف بقية الخيارات.
 */
export function facesFor(momentKind?: string): readonly string[] {
  return momentKind === "SLEEP" ? [...OPEN_FACES, "SLEEPY"] : OPEN_FACES;
}

export const FACES = OPEN_FACES;
/**
 * الإيموجي الحرّ لمشتركي آثار+ — قائمتُه في `lib/emoji.ts`.
 *
 * كان اثنين، والاشتراك يَعِد بـ«كل كيبوردك» — فصارت لوحةً تُفتح بضغطة:
 * الاثنان الأولان في الصفّ لأنهما الأكثر استعمالاً، والبقية خلف «＋».
 */
export { CUSTOM, EMOJI_GROUPS } from "@/lib/emoji";

type Mine = { kind: string; emoji: string | null } | null;

export function ReactionGlyph({
  kind,
  emoji,
  size = 20,
}: {
  kind: string;
  emoji?: string | null;
  size?: number;
}) {
  if (kind === "CUSTOM") {
    return (
      <span style={{ fontSize: size * 0.92, lineHeight: 1 }} aria-hidden>
        {emoji ?? "🙂"}
      </span>
    );
  }
  const src = REACTION_SRC[kind] ?? REACTION_SRC.SMILE;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={size} height={size} style={{ display: "block" }} />;
}

export function Reactions({
  momentId,
  momentKind,
  mine,
  count,
  isPlus,
  author = false,
  moderate = false,
}: {
  momentId: string;
  momentKind?: string;
  mine: Mine;
  count: number;
  isPlus: boolean;
  /** صاحب اللحظة يحذفها من اللوحة نفسها (القاعدة ٦١). */
  author?: boolean;
  /**
   * صلاحية الإشراف: الزرّ نفسه على لحظة غيره.
   *
   * صفحةُ اللحظة تفتحها البلاغات، فالحذف فيها لا في شاشةٍ أخرى. وكانت
   * بلا حذفٍ أصلاً — لا لصاحبها ولا لغيره — فيُفتح المنشور المُبلَّغ
   * عنه ولا يُفعل به شيء.
   */
  moderate?: boolean;
}) {
  const faces = facesFor(momentKind);
  const [open, setOpen] = useState(false);
  // لوحة الإيموجي الكاملة: تُفتح من «＋» ولا تزاحم الوجوه في الصفّ.
  const [board, setBoard] = useState(false);
  const [popped, setPopped] = useState(false);
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  function choose(kind: string, emoji?: string) {
    setPopped(true);
    setTimeout(() => setPopped(false), 420);
    setOpen(false);
    setBoard(false);
    start(() => void react(momentId, kind, emoji));
  }

  // البطاقة رابط، فيجب أن يقف الحدث هنا وإلا فتحت اللحظة مع كل ضغطة.
  const stop = (event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div ref={root} className="relative" onClick={stop}>
      <button
        type="button"
        aria-label="تفاعل"
        aria-expanded={open}
        disabled={pending}
        onClick={(e) => {
          stop(e);
          setBoard(false);
          setOpen((v) => !v);
        }}
        className="flex h-9 items-center gap-1.5 rounded-full border px-2.5 disabled:opacity-60"
        style={{
          background: mine ? "var(--color-clay-soft)" : "transparent",
          borderColor: mine ? "var(--color-clay)" : "var(--color-line)",
        }}
      >
        <span
          style={{
            transform: popped ? "scale(1.4)" : "scale(1)",
            transition: "transform 400ms cubic-bezier(.18,1.5,.4,1)",
            opacity: mine ? 1 : 0.5,
            filter: mine ? "none" : "grayscale(.85)",
          }}
        >
          <ReactionGlyph kind={mine?.kind ?? "SMILE"} emoji={mine?.emoji} size={19} />
        </span>
        {count > 0 ? (
          <span className="text-[12.5px] font-semibold text-ink-2">{ar(count)}</span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute bottom-full z-20 mb-2 rounded-2xl border border-line p-1"
          style={{
            background: "var(--color-card)",
            right: 0,
            boxShadow: "0 10px 30px rgba(14,26,36,.18)",
          }}
        >
          <div className="flex items-center gap-0.5">
            {faces.map((kind, index) => (
              <button
                key={kind}
                type="button"
                aria-label={kind}
                onClick={(e) => {
                  stop(e);
                  choose(kind);
                }}
                className="flex h-11 w-9 items-center justify-center rounded-xl hover:bg-chip"
                style={{
                  animation: "athr-pop 320ms cubic-bezier(.18,1.4,.4,1) both",
                  animationDelay: `${index * 34}ms`,
                }}
              >
                <ReactionGlyph kind={kind} size={26} />
              </button>
            ))}

            <span className="mx-0.5 h-6 w-px bg-line" />

            {isPlus ? (
              <>
                {CUSTOM.slice(0, 2).map((emoji, index) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={(e) => {
                      stop(e);
                      choose("CUSTOM", emoji);
                    }}
                    className="flex h-11 w-9 items-center justify-center rounded-xl text-[22px] leading-none hover:bg-chip"
                    style={{
                      animation: "athr-pop 320ms cubic-bezier(.18,1.4,.4,1) both",
                      animationDelay: `${(faces.length + index) * 34}ms`,
                    }}
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  type="button"
                  aria-label="كل الإيموجي"
                  aria-expanded={board}
                  onClick={(e) => {
                    stop(e);
                    setBoard((v) => !v);
                  }}
                  className="flex h-11 w-9 items-center justify-center rounded-xl text-[19px] font-bold leading-none hover:bg-chip"
                  style={{ color: "var(--color-clay-ink)" }}
                >
                  {board ? "×" : "＋"}
                </button>
              </>
            ) : (
              <a
                href="/subscribe"
                aria-label="الإيموجي الحر لمشتركي آثار+"
                onClick={(e) => e.stopPropagation()}
                className="flex h-11 w-9 items-center justify-center rounded-xl"
                style={{ color: "var(--color-gold-ink)" }}
              >
                <LockIcon size={16} />
              </a>
            )}
          </div>

          {board ? (
            <EmojiBoard onPick={(emoji) => choose("CUSTOM", emoji)} stop={stop} />
          ) : null}

          {/*
            الحذف في اللوحة نفسها: سؤالٌ ثم حذف (القاعدة ٦١). والبابان
            مختلفان وإن تشابه الزرّان — صاحبُها `deleteMoment`، والمشرفُ
            `removeMomentAsAdmin` خلف فحصِ صلاحيةٍ ومعه سجلّ.
          */}
          {author || moderate ? (
            <div className="mt-2 flex items-center justify-end gap-2 border-t border-line pt-2">
              {asking ? (
                <>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={(event) => {
                      stop(event);
                      setOpen(false);
                      setAsking(false);
                      start(() =>
                        void (author
                          ? deleteMoment(momentId)
                          : removeMomentAsAdmin(momentId, null)),
                      );
                    }}
                    className="h-8 rounded-full px-3 text-[11.5px] font-bold disabled:opacity-60"
                    style={{ background: "var(--color-live)", color: "#fff" }}
                  >
                    أحذفها
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      stop(event);
                      setAsking(false);
                    }}
                    className="h-8 rounded-full px-2.5 text-[11.5px] font-semibold text-muted"
                  >
                    تراجع
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={(event) => {
                    stop(event);
                    setAsking(true);
                  }}
                  className="h-8 rounded-full px-2.5 text-[11.5px] font-semibold"
                  style={{ color: "var(--color-live)" }}
                >
                  {author ? "احذف اللحظة" : "احذفها بصلاحية الإشراف"}
                </button>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * من تفاعل: صورته أسفل المنشور وتفاعله فوقها — كما كان في Path.
 * الرقم وحده لا يقول من، وهذا سؤال الدائرة الصغيرة الأول.
 * الصورة تُرسم بـ`Avatar` لا بدائرة فارغة: من لا صورة له يظهر بحرف اسمه
 * بدل قرصٍ بلا معنى لا يُقرأ أنه أحد.
 */
export function Reactors({
  reactions,
  viewerId,
  size = 32,
}: {
  reactions: {
    userId: string;
    kind: string;
    emoji: string | null;
    user: { name: string; avatarMediaId: string | null };
  }[];
  /** لفتح ملف صاحب التفاعل: ملفي أنا على `/me`، وغيري على `/u/<id>`. */
  viewerId?: string;
  size?: number;
}) {
  if (reactions.length === 0) return null;
  const shown = reactions.slice(0, 6);

  return (
    <div data-reactors className="flex items-center gap-2.5 pt-1">
      {shown.map((reaction) => (
        <Link
          key={reaction.userId}
          href={reaction.userId === viewerId ? "/me" : `/u/${reaction.userId}`}
          aria-label={`ملف ${reaction.user.name}`}
          onClick={(event) => event.stopPropagation()}
          className="relative block shrink-0"
          style={{ width: size, height: size }}
          title={`${reaction.user.name}`}
        >
          <Avatar name={reaction.user.name} size={size} mediaId={reaction.user.avatarMediaId} />
          <span
            className="absolute flex items-center justify-center rounded-full"
            style={{
              top: -size * 0.1,
              left: -size * 0.1,
              background: "var(--color-card)",
              padding: 1,
              boxShadow: "0 1px 3px rgba(14,26,36,.16)",
            }}
          >
            <ReactionGlyph kind={reaction.kind} emoji={reaction.emoji} size={size * 0.5} />
          </span>
        </Link>
      ))}
      {reactions.length > shown.length ? (
        <span className="text-[12px] font-semibold text-muted">
          +{ar(reactions.length - shown.length)}
        </span>
      ) : null}
    </div>
  );
}

/**
 * لوحة الإيموجي: مجموعاتٌ لها عناوين تُمرَّر كما يُمرَّر كيبورد النظام.
 *
 * وعنوانُ المجموعة `sticky` فوق صفوفها: لوحةٌ من مئاتٍ بلا عناوين
 * تُقرأ كومةً، ومن نزل فيها لا يعرف أين هو. والمفتاح يحمل اسم
 * المجموعة معه — الوجه الواحد يجلس في مجموعتين.
 */
export function EmojiBoard({
  onPick,
  stop,
}: {
  onPick: (emoji: string) => void;
  /** يوقف صعود الحدث إلى الرابط الذي تحت الشريط (القاعدة ٢٨). */
  stop: (event: React.MouseEvent) => void;
}) {
  return (
    <div
      className="no-bar mt-1 overflow-y-auto border-t border-line pt-1.5"
      style={{ maxHeight: 208, width: 246 }}
    >
      {EMOJI_GROUPS.map((group) => (
        <div key={group.label}>
          <p
            className="sticky top-0 z-10 px-1 py-1 text-[10.5px] font-semibold"
            style={{ background: "var(--color-card)", color: "var(--color-muted)" }}
          >
            {group.label}
          </p>
          <div className="grid grid-cols-6 gap-0.5">
            {group.items.map((emoji) => (
              <button
                key={`${group.label}:${emoji}`}
                type="button"
                onClick={(event) => {
                  stop(event);
                  onPick(emoji);
                }}
                className="flex h-10 items-center justify-center rounded-lg text-[21px] leading-none hover:bg-chip"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
