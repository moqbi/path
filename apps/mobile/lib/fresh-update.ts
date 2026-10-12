import { useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import * as Updates from "expo-updates";

/**
 * التحديثُ يُطبَّق من أوّل فتح (القاعدة ٢٧٥) — **بقرار المالك**.
 *
 * `expo-updates` يفتح على ما في يده وينزّل الجديدَ في الخلفية ولا يطبّقه إلا في
 * الإقلاع التالي، فكان من نزّل التطبيقَ للتوّ يرى نسخةَ المتجر حتى يُغلقه ويفتحه.
 * فهنا يُسأل الخادمُ ساعةَ الإقلاع وشاشةُ الانطلاق ظاهرة: لا جديدَ = يمضي كما هو،
 * وجديدٌ نزل في المهلة = يُعاد التشغيل عليه فوراً خلف شاشةٍ داكنة بالعلامة.
 * وما تجاوز المهلة لا يُقاطع من بدأ يستعمل التطبيق: يُطبَّق في الإقلاع التالي.
 */

const KEY = "athr.fresh";
/** أقصى ما يُنتظر من الإقلاع — الشبكةُ البطيئة لا تحبس التطبيق. */
const DEADLINE = 8000;

let started = false;

/** هل هذا الإقلاعُ إعادةُ تشغيلٍ بعد تحديثٍ للتوّ؟ فلا تُعاد شاشةُ الانطلاق مرّتين. */
export function justReloaded(): boolean {
  try {
    const at = SecureStore.getItem(KEY);
    if (!at) return false;
    void SecureStore.deleteItemAsync(KEY).catch(() => {});
    return Date.now() - Number(at) < 60_000;
  } catch {
    return false;
  }
}

/** صادقٌ ما دام التحقّقُ جارياً — والجذرُ يُبقي شاشةَ الانطلاق ما دام صادقاً. */
export function useFreshUpdate(): boolean {
  const [busy, setBusy] = useState(() => !__DEV__ && Updates.isEnabled && !started);

  useEffect(() => {
    if (!busy || started) return;
    started = true;
    let over = false;
    const finish = () => {
      if (over) return;
      over = true;
      setBusy(false);
    };
    const timer = setTimeout(finish, DEADLINE);

    void (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (!check.isAvailable) return finish();
        const got = await Updates.fetchUpdateAsync();
        // فات الموعد والمستخدمُ في التطبيق: لا نقطع عليه، والجديدُ يُطبَّق في الإقلاع التالي.
        if (!got.isNew || over) return finish();
        try {
          SecureStore.setItem(KEY, String(Date.now()));
        } catch {}
        await Updates.reloadAsync({
          reloadScreenOptions: {
            backgroundColor: "#0E1A24",
            image: require("../assets/athr-mark.png"),
            imageResizeMode: "center",
            fade: true,
          },
        });
      } catch {
        finish();
      }
    })();

    return () => clearTimeout(timer);
  }, []);

  return busy;
}
