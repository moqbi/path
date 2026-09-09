import { currentUserId } from "@/lib/auth";
import { unseenCount } from "@/lib/notifications";
import { TabBarNav } from "@/components/tabbar";

/**
 * الشريط السفلي: يجلب عدد الجديد ثم يسلّمه للشريط نفسه.
 * الجلب هنا لا في كل صفحة، فلا يتكرّر السطر في ثماني شاشات.
 */
export async function TabBar({ active }: { active: string }) {
  const id = await currentUserId();
  const news = id ? await unseenCount(id) : 0;
  return <TabBarNav active={active} news={news} />;
}
