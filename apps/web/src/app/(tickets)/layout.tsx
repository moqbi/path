import type { Metadata } from "next";
import { AthrMark, AthrWordmark } from "@/components/brand";
import { currentUser } from "@/lib/auth";
import { ticketSignOut } from "./tickets/actions";

export const metadata: Metadata = { title: "نظام التذاكر · آثار مومنتس" };

/**
 * نظامُ التذاكر على الجذر (`atharmts.com/tickets` — القاعدة ٤٨٠): بابٌ وحده لا يفتح
 * تطبيقَ الويب. دخولٌ ثمّ التذاكر، على تدرّج أرضيّة الإطلاق (القاعدة ٢٥٤) لا على ثيم
 * صاحبه — **بقرار المالك** — والبطاقاتُ ورقٌ فاتح فوقه.
 */
export default async function TicketsLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <div
      className="min-h-dvh"
      style={{
        background: "radial-gradient(120% 80% at 50% 0%, #1a3742 0%, #0d1c25 55%, #09151c 100%)",
        color: "#fdfcf8",
      }}
    >
      <header
        className="mx-auto flex w-full max-w-[680px] items-center gap-3 py-5"
        style={{
          paddingLeft: "max(20px, env(safe-area-inset-left, 0px))",
          paddingRight: "max(20px, env(safe-area-inset-right, 0px))",
        }}
      >
        <a href="/tickets" className="flex min-w-0 items-center gap-2.5">
          <AthrMark size={36} />
          {/* الاسمُ اللاتينيّ يُطوى على الشاشة الضيّقة: لا يتّسع سطرٌ للعلامة والاسمين وزرّ الخروج. */}
          <span className="hidden items-center gap-2.5 min-[440px]:flex">
            <AthrWordmark size={17} color="#fdfcf8" />
            <span className="h-5 w-px shrink-0" style={{ background: "rgba(253,252,248,.25)" }} />
          </span>
          <span className="truncate text-[15px] font-bold" style={{ fontFamily: "var(--font-display)" }}>
            نظام التذاكر
          </span>
        </a>
        {user ? (
          <form action={ticketSignOut} className="ms-auto shrink-0">
            <button
              type="submit"
              className="rounded-full px-3.5 py-1.5 text-[12px] font-semibold"
              style={{ border: "1px solid rgba(253,252,248,.22)", color: "rgba(253,252,248,.8)" }}
            >
              خروج
            </button>
          </form>
        ) : null}
      </header>
      <main
        className="mx-auto w-full max-w-[680px] pb-16"
        style={{
          paddingLeft: "max(20px, env(safe-area-inset-left, 0px))",
          paddingRight: "max(20px, env(safe-area-inset-right, 0px))",
        }}
      >
        {children}
      </main>
    </div>
  );
}
