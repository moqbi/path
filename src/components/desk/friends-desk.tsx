"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition } from "react";
import { deskChat, deskThread } from "@/app/actions";
import { Thread, type Line } from "@/app/messages/[id]/thread";
import { Composer } from "@/app/messages/[id]/composer";
import { BackIcon, MessageIcon } from "@/components/icons";

const VOICE = { free: 20, plus: 120 };
/** كم ثانيةً بين جلبين والمحادثة مفتوحة — لا خادمَ دائمَ بيننا (القاعدة ٣٤). */
const POLL_MS = 6_000;

type Chat = {
  id: string;
  meId: string;
  isPlus: boolean;
  other: { id: string; name: string };
  lines: Line[];
};

const Open = createContext<(friendId: string) => void>(() => {});

/**
 * عمودُ الأصدقاء على سطح المكتب بوجهين — **بقرار المالك** (القاعدة ٢٠٠):
 * القائمةُ، والمحادثةُ تُفتح **في العمود نفسه** بزرّ رجوع، لا في الوسط —
 * الوسطُ للخطّ الزمنيّ لا يُزاح عنه كلّما ردّ صديق.
 *
 * والقائمةُ تُرسم على الخادم وتصل هنا ابناً، وأزرارُ المحادثة فيها تنادي
 * هذا الغلاف بالسياق — فلا تنتقل القائمةُ كلُّها إلى العميل.
 */
export function FriendsDesk({ children }: { children: React.ReactNode }) {
  const [chat, setChat] = useState<Chat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);

  const open = useCallback((friendId: string) => {
    setError(null);
    start(async () => {
      const said = await deskChat(friendId);
      if ("error" in said) setError(said.error ?? "تعذّر فتح المحادثة");
      else setChat(said as Chat);
    });
  }, []);

  const reload = useCallback(async () => {
    if (!chat) return;
    const said = await deskThread(chat.id);
    if (!("error" in said)) setChat(said as Chat);
  }, [chat]);

  // جلبٌ كل بضع ثوانٍ والنافذةُ ظاهرة، فيصل ردُّ الصديق بلا تحديث.
  useEffect(() => {
    if (!chat) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void reload();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [chat, reload]);

  // والمحادثةُ تلتصق بآخرها (القاعدة ١٨٦).
  const count = chat?.lines.length ?? 0;
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [count, chat?.id]);

  if (chat) {
    return (
      <section className="desk-panel">
        <header className="desk-panel-head">
          <button
            type="button"
            onClick={() => setChat(null)}
            aria-label="رجوع إلى الأصدقاء"
            className="desk-icon-btn shrink-0"
          >
            <BackIcon size={18} />
          </button>
          <Link href={`/u/${chat.other.id}`} className="min-w-0 grow">
            <h2 dir="auto" className="truncate text-[15px] font-bold" style={{ fontFamily: "var(--font-display)" }}>
              {chat.other.name}
            </h2>
          </Link>
          <Link href={`/messages/${chat.id}`} className="shrink-0 text-[12px] font-semibold text-clay-ink">
            افتحها كاملة
          </Link>
        </header>
        <div className="desk-panel-body flex flex-col gap-2 px-3 py-3">
          <Thread lines={chat.lines} meId={chat.meId} />
          <div ref={end} />
        </div>
        <Composer
          conversationId={chat.id}
          isPlus={chat.isPlus}
          maxSeconds={chat.isPlus ? VOICE.plus : VOICE.free}
          onSent={() => void reload()}
          compact
        />
      </section>
    );
  }

  return (
    <Open.Provider value={open}>
      {children}
      {error ? (
        <p role="alert" className="px-4 pb-3 text-[12px]" style={{ color: "var(--color-live)" }}>
          {error}
        </p>
      ) : null}
      {pending ? <p className="px-4 pb-3 text-[12px] text-muted">تُفتح المحادثة…</p> : null}
    </Open.Provider>
  );
}

/** زرُّ المحادثة في صفّ الصديق — يفتحها في العمود نفسه. */
export function DeskChatButton({ friendId, name }: { friendId: string; name: string }) {
  const open = useContext(Open);
  return (
    <button type="button" aria-label={`محادثة مع ${name}`} className="desk-icon-btn shrink-0" onClick={() => open(friendId)}>
      <MessageIcon size={17} />
    </button>
  );
}
