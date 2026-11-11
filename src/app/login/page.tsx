import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { LoginForm } from "./form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string; verify?: string }>;
}) {
  if (await currentUserId()) redirect("/");
  const { deleted, verify } = await searchParams;
  return <LoginForm deleted={deleted === "1"} verify={verify ?? ""} />;
}
