/**
 * ملفُّ ربط النطاق بالتطبيق (Universal Links — القاعدة ٢٢٥).
 *
 * آبل تقرؤه من `https://<النطاق>/.well-known/apple-app-site-association`
 * عند تثبيت التطبيق وتحديثه، فتفتح روابطَ `/u/*` في التطبيق لمن نزّله، وفي
 * المتصفّح لمن لم ينزّله — بلا مهلةٍ ولا تخمين.
 *
 * وصفحةُ المشاركة وحدها (`/u/*`): الهبوطُ واللوحةُ وصفحاتُ المتجرين تبقى
 * في المتصفّح. ومعرّفُ الفريق من البيئة (`APPLE_TEAM_ID`) — وبلاه «غير موجود»،
 * فملفٌّ بمعرّفٍ خاطئٍ تحفظه آبل ولا تعود تسأل عنه إلا مع التحديث.
 */
const BUNDLE_ID = "app.athar.mobile";

export const dynamic = "force-dynamic";

export function GET() {
  const team = (process.env.APPLE_TEAM_ID ?? "").trim();
  if (!/^[A-Z0-9]{10}$/.test(team)) return new Response("Not found", { status: 404 });

  return Response.json(
    {
      applinks: {
        details: [{ appIDs: [`${team}.${BUNDLE_ID}`], components: [{ "/": "/u/*" }] }],
      },
    },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
