import { redirect } from "next/navigation";
import { SITE_URL } from "@/lib/site-url";

/** رابطُ تذكرةٍ قديم في بريدٍ خرج قبل الانتقال (القاعدة ٤٨٠). */
export default async function TicketMoved({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const safe = /^[a-z0-9]{8,40}$/i.test(id) ? id : "";
  redirect(SITE_URL ? `${SITE_URL}/tickets${safe ? `/${safe}` : ""}` : "/settings/support");
}
