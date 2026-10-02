/**
 * ترويساتُ ما يُقدَّم من ملفّات الناس.
 *
 * الملفُّ يُقدَّم من نطاق اللوحة نفسه، فلو خرج بنوعٍ يرسمه المتصفّح صفحةً
 * (HTML أو SVG) لجرى ما فيه بكوكي المشرف. فالنوعُ من قائمةٍ مغلقة وما عداه
 * `octet-stream` يُنزَّل ولا يُرسم، و`nosniff` يمنع التخمين، و`sandbox` يعزل
 * ما قد يُفتح منه مباشرةً — حارسٌ ثانٍ خلف فحص البايتات عند الرفع.
 */
const SAFE = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "audio/webm",
  "audio/mp4",
  "audio/ogg",
  "audio/mpeg",
  "audio/aac",
  "video/webm",
  "video/mp4",
  "video/quicktime",
  "application/pdf",
]);

export function servedType(mime: string): string {
  const base = mime.split(";")[0].trim().toLowerCase();
  return SAFE.has(base) ? base : "application/octet-stream";
}

export const SERVED_GUARD = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
} as const;
