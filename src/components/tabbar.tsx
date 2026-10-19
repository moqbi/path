"use client";

import Link from "next/link";
import {
  CircleIcon,
  HomeIcon,
  MessageIcon,
  StoreIcon,
  UserIcon,
} from "@/components/icons";
import { Avatar } from "@/components/ui";
import { ar } from "@/lib/format";

/**
 * خمسةُ أبوابٍ كشريط الجوّال (القاعدة ٢٦١): الإشعاراتُ جرسٌ في رأس اللحظات لا
 * تبويب، و«أنا» صورةُ صاحبها. ولا ضغطةَ مطوّلة: العدساتُ قرصٌ بجانب أوّل يوم.
 */
const TABS = [
  { href: "/", label: "اللحظات", Icon: HomeIcon },
  { href: "/circle", label: "الأصدقاء", Icon: CircleIcon },
  { href: "/messages", label: "المحادثات", Icon: MessageIcon },
  { href: "/store", label: "المتجر", Icon: StoreIcon },
  { href: "/me", label: "أنا", Icon: UserIcon },
];

const PILL = 62;

/**
 * ما له عمودٌ على سطح المكتب لا يتكرّر في شريط الوسط — **بقرار المالك**
 * (القاعدة ٢٠٠): الأصدقاءُ والمحادثاتُ يميناً، و«أنا» يساراً.
 */
const DESK_ELSEWHERE = new Set(["/circle", "/messages", "/me"]);

/** الشريط السفلي: زجاجٌ عائم بأيقوناتٍ بلا أسماء (القاعدة ٢٢٨). */
export function TabBarNav({
  active,
  unread = 0,
  me = null,
}: {
  active: string;
  /** ما لم يُقرأ من المحادثات — رقمٌ لا نقطة (القاعدة ١٥١). */
  unread?: number;
  me?: { name: string; avatarMediaId: string | null } | null;
}) {
  return (
    <>
      {/*
        زجاجٌ عائم — **بقرار المالك** (القاعدة ٢٢٨، كالجوّال): قرصٌ فوق المحتوى
        لا شريطٌ ملتصق، والمحتوى يمرّ تحته مغبّشاً (`.glassbar` يترك له مكانه في
        آخر التمرير). أيقوناتٌ بلا أسماء — الاسمُ لقارئ الشاشة.
      */}
      <nav className="glassbar shell-fixed z-10" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
        <div
          className="pointer-events-auto mx-3 flex items-center justify-around px-1.5"
          style={{
            height: PILL,
            borderRadius: PILL / 2,
            background: "rgba(20,24,28,.48)",
            backdropFilter: "blur(22px) saturate(1.5)",
            WebkitBackdropFilter: "blur(22px) saturate(1.5)",
            border: "1px solid rgba(255,255,255,.14)",
            boxShadow: "0 8px 26px rgba(14,26,36,.28)",
          }}
        >
          {TABS.map(({ href, label, Icon }) => {
            const on = href === active;
            const count = href === "/messages" && unread > 0 ? unread : 0;
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                title={label}
                aria-current={on ? "page" : undefined}
                className={`flex flex-1 items-center justify-center${DESK_ELSEWHERE.has(href) ? " desk-hide" : ""}`}
                style={{ height: PILL - 14, touchAction: "manipulation" }}
              >
                <span
                  className="relative flex items-center justify-center rounded-full transition-colors"
                  style={{
                    width: 46,
                    height: PILL - 16,
                    background: on ? "rgba(255,255,255,.2)" : "transparent",
                    color: on ? "#ffffff" : "rgba(255,255,255,.78)",
                  }}
                >
                  {href === "/me" && me ? (
                    <span className="block rounded-full" style={{ boxShadow: on ? "0 0 0 2px #fff" : "0 0 0 1.5px rgba(255,255,255,.5)" }}>
                      <Avatar name={me.name} mediaId={me.avatarMediaId} size={28} />
                    </span>
                  ) : (
                    <Icon size={23} />
                  )}
                  {count ? (
                    <span
                      className="absolute flex items-center justify-center rounded-full px-1 text-[9.5px] font-bold"
                      style={{ top: 2, right: 4, minWidth: 17, height: 17, background: "var(--color-live)", color: "#fff" }}
                    >
                      {count > 99 ? "+٩٩" : ar(count)}
                    </span>
                  ) : null}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
