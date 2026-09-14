import { HTTPException } from "hono/http-exception";

/**
 * أخطاء المجال.
 *
 * الرسالة للمستخدم بالعربية وبلا تفاصيل داخلية: «لا تملك هذا» لا مسار
 * الملف ولا اسم الجدول. وما لم يُرفع هنا عمداً يُعامَل خطأً غير متوقّع
 * ويُخفى أثره في الإنتاج.
 */
export const badRequest = (message = "طلب غير صالح") =>
  new HTTPException(400, { message });

export const unauthorized = (message = "سجّل الدخول") =>
  new HTTPException(401, { message });

export const forbidden = (message = "غير مصرّح") => new HTTPException(403, { message });

export const notFound = (message = "غير موجود") => new HTTPException(404, { message });

export const tooMany = (message = "محاولات كثيرة — انتظر قليلاً") =>
  new HTTPException(429, { message });
