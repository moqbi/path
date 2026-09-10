import { redirect } from "next/navigation";

/**
 * التحرير صار نافذةً في تبويب «أنا». الصفحة باقيةٌ تحويلاً وحدها فلا
 * ينكسر رابطٌ قديم أو زرُّ رجوعٍ في متصفّح أحدهم.
 */
export default function EditProfilePage() {
  redirect("/me");
}
