import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";

/** يبدأ ربط سبوتيفاي. بلا مفاتيح تطبيق لا يوجد ربط، فيُعاد المستخدم بلا ادّعاء. */
export async function GET(request: Request) {
  if (!(await currentUserId())) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) return NextResponse.redirect(new URL("/music", request.url));

  const redirectUri = new URL("/api/music/spotify/callback", request.url).toString();
  const authorize = new URL("https://accounts.spotify.com/authorize");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("scope", "user-read-currently-playing user-read-email");

  return NextResponse.redirect(authorize);
}
