import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { circleIds } from "@/lib/circle";
import { ComposeForm } from "./form";

const KINDS = ["PHOTO", "THOUGHT", "PLACE", "MUSIC"] as const;
type Kind = (typeof KINDS)[number];

export default async function ComposePage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const { kind } = await searchParams;
  // النوم وحده يُنشر من قائمة الزائد مباشرة بلا شاشة.
  if (!KINDS.includes(kind as Kind)) redirect("/");

  const ids = await circleIds(user.id);
  const [friends, groups, settings] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, avatarMediaId: true },
      orderBy: { name: "asc" },
    }),
    prisma.friendGroup.findMany({
      where: { ownerId: user.id },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, _count: { select: { members: true } } },
    }),
    prisma.user.findUnique({ where: { id: user.id }, select: { viewGroupId: true } }),
  ]);

  return (
    <ComposeForm
      kind={kind as Kind}
      friends={friends}
      groups={groups.map((group) => ({ id: group.id, name: group.name, count: group._count.members }))}
      defaultGroupId={settings?.viewGroupId ?? null}
    />
  );
}
