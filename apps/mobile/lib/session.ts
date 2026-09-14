import { create } from "zustand";
import { getItem } from "./store";
import { api, clearTokens, saveTokens } from "./api";

/**
 * من أنت — في مكانٍ واحد.
 *
 * الشاشات تسأل هذا المتجر لا الخادمَ في كل مرّة: خمسُ شاشاتٍ تسأل
 * `/v1/me` عند كل ظهورٍ تعني خمسةَ طلباتٍ لجوابٍ واحد.
 *
 * والتوكن ليس هنا: مكانه المخزن الآمن وحده، وهذا المتجر يحمل مَن لا سرّ
 * في معرفته — الاسم والصورة وحالة الاشتراك.
 */
export type Me = {
  id: string;
  memberNo: number;
  name: string;
  handle: string | null;
  email: string;
  bio: string | null;
  city: string | null;
  role: "USER" | "ADMIN";
  isPlus: boolean;
  storeCredit: number;
  createdAt: string;
  avatarMediaId: string | null;
  coverMediaId: string | null;
  coverY: number;
  frame: { id: string; spec: string; mediaId: string | null } | null;
  charm: { id: string; spec: string; mediaId: string | null } | null;
  background: { id: string; spec: string; mediaId: string | null; palette: string | null } | null;
  tag: { name: string; bg: string; fg: string } | null;
};

type State = {
  me: Me | null;
  /** `null` يعني «لم نسأل بعد» — والشاشة تنتظر ولا تقفز إلى الدخول. */
  ready: boolean;
  restore: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

export const useSession = create<State>((set) => ({
  me: null,
  ready: false,

  /**
   * عند الإقلاع: إن كان في المخزن توكنٌ نسأل به عن صاحبه.
   *
   * ولا نثق بوجود التوكن وحده: قد يكون منتهياً أو لحسابٍ حُذف، فالسؤال
   * هو الدليل. وفشلُه ليس خطأً يُعرض — بل يعني «سجّل الدخول».
   */
  async restore() {
    const token = await getItem("athr.access");
    const refresh = await getItem("athr.refresh");
    if (!token && !refresh) return set({ ready: true, me: null });

    try {
      const { user } = await api<{ user: Me }>("/v1/me");
      set({ me: user, ready: true });
    } catch {
      await clearTokens();
      set({ me: null, ready: true });
    }
  },

  async signIn(email, password) {
    const data = await api<{ user: { id: string }; accessToken: string; refreshToken: string }>(
      "/v1/auth/login",
      { method: "POST", body: JSON.stringify({ email, password, device: "mobile" }) },
    );
    await saveTokens(data.accessToken, data.refreshToken);
    const { user } = await api<{ user: Me }>("/v1/me");
    set({ me: user, ready: true });
  },

  async signOut() {
    const refreshToken = await getItem("athr.refresh");
    // الخروج يُبطل التوكن على الخادم أيضاً: مسحُه من الجهاز وحده يترك
    // جلسةً حيّةً ثلاثين يوماً لمن نسخها قبل الخروج.
    if (refreshToken) {
      await api("/v1/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {});
    }
    await clearTokens();
    set({ me: null, ready: true });
  },

  async refresh() {
    try {
      const { user } = await api<{ user: Me }>("/v1/me");
      set({ me: user });
    } catch {
      /* الشاشة تبقى بما لديها */
    }
  },
}));
