"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMyComment, removeCommentAsAdmin, reportComment } from "@/app/actions";
import { Sheet } from "@/components/sheet";
import { SwipeRow } from "@/components/swipe-row";

const REASONS: { key: string; label: string }[] = [
  { key: "SPAM", label: "إزعاج أو إعلان" },
  { key: "HATE", label: "كراهية أو إساءة" },
  { key: "SEXUAL", label: "محتوى جنسي" },
  { key: "VIOLENCE", label: "عنف" },
  { key: "SELF_HARM", label: "إيذاء النفس" },
  { key: "OTHER", label: "شيء آخر" },
];

/**
 * سحبُ التعليق في الويب — كالجوّال (القاعدتان ١٣٨ و٢٠٧): صاحبُه (أو صاحبُ
 * اللحظة) يكشف سلّة، والمشرفُ درعاً على تعليق غيره، وغيرُهما رايةَ بلاغ.
 * والسحبةُ ثمّ الضغطة خطوتان، وهما السؤالُ قبل الحذف.
 */
export function CommentSwipe({
  commentId,
  mine,
  moderate,
  children,
}: {
  commentId: string;
  /** تعليقي أو على لحظتي: يُحذف من بابي. */
  mine: boolean;
  moderate: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [reporting, setReporting] = useState(false);
  const [gone, setGone] = useState(false);

  if (gone) return null;

  const drop = async () => {
    const said = mine ? await deleteMyComment(commentId) : await removeCommentAsAdmin(commentId);
    if (said.error) alert(said.error);
    else {
      setGone(true);
      router.refresh();
    }
  };

  return (
    <>
      {mine || moderate ? (
        <SwipeRow
          onDelete={drop}
          confirmLabel={mine ? "حذف التعليق" : "حذف بصلاحية الإشراف"}
          icons={mine ? "trash" : "shield"}
          surface="var(--color-card)"
        >
          {children}
        </SwipeRow>
      ) : (
        <SwipeRow
          onDelete={() => setReporting(true)}
          confirmLabel="بلاغ عن التعليق"
          icons="flag"
          surface="var(--color-card)"
        >
          {children}
        </SwipeRow>
      )}
      {reporting ? <ReportSheet commentId={commentId} onClose={() => setReporting(false)} /> : null}
    </>
  );
}

function ReportSheet({ commentId, onClose }: { commentId: string; onClose: () => void }) {
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [said, setSaid] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <Sheet title="بلاغ عن تعليق" onClose={onClose}>
      {said?.ok ? (
        <div className="flex flex-col items-center gap-4 py-4">
          <p className="text-center text-[13.5px] text-ink">{said.ok}</p>
          <button
            type="button"
            onClick={onClose}
            className="h-11 w-full rounded-xl text-[14px] font-bold"
            style={{ background: "var(--color-chip)", color: "var(--color-ink)" }}
          >
            تمّ
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-center text-[12px] text-muted">نقرأ كلّ بلاغ خلال ٢٤ ساعة، ولا يعرف صاحبُه من أبلغ.</p>
          <div className="flex flex-wrap justify-center gap-2">
            {REASONS.map((one) => {
              const on = reason === one.key;
              return (
                <button
                  key={one.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setReason(one.key)}
                  className="h-9 rounded-full border px-3.5 text-[12.5px]"
                  style={{
                    borderColor: on ? "var(--color-live)" : "var(--color-line)",
                    background: on ? "color-mix(in srgb, var(--color-live) 12%, transparent)" : "var(--color-card)",
                    color: on ? "var(--color-live)" : "var(--color-ink)",
                  }}
                >
                  {one.label}
                </button>
              );
            })}
          </div>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
            placeholder="تفاصيل (اختياري)"
            className="h-20 resize-none rounded-xl border border-line bg-card px-3 py-2 text-[13px] text-ink outline-none focus:border-clay"
          />
          {said?.error ? (
            <p role="alert" className="text-center text-[12px]" style={{ color: "var(--color-live)" }}>
              {said.error}
            </p>
          ) : null}
          <button
            type="button"
            disabled={!reason || pending}
            onClick={() =>
              start(async () => {
                if (reason) setSaid(await reportComment(commentId, reason, note));
              })
            }
            className="h-12 rounded-xl text-[14px] font-bold disabled:opacity-60"
            style={{ background: "var(--color-live)", color: "#fff" }}
          >
            {pending ? "نرسل…" : "أرسل البلاغ"}
          </button>
        </div>
      )}
    </Sheet>
  );
}
