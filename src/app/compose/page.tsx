import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { circleIds } from "@/lib/circle";
import { ComposeSheet } from "./sheet";

export default async function ComposePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const ids = await circleIds(user.id);
  const friends = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return <ComposeSheet friends={friends} />;
}
