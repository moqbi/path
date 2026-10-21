import { create } from "zustand";
import { getItem } from "./store";
import { adoptRefreshToken, api, clearTokens, renewAccess, saveTokens } from "./api";
import {
  MAX_ACCOUNTS,
  forgetAccount,
  listAccounts,
  parkToken,
  peekParked,
  rememberAccount,
  takeParked,
  type Account,
} from "./accounts";
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
  /** فارغٌ لمن دخل بسناب ولم يربط بريداً بعد. */
  email: string | null;
  bio: string | null;
  city: string | null;
  role: "USER" | "ADMIN";
  /** صلاحية الإشراف على المحتوى: قراءةُ لحظات أيّ حساب بلا صداقة وحذفُها. */
  canModerate: boolean;
  /** إنشاءُ المحادثات الجماعيّة وإدارتُها — المالك وممنوحُ اللوحة كلّها. */
  canGroups?: boolean;
  /** إيقافٌ مؤقّت — `null` أو تاريخٌ مضى يعني «غير موقوف». */
  suspendedUntil: string | null;
  suspendedReason: string | null;
  isPlus: boolean;
  /** متى انتهى آخرُ اشتراكٍ في آثار+ — منه تُعرض نافذة التجديد مرّةً. */
  plusEndedAt?: string | null;
  coins: number;
  createdAt: string;
  avatarMediaId: string | null;
  coverMediaId: string | null;
  coverY: number;
  coverX: number;
  coverZoom: number;
  shareLocation: boolean;
  /** وضعُ التخفّي لمشتركي آثار+ (القاعدة ٢٥١). نسخةُ خادمٍ قديمة لا ترسله. */
  hideOnline?: boolean;
  /** صيغةُ خطاب الكتاب (القاعدة ٢٦٠): فارغٌ = مذكّر كما كان. نسخةُ خادمٍ قديمة لا ترسله. */
  gender?: "MALE" | "FEMALE" | "UNSPECIFIED" | null;
  notifyOnTag: boolean;
  /** هل على الحساب كلمةُ مرور؟ من دخل بمزوّدٍ لا كلمةَ له حتى يضعها. */
  hasPassword?: boolean;
  /** متى أُكّد البريد — فارغٌ يعني لم يُؤكَّد، ولا يُمنع به شيء. */
  emailVerifiedAt?: string | null;
  /** التنبيهات: مفتاحٌ لكل نوع، وطرفا الوضع الهادئ بالدقائق. */
  notifyDm?: boolean;
  notifyFriend?: boolean;
  notifyReaction?: boolean;
  notifyComment?: boolean;
  notifyStoreNew?: boolean;
  notifyStoreDeals?: boolean;
  notifyMemories?: boolean;
  notifyNearby?: boolean;
  quietFrom?: number | null;
  quietTo?: number | null;
  viewGroupId: string | null;
  interactGroupId: string | null;
  frame: Worn;
  charm: Worn;
  background: { id: string; spec: string; mediaId: string | null; palette: string | null; coverMediaId?: string | null } | null;
  tag: { name: string; bg: string; fg: string } | null;
};

type State = {
  me: Me | null;
  /** `null` يعني «لم نسأل بعد» — والشاشة تنتظر ولا تقفز إلى الدخول. */
  ready: boolean;
  restore: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  /** جلسةٌ صدرت من بابٍ آخر (مزوّد): يُعتمد صاحبُها كما هو. */
  adopt: (user: Me) => Promise<void>;
  /** يردّ `true` إن انتقل إلى الحساب الآخر على الجهاز بدل أن يخرج إلى الدخول. */
  signOut: () => Promise<boolean>;
  refresh: () => Promise<void>;
  /** الحسابات على الجهاز (القاعدة ٣١٦) — النشطُ بينها. */
  accounts: Account[];
  /** الحسابُ المركون الذي يُعاد إليه من شاشة الدخول إن تراجع صاحبُه عن إضافة ثانٍ. */
  parked: Account | null;
  /** يركن الحسابَ النشط ويفتح الدخولَ لحسابٍ ثانٍ. */
  addAccount: () => Promise<void>;
  switchAccount: (id: string) => Promise<void>;
  /** يُخرج حساباً مركوناً من الجهاز: يُبطل جلستَه على الخادم ويمحوه. */
  removeAccount: (id: string) => Promise<void>;
};

const faceOf = (user: Me): Account => ({
  id: user.id,
  name: user.name,
  memberNo: user.memberNo,
  avatarMediaId: user.avatarMediaId,
});

/** من دخل من جديد بحسابٍ مركون: نسختُه القديمة تُبطَل لا تبقى جلسةً ثانية. */
async function dropStale(id: string): Promise<void> {
  const old = await takeParked(id);
  if (!old) return;
  await api("/v1/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken: old }) }).catch(() => {});
}

/** يكتب وجهَ النشط ويقرأ القائمة — ومعها المركونُ إن لم يكن هو النشط. */
async function settle(user: Me | null): Promise<{ accounts: Account[]; parked: Account | null }> {
  if (user) await rememberAccount(faceOf(user));
  const accounts = await listAccounts();
  const parked = accounts.find((row) => row.id !== user?.id) ?? null;
  return { accounts, parked };
}

export const useSession = create<State>((set, get) => ({
  me: null,
  ready: false,
  accounts: [],
  parked: null,

  /**
   * عند الإقلاع: إن كان في المخزن توكنٌ نسأل به عن صاحبه.
   *
   * ولا نثق بوجود التوكن وحده: قد يكون منتهياً أو لحسابٍ حُذف، فالسؤال
   * هو الدليل. وفشلُه ليس خطأً يُعرض — بل يعني «سجّل الدخول».
   */
  async restore() {
    const token = await getItem("athr.access");
    const refresh = await getItem("athr.refresh");
    if (!token && !refresh) {
      // لا نشط — ومركونٌ إن وُجد يُعاد إليه بدل شاشة الدخول.
      const { parked } = await settle(null);
      if (parked) return get().switchAccount(parked.id).catch(() => undefined);
      return set({ ready: true, me: null, accounts: [], parked: null });
    }

    try {
      const { user } = await api<{ user: Me }>("/v1/me");
      void startBilling(user.id).catch(() => {});
      set({ me: user, ready: true, ...(await settle(user)) });
    } catch {
      await clearTokens();
      set({ me: null, ready: true, ...(await settle(null)) });
    }
  },

  /*
     الدخولُ بمزوّدٍ يحفظ التوكن بنفسه (`lib/providers.ts`)، ثمّ يُسأل
     `/v1/me` كما في الدخول بالبريد. ما يردّه بابُ المزوّد صفُّ الحساب
     خاماً — `frameId` لا الإطار، ولا تشارم ولا ثيم — فكان من خرج ودخل
     بقوقل أو آبل يرى إكسسواراته منزوعةً وغلافَه غائباً حتى يلبس شيئاً
     فيُعاد الجلب. ما لبسه محفوظٌ على الخادم، والعرضُ هو الذي نقص.
  */
  async adopt(user) {
    await dropStale(user.id);
    void startBilling(user.id).catch(() => {});
    try {
      const full = await api<{ user: Me }>("/v1/me");
      set({ me: full.user, ready: true, ...(await settle(full.user)) });
    } catch {
      set({ me: user, ready: true, ...(await settle(user)) });
    }
  },

  async signIn(email, password) {
    const data = await api<{ user: { id: string }; accessToken: string; refreshToken: string }>(
      "/v1/auth/login",
      { method: "POST", body: JSON.stringify({ email, password, device: "mobile" }) },
    );
    await saveTokens(data.accessToken, data.refreshToken);
    await dropStale(data.user.id);
    const { user } = await api<{ user: Me }>("/v1/me");
    // المشتري يُربط بحسابه هنا: بلا ذلك يشتري لمعرّفٍ مجهول فلا نعرف لمن نفعّل.
    void startBilling(user.id).catch(() => {});
    set({ me: user, ready: true, ...(await settle(user)) });
  },

  async signOut() {
    const leaving = get().me?.id;
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
    if (leaving) await forgetAccount(leaving);
    // حسابٌ ثانٍ على الجهاز: الخروجُ من أحدهما دخولٌ إلى الآخر لا شاشةُ الدخول.
    const { parked } = await settle(null);
    if (parked) {
      try {
        await get().switchAccount(parked.id);
        return true;
      } catch {
        /* جلستُه انتهت — يُمحى ويُكمل الخروج */
      }
    }
    set({ me: null, ready: true, ...(await settle(null)) });
    return false;
  },

  async refresh() {
    try {
      const { user } = await api<{ user: Me }>("/v1/me");
      set({ me: user, ...(await settle(user)) });
    } catch {
      /* الشاشة تبقى بما لديها */
    }
  },

  async addAccount() {
    const me = get().me;
    if (!me) return;
    const rows = await listAccounts();
    if (rows.filter((row) => row.id !== me.id).length >= MAX_ACCOUNTS - 1) {
      throw new Error(`حسابان على الأكثر في الجهاز الواحد`);
    }
    const refresh = await getItem("athr.refresh");
    if (!refresh) throw new Error("تعذّر حفظ جلسة هذا الحساب");
    await rememberAccount(faceOf(me));
    // يُركن ولا يخرج: جلستُه على الخادم باقية، والجهازُ يبقى مسجّلاً له حتى يدخل الثاني.
    await parkToken(me.id, refresh);
    await clearTokens();
    await stopBilling();
    set({ me: null, ready: true, ...(await settle(null)) });
  },

  async switchAccount(id) {
    const from = get().me;
    if (from?.id === id) return;
    const target = await peekParked(id);
    if (!target) {
      await forgetAccount(id);
      set(await settle(from));
      throw new Error("انتهت جلسة هذا الحساب — سجّل دخوله من جديد");
    }

    // النشطُ يُركن أوّلاً بتوكنه الحاليّ، ثمّ يُؤخذ المركون.
    const current = from ? await getItem("athr.refresh") : null;
    if (from && current) await parkToken(from.id, current);
    await takeParked(id);
    await adoptRefreshToken(target);

    try {
      if (!(await renewAccess())) throw new Error("expired");
      const { user } = await api<{ user: Me }>("/v1/me");
      void startBilling(user.id).catch(() => {});
      set({ me: user, ready: true, ...(await settle(user)) });
    } catch {
      // جلسةُ المركون أُبطلت (تغيّرت كلمتُه، أو حُذف): يُمحى ويُعاد الأوّل.
      await forgetAccount(id);
      if (from) {
        const back = await takeParked(from.id);
        if (back) {
          await adoptRefreshToken(back);
          await renewAccess().catch(() => false);
        }
        set({ me: from, ready: true, ...(await settle(from)) });
      } else {
        await clearTokens();
        set({ me: null, ready: true, ...(await settle(null)) });
      }
      throw new Error("انتهت جلسة هذا الحساب — سجّل دخوله من جديد");
    }
  },

  async removeAccount(id) {
    if (get().me?.id === id) return;
    const token = await takeParked(id);
    if (token) {
      await api("/v1/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken: token }),
      }).catch(() => {});
    }
    await forgetAccount(id);
    set(await settle(get().me));
  },
}));
