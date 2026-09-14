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

  /*
    إجراءات الخادم تُحدّ بميغابايت واحد افتراضياً، والصورة تصل كـdata URL
    فيكبر حجمها الثلث بترميز base64: صورةٌ متحركة بثلاثة ميغا تصير أربعة
    في الطلب. كان الحدّ يقطعها قبل أن تصل، فتفشل بلا سبب يُعرض —
    «Body exceeded 1 MB limit» في سجلّ الخادم وحده.
  */
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
