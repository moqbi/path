import { env } from "../env";

/**
 * آخرُ إصدارٍ في متجر آبل (القاعدة ٤٣٢) — من واجهة البحث العامّة (`itunes.apple.com/lookup`)
 * بمعرّف الحزمة، بلا مفتاح. يُسأل من الخادم لا من الجهاز، ويُحفظ ساعةً: ألفُ جهازٍ يُقلع
 * لا يسأل آبل ألف مرّة. والفشلُ يُبقي آخرَ ما عُرف، أو لا شيء — فلا يُطلب تحديثٌ بلا يقين.
 */
const BUNDLE = "app.athar.mobile";
let cached: { latest: string; url: string; at: number } | null = null;

async function lookup(): Promise<{ latest: string; url: string } | null> {
  if (cached && Date.now() - cached.at < 3_600_000) return cached;
  try {
    const response = await fetch(`https://itunes.apple.com/lookup?bundleId=${BUNDLE}&country=sa&t=${Date.now()}`, {
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) return cached;
    const data = (await response.json()) as { results?: { version?: string; trackViewUrl?: string }[] };
    const hit = data.results?.[0];
    if (!hit?.version || !hit.trackViewUrl) return cached;
    cached = { latest: hit.version, url: hit.trackViewUrl, at: Date.now() };
    return cached;
  } catch {
    return cached;
  }
}

export async function appVersion() {
  const store = await lookup();
  return {
    ios: {
      latest: store?.latest ?? null,
      url: store?.url ?? null,
      min: env.MIN_IOS_VERSION || null,
    },
  };
}

/** «٠٫١٫٥» أحدثُ من «٠٫١٫٣» — مقارنةُ أرقامٍ لا نصوص («0.1.10» بعد «0.1.9»). */
export function newer(a: string, b: string): boolean {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const x = left[i] ?? 0;
    const y = right[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}
