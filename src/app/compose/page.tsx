import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { circleIds } from "@/lib/circle";
import { ComposeForm } from "./form";

const KINDS = ["PHOTO", "THOUGHT", "PLACE"] as const;
type Kind = (typeof KINDS)[number];

export default async function ComposePage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const { kind } = await searchParams;
  // النوم والأغنية يُنشران من قائمة الزائد مباشرة بلا شاشة.
  if (!KINDS.includes(kind as Kind)) redirect("/");

  const ids = await circleIds(user.id);
  const friends = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return <ComposeForm kind={kind as Kind} friends={friends} />;
}
