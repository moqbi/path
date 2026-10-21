import { useEffect, useRef, useState } from "react";
import { View, Pressable, Animated, Easing, BackHandler, useWindowDimensions } from "react-native";
import { create } from "zustand";
import Svg, { Path } from "react-native-svg";
import { Text } from "./type";
import { measureSpot, type Rect } from "./spot";
import { usePathname, useRouter } from "expo-router";
import { closeAddSheet, useAddMode } from "./add-sheet";
import { CheckIcon } from "./icons";
import { api } from "../lib/api";
import { useFan } from "./composer-fan";
import { getItem, setItem } from "../lib/store";
import { colors } from "../theme/tokens";

/**
 * الجولة تُعرض مرّةً لكل جهاز. والمفتاحُ بنسخةٍ (`v4`): الجولةُ الجديدة
 * شيءٌ آخر، فمن رأى القديمة يراها مرّةً.
 *
 * و**نقاطٌ لا نقطتان رأسيّتان**: المخزنُ الآمن لا يقبل في المفتاح إلا
 * الحروفَ والأرقام و`.` و`-` و`_`، ويرمي على غيرها. فكان `athr:tour:v3`
 * يُسقط القراءةَ فلا تبدأ الجولةُ وحدها، ويُسقط الكتابةَ في `close()` قبل
 * أن تُغلق — فـ«تخطَّ» و«ابدأ» لا يفعلان شيئاً.
 */
const KEY = "athr.tour.v5";
/** الجولاتُ السابقة: من رأى إحداها رأى التطبيقَ من قبل (القاعدة ٢٤٣). */
const OLD_KEYS = ["athr.tour.v4", "athr.tour.v3"];

/** ما تقرؤه الخطوةُ لتعرف أنّ صاحبها فعل ما طُلب منه. */
type Ctx = { path: string; signals: Set<string>; addMode: string | null };

type Step = {
  /** هدفُ الدائرة — فارغٌ لخطوةٍ تُقرأ وحدها بلا هدف. */
  spot?: string;
  title: string;
  body: string;
  /** شاشةٌ تُفتح قبل القياس: الهدفُ فيها لا في الخطّ الزمنيّ. */
  route?: string;
  /** قوسُ النشر مفتوحٌ في هذه الخطوة. */
  fan?: boolean;
  /**
   * **يفعلها بيده** (القاعدة ٣٢٦): الدائرةُ ثقبٌ تمرّ منه اللمسة إلى الزرّ
   * تحتها، ولا «التالي» — الخطوةُ تمضي حين يتحقّق `until`.
   */
  tap?: boolean;
  /** تمضي الخطوةُ وحدها حين يصدق. */
  until?: (ctx: Ctx) => boolean;
  /**
   * بطاقةٌ بلا تعتيم فوق شاشةٍ يعمل فيها — «تعديل الملف» حقولٌ كثيرة لا
   * تتّسع لها دائرة. ومعها قائمةٌ تُشطب بما فعل.
   */
  coach?: { key: string; label: string; done: (ctx: Ctx) => boolean }[];
  /** ما دامت الخطوةُ قائمةً يجب أن يبقى هنا، وإلّا رجعت إلى سابقتها. */
  at?: string;
  /**
   * هدفٌ غائب = الخطوةُ فُعلت من قبل (خطوةُ بطاقة الترحيب المشطوبة)، فتُتجاوز
   * هي وما يتبعها — العددُ كم خطوةً تُطوى معها.
   */
  skipMissing?: number;
  /** يجري قبل الخطوة. */
  before?: () => void;
};

/**
 * خطواتُ الجولة — **تعليميّةٌ لا سردٌ** (القاعدة ٣٢٦)، **بترتيب المالك**: ملفُّه أوّلاً
 * يغيّر صورتَه واسمَه ومعرّفَه ويحفظ، ثمّ بطاقةُ الترحيب يضيف منها حسابَ الإدارة —
 * فتُشطب منها خطوتان — ثمّ كيف يُضاف الناس من التعليقات والتفاعلات، ثمّ أبوابُ
 * الإضافة (المعرّف، ومن حولك، والرمز)، ثمّ القصص والنوت، فآثار+، فالمتجر.
 */
const STEPS: Step[] = [
  {
    spot: "me.edit",
    route: "/me",
    tap: true,
    until: (ctx) => ctx.path === "/me/edit",
    title: "ابدأ بملفك",
    body: "اضغط «تعديل الملف» — أصحابك يعرفونك من صورتك واسمك قبل أيّ شيء.",
  },
  {
    at: "/me/edit",
    coach: [
      { key: "avatar", label: "غيّر صورتك — اضغط الكاميرا على حافّتها", done: (ctx) => ctx.signals.has("avatar") },
      { key: "name", label: "اكتب اسمك كما يعرفك ناسك", done: (ctx) => ctx.signals.has("name") },
      { key: "handle", label: "اختر معرّفاً يبحثون عنك به", done: (ctx) => ctx.signals.has("handle") },
    ],
    until: (ctx) => ctx.signals.has("profile.saved"),
    title: "عدّل ملفك",
    body: "وإذا خلصت اضغط «احفظ» في الأسفل.",
  },
  {
    spot: "welcome.support",
    route: "/",
    tap: true,
    skipMissing: 3,
    until: (ctx) => ctx.path.startsWith("/u/"),
    title: "أضف حساب آثار",
    body: "من بطاقة الترحيب: اضغط هنا لتفتح ملفّ حساب الإدارة — أخبار التطبيق وجديده في خطّك.",
  },
  {
    spot: "profile.add",
    tap: true,
    at: "/u/",
    until: (ctx) => ctx.signals.has("friend.added"),
    title: "اضغط «أضفه»",
    body: "هكذا يُضاف أيُّ حساب: من ملفّه.",
  },
  {
    spot: "welcome.card",
    route: "/",
    title: "خطوتان تمّتا",
    body: "صورتك وحساب آثار — شُطبتا من بطاقة الترحيب. والباقي: ادعُ صديقاً وانشر أوّل لحظة.",
  },
  {
    route: "/",
    title: "من التعليقات والتفاعلات",
    body: "تحت كلّ لحظةٍ وجوهُ من تفاعل وتعليقاتُهم — اضغط صورة أيّ واحدٍ منهم يفتح ملفّه، ومنه «أضفه». حساب آثار يملأ خطّك بالناس من اليوم.",
  },
  {
    spot: "circle.add",
    route: "/circle",
    tap: true,
    until: (ctx) => ctx.addMode !== null,
    title: "أبواب الإضافة",
    body: "اضغط هنا — كلُّ طرق الإضافة في نافذةٍ واحدة.",
  },
  {
    spot: "add.search",
    title: "بالمعرّف أو الاسم",
    body: "اكتب المعرّف كاملاً أو الاسم الكامل كما هو — لا قوائمَ تُتصفَّح، فلا يجدك إلا من يعرفك.",
  },
  {
    spot: "add.near",
    title: "من حولك",
    body: "لمن يجلس جنبك: افتحاها معاً فيظهر كلٌّ عند الآخر. ومن الإعدادات ← التنبيهات يوصلك خبرٌ إذا فتحها أحدٌ قريب.",
  },
  {
    spot: "add.qr",
    tap: true,
    until: (ctx) => ctx.addMode === "qr",
    title: "رمزك ورابطك",
    body: "اضغط هنا لترى رمزك.",
  },
  {
    coach: [],
    title: "شارك ملفك",
    body: "من يقف أمامك يمسح الرمز بكاميرته، ومن تراسله ترسل له الرابط — وكلُّ من يدخل من رابطك يُحسب لك في الدعوات.",
  },
  {
    spot: "stories",
    route: "/circle",
    before: () => closeAddSheet(),
    title: "القصص والنوت",
    body: "اضغط صورتك: قصةٌ تعيش يوماً، أو نوتٌ — عبارةٌ أو أغنيةٌ تطفو فوق صورتك عند أصدقائك.",
  },
  {
    spot: "header.plus",
    route: "/",
    title: "آثار+",
    body: "اشتراكٌ بمزايا لك وحدك: شارةُ توثيق، وإيموجي حرّ، وآثارنا، والتخفّي، وأرشيفٌ بلا نهاية، ونقاطٌ كلّ شهر.",
  },
  {
    spot: "tab.store",
    route: "/store",
    title: "المتجر",
    body: "تشارمز وإطاراتٌ وثيمات بالنقاط — تُرى قبل شرائها، وتُلبَس من ملفك، وتُهدى لصديق.",
  },
];

/**
 * خطوةُ الجولة في مخزنٍ لا في حالة المكوّن: «أعد الجولة» في الإعدادات
 * يبدؤها من شاشةٍ أخرى. ومعها ما فعله صاحبُها (`signals`) تقرؤه الخطوات.
 */
const useTour = create<{ step: number | null; first: boolean; signals: Set<string> }>(() => ({
  step: null,
  first: false,
  signals: new Set(),
}));

/** هل الجولةُ ظاهرة؟ — بطاقةُ الإعلان تنتظرها ولا تتزاحم معها. */
export function useTourOn() {
  return useTour((state) => state.step !== null);
}

/** يبدأ الجولةَ من أوّلها — من الإعدادات لمن تخطّاها أو فاتته. */
export function startTour() {
  useTour.setState({ step: 0, signals: new Set() });
}

/**
 * شاشةٌ تقول للجولة إنّ صاحبها فعل شيئاً (غيّر صورته، حفظ، أضاف) — والجولةُ
 * وحدها تعرف إن كانت تنتظره. وبلا جولةٍ قائمة لا شيء.
 */
export function tourSignal(name: string) {
  const { step, signals } = useTour.getState();
  if (step === null || signals.has(name)) return;
  useTour.setState({ signals: new Set([...signals, name]) });
}

/** يقيس الهدف، ويعيد المحاولة: تبويبٌ فُتح للتوّ قد لا يكون رُسم بعد. */
async function measureSoon(id: string): Promise<Rect | null> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const rect = await measureSpot(id);
    if (rect) return rect;
    await new Promise((done) => setTimeout(done, 200));
  }
  return null;
}

/** حولَ الهدف فراغٌ يتنفّس فيه — الدائرة لا تلتصق بحوافّه. */
const PAD = 14;

/**
 * جولة أوّل فتح — **تُعلّم لا تحكي** (القاعدة ٣٢٦).
 *
 * كانت تُري: دائرةٌ على كلّ زرّ وسطران عنه، فيقرأ صاحبُها تسعَ بطاقاتٍ ولا
 * يفعل شيئاً. صارت تأخذه بيده: الدائرةُ في خطوات الفعل (`tap`) **ثقبٌ تمرّ منه
 * اللمسة** إلى الزرّ نفسه، وما حولها يحجبها — فلا يضغط إلا ما يُطلب منه —
 * والخطوةُ تمضي حين يتحقّق ما طُلب (`until`): فتح الشاشة، أو حفظ الملف، أو
 * الإضافة. وفي «تعديل الملف» حقولٌ كثيرة لا تتّسع لها دائرة، فتطفو بطاقةٌ بلا
 * تعتيم (`coach`) بقائمةٍ تُشطب بما فعل.
 *
 * والدائرةُ ثقبٌ حقيقيّ في الحجاب (`Path` بقاعدة `evenodd`)، وطبقةٌ في الجذر لا
 * `Modal` (القاعدة ١٧٣).
 */
export function Tour() {
  const router = useRouter();
  const path = usePathname();
  const addMode = useAddMode();
  const step = useTour((state) => state.step);
  const signals = useTour((state) => state.signals);
  const setStep = (next: number | null) => useTour.setState({ step: next });
  const screen = useWindowDimensions();
  const [hole, setHole] = useState<Rect | null>(null);
  const [measured, setMeasured] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    void Promise.all([
      getItem(KEY).catch(() => null),
      ...OLD_KEYS.map((key) => getItem(key).catch(() => null)),
    ]).then(([seen, ...old]) => {
      /*
        مهلةٌ تسبق الجولة: نافذةُ إذن التنبيهات تُطلب مع الدخول، والشريطُ
        السفليّ يُرسم بعد الشاشة — ولا دائرة بلا هدف.
      */
      if (seen !== "1") {
        timer = setTimeout(() => {
          startTour();
          // من رأى جولةً قبلها ليس جديداً: لا يُفتح له ملفُّ الإدارة بعدها.
          useTour.setState({ first: !old.includes("1") });
        }, 1800);
      }
    });
    return () => clearTimeout(timer);
  }, []);

  // زرُّ الرجوع في أندرويد يُغلقها كما كانت النافذة تُغلق.
  useEffect(() => {
    if (step === null) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      close(false);
      return true;
    });
    return () => sub.remove();
  }, [step]);

  // كلُّ خطوةٍ تفتح شاشتها وتقيس هدفها ساعتها، ثمّ تظهر.
  useEffect(() => {
    if (step === null) return;
    let alive = true;
    fade.setValue(0);
    setHole(null);
    setMeasured(false);
    const current = STEPS[step];
    const id = current.spot ?? "";
    current.before?.();
    /*
      الشاشةُ والقوسُ أوّلاً ثمّ القياس: الهدفُ في تبويبٍ آخر أو داخل نافذة،
      ولا يُقاس قبل أن يُرسم ويقف (القوسُ يطير ٤٢٠ مللي، والنافذةُ تصعد).
    */
    if (current.route && path !== current.route) router.navigate(current.route as never);
    useFan.setState({ open: Boolean(current.fan) });
    const settle = new Promise((done) => setTimeout(done, current.route || id.startsWith("add.") ? 560 : 120));
    void settle.then(() => (id ? measureSoon(id) : null)).then((rect) => {
      if (!alive) return;
      // ما فُعل من قبلُ لا يُطلب ثانيةً: خطوةُ بطاقة الترحيب المشطوبة لا تُرسم.
      if (id && !rect && current.skipMissing) {
        const next = step + current.skipMissing;
        setStep(next < STEPS.length ? next : null);
        return;
      }
      // التبويبُ أيقونةٌ وتحتها اسمُه: الدائرةُ تحتضن الاثنين لا الأيقونة وحدها.
      setHole(rect && id.startsWith("tab.") ? { ...rect, height: rect.height + 16 } : rect);
      setMeasured(true);
      Animated.timing(fade, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, fade]);

  /*
    الخطوةُ تمضي حين يفعل صاحبُها ما طُلب — وتعود إلى سابقتها إن خرج من الشاشة
    قبل أن يفعل (رجع من «تعديل الملف» بلا حفظ، أو من ملفّ الإدارة بلا إضافة).
  */
  useEffect(() => {
    if (step === null) return;
    const current = STEPS[step];
    const ctx: Ctx = { path, signals, addMode };
    if (current.until?.(ctx)) {
      const timer = setTimeout(() => setStep(step + 1 < STEPS.length ? step + 1 : null), 380);
      return () => clearTimeout(timer);
    }
    if (current.at && !path.startsWith(current.at)) {
      const timer = setTimeout(() => setStep(Math.max(0, step - 1)), 380);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, path, signals, addMode]);

  // حلقةٌ تنبض حول الدائرة: العينُ تذهب إلى ما يتحرّك.
  useEffect(() => {
    if (step === null) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [step, pulse]);

  // الإغلاقُ أوّلاً ثمّ الحفظ: مخزنٌ يفشل لا يحبس الشاشة تحت الجولة.
  function close(finished: boolean) {
    const { first, signals: done } = useTour.getState();
    useTour.setState({ step: null, first: false, signals: new Set() });
    useFan.setState({ open: false });
    closeAddSheet();
    router.navigate("/" as never);
    void setItem(KEY, "1").catch(() => {});
    /*
      من تخطّى الجولةَ قبل أن يضيف حسابَ الإدارة يُفتح له ملفُّه (القاعدة ٢٤٣):
      الحسابُ الجديد خطُّه فارغ، ومن وجد شاشةً ميّتة لا يعود. ومن أكملها
      أضافه بيده في خطوتها.
    */
    if (first && !finished && !done.has("friend.added")) {
      void api<{ account: { id: string } | null }>("/v1/site/support")
        .then(({ account }) => {
          if (account) router.push(`/u/${account.id}` as never);
        })
        .catch(() => {});
    }
  }

  if (step === null || !measured) return null;

  const current = STEPS[step];
  const last = step === STEPS.length - 1;
  const ctx: Ctx = { path, signals, addMode };
  // خطوةُ فعلٍ بلا هدفٍ مرسوم تُعرض بـ«التالي»: لا تُحبس الجولةُ على زرٍّ غائب.
  const waiting = Boolean(current.tap && hole);

  const dots = (
    <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
      {STEPS.map((_, index) => (
        <View
          key={index}
          style={{
            width: index === step ? 14 : 5,
            height: 5,
            borderRadius: 3,
            backgroundColor: index === step ? colors.gold : "rgba(255,255,255,.35)",
          }}
        />
      ))}
    </View>
  );

  const controls = (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 14 }}>
      {dots}
      {last ? null : (
        <Pressable onPress={() => close(false)} hitSlop={10} style={{ paddingHorizontal: 12, height: 38, justifyContent: "center" }}>
          <Text style={{ color: "rgba(255,255,255,.75)", fontSize: 13 }}>تخطَّ</Text>
        </Pressable>
      )}
      {waiting || current.until ? null : (
        <Pressable
          onPress={() => (last ? close(true) : setStep(step + 1))}
          style={{ height: 38, paddingHorizontal: 18, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#fff" }}
        >
          <Text style={{ color: "#fff", fontSize: 13.5, fontWeight: "700" }}>{last ? "ابدأ" : "التالي"}</Text>
        </Pressable>
      )}
    </View>
  );

  const words = (
    <>
      <Text face="display" style={{ color: "#fff", fontSize: 19, fontWeight: "700", marginBottom: 6, textAlign: "right" }}>
        {current.title}
      </Text>
      <Text style={{ color: "rgba(255,255,255,.9)", fontSize: 14, lineHeight: 24, textAlign: "right" }}>{current.body}</Text>
    </>
  );

  /*
    بطاقةٌ بلا تعتيم: الشاشةُ تحتها تعمل كما هي — يكتب ويختار صورةً ويحفظ —
    والبطاقةُ في أعلاها بقائمةٍ تُشطب بما فعل. زجاجٌ داكن فيُقرأ فوق أيّ أرضية.
  */
  if (current.coach) {
    return (
      <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, elevation: 1000 }}>
        <Animated.View
          style={{
            position: "absolute",
            top: 54,
            left: 14,
            right: 14,
            opacity: fade,
            borderRadius: 20,
            padding: 16,
            backgroundColor: "rgba(8,14,20,0.92)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,.12)",
          }}
        >
          {words}
          {current.coach.length ? (
            <View style={{ marginTop: 10, gap: 8 }}>
              {current.coach.map((item) => {
                const done = item.done(ctx);
                return (
                  <View key={item.key} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: done ? colors.gold : "transparent",
                        borderWidth: done ? 0 : 1.5,
                        borderColor: "rgba(255,255,255,.5)",
                      }}
                    >
                      {done ? <CheckIcon size={13} color={colors.night} /> : null}
                    </View>
                    <Text
                      style={{
                        flex: 1,
                        color: done ? "rgba(255,255,255,.55)" : "#fff",
                        fontSize: 13.5,
                        textDecorationLine: done ? "line-through" : "none",
                      }}
                    >
                      {item.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}
          {controls}
        </Animated.View>
      </View>
    );
  }

  const circle = hole
    ? {
        cx: hole.x + hole.width / 2,
        cy: hole.y + hole.height / 2,
        r: Math.max(hole.width, hole.height) / 2 + PAD,
      }
    : null;

  // الحجابُ مستطيلُ الشاشة وفيه ثقبٌ دائريّ — قوسان يرسمان الدائرة.
  const veil = circle
    ? `M0 0H${screen.width}V${screen.height}H0Z ` +
      `M${circle.cx - circle.r} ${circle.cy}` +
      `a${circle.r} ${circle.r} 0 1 0 ${circle.r * 2} 0` +
      `a${circle.r} ${circle.r} 0 1 0 ${-circle.r * 2} 0Z`
    : `M0 0H${screen.width}V${screen.height}H0Z`;

  /*
    النافذةُ تحت الهدف إن كان في النصف الأعلى، وفوقه إن كان في الأسفل.
  */
  const below = circle ? circle.cy < screen.height / 2 : false;
  const cardStyle = circle
    ? below
      ? { top: circle.cy + circle.r + 18 }
      : { bottom: screen.height - (circle.cy - circle.r) + 18 }
    : { top: screen.height / 2 - 110 };

  /*
    ما حول الثقب يحجب اللمس، والثقبُ يتركه للزرّ تحته — أربعةُ مستطيلاتٍ حول
    مربّع الدائرة. وخطوةٌ لا فعلَ فيها تحجب الشاشةَ كلَّها.
  */
  const blockers =
    waiting && circle
      ? [
          { left: 0, right: 0, top: 0, height: Math.max(0, circle.cy - circle.r) },
          { left: 0, right: 0, top: circle.cy + circle.r, bottom: 0 },
          { left: 0, width: Math.max(0, circle.cx - circle.r), top: circle.cy - circle.r, height: circle.r * 2 },
          { left: circle.cx + circle.r, right: 0, top: circle.cy - circle.r, height: circle.r * 2 },
        ]
      : [{ left: 0, right: 0, top: 0, bottom: 0 }];

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, elevation: 1000 }}>
      <Animated.View pointerEvents="box-none" style={{ flex: 1, opacity: fade }}>
        {blockers.map((box, index) => (
          <View key={index} style={{ position: "absolute", ...box }} />
        ))}

        {/* تعتيمٌ خفيف لا ظلام: الشاشةُ تبقى مقروءةً حول الدائرة. */}
        {/*
          `pointerEvents` على `Svg` نفسه لا يُقرأ في آبل: لوحتُه الأصليّة تأخذ اللمسةَ
          كلَّها فلا يصل شيءٌ إلى الثقب. فتُلفّ في عرضٍ لا يأخذ لمساً.
        */}
        <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
          <Svg width={screen.width} height={screen.height}>
            <Path d={veil} fill="rgba(8,14,20,0.74)" fillRule="evenodd" />
          </Svg>
        </View>

        {circle ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: circle.cx - circle.r,
              top: circle.cy - circle.r,
              width: circle.r * 2,
              height: circle.r * 2,
              borderRadius: circle.r,
              borderWidth: 2,
              borderColor: colors.gold,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }],
            }}
          />
        ) : null}

        {/* السطران يطفوان على التعتيم بجانب الدائرة — بقرار المالك. */}
        <View style={{ position: "absolute", left: 24, right: 24, ...cardStyle }}>
          {words}
          {waiting ? (
            <Text style={{ color: colors.gold, fontSize: 13, fontWeight: "700", marginTop: 8, textAlign: "right" }}>
              اضغط داخل الدائرة
            </Text>
          ) : null}
          {controls}
        </View>
      </Animated.View>
    </View>
  );
}
