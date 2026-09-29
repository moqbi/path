import "server-only";
import { headers } from "next/headers";

/**
 * هل الطلبُ من متصفّح سطح مكتب؟
 *
 * العمودان الجانبيّان (الأصدقاء، و«أنا» مع الإشعارات) يُرسمان على الخادم،
 * فلا يُحمَّل ثمنُ استعلاماتهما على جوّالٍ لن يعرضهما أصلاً. والعرضُ نفسه
 * يحسمه CSS (`.desk` من ١٢٠٠ بكسل): نافذةُ كمبيوترٍ ضيّقة تعود هاتفاً كما
 * كانت. وآيباد يتسمّى «Macintosh» فيُعامَل كمبيوتراً — وفي عرضه الأفقيّ
 * تتّسع له الأعمدة الثلاثة.
 */
export async function isDesktopRequest(): Promise<boolean> {
  const list = await headers();
  if (list.get("sec-ch-ua-mobile") === "?1") return false;
  const agent = list.get("user-agent") ?? "";
  return !/Mobi|Android|iPhone|iPod|iPad/i.test(agent);
}
