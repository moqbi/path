import { createContext, useCallback, useContext, type ReactNode } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useWindowDimensions } from "react-native";
import { create } from "zustand";

/**
 * الشاشةُ العريضة لوحتان (القاعدة ٤٦٤): الآيباد، والجوّالُ القابل للطيّ مفتوحاً.
 *
 * من ٧٠٠ نقطة فما فوق — آيباد ميني رأسيّاً ٧٤٤ — تصير تبويباتُ اللحظات والأصدقاء
 * والمحادثات و«أنا» قائمةً في طرف البداية ولوحةً بجانبها، وما يُضغط في القائمة
 * (لحظةٌ، محادثةٌ، ملفُّ صديق) يُفتح في اللوحة لا فوق الشاشة كلّها. وتحته — آيبادٌ
 * مقسومٌ ثلثاً في Split View، أو الجوّالُ مطويّاً — التطبيقُ كما هو على الجوّال.
 * العرضُ من `useWindowDimensions` لا ثابتٌ: الدورانُ وتغييرُ حجم النافذة يُعيدان الحساب.
 */
export const WIDE_MIN = 700;

export function useWide(): boolean {
  return useWindowDimensions().width >= WIDE_MIN;
}

/** عرضُ القائمة: نحو خُمسَي الشاشة، بين ٣٨٠ و٤٨٠ — بطاقةٌ بعرض جوّالٍ كبير. */
export function listWidth(screen: number): number {
  return Math.round(Math.min(480, Math.max(380, screen * 0.4)));
}

/** ما يُفتح في اللوحة: لحظةٌ ومحادثةٌ وملفٌّ — وما سواها شاشةٌ كما كان. */
const PANE_PATH = /^\/(m|dm|u)\/([^/?#]+)$/;

type PaneState = {
  /** التبويبُ الظاهر الذي يحمل لوحة — لا يُفتح شيءٌ في لوحةٍ لا تُرى. */
  host: string | null;
  /** لكلّ تبويبٍ طريقُه في لوحته: آخرُه الظاهر، وما قبله رجوعُه. */
  trail: Record<string, string[]>;
  setHost: (host: string | null) => void;
  open: (path: string, replace?: boolean) => boolean;
  back: (host: string) => void;
};

export const usePane = create<PaneState>((set, get) => ({
  host: null,
  trail: {},
  setHost: (host) => set({ host }),
  open: (path, replace = false) => {
    const { host, trail } = get();
    if (!host || !PANE_PATH.test(path)) return false;
    const now = trail[host] ?? [];
    const next = replace ? [...now.slice(0, -1), path] : [...now, path];
    set({ trail: { ...trail, [host]: next.slice(-20) } });
    return true;
  },
  back: (host) => {
    const { trail } = get();
    set({ trail: { ...trail, [host]: (trail[host] ?? []).slice(0, -1) } });
  },
}));

/**
 * `router.push` لما قد يُفتح في اللوحة: على الشاشة العريضة لوحةٌ، وإلّا شاشةٌ كما كان.
 * يُكتب مكانَ `router.push` في القوائم التي تحمل لوحة وما يُرسم فيها.
 */
export function go(router: ReturnType<typeof useRouter>, path: string): void {
  if (usePane.getState().open(path)) return;
  router.push(path as never);
}

type Route = { id: string; host: string; replace: (path: string) => void; back: () => void };
const RouteContext = createContext<Route | null>(null);

/** ما يُرسم في اللوحة يعرف أنّه فيها: رجوعُه يرجع في اللوحة، لا في المكدّس. */
export function usePaneRoute(): Route | null {
  return useContext(RouteContext);
}

/** معرّفُ الشاشة: من اللوحة إن كانت فيها، وإلّا من مسارها. */
export function useRouteId(): string {
  const pane = useContext(RouteContext);
  const { id } = useLocalSearchParams<{ id: string }>();
  return pane?.id ?? id ?? "";
}

/** `router.replace` في الشاشة نفسها: في اللوحة يبدّل آخرَ طريقها. */
export function useReplace(): (path: string) => void {
  const pane = useContext(RouteContext);
  const router = useRouter();
  return (path) => (pane ? pane.replace(path) : router.replace(path as never));
}

/** يُسجّل التبويبَ الظاهر حاملاً للوحة ما دام ظاهراً على شاشةٍ عريضة. */
export function usePaneHost(host: string, wide: boolean): string | null {
  const setHost = usePane((state) => state.setHost);
  useFocusEffect(
    useCallback(() => {
      if (!wide) return;
      setHost(host);
      return () => {
        if (usePane.getState().host === host) setHost(null);
      };
    }, [host, wide, setHost]),
  );
  return usePane((state) => (wide ? (state.trail[host] ?? []).at(-1) ?? null : null));
}

export function PaneRoute({ path, host, children }: { path: string; host: string; children: ReactNode }) {
  const match = PANE_PATH.exec(path);
  const value: Route = {
    id: match?.[2] ?? "",
    host,
    replace: (next) => {
      if (!usePane.getState().open(next, true)) usePane.getState().back(host);
    },
    back: () => usePane.getState().back(host),
  };
  return <RouteContext.Provider value={value}>{children}</RouteContext.Provider>;
}

export function paneKind(path: string): "m" | "dm" | "u" | null {
  return (PANE_PATH.exec(path)?.[1] as "m" | "dm" | "u" | undefined) ?? null;
}

export const WidthContext = createContext<number | null>(null);

/**
 * عرضُ ما يُرسم فيه: عرضُ القائمة داخل `Split`، وإلّا عرضُ النافذة. يُقرأ مكانَ
 * `useWindowDimensions().width` في كلّ ما يحسب مقاسه من العرض (القاعدة ٤٦٤).
 */
export function usePaneWidth(): number {
  const window = useWindowDimensions().width;
  return useContext(WidthContext) ?? window;
}


/**
 * مقاسُ البطاقة في شبكةٍ بحشوة ٢٠ وفجوة ١٢: ثلاثٌ على الجوّال، وعلى الشاشة العريضة
 * ما يتّسع ببطاقةٍ نحو ١٥٠ — لا ثلاثٌ بعرض ثلث آيباد (القاعدة ٤٦٤). و`strip` بطاقةُ
 * الصفّ المُمرَّر: يظهر طرفُ ما بعدها فيُعرف أنّه يُمرَّر.
 */
export function useGrid(gap = 12): { cell: number; strip: number; columns: number } {
  const width = usePaneWidth();
  const inner = width - 40;
  const columns = Math.max(3, Math.floor((inner + gap) / (150 + gap)));
  const cell = Math.floor((inner - gap * (columns - 1)) / columns);
  // الصفُّ المُمرَّر خمسةٌ ثمّ «عرض الكل» (القاعدة ٣٣٥): على الشاشة العريضة تملأ الخمسةُ العرضَ.
  const strip =
    width >= WIDE_MIN ? Math.floor((inner - gap * 4) / 5) : Math.round((width - 64) / 3.25);
  return { cell, strip, columns };
}
