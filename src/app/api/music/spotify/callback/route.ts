import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** يستبدل رمز التفويض برموز الوصول ويخزّنها على حساب المستخدم. */
export async function GET(request: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.redirect(new URL("/login", request.url));

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const code = new URL(request.url).searchParams.get("code");
  if (!clientId || !clientSecret || !code) {
    return NextResponse.redirect(new URL("/music", request.url));
  }

  const redirectUri = new URL("/api/music/spotify/callback", request.url).toString();

  try {
    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!tokenResponse.ok) return NextResponse.redirect(new URL("/music", request.url));

    const token = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    const profile = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(6000),
    })
      .then((r) => (r.ok ? (r.json() as Promise<{ display_name?: string }>) : null))
      .catch(() => null);

    await prisma.user.update({
      where: { id: userId },
      data: {
        musicProvider: "SPOTIFY",
        musicAccountName: profile?.display_name ?? null,
        musicAccessToken: token.access_token,
        musicRefreshToken: token.refresh_token ?? null,
        musicTokenExpires: new Date(Date.now() + token.expires_in * 1000),
      },
    });
  } catch {
    // فشل الشبكة لا يترك الحساب نصف مربوط — يُعاد المستخدم ويحاول.
  }

  return NextResponse.redirect(new URL("/music", request.url));
}
