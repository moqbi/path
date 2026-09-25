import { deleteItem, getItem, setItem } from "./store";

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

/**
 * نسخةٌ من توكن الوصول في الذاكرة.
 *
 * المخزن الآمن يُقرأ بوعد، و`<Image>` لا ينتظر وعداً: مصدرُها يُبنى
 * وقت الرسم فيلزم أن يكون التوكن حاضراً في تلك اللحظة. والمخزن يبقى
 * هو المرجع على القرص — هذه مرآةٌ له تعيش مع العملية وتموت بموتها.
 */
let access: string | null = null;
const watchers = new Set<() => void>();

export const currentAccess = () => access;

/** تشترك الصور فيه لتُعيد المحاولة بتوكنٍ جديد بعد التجديد. */
export function watchAccess(fn: () => void): () => void {
  watchers.add(fn);
  return () => watchers.delete(fn);
}

function setAccess(token: string | null) {
  access = token;
  for (const fn of watchers) fn();
}

export const saveTokens = async (accessToken: string, refreshToken: string) => {
  setAccess(accessToken);
  await Promise.all([
    setItem(ACCESS, accessToken),
    setItem(REFRESH, refreshToken),
  ]);
};

export const clearTokens = async () => {
  setAccess(null);
  await Promise.all([
    deleteItem(ACCESS),
    deleteItem(REFRESH),
  ]);
};

/** عند الإقلاع: تُملأ المرآة من القرص مرّةً واحدة. */
export async function primeAccess(): Promise<void> {
  setAccess(await getItem(ACCESS));
}

let refreshing: Promise<boolean> | null = null;

async function renew(): Promise<boolean> {
  if (refreshing) return refreshing;

  refreshing = (async () => {
    const token = await getItem(REFRESH);
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
  const token = access ?? (await getItem(ACCESS));
  if (token && !access) setAccess(token);

  const response = await fetch(`${BASE}${path}`, {
    /*
       بلا مخبأ: `no-store` يجعل `fetch` يُلحق بالطلب ختماً زمنياً فلا
       يُعاد جوابٌ قديم من مخبأ النظام — كان السحبُ للتحديث يدور ولا يأتي
       بجديد حتى يُغلق التطبيق. والخادمُ يقولها أيضاً في ترويسته.
    */
    cache: "no-store",
    ...init,
    headers: {
      ...(init.body instanceof FormData ? {} : { "content-type": "application/json" }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
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

/** يحتاجه بناءُ عناوين الملفات والخطّ الحيّ. */
export const baseUrl = BASE;

/** تجديدٌ مقصود — تستدعيه الصورة حين تُردّ بـ401. */
export const renewAccess = renew;
