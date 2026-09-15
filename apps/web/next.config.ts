import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  /** لا تُحقَن قواعد الإطار في CLAUDE.md — الملف تعليمات صاحب المشروع. */
  agentRules: false,

  /*
    جذر التتبّع هو جذر المستودع: اللوحة تستورد `@athar/db` و`@athar/storage`
    من `packages/`، وقصُّ ما خرج عن `apps/web` يُسقط العميل المولَّد.
  */
  outputFileTracingRoot: new URL("../..", import.meta.url).pathname,

  /* صور الثيم تصل كملفٍّ في `FormData`، وحدّ الميغا الافتراضي يقطعها. */
  experimental: {
    serverActions: { bodySizeLimit: "16mb" },
  },
};

export default nextConfig;
