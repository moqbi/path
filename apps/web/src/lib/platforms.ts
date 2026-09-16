/**
 * منصّات التواصل — ملفٌّ بلا قاعدة قصداً.
 *
 * لوحةُ التحرير مكوّنُ عميل، ولو قرأت القائمةَ من `lib/site.ts` لجرّت
 * معها `prisma` إلى حزمة المتصفّح — فيسقط البناء بـ«لا أجد `dns`»،
 * وهو خطأٌ لا يقول شيئاً عن سببه. فما يقرؤه الطرفان يجلس وحده.
 *
 * والأيقونة تُختار بالاسم لا بالرابط: رابطُ `x.com` لا يقول إن كان
 * حساباً أم منشوراً، و«أخرى» تبقى لما لا نعرفه فلا يُمنع المشرف من
 * إضافته.
 */
export const PLATFORMS = [
  { key: "x", name: "إكس" },
  { key: "instagram", name: "إنستقرام" },
  { key: "snapchat", name: "سناب شات" },
  { key: "tiktok", name: "تيك توك" },
  { key: "youtube", name: "يوتيوب" },
  { key: "whatsapp", name: "واتساب" },
  { key: "telegram", name: "تيليقرام" },
  { key: "linkedin", name: "لينكدإن" },
  { key: "other", name: "أخرى" },
] as const;

export const platformName = (key: string): string =>
  PLATFORMS.find((one) => one.key === key)?.name ?? key;
