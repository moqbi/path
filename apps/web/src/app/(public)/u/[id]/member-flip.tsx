"use client";

import { useState } from "react";

/**
 * بطاقةُ العضويّة تنقلب إلى رمز QR (القاعدة ٤٢٠): وجهُها الملفُّ كما كان
 * (القاعدة ٣٩٩)، وظهرُها رمزُ رابطه لمن يقف أمامك يمسحه بكاميرته — كنافذة
 * المشاركة في التطبيق (القاعدة ٨٧). والزرُّ على الغلاف يقلبها، وفي الظهر
 * زرٌّ يعيدها. وبلا نطاقٍ مضبوط لا رمزَ ولا زرّ (القاعدة ١٠٥).
 */
export function MemberFlip({ front, back }: { front: React.ReactNode; back: React.ReactNode | null }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={open ? "member-flip on" : "member-flip"}>
      <div className="member-face" aria-hidden={open}>
        {front}
        {back ? (
          <button type="button" className="member-qr-btn" onClick={() => setOpen(true)} aria-label="اعرض رمز QR للملف" tabIndex={open ? -1 : 0}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3.5" y="3.5" width="6" height="6" rx="1.2" />
              <rect x="14.5" y="3.5" width="6" height="6" rx="1.2" />
              <rect x="3.5" y="14.5" width="6" height="6" rx="1.2" />
              <path d="M14.5 14.5h2.5v2.5M20.5 14.5v6h-3M14.5 20.5v-1" />
            </svg>
            <span>رمز QR</span>
          </button>
        ) : null}
      </div>
      {back ? (
        <div className="member-face member-back" aria-hidden={!open}>
          {back}
          <button type="button" className="member-back-btn" onClick={() => setOpen(false)} tabIndex={open ? 0 : -1}>
            رجوع إلى الملف
          </button>
        </div>
      ) : null}
    </div>
  );
}
