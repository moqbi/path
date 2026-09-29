"use client";

import { useEffect, useRef, useState } from "react";

/**
 * مرفقاتُ نموذجٍ من الموقع: زرٌّ يفتح الملفّات، وتحته ما اختير باسمه
 * وحجمه وزرٌّ يحذفه.
 *
 * **الملفّات في الحالة لا في الحقل وحده**: React يمسح حقول النموذج بعد
 * كل إجراء، فرسالةٌ تُردّ بخطأٍ في البريد كانت ستفقد مرفقاتها بصمت. فتُحفظ
 * هنا وتُعاد إلى الحقل (`DataTransfer`) بعد كلّ رسم — وبالنجاح يمسحها
 * صاحبُ النموذج بتغيير `resetKey`.
 *
 * والحدودُ تُقال قبل الإرسال لا بعده: ملفٌّ أكبر من خمسة ميغا لا يُضاف
 * أصلاً، والخادم يعيد فحصها كلَّها (`lib/ticket-files.ts`).
 */
const MAX = 3;
const BYTES = 5 * 1024 * 1024;

function size(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("ar-SA")} ك.ب`
    : `${(bytes / 1024 / 1024).toLocaleString("ar-SA", { maximumFractionDigits: 1 })} م.ب`;
}

export function FilesField({
  accept,
  label,
  hint,
  resetKey,
}: {
  accept: string;
  label: string;
  hint: string;
  resetKey: unknown;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    setFiles([]);
    setWarning(null);
  }, [resetKey]);

  // الحقلُ يحمل ما في الحالة بعد كل رسم — وبعد أن يمسحه React.
  useEffect(() => {
    if (!input.current) return;
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);
    input.current.files = transfer.files;
  });

  function add(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    let note: string | null = null;
    for (const file of Array.from(list)) {
      if (next.length >= MAX) {
        note = "ثلاثة مرفقات بحدٍّ أقصى";
        break;
      }
      if (file.size > BYTES) {
        note = `«${file.name}» أكبر من ٥ ميغا`;
        continue;
      }
      next.push(file);
    }
    setFiles(next);
    setWarning(note);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="px-1 text-[11.5px] font-semibold text-muted">{label}</span>

      {/* الحقلُ الحقيقيّ مخفيّ: شكلُه في كل متصفّحٍ غيرُ شكله في الآخر. */}
      <input
        ref={input}
        type="file"
        name="files"
        multiple
        accept={accept}
        className="hidden"
        onChange={(event) => {
          // ما اختير الآن يُضاف إلى الحالة، والحقلُ يُعاد إليها في الرسم التالي.
          const picked = event.currentTarget.files;
          add(picked);
        }}
      />

      {files.length < MAX ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex h-[52px] items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-card text-[13px] font-semibold text-ink-2 transition-colors hover:border-clay"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 12.5 12.9 20.6a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.4 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8" />
          </svg>
          أرفق ملفاً
        </button>
      ) : null}

      {files.length ? (
        <ul className="flex flex-col gap-1.5">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center gap-2.5 rounded-xl border border-line bg-card px-3 py-2"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-paper text-[9.5px] font-bold text-clay-ink">
                {file.type === "application/pdf" ? "PDF" : "صورة"}
              </span>
              <span dir="auto" className="min-w-0 grow truncate text-[12.5px] text-ink">
                {file.name}
              </span>
              <span className="shrink-0 text-[10.5px] text-faint">{size(file.size)}</span>
              <button
                type="button"
                aria-label={`احذف ${file.name}`}
                onClick={() => {
                  setFiles(files.filter((_, at) => at !== index));
                  setWarning(null);
                }}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-paper"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <span className="px-1 text-[10.5px] text-faint">{hint}</span>
      {warning ? (
        <span role="alert" className="px-1 text-[11.5px] font-medium" style={{ color: "var(--color-live)" }}>
          {warning}
        </span>
      ) : null}
    </div>
  );
}
