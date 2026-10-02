import { useFocusEffect } from "expo-router";
import { useCallback } from "react";

/**
 * المحادثةُ المفتوحة على الشاشة الآن — مسارُها كما يحمله التنبيه
 * (`/dm/<id>` أو `/group/<id>`).
 *
 * التنبيهُ يصل قبل جلب المحادثة التالي (كلّ ثماني ثوانٍ)، فكان صاحبُها
 * يرى الرسالة في شريط التنبيه وهو داخلها ثمّ تظهر في المحادثة بعدها.
 * فالتنبيهُ الواصل يجلبها في الحال، ولا يُعرض شريطُه لمن يقرأها أصلاً.
 */
let current: string | null = null;

export const openThread = () => current;

/** تُنادى من شاشة المحادثة: مسارُها ما دامت ظاهرة. */
export function useOpenThread(path: string) {
  useFocusEffect(
    useCallback(() => {
      current = path;
      return () => {
        if (current === path) current = null;
      };
    }, [path]),
  );
}
