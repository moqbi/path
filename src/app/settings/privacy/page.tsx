import { redirect } from "next/navigation";

/**
 * الخصوصية صارت قسماً في «الإعدادات والخصوصية».
 * والصفحة القديمة تحويلٌ فلا ينكسر رابطٌ محفوظ ولا زرٌّ في نسخةٍ قديمة
 * من التطبيق.
 */
export default function PrivacyRedirect() {
  redirect("/settings");
}
