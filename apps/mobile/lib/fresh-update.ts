import { useEffect, useState } from "react";
import { AppState } from "react-native";
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
        await reload();
      } catch {
        finish();
      }
    })();

    return () => clearTimeout(timer);
  }, []);

  return busy;
}

/** إعادةُ التشغيل على الجديد خلف شاشةٍ داكنة بالعلامة، بلا شاشة انطلاقٍ ثانية بعدها. */
async function reload() {
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
}

/** غيابٌ أطول من هذا يُسأل بعده عن تحديث. */
const AWAY = 30 * 60_000;
/** ما بعد الرجوع يُنتظر — بعده المستخدمُ يلمس الشاشة فلا نقطع عليه. */
const RESUME_DEADLINE = 5000;

/**
 * والرجوعُ من الخلفيّة بعد غيابٍ طويل كالإقلاع — **بقرار المالك**: تطبيقٌ بقي في
 * الذاكرة لا يُقلع، فلا يسأل `useFreshUpdate` أبداً حتى يُغلقه النظام. فمن غاب ثلاثين
 * دقيقةً فأكثر يُسأل له الخادمُ ساعةَ يرجع، وما نزل في خمس ثوانٍ يُطبَّق في الحال
 * — لم يبدأ بعدُ شيئاً — وما تأخّر يُترك للإقلاع التالي.
 */
export function useResumeUpdate() {
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    let leftAt = 0;
    let busy = false;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background") {
        leftAt = Date.now();
        return;
      }
      if (state !== "active" || !leftAt || busy) return;
      const away = Date.now() - leftAt;
      leftAt = 0;
      if (away < AWAY) return;
      busy = true;
      const back = Date.now();
      void (async () => {
        try {
          const check = await Updates.checkForUpdateAsync();
          if (!check.isAvailable) return;
          const got = await Updates.fetchUpdateAsync();
          if (got.isNew && Date.now() - back < RESUME_DEADLINE) await reload();
        } catch {
          // شبكةٌ متعثّرة: الإقلاعُ التالي يكفي.
        } finally {
          busy = false;
        }
      })();
    });
    return () => sub.remove();
  }, []);
}
