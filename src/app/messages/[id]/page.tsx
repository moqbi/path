import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { conversationFor, VOICE_SECONDS } from "@/lib/dm";
import { markConversationRead } from "@/app/actions";
import { Avatar, ScreenHeader } from "@/components/ui";
import { Thread } from "./thread";
import { Composer } from "./composer";
import { ChatScroll } from "@/components/chat-scroll";

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

  return (
    <div className="screen">
      <ScreenHeader
        title={conversation.other.name}
        titleHref={`/u/${conversation.other.id}`}
        back="/messages"
        action={
          <Avatar
            name={conversation.other.name}
            size={34}
            frame={conversation.other.frame}
            charm={conversation.other.charm}
            mediaId={conversation.other.avatarMediaId}
          />
        }
      />

      <ChatScroll last={conversation.messages.at(-1)?.id ?? null}>
        <Thread
          lines={conversation.messages}
          meId={user.id}
          people={{ [conversation.me.id]: conversation.me, [conversation.other.id]: conversation.other }}
        />
      </ChatScroll>

      <Composer
        conversationId={id}
        isPlus={user.isPlus}
        maxSeconds={user.isPlus ? VOICE_SECONDS.plus : VOICE_SECONDS.free}
      />
    </div>
  );
}
