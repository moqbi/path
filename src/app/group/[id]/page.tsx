import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { groupThread, markGroupRead } from "@/lib/groups";
import { ScreenHeader } from "@/components/ui";
import { ChatScroll } from "@/components/chat-scroll";
import type { ChatPerson } from "@/components/chat-line";
import { GroupFace } from "@/components/group-face";
import { Thread } from "@/app/messages/[id]/thread";
import { Composer } from "@/app/messages/[id]/composer";
import { ar } from "@/lib/format";

/**
 * المحادثةُ الجماعيّة على الويب (القاعدة ٢١٥): قراءةٌ وكتابةٌ لأعضائها وحدهم،
 * و«غير موجودة» لغيرهم. والإدارةُ — الاسمُ والصورةُ والأعضاء — من التطبيق.
 * والمسارُ `/group/:id` كمسار جرس الجوّال.
 */
export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect("/login");

  const group = await groupThread(user.id, id).catch(() => null);
  if (!group) notFound();
  await markGroupRead(user.id, id);

  const people: Record<string, ChatPerson> = {};
  for (const line of group.messages) people[line.sender.id] = line.sender;

  return (
    <div className="screen">
      <ScreenHeader
        title={group.name}
        back="/messages"
        action={<GroupFace photoMediaId={group.photoMediaId} size={34} />}
      />
      <p className="shrink-0 py-1.5 text-center text-[11px] text-ground-faint">{ar(group.members)} عضو</p>

      <ChatScroll last={group.messages.at(-1)?.id ?? null}>
        <Thread lines={group.messages} meId={user.id} people={people} receipts={false} />
      </ChatScroll>

      <Composer groupId={id} isPlus={user.isPlus} maxSeconds={0} />
    </div>
  );
}
