import { currentUser } from "@/lib/auth";
import { unreadCount } from "@/lib/dm";
import { TabBarNav } from "@/components/tabbar";

/**
 * الشريط السفلي: يجلب ما يعرضه ثم يسلّمه للشريط نفسه — مرّةً هنا لا في كل صفحة.
 * ما لم يُقرأ من المحادثات، وصورةُ صاحب «أنا» (القاعدة ٢٢٨). والإشعاراتُ جرسٌ
 * في رأس اللحظات (القاعدة ٢٦١).
 */
export async function TabBar({ active }: { active: string; view?: string }) {
  const user = await currentUser();
  const unread = user ? await unreadCount(user.id) : 0;
  return (
    <TabBarNav
      active={active}
      unread={unread}
      me={user ? { name: user.name, avatarMediaId: user.avatarMediaId } : null}
    />
  );
}
