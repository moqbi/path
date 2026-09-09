import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { conversationFor } from "@/lib/dm";
import { markConversationRead, sendMessage } from "@/app/actions";
import { Avatar, ScreenHeader } from "@/components/ui";
import { timeOfDay } from "@/lib/format";

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
          />
        }
      />

      <main className="scroll-area flex flex-col justify-end gap-2 px-5 py-4">
        {conversation.messages.length === 0 ? (
          <p className="pb-6 text-center text-[13px] text-muted">
            لا رسائل بعد. اكتب أول سطر.
          </p>
        ) : (
          conversation.messages.map((message) => {
            const mine = message.senderId === user.id;
            return (
              <div
                key={message.id}
                className="flex flex-col"
                style={{ alignItems: mine ? "flex-start" : "flex-end" }}
              >
                <div
                  className="max-w-[78%] rounded-2xl px-3.5 py-2.5"
                  style={{
                    background: mine ? "var(--color-clay)" : "var(--color-card)",
                    color: mine ? "var(--color-on-brand)" : "var(--color-ink)",
                    border: mine ? "none" : "1px solid var(--color-line)",
                  }}
                >
                  <p className="text-[13.5px] leading-relaxed">{message.body}</p>
                </div>
                <span className="mt-1 px-1 text-[10px] text-faint">
                  {timeOfDay(message.createdAt)}
                </span>
              </div>
            );
          })
        )}
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
