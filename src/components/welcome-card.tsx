"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShareProfile } from "@/app/me/share";
import { CameraIcon, CheckIcon, CloseIcon, PlusIcon, ShareIcon, SparkIcon } from "@/components/icons";
import { ar } from "@/lib/format";
import type { welcome } from "@/lib/welcome";

type Shown = Extract<Awaited<ReturnType<typeof welcome>>, { show: true }>;

const KEY = "athr.welcome.closed";

/**
 * بطاقةُ الترحيب أعلى اللحظات (القاعدة ٢٤٦) — نسخةُ
 * `apps/mobile/components/welcome-card.tsx`: أربعُ خطواتٍ كلٌّ منها زرٌّ يفعلها،
 * وما فُعل يُشطب من القاعدة لا من المتصفّح، و«×» يطويها هنا.
 */
export function WelcomeCard({ data, name, memberNo }: { data: Shown; name: string; memberNo: number }) {
  // `null` حتى يُقرأ المخزن: بطاقةٌ تظهر ثمّ تختفي ومضةٌ لا تُحتمل.
  const [closed, setClosed] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      setClosed(window.localStorage.getItem(KEY) === "1");
    } catch {
      setClosed(false);
    }
  }, []);
  if (closed !== false) return null;

  const close = () => {
    setClosed(true);
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      // المخزنُ مغلق: تُطوى لهذه الصفحة وحدها.
    }
  };

  const steps: { key: string; done: boolean; icon: React.ReactNode; title: string; hint: string; go: (child: React.ReactNode) => React.ReactNode }[] = [
    {
      key: "support",
      done: data.steps.support,
      icon: <SparkIcon size={16} />,
      title: `أضف ${data.supportName ?? "حساب آثار"}`,
      hint: "أخبار التطبيق وجديده في خطّك الزمني من اليوم",
      go: (child) => (data.supportId ? <Link href={`/u/${data.supportId}`}>{child}</Link> : child),
    },
    {
      key: "avatar",
      done: data.steps.avatar,
      icon: <CameraIcon size={16} />,
      title: "ضع صورتك",
      hint: "أصحابك يعرفونك من وجهك قبل اسمك",
      go: (child) => <Link href="/me?edit=1">{child}</Link>,
    },
    {
      key: "friend",
      done: data.steps.friend,
      icon: <ShareIcon size={16} />,
      title: "ادعُ أوّل صديق",
      hint: "شارك رابط ملفك أو رمزه — دائرتك أنت تبنيها",
      go: (child) => (
        <ShareProfile
          name={name}
          memberNo={memberNo}
          trigger={(open) => (
            <button type="button" onClick={open} className="block w-full text-right">
              {child}
            </button>
          )}
        />
      ),
    },
    {
      key: "moment",
      done: data.steps.moment,
      icon: <PlusIcon size={16} />,
      title: "انشر أوّل لحظة",
      hint: "مكانك، أغنيتك، صورة، أو سطر — من زرّ الزائد",
      go: (child) => (
        <button type="button" onClick={() => window.dispatchEvent(new Event("athr:fan"))} className="block w-full text-right">
          {child}
        </button>
      ),
    },
  ];
  const done = steps.filter((step) => step.done).length;

  return (
    <section className="mb-3 rounded-[18px] border bg-card p-3.5" style={{ borderColor: "var(--color-gold-line)" }}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 grow">
          <p className="text-[16px] font-extrabold text-ink">
            أهلاً <span dir="auto">{name}</span>، حيّاك في آثار
          </p>
          <p className="mt-0.5 text-[12px] text-muted">أربع خطوات وتصير آثار بيتك — {ar(done)} من ٤</p>
        </div>
        <button type="button" aria-label="إخفاء" onClick={close} className="p-1 text-muted">
          <CloseIcon size={14} />
        </button>
      </div>

      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--color-gold-soft)" }}>
        <div className="h-full" style={{ width: `${(done / steps.length) * 100}%`, background: "var(--color-clay)" }} />
      </div>

      <div className="mt-1.5">
        {steps.map((step) => {
          const row = (
            <div className="flex items-center gap-3 py-2.5">
              <span
                className="flex shrink-0 items-center justify-center rounded-full"
                style={{
                  width: 34,
                  height: 34,
                  background: step.done ? "var(--color-clay)" : "var(--color-clay-soft)",
                  color: step.done ? "var(--color-on-brand)" : "var(--color-clay-ink)",
                }}
              >
                {step.done ? <CheckIcon size={16} /> : step.icon}
              </span>
              <span className="min-w-0 grow">
                <span
                  className="block text-[14px] font-bold"
                  style={{ color: step.done ? "var(--color-faint)" : "var(--color-ink)", textDecoration: step.done ? "line-through" : "none" }}
                >
                  {step.title}
                </span>
                {step.done ? null : <span className="mt-px block text-[11.5px] text-muted">{step.hint}</span>}
              </span>
              {step.done ? null : (
                <span className="text-[18px]" style={{ color: "var(--color-clay-ink)" }}>
                  ‹
                </span>
              )}
            </div>
          );
          return <div key={step.key}>{step.done ? row : step.go(row)}</div>;
        })}
      </div>
    </section>
  );
}
