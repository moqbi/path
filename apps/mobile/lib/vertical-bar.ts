import { useEffect, useSyncExternalStore } from "react";
import { AppState, Platform, useWindowDimensions } from "react-native";
import { requireOptionalNativeModule } from "expo";

/**
 * شريطُ التبويبات في جانب الشاشة على iPhone Duo (القاعدة ٤٩٤).
 *
 * iOS 27.1 ينقل شريطَ `UITabBarController` — وهو ما يرسمه `NativeTabs` — إلى «الشريط
 * العموديّ» في جانب الشاشة الخارجيّة، ومفتوحاً يعيده إلى الأسفل. وهذا من النظام بلا كود.
 * ما نرسمه بأنفسنا — زرُّ النشر وحشوةُ القوائم تحت الشريط — يسأل هنا: أين الشريط، وكم يأخذ.
 *
 * والوحدةُ **اختياريّة** (القاعدة ١٢٤): بناءٌ بلاها، أو جهازٌ بلا شريطٍ عموديّ، يردّ
 * «أفقيّ» فيبقى كلُّ شيءٍ كما كان.
 */
export type VerticalBar = { vertical: boolean; left: number; right: number };

type Native = { state(): Promise<VerticalBar & { edge: number }> };
const native =
  Platform.OS === "ios"
    ? requireOptionalNativeModule<Native>("VerticalBar")
    : null;

const HORIZONTAL: VerticalBar = { vertical: false, left: 0, right: 0 };
let current: VerticalBar = HORIZONTAL;
const listeners = new Set<() => void>();

function set(next: VerticalBar) {
  if (
    next.vertical === current.vertical &&
    Math.round(next.left) === Math.round(current.left) &&
    Math.round(next.right) === Math.round(current.right)
  ) {
    return;
  }
  current = next.vertical
    ? { vertical: true, left: next.left, right: next.right }
    : HORIZONTAL;
  listeners.forEach((listener) => listener());
}

/** يُسأل النظامُ ثلاثاً: الآن، وبعد أن يستقرّ الطيُّ، وبعد أن يرسم الشريطُ نفسه. */
export function refreshVerticalBar() {
  if (!native) return;
  for (const delay of [0, 250, 700]) {
    setTimeout(() => {
      native
        .state()
        .then(set)
        .catch(() => {});
    }, delay);
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useVerticalBar(): VerticalBar {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => HORIZONTAL,
  );
}

/** في تخطيط التبويبات: الطيُّ والفتحُ والدورانُ تبدّل مقاسَ النافذة، فيُسأل من جديد. */
export function useWatchVerticalBar() {
  const { width, height } = useWindowDimensions();
  useEffect(() => {
    refreshVerticalBar();
  }, [width, height]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshVerticalBar();
    });
    return () => sub.remove();
  }, []);
}
