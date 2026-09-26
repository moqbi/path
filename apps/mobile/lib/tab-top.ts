import { useEffect, useRef } from "react";
import { useNavigation } from "expo-router";

/**
 * ضغطةُ التبويب المفتوح ترجع إلى أعلاه — ما تعوّده الناس في كل تطبيق.
 *
 * من نزل في لحظاته ثمّ ضغط «اللحظات» يريد أعلاها، لا أن لا يحدث شيء.
 * والحدثُ `tabPress` من المتصفّح نفسه، ولا يُنفَّذ إلا والشاشةُ ظاهرة:
 * ضغطةُ التبويب من شاشةٍ أخرى انتقالٌ لا صعود.
 */
export function useTabTop(onTop: () => void) {
  const navigation = useNavigation();
  const latest = useRef(onTop);
  latest.current = onTop;

  useEffect(() => {
    const nav = navigation as unknown as {
      addListener: (event: "tabPress", run: () => void) => () => void;
      isFocused: () => boolean;
    };
    return nav.addListener("tabPress", () => {
      if (nav.isFocused()) latest.current();
    });
  }, [navigation]);
}
