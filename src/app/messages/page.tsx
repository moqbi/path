import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { conversationsFor } from "@/lib/dm";
import { Avatar, Empty, ScreenHeader, TabBar } from "@/components/ui";
import { relative } from "@/lib/format";

export default async function MessagesPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const conversations = await conversationsFor(user.id);

  return (
    <div className="flex min-h-dvh flex-col">
      <ScreenHeader title="المحادثات" back="/" />

      <main className="grow px-5 pt-2">
        {conversations.length === 0 ? (
          <Empty
            title="ما عندك محادثات"
            hint="افتح دائرتك واختر أحداً لتبدأ محادثة خاصة معه."
          />
        ) : (
          conversations.map((conversation) => (
            <Link
              key={conversation.id}
              href={`/messages/${conversation.id}`}
              className="flex items-center gap-3 border-b border-line py-3.5"
            >
              <Avatar
                name={conversation.other.name}
                size={46}
                frameSpec={conversation.other.frame?.spec}
              />
              <div className="grow overflow-hidden">
                <div className="mb-0.5 flex items-baseline justify-between gap-2">
                  <span className="text-[14.5px] font-semibold">{conversation.other.name}</span>
                  {conversation.last ? (
                    <span className="shrink-0 text-[10.5px] text-faint">
                      {relative(conversation.last.createdAt)}
                    </span>
                  ) : null}
                </div>
                <p
                  className="truncate text-[12.5px]"
                  style={{
                    color: conversation.unread ? "var(--color-ink)" : "var(--color-muted)",
                    fontWeight: conversation.unread ? 600 : 400,
                  }}
                >
                  {conversation.last?.body ?? "ابدأ الحديث"}
                </p>
              </div>
              {conversation.unread ? (
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: "var(--color-live)" }}
                />
              ) : null}
            </Link>
          ))
        )}
      </main>

      <TabBar active="/messages" />
    </div>
  );
}
