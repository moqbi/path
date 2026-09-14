/**
 * تحويل الإحداثيات إلى اسم مكان عربي.
 *
 * يجري على الخادم لا في الجهاز: Nominatim تشترط تعريفاً بالتطبيق في
 * ترويسة الطلب، ولأن إخفاء مواقع المستخدمين عن طرف ثالث أفضل حين يمكن.
 * الفشل ليس خطأً يوقف النشر — تُحفظ الإحداثيات ويبقى الاسم فارغاً.
 *
 * نسخةٌ من `src/lib/places.ts` بلا `server-only`: تلك موسومةٌ لـNext،
 * وهذه تعمل تحت node وحده. تُدمجان حين يُسحب الويب القديم.
 */
export type ResolvedPlace = { name: string | null; city: string | null };

export async function reverseGeocode(lat: number, lng: number): Promise<ResolvedPlace> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("accept-language", "ar");
  url.searchParams.set("zoom", "18");

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "AthrApp/0.1 (https://athr.app)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return { name: null, city: null };

    const data = (await response.json()) as { name?: string; address?: Record<string, string> };
    const address = data.address ?? {};
    const city = address.city ?? address.town ?? address.village ?? address.state ?? null;
    const name =
      data.name?.trim() ||
      address.amenity ||
      address.shop ||
      address.road ||
      address.suburb ||
      address.neighbourhood ||
      city ||
      null;

    return { name: name ?? null, city };
  } catch {
    return { name: null, city: null };
  }
}
