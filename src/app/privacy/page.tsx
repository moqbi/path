import { redirect } from "next/navigation";

/** المسارُ العامّ للوثيقة — تحويلٌ إلى نسختها في التطبيق. */
export default function Page() {
  redirect("/legal/privacy");
}
