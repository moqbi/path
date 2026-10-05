"use client";

import { useEffect, useState, useTransition } from "react";
import {
  addComment,
  deleteMoment,
  momentAudience,
  removeMomentAsAdmin,
  reportMoment,
  setCommentsLock,
} from "@/app/actions";
import { GlassSheet } from "@/components/glass-sheet";
import { ReportSheet } from "@/components/comment-swipe";
import { EyeIcon, FlagIcon, LockIcon, TrashIcon, UnlockIcon } from "@/components/icons";
import { CUSTOM, EMOJI_GROUPS, facesFor, ReactionGlyph } from "@/components/reactions";
import { ar } from "@/lib/format";

type Mine = { kind: string; emoji: string | null } | null;

const SOFT = "rgba(255,255,255,.1)";
const DIM = "rgba(255,255,255,.62)";
const GOLD = "#F6B93B";

/**
 * لوحةُ التفاعل في نافذةٍ زجاجيّة (القاعدة ٢٤٧) — نسخةُ
 * `apps/mobile/components/react-sheet.tsx` بترتيبها: الوجوهُ الخمسة كبيرةً
 * (القاعدة ٣)، فالإيموجي الحرّ لآثار+، فالتعليق، فالحذفُ أو البلاغ. ولصاحب
 * اللحظة قفلُ التعليقات ومشاهداتُها مكان الوجوه (القاعدة ٢٠٢).
 */
export function ReactSheet({
  momentId,
  momentKind,
  mine,
  isPlus,
  author,
  moderate,
  locked,
  onLocked,
  onChoose,
  onClose,
}: {
  momentId: string;
  momentKind?: string;
  mine: Mine;
  isPlus: boolean;
  author: boolean;
  moderate: boolean;
  locked: boolean;
  onLocked: (locked: boolean) => void;
  onChoose: (kind: string, emoji?: string) => void;
  onClose: () => void;
}) {
  const [body, setBody] = useState("");
  const [board, setBoard] = useState(false);
  const [asking, setAsking] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [views, setViews] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const faces = facesFor(momentKind);

  useEffect(() => {
    if (!author) return;
    let live = true;
    void momentAudience(momentId).then((said) => {
      if (!live || "error" in said) return;
      setViews(said.views);
      onLocked(said.commentsLocked);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [author, momentId]);

  function send() {
    const text = body.trim();
    if (!text) return;
    const data = new FormData();
    data.set("body", text);
    setBody("");
    onClose();
    start(() => void addComment(momentId, data));
  }

  if (reporting) {
    return (
      <ReportSheet
        title="بلاغ عن لحظة"
        send={(reason, note) => reportMoment(momentId, reason, note)}
        onClose={onClose}
      />
    );
  }

  return (
    <GlassSheet
      title={author ? "لحظتك" : "تفاعل"}
      subtitle={author ? "قفلُ التعليقات ومن شاهدها" : locked ? "التعليقات مقفلة — التفاعل مفتوح" : "وجهٌ أو تعليق"}
      onClose={onClose}
      keep={body.trim().length > 0}
    >
      <div className="flex flex-col gap-3.5 px-4 pb-4 pt-3.5">
        {author ? (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              role="switch"
              aria-checked={locked}
              onClick={() => {
                const next = !locked;
                onLocked(next);
                start(async () => {
                  const said = await setCommentsLock(momentId, next);
                  if (said.error) onLocked(!next);
                });
              }}
              className="flex h-12 grow items-center justify-center gap-2 rounded-full text-[13.5px] font-bold"
              style={{ background: locked ? "rgba(246,185,59,.22)" : SOFT, color: locked ? GOLD : "#fff" }}
            >
              {locked ? <LockIcon size={16} /> : <UnlockIcon size={16} />}
              {locked ? "التعليقات مقفلة" : "التعليقات مفتوحة"}
            </button>
            <span className="flex h-12 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-bold" style={{ background: SOFT }}>
              <EyeIcon size={16} />
              {views === null ? "…" : ar(views)}
            </span>
          </div>
        ) : (
          <>
            <div className="flex justify-between">
              {faces.map((kind, index) => {
                const on = mine?.kind === kind;
                return (
                  <button
                    key={kind}
                    type="button"
                    aria-label={kind}
                    onClick={() => onChoose(kind)}
                    className="flex items-center justify-center rounded-full transition-transform hover:scale-110 active:scale-110"
                    style={{
                      width: 56,
                      height: 56,
                      background: on ? "rgba(246,185,59,.3)" : "rgba(255,255,255,.08)",
                      animation: "athr-pop 320ms cubic-bezier(.18,1.4,.4,1) both",
                      animationDelay: `${index * 34}ms`,
                    }}
                  >
                    <ReactionGlyph kind={kind} size={36} />
                  </button>
                );
              })}
            </div>

            {isPlus ? (
              <div>
                <div className="flex items-center gap-1.5">
                  {CUSTOM.slice(0, 6).map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => onChoose("CUSTOM", emoji)}
                      className="flex items-center justify-center rounded-full text-[22px] leading-none"
                      style={{ width: 40, height: 40, background: mine?.emoji === emoji ? "rgba(246,185,59,.3)" : "transparent" }}
                    >
                      {emoji}
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-expanded={board}
                    onClick={() => setBoard((v) => !v)}
                    className="mr-auto h-9 rounded-full px-3 text-[12.5px] font-bold"
                    style={{ background: SOFT }}
                  >
                    {board ? "إخفاء" : "كل الإيموجي"}
                  </button>
                </div>
                {board ? (
                  <div className="no-bar mt-2 overflow-y-auto rounded-[18px] p-1.5" style={{ maxHeight: 220, background: "rgba(255,255,255,.07)" }}>
                    {EMOJI_GROUPS.map((group) => (
                      <div key={group.label}>
                        <p className="p-1 text-[10.5px] font-semibold" style={{ color: "rgba(255,255,255,.55)" }}>
                          {group.label}
                        </p>
                        <div className="grid grid-cols-8">
                          {group.items.map((emoji) => (
                            <button
                              key={`${group.label}:${emoji}`}
                              type="button"
                              onClick={() => onChoose("CUSTOM", emoji)}
                              className="flex h-[38px] items-center justify-center text-[21px] leading-none"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <a
                href="/subscribe"
                className="flex h-10 w-fit items-center gap-2 rounded-full px-3.5 text-[12.5px] font-bold"
                style={{ background: "rgba(246,185,59,.14)", color: GOLD }}
              >
                <LockIcon size={14} />
                كل الإيموجي مع آثار+
              </a>
            )}
          </>
        )}

        {locked && !author ? (
          <p className="flex h-11 items-center gap-2 rounded-full px-3.5 text-[12.5px] font-semibold" style={{ background: "rgba(255,255,255,.07)", color: "rgba(255,255,255,.7)" }}>
            <LockIcon size={14} />
            أقفل صاحبُ اللحظة التعليقات
          </p>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
            className="flex items-end gap-2"
          >
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              placeholder={author ? "علّق على لحظتك…" : "اكتب تعليقك…"}
              maxLength={500}
              rows={1}
              aria-label="تعليق"
              className="min-w-0 grow resize-none rounded-[23px] px-4 py-3 text-[14px] text-white outline-none placeholder:text-white/45"
              style={{ minHeight: 46, maxHeight: 120, background: SOFT }}
            />
            <button
              type="submit"
              disabled={!body.trim() || pending}
              className="h-[46px] shrink-0 rounded-[23px] px-[18px] text-[13.5px] font-bold"
              style={{
                background: body.trim() ? "var(--color-clay)" : SOFT,
                color: body.trim() ? "var(--color-on-brand)" : "rgba(255,255,255,.45)",
              }}
            >
              إرسال
            </button>
          </form>
        )}

        {author || moderate ? (
          asking ? (
            <div className="flex items-center gap-2">
              <p className="grow text-[13px] font-semibold">
                {author ? "تحذف اللحظة؟ تذهب معها التفاعلات والتعليقات." : "تحذفها بصلاحية الإشراف؟ يُكتب في السجلّ باسمك."}
              </p>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  onClose();
                  start(() => void (author ? deleteMoment(momentId) : removeMomentAsAdmin(momentId, null)));
                }}
                className="h-[38px] shrink-0 rounded-full px-4 text-[12.5px] font-bold"
                style={{ background: "var(--color-live)", color: "#fff" }}
              >
                احذفها
              </button>
              <button type="button" onClick={() => setAsking(false)} className="h-[38px] shrink-0 px-2.5 text-[12.5px] font-semibold" style={{ color: DIM }}>
                تراجع
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAsking(true)}
              className="flex h-11 w-fit items-center gap-2 rounded-full px-3.5 text-[13px] font-bold"
              style={{ background: "rgba(255,122,90,.14)", color: "#ff9d84" }}
            >
              <TrashIcon size={15} />
              {author ? "احذف اللحظة" : "احذفها بصلاحية الإشراف"}
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={() => setReporting(true)}
            className="flex h-10 w-fit items-center gap-2 rounded-full px-3.5 text-[12.5px] font-semibold"
            style={{ background: "rgba(255,255,255,.07)", color: DIM }}
          >
            <FlagIcon size={14} />
            بلاغ
          </button>
        )}
      </div>
    </GlassSheet>
  );
}
