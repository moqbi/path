import { currentUser } from "@/lib/auth";
import { unseenCount } from "@/lib/notifications";
import { unreadCount } from "@/lib/dm";
import { TabBarNav } from "@/components/tabbar";

/**
 * الشريط السفلي: يجلب عدد الجديد ثم يسلّمه للشريط نفسه.
 * الجلب هنا لا في كل صفحة، فلا يتكرّر السطر في ثماني شاشات.
 * ومعه ما لم يُقرأ من المحادثات، وصورةُ صاحب «أنا» (القاعدة ٢٢٨).
 */
export async function TabBar({ active, view = "" }: { active: string; view?: string }) {
  const user = await currentUser();
  const [news, unread] = user ? await Promise.all([unseenCount(user.id), unreadCount(user.id)]) : [0, 0];
  return (
    <TabBarNav
      active={active}
      news={news}
      unread={unread}
      view={view}
      me={user ? { name: user.name, avatarMediaId: user.avatarMediaId } : null}
    />
  );
}
