import * as SecureStore from "expo-secure-store";

/**
 * بابُ الخادم الوحيد.
 *
 * لا Prisma ولا قاعدة هنا: الجهاز في يد مستخدم، وكل ما يُقرأ ويُكتب يمرّ
 * بـHTTPS إلى `apps/api`. والتوكن في المخزن الآمن لا في `AsyncStorage`:
 * الأخير نصٌّ عاديّ يُقرأ من جهازٍ مكسور الحماية.
 *
 * والتجديد يجري مرةً واحدة مهما تزامنت الطلبات: خمسة طلبات تنتهي صلاحيتها
 * معاً كانت تُطلق خمسة تجديدات، وأوّلُها يُبطل البقية فتُقرأ سرقةً.
 */
const BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:4000";

const ACCESS = "athr.access";
const REFRESH = "athr.refresh";

export const saveTokens = async (accessToken: string, refreshToken: string) => {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS, accessToken),
    SecureStore.setItemAsync(REFRESH, refreshToken),
  ]);
};

export const clearTokens = async () => {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS),
    SecureStore.deleteItemAsync(REFRESH),
  ]);
};

let refreshing: Promise<boolean> | null = null;

async function renew(): Promise<boolean> {
  if (refreshing) return refreshing;

  refreshing = (async () => {
    const token = await SecureStore.getItemAsync(REFRESH);
    if (!token) return false;

    const response = await fetch(`${BASE}/v1/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: token }),
    });
    if (!response.ok) {
      await clearTokens();
      return false;
    }

    const data = (await response.json()) as { accessToken: string; refreshToken: string };
    await saveTokens(data.accessToken, data.refreshToken);
    return true;
  })();

  try {
    return await refreshing;
  } finally {
    refreshing = null;
  }
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const access = await SecureStore.getItemAsync(ACCESS);

  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body instanceof FormData ? {} : { "content-type": "application/json" }),
      ...(access ? { authorization: `Bearer ${access}` } : {}),
      ...init.headers,
    },
  });

  if (response.status === 401 && retry && (await renew())) {
    return api<T>(path, init, false);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as { error?: string }).error ?? "تعذّر الاتصال");
  return data as T;
}
