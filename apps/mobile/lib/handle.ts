import { useEffect, useRef, useState } from "react";
import { api } from "./api";

export type HandleState = { status: "idle" | "checking" | "ok" | "bad"; error?: string; suggestions: string[] };

/**
 * فحصُ المعرّف وهو يُكتب واقتراحُه (القاعدة ٣٧٧) — يُسأل الخادمُ بعد ٣٥٠ مللي من آخر حرف،
 * وما يصل متأخّراً عن حرفٍ أحدث يُرمى. وخادمٌ قديمٌ بلا البابِ يُبقي الحالَ «idle» ولا يُعطّل الحفظ.
 */
export function useHandleCheck(handle: string, current: string | null | undefined) {
  const [state, setState] = useState<HandleState>({ status: "idle", suggestions: [] });
  const seq = useRef(0);
  const clean = handle.trim().replace(/^@/, "").toLowerCase();

  useEffect(() => {
    const mine = ++seq.current;
    if (clean && clean === (current ?? "").toLowerCase()) {
      setState({ status: "ok", suggestions: [] });
      return;
    }
    if (clean) setState((now) => ({ ...now, status: "checking" }));
    const timer = setTimeout(async () => {
      try {
        const res = await api<{ ok: boolean | null; error?: string; suggestions: string[] }>(
          `/v1/me/handle?h=${encodeURIComponent(clean)}`,
        );
        if (mine !== seq.current) return;
        setState({
          status: res.ok === null ? "idle" : res.ok ? "ok" : "bad",
          error: res.error,
          suggestions: res.suggestions ?? [],
        });
      } catch {
        if (mine === seq.current) setState({ status: "idle", suggestions: [] });
      }
    }, clean ? 350 : 0);
    return () => clearTimeout(timer);
  }, [clean, current]);

  return state;
}
