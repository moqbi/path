"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { GlassSheet } from "@/components/glass-sheet";
import { Avatar, NameTag } from "@/components/ui";
import { BackIcon, PinIcon, SearchIcon, ShareIcon, UserPlusIcon } from "@/components/icons";
import { Qr } from "@/app/me/share";
import { addFromSheet, findFriends, leaveNearby, pingNearby, type Found } from "@/app/circle/add-actions";
import { ar } from "@/lib/format";

type Mode = "home" | "near" | "qr";
type Me = { name: string; memberNo: number; avatarMediaId: string | null; frame: Found["frame"]; charm: Found["charm"] };

const LABEL: Record<Found["relation"], string> = { none: "أضف", incoming: "اقبل", sent: "أُرسل", friend: "صديقك" };
const glass = { background: "rgba(255,255,255,.08)", borderRadius: 16 } as const;

/**
 * «إضافة صديق» — نسخةُ `apps/mobile/components/add-sheet.tsx` (القاعدتان ٢٨٠ و٢٨١):
 * نافذةٌ زجاجيّة في رأسها البحثُ بالمعرّف أو الاسم الكامل ونتائجُه، ثمّ بابان — «من
 * حولك» برادار، و«الرمز والرابط». والزرُّ في رأس تبويب الأصدقاء.
 */
export function AddFriendButton({ me }: { me: Me }) {
  const [mode, setMode] = useState<Mode | null>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => setMode("home")}
        aria-label="إضافة صديق"
        className="flex h-10 w-10 items-center justify-center rounded-full"
        style={{ background: "rgba(255,255,255,.08)", color: "var(--color-chrome-ink)" }}
      >
        <UserPlusIcon size={20} />
      </button>
      {mode ? <Body me={me} mode={mode} go={setMode} close={() => setMode(null)} /> : null}
    </>
  );
}

function Body({ me, mode, go, close }: { me: Me; mode: Mode; go: (mode: Mode) => void; close: () => void }) {
  const [done, setDone] = useState<Record<string, Found["relation"]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const add = async (person: Found) => {
    setBusy(person.id);
    setError(null);
    const res = await addFromSheet(person.id);
    setBusy(null);
    if ("error" in res) setError(res.error);
    else setDone((all) => ({ ...all, [person.id]: person.relation === "incoming" ? "friend" : "sent" }));
  };

  const row = (person: Found, alias = false) => (
    <PersonRow
      key={person.id}
      person={person}
      alias={alias}
      relation={done[person.id] ?? person.relation}
      pending={busy === person.id}
      onAdd={() => void add(person)}
    />
  );

  const title = mode === "near" ? "من حولك" : mode === "qr" ? "رمزك ورابطك" : "إضافة صديق";
  const subtitle =
    mode === "near"
      ? "افتحوها معاً وأنتم قريبين"
      : mode === "qr"
        ? "لمن يقف أمامك يمسحه، ولمن تراسله الرابط"
        : "بالمعرّف أو الاسم الكامل، أو من حولك";

  return (
    <GlassSheet title={title} subtitle={subtitle} onClose={close}>
      {mode !== "home" ? (
        <button
          type="button"
          onClick={() => go("home")}
          className="mx-4 mb-1 flex items-center gap-1 text-[12.5px] font-bold"
          style={{ color: "rgba(255,255,255,.7)" }}
        >
          <BackIcon size={16} /> رجوع
        </button>
      ) : null}
      {mode === "home" ? <Home go={go} row={row} /> : null}
      {mode === "near" ? <Near me={me} row={row} /> : null}
      {mode === "qr" ? <QrPane me={me} /> : null}
      {error ? (
        <p role="alert" className="pb-3 text-center text-[12.5px]" style={{ color: "#FF9C84" }}>
          {error}
        </p>
      ) : null}
    </GlassSheet>
  );
}

/** المعرّفُ إن وُجد، وإلّا الاسمُ الأوّل وحده — «من حولك» لا تُري الاسمَ كاملاً (القاعدة ٢٨٢). */
const aliasOf = (person: Found) =>
  person.handle ? `⁨@${person.handle}⁩` : (person.name.trim().split(/\s+/)[0] ?? person.name);

function PersonRow({
  person,
  relation,
  pending,
  onAdd,
  alias,
}: {
  person: Found;
  relation: Found["relation"];
  pending: boolean;
  onAdd: () => void;
  alias: boolean;
}) {
  const live = relation === "none" || relation === "incoming";
  return (
    <div className="flex items-center gap-3 py-2">
      <Link href={`/u/${person.id}`} className="flex min-w-0 grow items-center gap-3">
        <Avatar name={person.name} size={44} mediaId={person.avatarMediaId} frame={person.frame} charm={person.charm} />
        <span className="min-w-0 grow">
          <span className="flex items-center gap-1.5">
            <span dir="auto" className="truncate text-[14.5px] font-bold text-white">
              {alias ? aliasOf(person) : person.name}
            </span>
            <NameTag isPlus={person.isPlus} tag={person.tag} size={10} />
          </span>
          <span className="block text-[11.5px]" style={{ color: "rgba(255,255,255,.55)" }}>
            عضوية رقم {ar(person.memberNo)}
            {person.handle && !alias ? ` │ ⁨@${person.handle}⁩` : ""}
          </span>
        </span>
      </Link>
      <button
        type="button"
        disabled={!live || pending}
        onClick={onAdd}
        className="flex h-[34px] min-w-16 shrink-0 items-center justify-center rounded-full px-3.5 text-[12.5px] font-bold disabled:opacity-80"
        style={{
          background: live ? "var(--color-clay)" : "rgba(255,255,255,.1)",
          color: live ? "var(--color-on-brand)" : "rgba(255,255,255,.6)",
        }}
      >
        {pending ? "…" : LABEL[relation]}
      </button>
    </div>
  );
}

function Home({ go, row }: { go: (mode: Mode) => void; row: (person: Found) => React.ReactNode }) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Found[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ready = query.trim().length >= 2;

  const search = () =>
    ready &&
    start(async () => {
      const res = await findFriends(query.trim());
      if ("error" in res) {
        setError(res.error);
        setFound(null);
      } else {
        setError(null);
        setFound(res.people);
      }
    });

  const door = (label: string, hint: string, icon: React.ReactNode, to: Mode) => (
    <button type="button" onClick={() => go(to)} className="flex w-full items-center gap-3 p-3.5 text-right" style={glass}>
      <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full text-white" style={{ background: "rgba(255,255,255,.12)" }}>
        {icon}
      </span>
      <span className="grow">
        <span className="block text-[15px] font-extrabold text-white">{label}</span>
        <span className="block text-[12px]" style={{ color: "rgba(255,255,255,.6)" }}>{hint}</span>
      </span>
      <span className="text-[18px]" style={{ color: "rgba(255,255,255,.5)" }}>‹</span>
    </button>
  );

  return (
    <div className="flex flex-col gap-3 p-4 pt-1">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          search();
        }}
        className="flex h-12 items-center gap-2 px-3.5"
        style={glass}
      >
        <span style={{ color: "rgba(255,255,255,.6)" }}>
          <SearchIcon size={18} />
        </span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="المعرّف أو الاسم الكامل"
          aria-label="المعرّف أو الاسم الكامل"
          autoCapitalize="none"
          autoCorrect="off"
          enterKeyHint="search"
          className="min-w-0 grow bg-transparent text-[15px] text-white outline-none placeholder:text-white/40"
        />
        {pending ? (
          <span className="text-[12px] text-white/70">…</span>
        ) : ready ? (
          <button type="submit" className="text-[14px] font-extrabold" style={{ color: "var(--color-clay)" }}>
            ابحث
          </button>
        ) : null}
      </form>

      {error ? (
        <p className="text-[12.5px]" style={{ color: "#FF9C84" }}>{error}</p>
      ) : found ? (
        found.length ? (
          <div>{found.map((person) => row(person))}</div>
        ) : (
          <p className="text-[12.5px]" style={{ color: "rgba(255,255,255,.6)" }}>
            ما لقينا أحداً — اكتب المعرّف أو الاسم كاملاً كما هو.
          </p>
        )
      ) : null}

      {door("من حولك", "لمن يقف جنبك الحين", <PinIcon size={19} />, "near")}
      {door("الرمز والرابط", "رمز QR ورابط ملفك للمشاركة", <ShareIcon size={18} />, "qr")}
    </div>
  );
}

/** «من حولك»: منارةٌ كلّ أربع ثوانٍ ما دامت الشاشةُ مفتوحة، ورادارٌ تنبض هالاتُه حول صورتك. */
function Near({ me, row }: { me: Me; row: (person: Found, alias?: boolean) => React.ReactNode }) {
  const [state, setState] = useState<"asking" | "on" | "denied">("asking");
  const [people, setPeople] = useState<Found[]>([]);
  const [rang, setRang] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    if (!("geolocation" in navigator)) {
      setState("denied");
      return;
    }
    let timer: ReturnType<typeof setInterval> | null = null;
    const beat = () =>
      navigator.geolocation.getCurrentPosition(
        async (here) => {
          if (!alive.current) return;
          setState("on");
          const res = await pingNearby(here.coords.latitude, here.coords.longitude);
          if (!alive.current || "error" in res) return;
          setPeople(res.people);
          if (res.rang) setRang(true);
        },
        (error) => {
          if (alive.current && error.code === error.PERMISSION_DENIED) setState("denied");
        },
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5_000 },
      );
    beat();
    timer = setInterval(beat, 4000);
    // الخروجُ من الوجه — رجوعاً أو إغلاقاً — يُطفئ المنارة.
    return () => {
      alive.current = false;
      if (timer) clearInterval(timer);
      void leaveNearby();
    };
  }, []);

  const R = 220;
  const ring = people.slice(0, 8);

  return (
    <div className="p-4 pt-2">
      <style>{`@keyframes athr-pulse{0%{transform:scale(.5);opacity:.7}100%{transform:scale(2.2);opacity:0}}`}</style>
      <div className="relative flex items-center justify-center" style={{ height: R + 20 }}>
        {state === "on"
          ? [0, 800, 1600].map((delay) => (
              <span
                key={delay}
                aria-hidden
                className="absolute rounded-full"
                style={{
                  width: R * 0.5,
                  height: R * 0.5,
                  border: "2px solid var(--color-clay)",
                  background: "rgba(246,185,59,.08)",
                  animation: `athr-pulse 2400ms ease-out ${delay}ms infinite`,
                  opacity: 0,
                }}
              />
            ))
          : null}
        <Avatar name={me.name} size={84} mediaId={me.avatarMediaId} frame={me.frame} charm={me.charm} />
        {ring.map((person, index) => {
          const angle = (index / Math.max(ring.length, 1)) * Math.PI * 2 - Math.PI / 2;
          const radius = R / 2 - 6;
          return (
            <span
              key={person.id}
              className="absolute"
              style={{ left: "50%", top: "50%", transform: `translate(${Math.cos(angle) * radius - 22}px, ${Math.sin(angle) * radius - 22}px)` }}
            >
              <Avatar name={person.name} size={44} mediaId={person.avatarMediaId} frame={person.frame} charm={person.charm} />
            </span>
          );
        })}
      </div>

      {state === "denied" ? (
        <p className="text-center text-[12.5px]" style={{ color: "#FF9C84" }}>
          نحتاج إذن الموقع لنعرف من حولك — يُفعَّل من إعدادات المتصفّح.
        </p>
      ) : people.length ? (
        <div>
          <p className="mb-0.5 text-[12px]" style={{ color: "rgba(255,255,255,.6)" }}>
            حولك الحين ({ar(people.length)})
          </p>
          {people.map((person) => row(person, true))}
        </div>
      ) : (
        <p className="text-center text-[13px]" style={{ color: "rgba(255,255,255,.7)" }}>
          نبحث عمّن فتحها جنبك…
        </p>
      )}
      <p className="mt-3.5 text-center text-[11px]" style={{ color: "rgba(255,255,255,.4)" }}>
        {rang
          ? "نبّهنا من فعّل «من حولك» قريباً منك — وتبقى ظاهراً لهم عشر دقائق."
          : "موقعك لا يُرسل لأحد — يظهر معرّفك وصورتك لمن فتحها جنبك، ومن فعّل تنبيهها يوصله خبر بلا اسم."}
      </p>
    </div>
  );
}

function QrPane({ me }: { me: Me }) {
  const [said, setSaid] = useState<string | null>(null);
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/u/${me.memberNo}`;
  const text = `ملف ${me.name} في آثار · عضوية رقم ${ar(me.memberNo)}`;

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: "آثار", text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setSaid("نُسخ الرابط");
      setTimeout(() => setSaid(null), 1800);
    } catch {
      // إلغاءُ المشاركة ليس خطأً يُعرض.
    }
  }

  return (
    <div className="flex flex-col p-4 pt-3">
      {url ? (
        <div className="mx-auto flex flex-col items-center rounded-3xl bg-white p-4">
          <Qr value={url} size={200} />
          <b className="mt-2 text-[16px]" style={{ color: "var(--color-night)" }}>{me.name}</b>
          <span className="text-[12px]" style={{ color: "#6b7680" }}>عضوية رقم {ar(me.memberNo)}</span>
        </div>
      ) : null}
      <p dir="ltr" className="mt-3 select-all break-all text-center text-[12.5px]" style={{ color: "rgba(255,255,255,.75)" }}>
        {url}
      </p>
      <button
        type="button"
        onClick={() => void share()}
        className="mt-3.5 flex h-[50px] items-center justify-center gap-2 rounded-full text-[15px] font-extrabold"
        style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
      >
        <ShareIcon size={18} />
        {said ?? "شارك الرابط"}
      </button>
    </div>
  );
}
