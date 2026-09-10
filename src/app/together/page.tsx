import { redirect } from "next/navigation";

/** آثارنا صارت عدسةً في الخط الزمني نفسه. */
export default function TogetherRedirect() {
  redirect("/?view=together");
}
