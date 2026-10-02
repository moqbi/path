/**
 * سببُ التواصل — القائمةُ نفسها في الموقع (`apps/web/src/lib/topics.ts`)
 * والتطبيق، فلا يختلف الاسمُ بين مكانين (القاعدة ١٨٠ب). وملفٌّ بلا `prisma`
 * (القاعدة ١١٢): النموذجُ مكوّنُ عميلٍ يستورده.
 */
export const CONTACT_REASONS = [
  { key: "suggestion", label: "اقتراح" },
  { key: "complaint", label: "شكوى" },
  { key: "report", label: "بلاغ" },
] as const;

export const TOPIC_LABEL: Record<string, string> = {
  suggestion: "اقتراح",
  complaint: "شكوى",
  report: "بلاغ",
  beta: "فريق التجربة",
};

export const BETA_DEVICES = ["iPhone", "Android"] as const;

/** حدودُ المرفقات كالموقع: ثلاثُ صورٍ بخمسة ميغا لكلٍّ (القاعدة ١٧٩). */
export const TICKET_FILES = { max: 3, bytes: 5 * 1024 * 1024 } as const;
