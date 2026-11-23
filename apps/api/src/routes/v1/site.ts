import { Hono } from "hono";
import { prisma } from "@athar/db";
import { requireAuth } from "../../middleware/auth";
import { supportAccount } from "../../services/support-account";
import { interestCatalog } from "../../services/interests";
import { appVersion } from "../../lib/app-version";

/**
 * محتوى الموقع كما يقرؤه التطبيق.
 *
 * اليوم روابطُ التواصل وحدها: «تابعنا» في شاشة الخصوصية. وهي الصفوفُ
 * نفسها التي يعرضها ذيلُ الموقع — مكانٌ واحد يُدار منه الاثنان، فحسابٌ
 * جديد يظهر فيهما بلا نشر نسخةٍ من أيّهما.
 *
 * وخلف `requireAuth` كبقية الأبواب: لا شيء سرّيّ هنا، لكن باباً مفتوحاً
 * بلا حساب بابٌ يُنادى بلا حدّ.
 */
export const siteRoutes = new Hono()
  .use("*", requireAuth)

  .get("/social", async (c) => {
    const links = await prisma.socialLink.findMany({
      where: { hidden: false },
      orderBy: { sortOrder: "asc" },
      select: { id: true, platform: true, url: true },
    });
    return c.json({ links });
  })

  /** حسابُ الدعم الذي تحيل إليه شاشةُ «الدعم الفني» (القاعدة ٢٢١). */
  .get("/support", async (c) => {
    const account = await supportAccount();
    return c.json({ account });
  })

  /** آخرُ إصدارٍ في المتجر وأدنى ما يُقبل — لنافذة التحديث (القاعدة ٤٣٢). */
  .get("/app-version", async (c) => c.json(await appVersion()))

  /** قائمةُ الاهتمامات كما ضُبطت في اللوحة (القاعدة ٣٧٥). */
  /** مودات «وش مودك؟» الظاهرة بترتيبها (القاعدة ٤٨٤) — تُدار من اللوحة. */
  .get("/moods", async (c) => {
    const moods = await prisma.mood.findMany({
      where: { hidden: false },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, emoji: true, name: true, color: true, mediaId: true },
    });
    return c.json({ moods });
  })
  .get("/interests", async (c) => {
    const { groups } = await interestCatalog();
    return c.json({ groups });
  });
