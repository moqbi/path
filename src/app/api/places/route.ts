import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { nearbyPlaces } from "@/lib/places";

/**
 * الأماكن حول نقطة.
 *
 * يمرّ الطلب بالخادم لا بالمتصفح: مصدر الأماكن يشترط تعريفاً بالتطبيق،
 * ولأن إحداثيات المستخدم لا تُرسل من جهازه إلى طرفٍ ثالث مباشرة.
 * ولا يُخدم إلا لمسجَّل — الموقع ليس واجهةً عامة.
 */
export async function GET(request: Request) {
  const id = await currentUserId();
  if (!id) return NextResponse.json({ places: [] }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ places: [] }, { status: 400 });
  }

  return NextResponse.json({ places: await nearbyPlaces(lat, lng) });
}
