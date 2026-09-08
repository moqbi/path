import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { circleIds } from "@/lib/circle";
import { CheckinForm } from "./form";

export default async function CheckinPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const ids = await circleIds(user.id);
  const friends = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // أماكن مقترحة من تاريخ المستخدم نفسه — أبسط من قاعدة أماكن كاملة في النموذج.
  const recent = await prisma.moment.findMany({
    where: { authorId: user.id, placeName: { not: null } },
    select: { placeName: true },
    distinct: ["placeName"],
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  return (
    <CheckinForm
      friends={friends}
      city={user.city ?? "الرياض"}
      suggestions={recent.map((r) => r.placeName!).filter(Boolean)}
    />
  );
}
