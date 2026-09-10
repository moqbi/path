import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { conversationFor } from "@/lib/dm";
import { markConversationRead, sendMessage } from "@/app/actions";
import { Avatar, ScreenHeader } from "@/components/ui";
import { Thread } from "./thread";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await currentUser();
  if (!user) redirect("/login");

  const conversation = await conversationFor(user.id, id);
  if (!conversation) notFound();

  await markConversationRead(id);
  const send = sendMessage.bind(null, id);

  return (
    <div className="screen">
      <ScreenHeader
        title={conversation.other.name}
        back="/messages"
        action={
          <Avatar
            name={conversation.other.name}
            size={34}
            frameSpec={conversation.other.frame?.spec}
            charm={conversation.other.charm}
          />
        }
      />

      <main className="scroll-area flex flex-col justify-end gap-2 px-5 py-4">
        <Thread lines={conversation.messages} meId={user.id} />
      </main>

      <form action={send} className="flex items-center gap-2 px-5 pb-8 pt-3">
        <input
          name="body"
          required
          maxLength={2000}
          autoComplete="off"
          placeholder="اكتب رسالة…"
          className="grow rounded-full border border-line bg-card px-5 text-[13.5px] text-ink outline-none placeholder:text-faint focus:border-clay"
          style={{ height: 48 }}
        />
        <button
          type="submit"
          className="brand-gradient shrink-0 rounded-full px-5 text-[13.5px] font-bold"
          style={{ height: 48, color: "var(--color-on-brand)" }}
        >
          إرسال
        </button>
      </form>
    </div>
  );
}
