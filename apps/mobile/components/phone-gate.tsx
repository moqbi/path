import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { useSession } from "../lib/session";
import { DEV_FEATURES } from "../lib/dev-features";

/**
 * يفتح شاشةَ الرقم مرّةً بعد الدخول (القاعدة ٢٩٧) لمن لم يربط رقمه ولم يتخطَّه.
 * وخادمٌ قديمٌ لا يرسل الحقلين فلا تُفتح — لا شاشةَ لبابٍ لا خادمَ خلفه.
 */
export function PhoneGate() {
  const router = useRouter();
  const me = useSession((s) => s.me);
  const shown = useRef(false);
  useEffect(() => {
    if (!DEV_FEATURES || !me || shown.current) return;
    if (!("phoneSkippedAt" in me) || me.phone || me.phoneSkippedAt) return;
    shown.current = true;
    const timer = setTimeout(() => router.push("/phone?first=1" as never), 700);
    return () => clearTimeout(timer);
  }, [me, router]);
  return null;
}
