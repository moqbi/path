import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * مكان التوكن.
 *
 * على الجهاز — وهو الوحيد الذي يُنشر — المخزنُ الآمن وحده: سلسلة المفاتيح
 * في iOS وKeystore في أندرويد. لا `AsyncStorage`: ذاك نصٌّ عاديّ يُقرأ من
 * جهازٍ مكسور الحماية.
 *
 * وعلى الويب لا وجود لـSecureStore أصلاً — الحزمة أصلية ولا تعمل في
 * المتصفّح. والويب هنا معاينةُ تطويرٍ فقط: التطبيق يُبنى لـiOS وأندرويد،
 * وويبُ أثر تطبيقٌ آخر (`apps/web`) يستعمل ملفّ ارتباطٍ لا توكناً في
 * مخزنٍ يقرؤه أيّ سكربت. فـ`sessionStorage` هنا لا يخرج من طاولة
 * المطوّر، ويذهب بإغلاق التبويب.
 */
const web = Platform.OS === "web";

export async function getItem(key: string): Promise<string | null> {
  if (web) {
    try {
      return globalThis.sessionStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (web) {
    try {
      globalThis.sessionStorage?.setItem(key, value);
    } catch {
      /* معاينةٌ بلا تخزين — تعمل حتى تُغلق الصفحة */
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  if (web) {
    try {
      globalThis.sessionStorage?.removeItem(key);
    } catch {
      /* لا شيء */
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
