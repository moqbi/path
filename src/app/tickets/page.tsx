import { redirect } from "next/navigation";
import { SITE_URL } from "@/lib/site-url";

/** نظامُ التذاكر انتقل إلى الجذر (`/tickets` — القاعدة ٤٨٠): رابطٌ قديم لا ينكسر. */
export default function TicketsMoved() {
  redirect(SITE_URL ? `${SITE_URL}/tickets` : "/settings/support");
}
