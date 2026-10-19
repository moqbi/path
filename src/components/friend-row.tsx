"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { blockUser, createGroupWith, removeFriend, setFriendGroup, startConversation } from "@/app/actions";
import { SwipeRow } from "@/components/swipe-row";
import { Sheet } from "@/components/sheet";
import { CheckIcon, MessageIcon, TagIcon, UserPlusIcon } from "@/components/icons";
import { ShareProfile } from "@/app/me/share";

type Group = { id: string; name: string };

/**
 * صفُّ الصديق قالباً — نسخةُ الجوّال (القاعدة ٢٦٨): السحبُ يكشف المحادثة
 * والتصنيف والحظر والإزالة، والصفُّ نفسه يفتح الملف. والوجهُ والاسمُ يرسمهما
 * الخادم (`children`) لأنّ الصورة والوسم مكوّنا خادم.
 */
export function FriendRow({
  id,
  name,
  group,
  groups,
  children,
}: {
  id: string;
  name: string;
  group: Group | null;
  groups: Group[];
  children: React.ReactNode;
}) {
  const [tagging, setTagging] = useState(false);

  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      <SwipeRow
        icons
        surface="var(--color-card)"
        confirmLabel="إزالة"
        onDelete={removeFriend.bind(null, id)}
        secondLabel="حظر"
        onSecond={blockUser.bind(null, id)}
        extra={[
          { label: `محادثة ${name}`, icon: <MessageIcon size={22} />, run: startConversation.bind(null, id) },
          { label: "تصنيف", icon: <TagIcon size={22} />, run: () => setTagging(true), color: "var(--color-gold)" },
        ]}
      >
        <Link href={`/u/${id}`} className="flex items-center gap-3 p-3">
          {children}
        </Link>
      </SwipeRow>
      {tagging ? <GroupSheet friendId={id} name={name} current={group} groups={groups} onClose={() => setTagging(false)} /> : null}
    </div>
  );
}

/** نافذةُ التصنيف: تصنيفاتُك بعلامةٍ على الحاليّ، و«بلا تصنيف»، وحقلٌ يُنشئ ويضع. */
function GroupSheet({
  friendId,
  name,
  current,
  groups,
  onClose,
}: {
  friendId: string;
  name: string;
  current: Group | null;
  groups: Group[];
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [fresh, setFresh] = useState("");
  const [error, setError] = useState<string | null>(null);

  const pick = (groupId: string) =>
    start(async () => {
      const data = new FormData();
      data.set("groupId", groupId);
      await setFriendGroup(friendId, data);
      onClose();
    });

  const create = () =>
    start(async () => {
      const said = await createGroupWith(friendId, fresh);
      if (said) setError(said);
      else onClose();
    });

  const option = (label: string, groupId: string, on: boolean) => (
    <button
      key={groupId || "none"}
      type="button"
      disabled={pending}
      onClick={() => pick(groupId)}
      className="flex h-12 items-center justify-between rounded-xl border px-4 text-[14px] font-semibold disabled:opacity-60"
      style={{
        borderColor: on ? "var(--color-clay)" : "var(--color-line)",
        background: on ? "var(--color-clay-soft)" : "var(--color-card)",
        color: on ? "var(--color-clay-ink)" : "var(--color-ink)",
      }}
    >
      {label}
      {on ? <CheckIcon size={16} /> : null}
    </button>
  );

  return (
    <Sheet title={`تصنيف ${name}`} onClose={onClose}>
      <p className="mb-3 text-center text-[12px] text-faint">التصنيف لك وحدك ولا يراه أحد.</p>
      <div className="flex flex-col gap-2">
        {groups.map((group) => option(group.name, group.id, current?.id === group.id))}
        {option("بلا تصنيف", "", !current)}
      </div>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          create();
        }}
      >
        <input
          value={fresh}
          onChange={(event) => {
            setFresh(event.target.value);
            setError(null);
          }}
          maxLength={20}
          placeholder="تصنيف جديد — العائلة، الزملاء…"
          aria-label="تصنيف جديد"
          className="min-w-0 grow rounded-xl border border-line bg-paper px-4 text-[13.5px] text-ink outline-none focus:border-clay"
          style={{ height: 46 }}
        />
        <button
          type="submit"
          disabled={pending || !fresh.trim()}
          className="shrink-0 rounded-xl px-4 text-[13px] font-bold disabled:opacity-50"
          style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
        >
          أضف
        </button>
      </form>
      {error ? (
        <p role="alert" className="mt-2 text-center text-[12.5px] text-clay-ink">
          {error}
        </p>
      ) : null}
    </Sheet>
  );
}

/**
 * زرُّ الإضافة في رأس الأصدقاء — كالجوّال (القاعدة ٢٨١)، وفي الويب يفتح نافذةَ
 * المشاركة بالرابط والرمز: الويبُ لا يحمل البحث ولا «من حولك» بعد.
 */
export function AddFriendButton({ name, memberNo }: { name: string; memberNo: number }) {
  return (
    <ShareProfile
      name={name}
      memberNo={memberNo}
      trigger={(open) => (
        <button
          type="button"
          onClick={open}
          aria-label="إضافة صديق"
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{ background: "rgba(255,255,255,.08)", color: "var(--color-chrome-ink)" }}
        >
          <UserPlusIcon size={20} />
        </button>
      )}
    />
  );
}
