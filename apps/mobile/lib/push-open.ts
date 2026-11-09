/**
 * ضغطةُ تنبيهٍ من هواوي (القاعدة ٤٤٦) لا تمرّ بـ`expo-notifications`: HMS Core يعرضه ويفتح
 * التطبيقَ برابطٍ (`athar://push?path=…&broadcast=…`). فـ`+native-intent` يصرف الرابطَ إلى «/»
 * ويضع ما فيه هنا، والجذرُ يفتحه بمنطق ضغطة التنبيه نفسه.
 */
export type PushData = { path?: string; broadcast?: string };

let pending: PushData | null = null;
let listener: ((data: PushData) => void) | null = null;

export function queuePush(data: PushData) {
  if (listener) setTimeout(() => listener?.(data), 0);
  else pending = data;
}

export function onPush(fn: (data: PushData) => void): () => void {
  listener = fn;
  if (pending) {
    const data = pending;
    pending = null;
    setTimeout(() => fn(data), 0);
  }
  return () => {
    if (listener === fn) listener = null;
  };
}

/** يقرأ رابطَ تنبيه هواوي، ولا شيء لغيره. */
export function readPushUrl(url: string): PushData | null {
  const match = /^(?:athar:\/\/)?\/?push\?(.*)$/.exec(url);
  if (!match) return null;
  const params = new URLSearchParams(match[1]);
  const path = params.get("path") ?? undefined;
  const broadcast = params.get("broadcast") ?? undefined;
  return { path: path || undefined, broadcast: broadcast || undefined };
}
