import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { LoginForm } from "./form";

export default async function LoginPage() {
  if (await currentUserId()) redirect("/");
  return <LoginForm />;
}
