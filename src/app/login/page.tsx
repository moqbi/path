import fs from "node:fs";
import path from "node:path";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { LoginForm } from "./form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  if (await currentUserId()) redirect("/");
  const { deleted } = await searchParams;

  /*
   * الخلفية صورة حقيقية إن وُجدت في `public/login-bg.jpg`، وإلا تدرّج
   * يحاكي غروب الجبال. الفحص هنا لا في المتصفح حتى لا تومض صورة مفقودة.
   */
  const photo = fs.existsSync(path.join(process.cwd(), "public", "login-bg.jpg"));

  return <LoginForm photo={photo} deleted={deleted === "1"} />;
}
