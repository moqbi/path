/**
 * الرسائلُ النصّيّة الصادرة (القاعدة ٢٩٧) — اليومَ عبر TextBee: جوّالُ أندرويد
 * بشريحته يُرسل ما نطلبه، بلا مزوّدٍ ولا اسم مرسِلٍ مسجّل. **بابٌ واحد يُبدَّل**:
 * مزوّدٌ سعوديٌّ باسم مرسِلٍ مسجّل (القاعدة في `OPS.md`) يُكتب هنا وحده، والشاشاتُ
 * والخادمُ لا يعرفان من أرسل.
 *
 * **وبلا مفتاحٍ يعمل كل شيء** (كالبريد — القاعدة ١١٩): يُكتب المتنُ في السجلّ
 * وفيه الرمز، فتُجرَّب الدورةُ كاملةً في التطوير.
 */
const API = process.env.TEXTBEE_API_URL ?? "https://api.textbee.dev/api/v1/gateway";

export async function sendSms(to: string, message: string): Promise<boolean> {
  const key = process.env.TEXTBEE_API_KEY;
  if (!key) {
    console.info("[sms] لم يُرسَل (بلا TEXTBEE_API_KEY):", to, message);
    return false;
  }
  // مع معرّف الجهاز يُرسل منه بعينه، وبلاه يختار TextBee أوّلَ جهازٍ في الحساب.
  const device = process.env.TEXTBEE_DEVICE_ID;
  const url = device ? `${API}/devices/${encodeURIComponent(device)}/send-sms` : `${API}/send-sms`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "x-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({ recipients: [to], message }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error("[sms] رفضه TextBee:", response.status, (await response.text()).slice(0, 300));
      return false;
    }
    return true;
  } catch (error) {
    console.error("[sms] تعذّر الإرسال:", error);
    return false;
  }
}
