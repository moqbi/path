import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useKeyboardInset } from "../lib/keyboard";
import * as Location from "expo-location";
import { Text, TextInput } from "./type";
import { CloseIcon, PinIcon, SearchIcon } from "./icons";
import { api } from "../lib/api";
import { appleNearby, appleSearch } from "../lib/apple-places";
import { ar } from "../lib/format";

type Place = { id: string; name: string; kind: string | null; meters: number };
export type PickedPlace = { name: string; city?: string; lat: number; lng: number };

/**
 * أين أنت؟ — لملصق الموقع على القصّة (القاعدة ٢٣٨).
 *
 * المكانُ من الجهاز لا من لوحة المفاتيح (القاعدة ٥): القريبُ أوّلاً — خرائطُ
 * آبل على الآيفون ثمّ الخادم (القاعدة ١٨٨) — والبحثُ بالاسم لما لم يظهر.
 * والإذنُ يُطلب حين يُضغط الملصق لا قبله (القاعدة ٦٨). وطبقةٌ فوق الناشر لا
 * `Modal` (القاعدة ١٢٦).
 */
export function StoryPlaceSheet({ onPick, onClose }: { onPick: (place: PickedPlace) => void; onClose: () => void }) {
  const [fix, setFix] = useState<{ lat: number; lng: number } | null>(null);
  const [city, setCity] = useState<string | undefined>();
  const [around, setAround] = useState<Place[] | null>(null);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Place[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!alive) return;
      if (status !== "granted") {
        setProblem("لازم تسمح بالوصول لموقعك عشان تضيف ملصق الموقع.");
        return;
      }
      const known = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60 * 1000, requiredAccuracy: 150 }).catch(() => null);
      const point =
        known ??
        (await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
          new Promise<null>((done) => setTimeout(() => done(null), 8000)),
        ]).catch(() => null));
      if (!alive) return;
      if (!point) {
        setProblem("تعذّر تحديد موقعك. جرّب مرة ثانية.");
        return;
      }
      const here = { lat: point.coords.latitude, lng: point.coords.longitude };
      setFix(here);
      // المدينةُ سطرٌ صغير تحت الاسم — من الجهاز نفسه.
      Location.reverseGeocodeAsync({ latitude: here.lat, longitude: here.lng })
        .then((rows) => alive && setCity(rows[0]?.city ?? rows[0]?.region ?? undefined))
        .catch(() => {});
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!fix) return;
    let alive = true;
    appleNearby(fix.lat, fix.lng)
      .catch(() => null)
      .then((apple) =>
        apple && apple.length
          ? apple
          : api<{ places: Place[] }>(`/v1/places/nearby?lat=${fix.lat}&lng=${fix.lng}`).then((row) => row.places),
      )
      .then((places) => alive && setAround(places))
      .catch(() => alive && setAround([]));
    return () => {
      alive = false;
    };
  }, [fix]);

  useEffect(() => {
    const q = query.trim();
    if (!fix || q.length < 2) {
      setFound(null);
      return;
    }
    let alive = true;
    const timer = setTimeout(() => {
      appleSearch(q, fix.lat, fix.lng)
        .catch(() => null)
        .then((apple) =>
          apple
            ? apple
            : api<{ places: Place[] }>(`/v1/places/search?lat=${fix.lat}&lng=${fix.lng}&q=${encodeURIComponent(q)}`).then(
                (row) => row.places,
              ),
        )
        .then((places) => alive && setFound(places))
        .catch(() => alive && setFound([]));
    }, 450);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, fix]);

  const list = found ?? around;
  // نافذةٌ في نصف الشاشة كبقيّة النوافذ — تصعد فوق الكيبورد حين يُبحث فيها.
  const { height } = useWindowDimensions();
  const lift = useKeyboardInset();

  return (
    <Pressable
      accessibilityLabel="إغلاق"
      onPress={onClose}
      style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(8,13,18,.55)", justifyContent: "flex-end" }}
    >
    <Pressable
      onPress={() => {}}
      style={{
        height: Math.min(height * 0.62, height - lift - 60),
        marginBottom: lift,
        backgroundColor: "#16222D",
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        paddingTop: 10,
        paddingHorizontal: 16,
      }}
    >
      <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,.25)", marginBottom: 10 }} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <Text style={{ flex: 1, color: "#fff", fontSize: 17, fontWeight: "800" }}>وين أنت؟</Text>
        <Pressable
          accessibilityLabel="إغلاق"
          onPress={onClose}
          style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.16)" }}
        >
          <CloseIcon size={16} color="#fff" />
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 44, borderRadius: 12, paddingHorizontal: 12, backgroundColor: "rgba(255,255,255,.12)", marginBottom: 10 }}>
        <SearchIcon size={16} color="rgba(255,255,255,.7)" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="ابحث عن مكان"
          placeholderTextColor="rgba(255,255,255,.5)"
          style={{ flex: 1, color: "#fff", fontSize: 14 }}
        />
      </View>

      {problem ? (
        <Text style={{ color: "#FF7A5A", fontSize: 13, textAlign: "center", marginTop: 24 }}>{problem}</Text>
      ) : !list ? (
        <ActivityIndicator color="#fff" style={{ marginTop: 30 }} />
      ) : list.length === 0 ? (
        <Text style={{ color: "rgba(255,255,255,.7)", fontSize: 13, textAlign: "center", marginTop: 24 }}>ما لقينا أماكن هنا.</Text>
      ) : (
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 34 }}>
          {list.map((place) => (
            <Pressable
              key={place.id}
              onPress={() => fix && onPick({ name: place.name, city, lat: fix.lat, lng: fix.lng })}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.08)" }}
            >
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "#FF7A5A", alignItems: "center", justifyContent: "center" }}>
                <PinIcon size={17} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: "#fff", fontSize: 14.5, fontWeight: "700" }}>
                  {place.name}
                </Text>
                <Text style={{ color: "rgba(255,255,255,.6)", fontSize: 11.5 }}>
                  {[place.kind, place.meters ? `${ar(Math.round(place.meters))} م` : null].filter(Boolean).join("، ")}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </Pressable>
    </Pressable>
  );
}
