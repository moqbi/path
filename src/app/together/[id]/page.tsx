import { redirect } from "next/navigation";

export default async function TogetherWithRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/?view=together&with=${id}`);
}
