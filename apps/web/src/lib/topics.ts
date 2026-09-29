/**
 * أنواعُ رسائل الموقع — تُقرأ في النماذج واللوحة معاً، فلا يختلف الاسمُ بينهما.
 * وملفٌّ بلا `prisma` (القاعدة ١١٢): النموذجُ مكوّنُ عميل يستورده.
 */
export const CONTACT_REASONS = [
  { key: "suggestion", label: "اقتراح" },
  { key: "complaint", label: "شكوى" },
  { key: "report", label: "بلاغ" },
] as const;

export type ContactReason = (typeof CONTACT_REASONS)[number]["key"];

export const TOPIC_LABEL: Record<string, string> = {
  suggestion: "اقتراح",
  complaint: "شكوى",
  report: "بلاغ",
  careers: "طلب وظيفة",
  beta: "فريق التجربة",
};

export const BETA_DEVICES = ["iPhone", "Android"] as const;
