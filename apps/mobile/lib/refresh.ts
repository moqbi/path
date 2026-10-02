import { useCallback, useState } from "react";

/**
 * حالةُ «اسحب للتحديث» من الإصبع لا من الجلب.
 *
 * كانت القوائم تكتب `refreshing={query.isRefetching}`، وذاك صادقٌ مع كل
 * جلبٍ في الخلفية — تقادمُ الذاكرة عند العودة إلى تبويب، أو إبطالٌ بعد
 * تفاعل — لا مع السحب وحده. فتظهر دوّارةُ النظام أعلى التبويب بلا أن
 * يسحب أحد، وفي آبل تعلق هناك إن انتهى الجلب والشاشة غير ظاهرة، فلا
 * تذهب إلا بسحبةٍ ثانية. فالدوّارةُ هنا تدور لسحبٍ وقع وتقف بانتهائه.
 */
export function usePullRefresh(run: () => Promise<unknown> | unknown) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void Promise.resolve()
      .then(run)
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, [run]);
  return { refreshing, onRefresh };
}
