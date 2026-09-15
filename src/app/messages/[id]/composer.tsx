"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { sendMessage, sendPhoto, sendVoice } from "@/app/actions";
import { ImagePicker } from "@/components/image-picker";
import { CameraIcon, CloseIcon, MicIcon } from "@/components/icons";
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
  conversationId,
  isPlus,
  maxSeconds,
}: {
  conversationId: string;
  isPlus: boolean;
  maxSeconds: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [taping, setTaping] = useState(false);
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
    <div className="shrink-0 px-5 pb-8 pt-3">
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
        <form action={sendMessage.bind(null, conversationId)} className="flex items-center gap-2">
          <input
            name="body"
            required
            maxLength={2000}
            autoComplete="off"
            placeholder="اكتب رسالة…"
            className="grow rounded-full border border-line bg-card px-5 text-[13.5px] text-ink outline-none placeholder:text-faint focus:border-clay"
            style={{ height: 48 }}
          />

          <ImagePicker
            label="أرسل صورة"
            maxSize={1200}
            onError={setError}
            onPicked={(file, width, height) => {
              const data = new FormData();
              data.set("image", file);
              data.set("width", String(width));
              data.set("height", String(height));
              return sendPhoto(conversationId, data).then((said) => said.error ?? undefined);
            }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink-2"
          >
            <CameraIcon size={19} />
          </ImagePicker>

          <button
            type="button"
            aria-label="رسالة صوتية"
            disabled={pending}
            onClick={() => void begin()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink-2 disabled:opacity-50"
          >
            <MicIcon size={19} />
          </button>

          <button
            type="submit"
            className="brand-gradient shrink-0 rounded-full px-5 text-[13.5px] font-bold"
            style={{ height: 48, color: "var(--color-on-brand)" }}
          >
            إرسال
          </button>
        </form>
      )}

      {!isPlus ? (
        <p className="mt-2 text-center text-[10.5px] text-faint">
          الصوت حتى {ar(maxSeconds)} ثانية · ومع آثار+ ١٢٠
        </p>
      ) : null}
    </div>
  );
}
