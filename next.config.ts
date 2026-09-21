import type { NextConfig } from "next";
import { BASE } from "./src/lib/base";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  /*
    صفحةُ الهبوط تملك `/` (مشروع `apps/web`)، وهذا التطبيق تحت `/app`.
    والقيمة تُقرأ من `src/lib/base.ts` لا تُكتب هنا رقماً ثانياً: ما لا
    يسبقه الإطارُ بالجذر — `fetch` بمسارٍ مطلق، و`src` في وسمٍ عاديّ،
    و`url(...)` في نمط — يُكتب بذلك الثابت نفسه.
    وهي تُدمج في حزمة المتصفّح وقت البناء، فتغييرُها يستلزم بناءً جديداً.
  */
  basePath: BASE,

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
    «Body exceeded 1 MB limit» في سجلّ الخادم وحده. وفيديو القصة تسعة
    ميغا، فالحدّ يتّسع له ولمغلّفه.
  */
  experimental: {
    serverActions: { bodySizeLimit: "16mb" },
  },
};

export default nextConfig;
