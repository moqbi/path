"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { sendGroupMessage, sendGroupPhoto, sendMessage, sendPhoto, sendVoice } from "@/app/actions";
import { ImagePicker } from "@/components/image-picker";
import { CloseIcon, MicIcon, PlusIcon, SendIcon, StickerIcon } from "@/components/icons";
import { StickerPanel, useStickersAllowed } from "@/components/sticker-panel";
import { ar } from "@/lib/format";

/** الصيغ التي يخرج بها التسجيل، بترتيب ما تدعمه المتصفحات. */
const TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

function pickType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

const clock = (seconds: number) =>
  `${ar(Math.floor(seconds / 60))}:${ar(String(seconds % 60).padStart(2, "0"))}`;

/**
 * سطر الإرسال: نصّ، وصورة، وصوت.
 *
 * الصورة تُضغط في المتصفح قبل أن تصل (كبقية صور التطبيق)، والصوت يُسجَّل
 * هنا ويقف وحده عند الحدّ — عشرون ثانية، ومئة وعشرون لمشتركي آثار+ —
 * فلا يكتشف صاحبه بعد دقيقتين أنّ ما سجّله لن يُقبل.
 */
export function Composer({
  conversationId = "",
  groupId,
  isPlus,
  maxSeconds,
  onSent,
  compact = false,
}: {
  conversationId?: string;
  /** المجموعةُ نصٌّ وصورة كخادمها (القاعدة ٢١٥) — بلا صوت. */
  groupId?: string;
  isPlus: boolean;
  maxSeconds: number;
  /** بعد كل إرسال — عمودُ الأصدقاء على سطح المكتب يُعيد جلب المحادثة به. */
  onSent?: () => void;
  /** أضيقُ حشوةً — لعمود سطح المكتب. */
  compact?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [taping, setTaping] = useState(false);
  const [stickers, setStickers] = useState(false);
  const [body, setBody] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  // الملصقاتُ في المحادثة الثنائيّة كخادمها (القاعدة ٢٩١) — المجموعةُ بلا ملصق.
  const stickersAllowed = useStickersAllowed() && !groupId;
  const [pending, start] = useTransition();

  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<BlobPart[]>([]);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const keep = useRef(true);

  // الميكروفون يبقى مفتوحاً ما دام التسجيل جارياً، ويُغلق مع آخر شريحة.
  useEffect(() => {
    return () => {
      if (ticker.current) clearInterval(ticker.current);
      recorder.current?.stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function begin() {
    setError(null);
    const type = pickType();
    if (!navigator.mediaDevices || !type) {
      setError("جهازك لا يدعم التسجيل الصوتي.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("لازم تسمح بالميكروفون.");
      return;
    }

    const tape = new MediaRecorder(stream, { mimeType: type, audioBitsPerSecond: 32_000 });
    chunks.current = [];
    keep.current = true;

    tape.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.current.push(event.data);
    };
    tape.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      if (ticker.current) clearInterval(ticker.current);
      const length = Math.max(1, Math.round((Date.now() - began) / 1000));
      const clip = new Blob(chunks.current, { type });
      setTaping(false);
      setSeconds(0);
      if (!keep.current || clip.size === 0) return;

      const data = new FormData();
      data.set("clip", clip, "voice");
      data.set("seconds", String(Math.min(length, maxSeconds)));
      start(async () => {
        const said = await sendVoice(conversationId, data);
        if (said.error) setError(said.error);
        else onSent?.();
      });
    };

    const began = Date.now();
    recorder.current = tape;
    tape.start();
    setTaping(true);
    setSeconds(0);
    ticker.current = setInterval(() => {
      const passed = Math.round((Date.now() - began) / 1000);
      setSeconds(passed);
      // الوقوف عند الحدّ لا بعده: ما يُسجَّل زيادةً لا يُقبل أصلاً.
      if (passed >= maxSeconds) tape.stop();
    }, 250);
  }

  function finish(send: boolean) {
    keep.current = send;
    recorder.current?.stop();
  }

  return (
    <div className={compact ? "shrink-0 px-3 pb-3 pt-2" : "shrink-0 px-5 pb-8 pt-3"}>
      {error ? (
        <p role="alert" className="mb-2 text-center text-[11.5px]" style={{ color: "var(--color-live)" }}>
          {error}
        </p>
      ) : null}

      {taping ? (
        <div
          className="flex items-center gap-3 rounded-full border px-4"
          style={{ height: 48, borderColor: "var(--color-live)", background: "var(--color-live-soft)" }}
        >
          <span
            className="block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: "var(--color-live)", animation: "athr-pulse 1s ease-in-out infinite" }}
          />
          <span className="grow text-[13px] font-semibold" style={{ color: "var(--color-live)" }}>
            {clock(seconds)} / {clock(maxSeconds)}
          </span>
          <button
            type="button"
            aria-label="إلغاء التسجيل"
            onClick={() => finish(false)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card text-muted"
          >
            <CloseIcon size={16} />
          </button>
          <button
            type="button"
            onClick={() => finish(true)}
            className="shrink-0 rounded-full px-4 text-[13px] font-bold"
            style={{ height: 36, background: "var(--color-clay)", color: "var(--color-on-brand)" }}
          >
            أرسل
          </button>
        </div>
      ) : (
        /*
          شريطٌ واحد كالجوّال (القاعدة ٢٩٥): الزائدُ يرسل صورةً (المتصفّحُ يعرض الكاميرا
          والاستوديو معاً)، ثمّ الحقلُ يطول مع النصّ، ثمّ الملصقات، ثمّ المايكُ ما دام
          الحقلُ فارغاً والإرسالُ حين يُكتب شيء — في قرصٍ واحد.
        */
        <form
          ref={formRef}
          action={async (data) => {
            if (groupId) {
              const said = await sendGroupMessage(groupId, data);
              if (said.error) return setError(said.error);
            } else {
              await sendMessage(conversationId, data);
            }
            setBody("");
            if (textRef.current) textRef.current.style.height = "";
            setError(null);
            onSent?.();
          }}
          className="flex items-end rounded-[21px] border bg-card px-1 py-[3px]"
          style={{ borderColor: stickers ? "var(--color-clay)" : "var(--color-line)", minHeight: 42 }}
        >
          <ImagePicker
            label="أرسل صورة"
            maxSize={1200}
            onError={setError}
            onPicked={(file, width, height) => {
              const data = new FormData();
              data.set("image", file);
              data.set("width", String(width));
              data.set("height", String(height));
              return (groupId ? sendGroupPhoto(groupId, data) : sendPhoto(conversationId, data)).then((said) => {
                if (!said.error) onSent?.();
                return said.error ?? undefined;
              });
            }}
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center text-ink-2"
          >
            <PlusIcon size={20} />
          </ImagePicker>

          <textarea
            ref={textRef}
            name="body"
            required
            rows={1}
            maxLength={2000}
            value={body}
            onChange={(event) => {
              setBody(event.target.value);
              // يطول مع النصّ إلى ١١٠ ثمّ يُمرَّر داخله.
              event.target.style.height = "auto";
              event.target.style.height = `${Math.min(110, event.target.scrollHeight)}px`;
            }}
            onFocus={() => setStickers(false)}
            onKeyDown={(event) => {
              // Enter يرسل على الحاسوب، وShift+Enter سطرٌ جديد. وعلى الجوّال سطرٌ جديد كالتطبيق.
              if (event.key === "Enter" && !event.shiftKey && !("ontouchstart" in window)) {
                event.preventDefault();
                if (body.trim()) formRef.current?.requestSubmit();
              }
            }}
            placeholder="اكتب رسالة…"
            className="min-w-0 grow resize-none bg-transparent px-1 py-2 text-[13.5px] leading-[1.45] text-ink outline-none placeholder:text-faint"
            style={{ maxHeight: 110 }}
          />

          {stickersAllowed ? (
            <button
              type="button"
              aria-label="الملصقات"
              aria-expanded={stickers}
              onClick={() => setStickers((v) => !v)}
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center"
              style={{ color: stickers ? "var(--color-clay)" : "var(--color-muted)" }}
            >
              <StickerIcon size={19} />
            </button>
          ) : null}

          {body.trim() || groupId ? (
            <button
              type="submit"
              aria-label="إرسال"
              disabled={!body.trim()}
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full disabled:opacity-50"
              style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
            >
              <SendIcon size={16} />
            </button>
          ) : (
            <button
              type="button"
              aria-label="رسالة صوتية"
              disabled={pending}
              onClick={() => void begin()}
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full disabled:opacity-50"
              style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
            >
              <MicIcon size={17} />
            </button>
          )}
        </form>
      )}

      {stickers && stickersAllowed && !taping ? (
        <div className="mt-2">
          <StickerPanel
            tone="light"
            isPlus={isPlus}
            onPick={(stickerId) => {
              const data = new FormData();
              data.set("stickerId", stickerId);
              setStickers(false);
              start(async () => {
                try {
                  await sendMessage(conversationId, data);
                  setError(null);
                  onSent?.();
                } catch (problem) {
                  setError(problem instanceof Error ? problem.message : "تعذّر الإرسال");
                }
              });
            }}
          />
        </div>
      ) : null}

      {!isPlus && !groupId ? (
        <p className="mt-2 text-center text-[10.5px] text-faint">
          الصوت حتى {ar(maxSeconds)} ثانية · ومع آثار+ ١٢٠
        </p>
      ) : null}
    </div>
  );
}
