import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Pressable, Share, View } from "react-native";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { create } from "zustand";
import { SITE_URL, hasSite } from "@athar/shared";
import { Text, TextInput } from "./type";
import { GlassSheet, SheetScrollView } from "./glass-sheet";
import { Avatar } from "./avatar";
import { NameTag } from "./name-tag";
import { Qr } from "./share-profile";
import { InviteProgress } from "./invite-progress";
import { BackIcon, PinIcon, SearchIcon, ShareIcon, UserPlusIcon } from "./icons";
import { api } from "../lib/api";
import { ar } from "../lib/format";
import { useSession } from "../lib/session";
import { useAddFriend, type FoundPerson } from "../lib/add-friend";
import { colors } from "../theme/tokens";

type Mode = "home" | "near" | "qr";

const useAddSheet = create<{ mode: Mode | null }>(() => ({ mode: null }));

/** يفتح نافذةَ «إضافة صديق» (القاعدة ٢٨١) — من رأس تبويب الأصدقاء. */
export const openAddSheet = (mode: Mode = "home") => useAddSheet.setState({ mode });

const LABEL: Record<FoundPerson["relation"], string> = {
  none: "أضف",
  incoming: "اقبل",
  sent: "أُرسل",
  friend: "صديقك",
};

const glassRow = { backgroundColor: "rgba(255,255,255,.08)", borderRadius: 16 } as const;

/**
 * «إضافة صديق» نافذةٌ زجاجيّة بهيئة نافذة التفاعل (القاعدة ٢٤٧) — **بقرار المالك**،
 * لا صفحة: البحثُ في رأسها ونتائجُه تحته، ثمّ بابان — «من حولك» برادارٍ تنبض
 * هالاتُه حول صورتك، و«الرمز والرابط». وتُركَّب في الجذر (القاعدة ١٣٧).
 */
export function AddSheet() {
  const mode = useAddSheet((s) => s.mode);
  if (!mode) return null;
  return <Body mode={mode} close={() => useAddSheet.setState({ mode: null })} />;
}

function Body({ mode, close }: { mode: Mode; close: () => void }) {
  const go = (next: Mode) => useAddSheet.setState({ mode: next });
  const { add, done, error } = useAddFriend();

  const row = (person: FoundPerson) => (
    <PersonRow
      key={person.id}
      person={person}
      relation={done[person.id] ?? person.relation}
      pending={add.isPending && add.variables === person.id}
      onAdd={() => add.mutate(person.id)}
      onOpen={close}
    />
  );

  const title = mode === "near" ? "من حولك" : mode === "qr" ? "رمزك ورابطك" : "إضافة صديق";
  const subtitle =
    mode === "near"
      ? "افتحوها معاً وأنتم قريبين"
      : mode === "qr"
        ? "لمن يقف أمامك يمسحه، ولمن تراسله الرابط"
        : "بالمعرّف أو الاسم الكامل، أو من حولك";

  return (
    <GlassSheet
      icon={mode === "home" ? <UserPlusIcon size={20} color="#fff" /> : (
        <Pressable accessibilityLabel="رجوع" onPress={() => go("home")} hitSlop={8}>
          <BackIcon size={20} color="#fff" />
        </Pressable>
      )}
      title={title}
      subtitle={subtitle}
      onClose={close}
    >
      {mode === "home" ? <Home go={go} row={row} /> : null}
      {mode === "near" ? <Near row={row} /> : null}
      {mode === "qr" ? <QrPane /> : null}
      {error ? <Text style={{ color: "#FF9C84", fontSize: 12.5, textAlign: "center", paddingBottom: 12 }}>{error}</Text> : null}
    </GlassSheet>
  );
}

/** صفُّ من يُضاف بزجاج النافذة: الضغطُ يفتح بطاقتَه، والزرُّ يُضيف. */
function PersonRow({
  person,
  relation,
  pending,
  onAdd,
  onOpen,
}: {
  person: FoundPerson;
  relation: FoundPerson["relation"];
  pending: boolean;
  onAdd: () => void;
  onOpen: () => void;
}) {
  const router = useRouter();
  const live = relation === "none" || relation === "incoming";
  return (
    <Pressable
      onPress={() => {
        onOpen();
        router.push(`/u/${person.id}` as never);
      }}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9 }}
    >
      <Avatar name={person.name} size={44} mediaId={person.avatarMediaId} frame={person.frame} charm={person.charm} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text numberOfLines={1} style={{ color: "#fff", fontSize: 14.5, fontWeight: "700", writingDirection: "auto", flexShrink: 1 }}>
            {person.name}
          </Text>
          <NameTag isPlus={person.isPlus} tag={person.tag} />
        </View>
        <Text style={{ color: "rgba(255,255,255,.55)", fontSize: 11.5 }}>
          عضوية رقم {ar(person.memberNo)}
          {person.handle ? ` │ ⁨@${person.handle}⁩` : ""}
        </Text>
      </View>
      <Pressable
        disabled={!live || pending}
        onPress={onAdd}
        hitSlop={6}
        style={{
          height: 34,
          minWidth: 64,
          paddingHorizontal: 14,
          borderRadius: 17,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: live ? colors.clay : "rgba(255,255,255,.1)",
        }}
      >
        {pending ? (
          <ActivityIndicator size="small" color={colors.onBrand} />
        ) : (
          <Text style={{ color: live ? colors.onBrand : "rgba(255,255,255,.6)", fontSize: 12.5, fontWeight: "700" }}>
            {LABEL[relation]}
          </Text>
        )}
      </Pressable>
    </Pressable>
  );
}

function Home({ go, row }: { go: (mode: Mode) => void; row: (p: FoundPerson) => React.ReactNode }) {
  const [query, setQuery] = useState("");
  const find = useMutation({
    mutationFn: (q: string) =>
      api<{ people: FoundPerson[] }>("/v1/circle/find", { method: "POST", body: JSON.stringify({ q }) }),
  });
  const ready = query.trim().length >= 2;
  const search = () => ready && find.mutate(query.trim());

  const Door = ({ label, hint, icon, to }: { label: string; hint: string; icon: React.ReactNode; to: Mode }) => (
    <Pressable onPress={() => go(to)} style={[glassRow, { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }]}>
      <View style={{ width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.12)" }}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>{label}</Text>
        <Text style={{ color: "rgba(255,255,255,.6)", fontSize: 12 }}>{hint}</Text>
      </View>
      <Text style={{ color: "rgba(255,255,255,.5)", fontSize: 18 }}>‹</Text>
    </Pressable>
  );

  return (
    <SheetScrollView name="add-home" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={[glassRow, { flexDirection: "row", alignItems: "center", gap: 8, height: 48, paddingHorizontal: 14 }]}>
        <SearchIcon size={18} color="rgba(255,255,255,.6)" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="المعرّف أو الاسم الكامل"
          placeholderTextColor="rgba(255,255,255,.4)"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={search}
          style={{ flex: 1, color: "#fff", fontSize: 15 }}
        />
        {find.isPending ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : ready ? (
          <Pressable onPress={search} hitSlop={8}>
            <Text style={{ color: colors.clay, fontWeight: "800" }}>ابحث</Text>
          </Pressable>
        ) : null}
      </View>

      {find.error ? (
        <Text style={{ color: "#FF9C84", fontSize: 12.5 }}>{(find.error as Error).message}</Text>
      ) : find.data ? (
        find.data.people.length ? (
          <View>{find.data.people.map(row)}</View>
        ) : (
          <Text style={{ color: "rgba(255,255,255,.6)", fontSize: 12.5 }}>
            ما لقينا أحداً — اكتب المعرّف أو الاسم كاملاً كما هو.
          </Text>
        )
      ) : null}

      <Door label="من حولك" hint="لمن يقف جنبك الحين" icon={<PinIcon size={19} color="#fff" />} to="near" />
      <Door label="الرمز والرابط" hint="رمز QR ورابط ملفك للمشاركة" icon={<ShareIcon size={18} color="#fff" />} to="qr" />
    </SheetScrollView>
  );
}

/** هالةٌ تتّسع من الصورة وتبهت — ثلاثٌ متتالية تُقرأ «جاري البحث». */
function Pulse({ delay, size }: { delay: number; size: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(t, { toValue: 1, duration: 2400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t, delay]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: colors.clay,
        backgroundColor: "rgba(246,185,59,.08)",
        opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
        transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2.2] }) }],
      }}
    />
  );
}

function Near({ row }: { row: (p: FoundPerson) => React.ReactNode }) {
  const me = useSession((s) => s.me);
  const [state, setState] = useState<"asking" | "on" | "denied">("asking");
  const [people, setPeople] = useState<FoundPerson[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    void api("/v1/circle/nearby", { method: "DELETE" }).catch(() => {});
  }, []);

  // الدخولُ إلى هذا الوجه يبدأ البحث، والخروجُ منه — رجوعاً أو إغلاقاً — يُطفئ المنارة.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!alive) return;
      if (status !== "granted") {
        setState("denied");
        return;
      }
      setState("on");
      const beat = async () => {
        try {
          const here = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          const res = await api<{ people: FoundPerson[] }>("/v1/circle/nearby", {
            method: "POST",
            body: JSON.stringify({ lat: here.coords.latitude, lng: here.coords.longitude }),
          });
          if (alive) setPeople(res.people);
        } catch {
          // نبضةٌ فاتت لا توقف البحث: التالية بعد ثوانٍ.
        }
      };
      void beat();
      timer.current = setInterval(() => void beat(), 4000);
    })();
    return () => {
      alive = false;
      stop();
    };
  }, [stop]);

  const R = 220;
  // من وُجد يجلس حول الصورة على دائرة — ثمانيةٌ على الأكثر، والبقيّةُ في القائمة.
  const ring = people.slice(0, 8);

  return (
    <SheetScrollView name="add-near" contentContainerStyle={{ padding: 16, paddingTop: 8 }}>
      <View style={{ height: R + 20, alignItems: "center", justifyContent: "center" }}>
        {state === "on" ? (
          <>
            <Pulse delay={0} size={R * 0.5} />
            <Pulse delay={800} size={R * 0.5} />
            <Pulse delay={1600} size={R * 0.5} />
          </>
        ) : null}
        {me ? (
          <Avatar name={me.name} size={84} mediaId={me.avatarMediaId} frame={me.frame} charm={me.charm} />
        ) : null}
        {ring.map((person, i) => {
          const angle = (i / Math.max(ring.length, 1)) * Math.PI * 2 - Math.PI / 2;
          const radius = R / 2 - 6;
          return (
            <View
              key={person.id}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: [
                  { translateX: Math.cos(angle) * radius - 22 },
                  { translateY: Math.sin(angle) * radius - 22 },
                ],
              }}
            >
              <Avatar name={person.name} size={44} mediaId={person.avatarMediaId} frame={person.frame} charm={person.charm} />
            </View>
          );
        })}
      </View>

      {state === "denied" ? (
        <Text style={{ color: "#FF9C84", fontSize: 12.5, textAlign: "center" }}>
          نحتاج إذن الموقع لنعرف من حولك — يُفعَّل من إعدادات الجهاز.
        </Text>
      ) : people.length ? (
        <View>
          <Text style={{ color: "rgba(255,255,255,.6)", fontSize: 12, marginBottom: 2 }}>
            حولك الحين ({ar(people.length)})
          </Text>
          {people.map(row)}
        </View>
      ) : (
        <Text style={{ color: "rgba(255,255,255,.7)", fontSize: 13, textAlign: "center" }}>
          نبحث عمّن فتحها جنبك…
        </Text>
      )}
      <Text style={{ color: "rgba(255,255,255,.4)", fontSize: 11, textAlign: "center", marginTop: 14 }}>
        موقعك لا يُحفظ ولا يُرسل لأحد — يظهر اسمك وصورتك لمن فتحها جنبك وبس، وتختفي إذا طلعت.
      </Text>
    </SheetScrollView>
  );
}

function QrPane() {
  const me = useSession((s) => s.me);
  if (!me) return null;
  const url = hasSite() ? `${SITE_URL}/u/${me.memberNo}` : null;
  const message = url
    ? `ملف ${me.name} في آثار · عضوية رقم ${ar(me.memberNo)}\n${url}`
    : `ملف ${me.name} في آثار · عضوية رقم ${ar(me.memberNo)}`;
  return (
    <SheetScrollView name="add-qr" contentContainerStyle={{ padding: 16, paddingTop: 12, alignItems: "stretch" }}>
      {url ? (
        <View style={{ alignSelf: "center", alignItems: "center", backgroundColor: "#fff", borderRadius: 24, padding: 16 }}>
          <Qr value={url} size={200} />
          <Text style={{ color: colors.night, fontSize: 16, fontWeight: "800", marginTop: 8 }}>{me.name}</Text>
          <Text style={{ color: "#6b7680", fontSize: 12 }}>عضوية رقم {ar(me.memberNo)}</Text>
        </View>
      ) : null}
      {url ? (
        <Text selectable style={{ color: "rgba(255,255,255,.75)", fontSize: 12.5, textAlign: "center", marginTop: 12, writingDirection: "ltr" }}>
          {url}
        </Text>
      ) : null}
      <Pressable
        onPress={() => void Share.share({ message })}
        style={{ marginTop: 14, height: 50, borderRadius: 25, backgroundColor: colors.clay, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}
      >
        <ShareIcon size={18} color={colors.onBrand} />
        <Text style={{ color: colors.onBrand, fontSize: 15, fontWeight: "800" }}>
          {url ? "شارك الرابط" : "شارك رقم عضويتك"}
        </Text>
      </Pressable>
      <InviteProgress />
    </SheetScrollView>
  );
}
