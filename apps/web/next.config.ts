import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /* «X-Powered-By: Next.js» يقول للماسح أيَّ ثغراتٍ يجرّب أوّلاً. */
  poweredByHeader: false,

  /** لا تُحقَن قواعد الإطار في CLAUDE.md — الملف تعليمات صاحب المشروع. */
  agentRules: false,

  /*
    جذر التتبّع هو جذر المستودع: اللوحة تستورد `@athar/db` و`@athar/storage`
    من `packages/`، وقصُّ ما خرج عن `apps/web` يُسقط العميل المولَّد.
  */
  outputFileTracingRoot: new URL("../..", import.meta.url).pathname,

  /*
    ترويساتُ الحماية هنا أيضاً لا في Caddy وحده: بيئةٌ بلا Caddy (تجربةٌ
    محليّة، أو مضيفٌ آخر يوماً) كانت تخرج بلا شيء. وCaddy يكتب فوقها بالقيم
    نفسها فلا تتكرّر.
    و`frame-ancestors 'none'` يمنع وضع اللوحة في إطارٍ يخدع المشرف بضغطة،
    و`form-action 'self'` يمنع نموذجاً محقوناً من إرسال ما فيه خارج النطاق،
    و`base-uri 'self'` يمنع `<base>` يحوّل الروابط النسبية. ولا `script-src`:
    Next يحقن نصوصاً في السطر، وسياسةٌ تكسرها أسوأ من غيابها.
  */
  async headers() {
    return [
      {
        // الصفحاتُ وحدها: ملفّاتُ `/api` تكتب سياستها بنفسها (`lib/served.ts`
        // بـ`sandbox`)، وقاعدةٌ هنا تُطابقها كانت تكتب فوقها فتذهب العزلة.
        source: "/((?!api/).*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },

  /* صور الثيم تصل كملفٍّ في `FormData`، وحدّ الميغا الافتراضي يقطعها. */
  experimental: {
    serverActions: { bodySizeLimit: "16mb" },
  },
};

export default nextConfig;
