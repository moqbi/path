import { redirect } from "next/navigation";

/** اللحظات الخاصة صارت عدسةً في الخط الزمني نفسه. */
export default function PrivateRedirect() {
  redirect("/?view=private");
}
