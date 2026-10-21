import { useCallback, useEffect, useRef, useState } from "react";
import { LayoutAnimation, Pressable, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Text } from "./type";
import { CameraIcon, CheckIcon, CloseIcon, ShareIcon, SparkIcon, PlusIcon } from "./icons";
import { ShareProfileSheet } from "./share-profile";
import { InviteProgress } from "./invite-progress";
import { useFan } from "./composer-fan";
import { Spot } from "./spot";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { getItem, setItem } from "../lib/store";
import { ar } from "../lib/format";
import { colors } from "../theme/tokens";

type Steps = { avatar: boolean; friend: boolean; moment: boolean; support: boolean };
type Shown = {
  show: true;
  memberNo: number;
  supportId: string | null;
  supportName: string | null;
  steps: Steps;
};
type Welcome = { show: false } | Shown;

// ما فُعل للتوّ يبقى مشطوباً لحظةً ليُرى ثمّ يُطوى.
const STRIKE_MS = 1400;
const fold = () => LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

// لكلّ حسابٍ مفتاحُه — **بقرار المالك**: كان واحداً للجهاز، فمن طواها بحسابٍ طُويت عن
// كلّ حسابٍ يدخل الجهازَ بعده. والقديمُ (`athr.welcome.closed`) لا يُقرأ.
const keyOf = (id: string) => `athr.welcome.closed.${id}`;

/**
 * بطاقةُ الترحيب أعلى اللحظات (القاعدة ٢٤٦) — **بقرار المالك**: الحسابُ الجديد
 * خطُّه فارغ، فتقول له البطاقةُ ما يفعل خطوةً خطوة، وكلُّ خطوةٍ زرٌّ يفعلها.
 * وما فُعل يُشطب من القاعدة لا من الجهاز، و«×» يطويها هنا.
 *
 * **وما شُطب يُحذف، وبإكمالها تختفي** — **بقرار المالك**: الخطوةُ التي فُعلت وهو
 * يرى البطاقة (أو عاد إليها للتوّ) تُشطب لحظةً ثمّ تُطوى، وما كان مفعولاً قبل لا
 * يُرسم أصلاً. والخادمُ يردّ `show: false` حين تكتمل، فتُرسم آخرُ نسخةٍ مشطوبةً
 * كلُّها لحظةً ثمّ تختفي — لا تختفي فجأةً بلا أن يرى أنّه أكملها.
 */
export function WelcomeCard() {
  const router = useRouter();
  const me = useSession((state) => state.me);
  const [closed, setClosed] = useState<boolean | null>(null);
  const [sharing, setSharing] = useState(false);
  const welcome = useQuery({
    queryKey: ["welcome", me?.id],
    queryFn: () => api<Welcome>("/v1/memories/welcome"),
    staleTime: 60_000,
  });
  // الخطواتُ تُشطب من القاعدة، فتُسأل كلّما عاد إلى اللحظات: يضع صورته أو ينشر أو يضيف
  // ثمّ يرجع — وكان الردُّ محفوظاً دقيقةً فتبقى الخطوةُ غيرَ مشطوبةٍ بعد أن فعلها.
  const { refetch } = welcome;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const meId = me?.id;
  useEffect(() => {
    if (!meId) return;
    setClosed(null);
    void getItem(keyOf(meId))
      .catch(() => null)
      .then((value) => setClosed(value === "1"));
  }, [meId]);

  // آخرُ ما عُرض، ومعه ما شوهد غيرَ مفعول: من هنا يُعرف ما فُعل «للتوّ».
  const last = useRef<Shown | null>(null);
  const pending = useRef<Partial<Record<keyof Steps, boolean>>>({});
  const [leaving, setLeaving] = useState<Set<string>>(new Set());

  const fresh = welcome.data;
  const completed = Boolean(fresh && !fresh.show && last.current);
  const data: Shown | null = fresh?.show
    ? fresh
    : completed && last.current
      ? { ...last.current, steps: { avatar: true, friend: true, moment: true, support: true } }
      : null;

  useEffect(() => {
    if (!data) return;
    const just: string[] = [];
    for (const key of Object.keys(data.steps) as (keyof Steps)[]) {
      if (data.steps[key] && pending.current[key]) just.push(key);
      pending.current[key] = !data.steps[key];
    }
    if (fresh?.show) last.current = fresh;
    if (!just.length) return;
    setLeaving((prev) => new Set([...prev, ...just]));
    setTimeout(() => {
      fold();
      setLeaving((prev) => new Set([...prev].filter((key) => !just.includes(key))));
      // اكتملت: آخرُ خطوةٍ رُئيت مشطوبة، فتذهب البطاقة.
      if (completed) last.current = null;
    }, STRIKE_MS);
    // بلا إلغاءٍ عند جلبٍ جديد: مؤقّتٌ أُلغي يترك الخطوةَ مشطوبةً لا تُطوى أبداً.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fresh]);

  if (!me || closed !== false || !data) return null;

  const close = () => {
    setClosed(true);
    void setItem(keyOf(me.id), "1").catch(() => {});
  };

  const steps = [
    {
      key: "support",
      done: data.steps.support,
      icon: <SparkIcon size={16} color={colors.clayInk} />,
      title: `أضف ${data.supportName ?? "حساب آثار"}`,
      hint: "أخبار التطبيق وجديده في خطّك الزمني من اليوم",
      go: () => data.supportId && router.push(`/u/${data.supportId}` as never),
    },
    {
      key: "avatar",
      done: data.steps.avatar,
      icon: <CameraIcon size={16} color={colors.clayInk} />,
      title: "ضع صورتك",
      hint: "أصحابك يعرفونك من وجهك قبل اسمك",
      go: () => router.push("/me/edit" as never),
    },
    {
      key: "friend",
      done: data.steps.friend,
      icon: <ShareIcon size={16} color={colors.clayInk} />,
      title: "ادعُ أوّل صديق",
      hint: "شارك رابط ملفك أو رمزه — دائرتك أنت تبنيها",
      go: () => setSharing(true),
    },
    {
      key: "moment",
      done: data.steps.moment,
      icon: <PlusIcon size={16} color={colors.clayInk} />,
      title: "انشر أوّل لحظة",
      hint: "مكانك، أغنيتك، صورة، أو سطر — من زرّ الزائد",
      go: () => useFan.setState({ open: true }),
    },
  ];
  const done = steps.filter((step) => step.done).length;
  // `pending` يُحدَّث بعد الرسم، فما فُعل للتوّ يُرسم مشطوباً من أوّل رسمةٍ بلا ومضة.
  const shown = steps.filter(
    (step) => !step.done || leaving.has(step.key) || pending.current[step.key as keyof Steps],
  );
  if (!shown.length) return null;

  return (
    <Spot id="welcome.card">
    <View
      style={{
        marginTop: 14,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.goldLine,
        backgroundColor: colors.card,
        padding: 14,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "800" }}>أهلاً {me.name}، حيّاك في آثار</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
            أربع خطوات وتصير آثار بيتك — {ar(done)} من ٤
          </Text>
        </View>
        <Pressable accessibilityLabel="إخفاء" hitSlop={8} onPress={close} style={{ padding: 4 }}>
          <CloseIcon size={14} color={colors.muted} />
        </Pressable>
      </View>

      <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.goldSoft, marginTop: 10, overflow: "hidden" }}>
        <View style={{ width: `${(done / steps.length) * 100}%`, height: "100%", backgroundColor: colors.clay }} />
      </View>

      <View style={{ marginTop: 6 }}>
        {shown.map((step) => (
          <Spot key={step.key} id={`welcome.${step.key}`}>
          <Pressable
            disabled={step.done}
            onPress={step.go}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: step.done ? colors.clay : colors.claySoft,
              }}
            >
              {step.done ? <CheckIcon size={16} color={colors.onBrand} /> : step.icon}
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: step.done ? colors.faint : colors.ink,
                  fontSize: 14,
                  fontWeight: "700",
                  textDecorationLine: step.done ? "line-through" : "none",
                }}
              >
                {step.title}
              </Text>
              {step.done ? null : (
                <Text style={{ color: colors.muted, fontSize: 11.5, marginTop: 1 }}>{step.hint}</Text>
              )}
            </View>
            {step.done ? null : <Text style={{ color: colors.clayInk, fontSize: 18 }}>‹</Text>}
          </Pressable>
          </Spot>
        ))}
      </View>

      {sharing ? (
        <ShareProfileSheet
          name={me.name}
          memberNo={me.memberNo}
          onClose={() => {
            setSharing(false);
            void welcome.refetch();
          }}
          footer={<InviteProgress />}
        />
      ) : null}
    </View>
    </Spot>
  );
}
