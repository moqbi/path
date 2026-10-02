/**
 * جذرُ تطبيق الويب على النطاق.
 *
 * صفحةُ الهبوط تملك `/` (وهي `apps/web`)، وهذا التطبيق يجلس تحت `/app`.
 * وقيمتُه هنا لا في `next.config.ts` وحده: الإطار يسبق `basePath` إلى
 * `next/link` و`redirect()` و`next/image`، ولا يسبقه إلى `fetch` بمسارٍ
 * مطلق ولا إلى `src` في وسمٍ عاديّ ولا إلى `url(...)` في نمط — وتلك
 * تُكتب بهذا الثابت، فيتغيّر الجذرُ من موضعٍ واحد.
 */
export const BASE = "/app";

/** مسارُ أصلٍ في `public/`: `asset("/reactions/love.png")`. */
export const asset = (path: string) => `${BASE}${path}`;
