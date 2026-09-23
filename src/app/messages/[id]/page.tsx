import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { conversationFor, VOICE_SECONDS } from "@/lib/dm";
import { markConversationRead } from "@/app/actions";
import { Avatar, ScreenHeader } from "@/components/ui";
import { Thread } from "./thread";
import { Composer } from "./composer";

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
          />
        }
      />

      <main className="scroll-area flex flex-col justify-end gap-2 px-5 py-4">
        <Thread lines={conversation.messages} meId={user.id} />
      </main>

      <Composer
        conversationId={id}
        isPlus={user.isPlus}
        maxSeconds={user.isPlus ? VOICE_SECONDS.plus : VOICE_SECONDS.free}
      />
    </div>
  );
}
