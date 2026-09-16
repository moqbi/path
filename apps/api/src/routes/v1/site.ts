import { Hono } from "hono";
import { prisma } from "@athar/db";
import { requireAuth } from "../../middleware/auth";

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
  });
