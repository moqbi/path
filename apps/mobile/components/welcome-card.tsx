import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Text } from "./type";
import { CameraIcon, CheckIcon, CloseIcon, ShareIcon, SparkIcon, PlusIcon } from "./icons";
import { ShareProfileSheet } from "./share-profile";
import { InviteProgress } from "./invite-progress";
import { useFan } from "./composer-fan";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { getItem, setItem } from "../lib/store";
import { ar } from "../lib/format";
import { colors } from "../theme/tokens";

type Welcome =
  | { show: false }
  | {
      show: true;
      memberNo: number;
      supportId: string | null;
      supportName: string | null;
      steps: { avatar: boolean; friend: boolean; moment: boolean; support: boolean };
    };

const KEY = "athr.welcome.closed";

/**
 * بطاقةُ الترحيب أعلى اللحظات (القاعدة ٢٤٦) — **بقرار المالك**: الحسابُ الجديد
 * خطُّه فارغ، فتقول له البطاقةُ ما يفعل خطوةً خطوة، وكلُّ خطوةٍ زرٌّ يفعلها.
 * وما فُعل يُشطب من القاعدة لا من الجهاز، و«×» يطويها هنا.
 */
export function WelcomeCard() {
  const router = useRouter();
  const me = useSession((state) => state.me);
  const [closed, setClosed] = useState<boolean | null>(null);
  const [sharing, setSharing] = useState(false);
  const welcome = useQuery({
    queryKey: ["welcome"],
    queryFn: () => api<Welcome>("/v1/memories/welcome"),
    staleTime: 60_000,
  });

  useEffect(() => {
    void getItem(KEY)
      .catch(() => null)
      .then((value) => setClosed(value === "1"));
  }, []);

  const data = welcome.data;
  if (!me || closed !== false || !data?.show) return null;

  const close = () => {
    setClosed(true);
    void setItem(KEY, "1").catch(() => {});
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

  return (
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
        {steps.map((step) => (
          <Pressable
            key={step.key}
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
  );
}
