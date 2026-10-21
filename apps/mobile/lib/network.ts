import { AppState } from "react-native";
import { onlineManager } from "@tanstack/react-query";
import { create } from "zustand";

/**
 * الاتصالُ يُستعاد لا يُنتظر (القاعدة ٣٢١) — **بقرار المالك**: كان طلبٌ في شبكةٍ
 * ميّتة يعلق بلا مهلة، والقائمةُ تدور حتى يُغلق التطبيق. الآن كلُّ طلبٍ له مهلة،
 * وفشلُ الشبكة يُعلن «لا اتصال» ويُوقف الاستعلامات (`onlineManager`) بدل أن
 * تحترق محاولاتُها، ثمّ يُسأل `/health` بمهلٍ تطول (٢، ٣، ٥، ٨، ١٣، ٢٠ ثانية)
 * حتى يردّ — فتُستأنف الاستعلاماتُ الموقوفة وحدها. والعودةُ إلى التطبيق تسأل
 * في الحال. بلا وحدةٍ أصليّة (`netinfo`): الطلبُ نفسه هو المقياس، فيصل بتحديث.
 */

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:4000";
const STEPS = [2000, 3000, 5000, 8000, 13000, 20000];

/** فشلُ شبكةٍ لا ردُّ خادم: مهلةٌ انقضت أو طلبٌ لم يخرج. */
export class NetworkError extends Error {
  constructor() {
    super("ما فيه اتصال بالإنترنت");
    this.name = "NetworkError";
  }
}

export const isNetworkError = (error: unknown): boolean => error instanceof NetworkError;

type Net = { offline: boolean; since: number; checking: boolean; back: number };
export const useNet = create<Net>(() => ({ offline: false, since: 0, checking: false, back: 0 }));

let timer: ReturnType<typeof setTimeout> | null = null;
let attempt = 0;

function schedule(delay: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void probe(), delay);
}

async function probe() {
  timer = null;
  useNet.setState({ checking: true });
  const abort = new AbortController();
  const cut = setTimeout(() => abort.abort(), 6000);
  try {
    const response = await fetch(`${BASE}/health`, { cache: "no-store", signal: abort.signal });
    if (response.ok) return reportOnline();
  } catch {
    // ما زالت مقطوعة.
  } finally {
    clearTimeout(cut);
    useNet.setState({ checking: false });
  }
  if (useNet.getState().offline) schedule(STEPS[Math.min(attempt++, STEPS.length - 1)]);
}

export function reportOffline() {
  if (useNet.getState().offline) return;
  attempt = 0;
  useNet.setState({ offline: true, since: Date.now() });
  onlineManager.setOnline(false);
  schedule(STEPS[0]);
}

export function reportOnline() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!useNet.getState().offline) return;
  useNet.setState({ offline: false, back: Date.now() });
  onlineManager.setOnline(true);
}

/** «حاول الآن» والعودةُ إلى التطبيق: سؤالٌ في الحال لا بعد المهلة. */
export function retryNow() {
  if (!useNet.getState().offline || useNet.getState().checking) return;
  attempt = 0;
  schedule(0);
}

AppState.addEventListener("change", (state) => {
  if (state === "active") retryNow();
});
