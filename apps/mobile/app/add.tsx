import { useEffect, useRef, useState } from "react";
import { View, ScrollView, Pressable, ActivityIndicator } from "react-native";
import * as Location from "expo-location";
import { Text, TextInput } from "../components/type";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";
import { ScreenHeader } from "../components/screen-header";
import { ShareProfileSheet } from "../components/share-profile";
import { PinIcon, SearchIcon, ShareIcon } from "../components/icons";
import { api } from "../lib/api";
import { ar } from "../lib/format";
import { useSession } from "../lib/session";
import { useAddFriend, type FoundPerson } from "../lib/add-friend";
import { FoundRow } from "../components/found-row";
import { colors } from "../theme/tokens";

/**
 * إضافةُ صديق (القاعدة ٢٨٠) — ثلاثةُ أبواب في شاشةٍ واحدة:
 * البحثُ بالمعرّف أو الاسم الكامل (مطابقةٌ تامّة، فلا قائمةَ تُتصفَّح)،
 * و«من حولك» لمن يقف أمامك الآن، ورابطُ ملفّك ورمزُه.
 */
export default function AddFriend() {
  const me = useSession((s) => s.me);
  const { add, done, error } = useAddFriend();
  const [query, setQuery] = useState("");
  const [share, setShare] = useState(false);

  const find = useMutation({
    mutationFn: (q: string) =>
      api<{ people: FoundPerson[] }>("/v1/circle/find", { method: "POST", body: JSON.stringify({ q }) }),
  });

  // ───── من حولك ─────
  const [near, setNear] = useState<"off" | "asking" | "on" | "denied">("off");
  const [people, setPeople] = useState<FoundPerson[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    void api("/v1/circle/nearby", { method: "DELETE" }).catch(() => {});
  }, []);

  // الخروجُ من الشاشة يُطفئ المنارة: لا يبقى أحدٌ ظاهراً لمن حوله بعد أن يغادر.
  useFocusEffect(useCallback(() => stop, [stop]));
  useEffect(() => stop, [stop]);

  async function startNear() {
    setNear("asking");
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setNear("denied");
      return;
    }
    setNear("on");
    const beat = async () => {
      try {
        const here = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const row = await api<{ people: FoundPerson[] }>("/v1/circle/nearby", {
          method: "POST",
          body: JSON.stringify({ lat: here.coords.latitude, lng: here.coords.longitude }),
        });
        setPeople(row.people);
      } catch {
        // نبضةٌ فاتت لا توقف الشاشة: التالية بعد ثوانٍ.
      }
    };
    void beat();
    timer.current = setInterval(() => void beat(), 4000);
  }

  function row(person: FoundPerson) {
    return (
      <FoundRow
        key={person.id}
        person={person}
        relation={done[person.id] ?? person.relation}
        pending={add.isPending && add.variables === person.id}
        onAdd={() => add.mutate(person.id)}
      />
    );
  }

  const card = { backgroundColor: colors.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.line } as const;

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: colors.ground }}>
      <ScreenHeader title="إضافة صديق" back="/circle" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
        {/* البحث. */}
        <View style={card}>
          <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "800" }}>ابحث بالمعرّف أو الاسم الكامل</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
            مثل ‎@noura أو «نورة العتيبي» — الاسم كما هو، لا جزءاً منه
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginTop: 12,
              height: 46,
              borderRadius: 14,
              paddingHorizontal: 12,
              backgroundColor: colors.paper,
              borderWidth: 1,
              borderColor: colors.line,
            }}
          >
            <SearchIcon size={18} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="المعرّف أو الاسم"
              placeholderTextColor={colors.faint}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => query.trim().length >= 2 && find.mutate(query.trim())}
              style={{ flex: 1, color: colors.ink, fontSize: 14.5 }}
            />
            <Pressable
              disabled={query.trim().length < 2 || find.isPending}
              onPress={() => find.mutate(query.trim())}
              hitSlop={6}
            >
              {find.isPending ? (
                <ActivityIndicator size="small" color={colors.clay} />
              ) : (
                <Text style={{ color: query.trim().length < 2 ? colors.faint : colors.clayInk, fontWeight: "700" }}>ابحث</Text>
              )}
            </Pressable>
          </View>
          {find.error ? (
            <Text style={{ color: colors.live, fontSize: 12.5, marginTop: 8 }}>{(find.error as Error).message}</Text>
          ) : null}
          {find.data ? (
            find.data.people.length ? (
              <View style={{ marginTop: 6 }}>{find.data.people.map(row)}</View>
            ) : (
              <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 10 }}>
                ما لقينا أحداً بهذا الاسم أو المعرّف — تأكّد منه كاملاً.
              </Text>
            )
          ) : null}
        </View>

        {/* وجهاً لوجه. */}
        <View style={card}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.claySoft, alignItems: "center", justifyContent: "center" }}>
              <PinIcon size={19} color={colors.clayInk} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "800" }}>من حولك</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                افتحوها معاً وأنتم قريبين — يظهر كلٌّ للثاني
              </Text>
            </View>
          </View>

          {near === "off" || near === "denied" ? (
            <Pressable
              onPress={() => void startNear()}
              style={{ marginTop: 12, height: 44, borderRadius: 22, backgroundColor: colors.clay, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: colors.onBrand, fontWeight: "800" }}>ابدأ</Text>
            </Pressable>
          ) : null}
          {near === "denied" ? (
            <Text style={{ color: colors.live, fontSize: 12, marginTop: 8 }}>
              نحتاج إذن الموقع لنعرف من حولك — يُفعَّل من إعدادات الجهاز.
            </Text>
          ) : null}
          {near === "asking" ? <ActivityIndicator style={{ marginTop: 14 }} color={colors.clay} /> : null}
          {near === "on" ? (
            people.length ? (
              <View style={{ marginTop: 6 }}>{people.map(row)}</View>
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 }}>
                <ActivityIndicator size="small" color={colors.clay} />
                <Text style={{ color: colors.muted, fontSize: 12.5 }}>نبحث عمّن فتحها حولك…</Text>
              </View>
            )
          ) : null}
          <Text style={{ color: colors.faint, fontSize: 11, marginTop: 10 }}>
            موقعك لا يُحفظ ولا يُرسل لأحد — يظهر اسمك وصورتك لمن فتحها جنبك وبس، ويختفي إذا طلعت من الشاشة.
          </Text>
        </View>

        {/* الرابط والرمز. */}
        {me ? (
          <Pressable
            onPress={() => setShare(true)}
            style={[card, { flexDirection: "row", alignItems: "center", gap: 10 }]}
          >
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.claySoft, alignItems: "center", justifyContent: "center" }}>
              <ShareIcon size={18} color={colors.clayInk} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "800" }}>شارك ملفك</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>رابطٌ لمن تراسله، ورمزٌ لمن يقف أمامك</Text>
            </View>
          </Pressable>
        ) : null}

        {error ? <Text style={{ color: colors.live, fontSize: 12.5, textAlign: "center" }}>{error}</Text> : null}
      </ScrollView>

      {share && me ? <ShareProfileSheet name={me.name} memberNo={me.memberNo} onClose={() => setShare(false)} /> : null}
    </SafeAreaView>
  );
}
