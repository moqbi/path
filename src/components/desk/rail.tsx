"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AthrMark } from "@/components/brand";
import { ComposerFan } from "@/components/composer-fan";
import { BellIcon, CircleIcon, HomeIcon, MessageIcon, StoreIcon } from "@/components/icons";
import { Avatar } from "@/components/ui";
import { ar } from "@/lib/format";

const LINKS = [
  { href: "/", label: "اللحظات", Icon: HomeIcon },
  { href: "/circle", label: "الأصدقاء", Icon: CircleIcon },
  { href: "/messages", label: "المحادثات", Icon: MessageIcon },
  { href: "/store", label: "المتجر", Icon: StoreIcon },
  { href: "/notifications", label: "الإشعارات", Icon: BellIcon },
];

/**
 * شريطُ أيقونات سطح المكتب — **بقرار المالك** (القاعدة ٤٥٦): الأقسامُ الخمسة
 * في طرف البداية، وزرُّ النشر بقوسه كما رُسم أوّلَ مرّة (ربعُ دائرةٍ من ركنٍ
 * يمينيّ)، و«أنا» صورةُ صاحبها في أسفله. والشريطُ السفليّ يختفي بجانبه.
 */
export function DeskRail({
  me,
  unread,
  unseen,
}: {
  me: { name: string; avatarMediaId: string | null };
  /** ما لم يُقرأ من المحادثات — رقمٌ (القاعدة ١٥١). */
  unread: number;
  /** ما لم يُقرأ من الإشعارات — نقطة (القاعدة ٢٣١). */
  unseen: number;
}) {
  const pathname = usePathname();
  const on = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <nav className="desk-rail" aria-label="الأقسام">
      <Link href="/" aria-label="آثار" className="mb-3 flex h-12 w-12 items-center justify-center">
        <AthrMark size={34} />
      </Link>

      {LINKS.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          aria-label={label}
          title={label}
          aria-current={on(href) ? "page" : undefined}
          className="desk-rail-link"
        >
          <Icon size={24} />
          {href === "/messages" && unread > 0 ? (
            <span
              className="absolute flex items-center justify-center rounded-full px-1 text-[9.5px] font-bold"
              style={{ top: 4, right: 2, minWidth: 17, height: 17, background: "var(--color-live)", color: "#fff" }}
            >
              {unread > 99 ? "+٩٩" : ar(unread)}
            </span>
          ) : null}
          {href === "/notifications" && unseen > 0 ? (
            <span
              className="absolute block rounded-full"
              style={{ top: 10, right: 11, width: 9, height: 9, background: "var(--color-live)", border: "1.5px solid var(--color-chrome)" }}
            />
          ) : null}
        </Link>
      ))}

      <span className="grow" />
      <ComposerFan mode="rail" />
      <Link
        href="/me"
        aria-label="أنا"
        title="أنا"
        aria-current={on("/me") ? "page" : undefined}
        className="mt-2 block rounded-full"
        style={{ boxShadow: on("/me") ? "0 0 0 2px var(--color-clay)" : "0 0 0 1.5px rgba(255,255,255,.35)" }}
      >
        <Avatar name={me.name} mediaId={me.avatarMediaId} size={40} />
      </Link>
    </nav>
  );
}
