import { create } from "zustand";
import { getItem } from "./store";
import { api, clearTokens, saveTokens } from "./api";
import { startBilling, stopBilling } from "./billing";
import { disablePush } from "./push";

/**
 * من أنت — في مكانٍ واحد.
 *
 * الشاشات تسأل هذا المتجر لا الخادمَ في كل مرّة: خمسُ شاشاتٍ تسأل
 * `/v1/me` عند كل ظهورٍ تعني خمسةَ طلباتٍ لجوابٍ واحد.
 *
 * والتوكن ليس هنا: مكانه المخزن الآمن وحده، وهذا المتجر يحمل مَن لا سرّ
 * في معرفته — الاسم والصورة وحالة الاشتراك.
 */
/** الصنف الملبوس كما يردّه الخادم: يكفي لبطاقته في نافذة الصورة. */
export type Worn = {
  id: string;
  name: string;
  kind: string;
  spec: string;
  mediaId: string | null;
  priceCoins: number;
  plusOnly: boolean;
} | null;

export type Me = {
  id: string;
  memberNo: number;
  name: string;
  handle: string | null;
  email: string;
  bio: string | null;
  city: string | null;
  role: "USER" | "ADMIN";
  /** صلاحية الإشراف على المحتوى: قراءةُ لحظات أيّ حساب بلا صداقة وحذفُها. */
  canModerate: boolean;
  /** إيقافٌ مؤقّت — `null` أو تاريخٌ مضى يعني «غير موقوف». */
  suspendedUntil: string | null;
  suspendedReason: string | null;
  isPlus: boolean;
  coins: number;
  createdAt: string;
  avatarMediaId: string | null;
  coverMediaId: string | null;
  coverY: number;
  shareLocation: boolean;
  notifyOnTag: boolean;
  /** متى أُكّد البريد — فارغٌ يعني لم يُؤكَّد، ولا يُمنع به شيء. */
  emailVerifiedAt?: string | null;
  /** التنبيهات: مفتاحٌ لكل نوع، وطرفا الوضع الهادئ بالدقائق. */
  notifyDm?: boolean;
  notifyFriend?: boolean;
  notifyReaction?: boolean;
  notifyComment?: boolean;
  notifyStoreNew?: boolean;
  notifyStoreDeals?: boolean;
  quietFrom?: number | null;
  quietTo?: number | null;
  viewGroupId: string | null;
  interactGroupId: string | null;
  frame: Worn;
  charm: Worn;
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
      void startBilling(user.id).catch(() => {});
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
    // المشتري يُربط بحسابه هنا: بلا ذلك يشتري لمعرّفٍ مجهول فلا نعرف لمن نفعّل.
    void startBilling(user.id).catch(() => {});
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
    // ونزعُ الجهاز قبل مسح التوكن: بعده لا تصل الطلبات مُستوثَقة.
    await disablePush();
    await clearTokens();
    await stopBilling();
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
