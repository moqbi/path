import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  /**
   * يمنع `next dev` من حقن كتلة `nextjs-agent-rules` في CLAUDE.md.
   *
   * الملف تعليمات مكتوبة بيد صاحب المشروع، وخلط نص يولّده الإطار بها يجعل
   * كل تشغيل للخادم يتّسخ به الفرع. وما تقوله تلك الكتلة مغطّى أصلاً في
   * CLAUDE.md بتوجيه صريح لقراءة node_modules/next/dist/docs.
   */
  agentRules: false,
};

export default nextConfig;
