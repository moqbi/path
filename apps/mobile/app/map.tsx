import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Platform, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import MapView, { Marker, Polyline, type Region } from "react-native-maps";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { Text } from "../components/type";
import { Spinner } from "../components/spinner";
import { MediaImage } from "../components/media-image";
import { AthrMark } from "../components/brand";
import { BackChevron } from "../components/screen-header";
import { MapIcon, PinIcon } from "../components/icons";
import { api } from "../lib/api";
import { openMaps } from "../lib/maps";
import { ar, dayLabel } from "../lib/format";
import { colors } from "../theme/tokens";

type Point = {
  id: string;
  kind: string;
  text: string | null;
  placeName: string | null;
  placeCity: string | null;
  /** دولتُها من آخر وصولٍ قبلها — خادمٌ قبل القاعدة ٣٨١ لا يرسلها. */
  country?: string;
  lat: number;
  lng: number;
  mediaId: string | null;
  at: string;
  year: number;
};

type Stats = {
  places: number;
  cities: number;
  countries: number;
  top: { name: string; count: number } | null;
  unplaced: number;
};

type MapData = { points: Point[]; years: number[]; stats: Record<string, Stats>; limited: boolean };

/** ثلاثُ درجاتٍ للقرب (القاعدة ٣٨٣): دولٌ من بعيد، ثمّ مدن، ثمّ أماكنُ بصورها. */
type Level = "country" | "city" | "place";
type Pin = { key: string; level: Level; lat: number; lng: number; label: string; country: string; points: Point[] };

/** ما فوق هذا من عرض الخريطة (بالدرجات) دول، وما فوق الثاني مدن، وما دونه أماكن. */
const COUNTRY_ZOOM = 14;
const CITY_ZOOM = 0.6;

/**
 * خطوطُ الأثر خاناتٌ ثابتةُ العدد تُركَّب مع الخريطة ولا تُنزع (القاعدة ٣٨١): تركيبُ
 * `Polyline` ونزعُها في الطبقة القديمة داخل Fabric أسقطا التطبيقَ عند «أثري».
 */
const TRAIL_SLOTS = 24;
type Coord = { latitude: number; longitude: number };
const NOWHERE: Coord[] = [
  { latitude: 0, longitude: 0 },
  { latitude: 0, longitude: 0 },
];

// ألوانُ الخريطة ثابتةٌ لا تتبع الثيم: أرضٌ داكنةٌ هادئة وذهبُ آثار عليها.
const AMBER = "#F6B93B";
const NIGHT = "#0E1A24";
const INK = "#F7F5EF";
const SOFT = "rgba(247,245,239,0.66)";
const FAINT = "rgba(247,245,239,0.42)";
const GLASS = "rgba(14,26,36,0.62)";
const EDGE = "rgba(255,255,255,0.12)";

const SAUDI = "السعودية";
const countryOf = (point: Point) => point.country ?? SAUDI;
const cityOf = (point: Point) => point.placeCity ?? `${point.lat.toFixed(1)},${point.lng.toFixed(1)}`;
const photoOf = (points: Point[]) => [...points].reverse().find((point) => point.mediaId)?.mediaId ?? null;

/** حجمُ النقطة بكثافة الذكريات لا بعددها خطّياً: لحظةٌ واحدة نقطةٌ صغيرة، وخمسون أكبرُ بقليل. */
const coreOf = (count: number) => Math.round(7 + Math.min(9, 2.4 * Math.log2(Math.max(1, count))));

/**
 * «خريطتي» (القاعدة ٣٨٣) — **بقرار المالك**: الخريطةُ هادئةٌ والذكرياتُ هي الأبرز. من بعيدٍ
 * دول، ثمّ مدنٌ — نقطةٌ ذهبيّة تكبر وتتوهّج بكثافة لحظاتها ومعها اسمُها وعددُها — ثمّ أماكنُ
 * بصورها. الضغطُ يطير إليها وتكبر علامتُها بصورةٍ منها، وتصعد بطاقةٌ من الأسفل تُسحب: إلى
 * أعلى لكلّ لحظاتها، وإلى أسفل لتعود الخريطة. وبلا اختيارٍ لا يغطّي الخريطةَ إلا سطرٌ صغير.
 */
export default function MyMap() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const map = useRef<MapView>(null);
  const [year, setYear] = useState<number | null>(null);
  const [delta, setDelta] = useState(30);
  const [open, setOpen] = useState<Pin | null>(null);
  const [trail, setTrail] = useState(true);
  // صورُ العلامات تُرسم ثمّ تُجمَّد: علامةٌ تتابع تغيّرها تُعيد رسمَ الخريطة مع كلّ إطار.
  const [tracking, setTracking] = useState(true);

  const state = useQuery({
    queryKey: ["my-map"],
    queryFn: () => api<MapData>("/v1/archive/map"),
  });

  const points = useMemo(
    () =>
      (state.data?.points ?? [])
        .filter((point) => year == null || point.year === year)
        .sort((a, b) => a.at.localeCompare(b.at)),
    [state.data, year],
  );
  const stats = state.data?.stats[year == null ? "all" : String(year)];
  const level: Level = delta > COUNTRY_ZOOM ? "country" : delta > CITY_ZOOM ? "city" : "place";

  const pins = useMemo<Pin[]>(() => {
    const groups = new Map<string, Pin>();
    for (const point of points) {
      const key =
        level === "country"
          ? `n:${countryOf(point)}`
          : level === "city"
            ? `c:${cityOf(point)}`
            : `p:${point.placeName ?? ""}:${point.lat.toFixed(3)},${point.lng.toFixed(3)}`;
      const label =
        level === "country"
          ? countryOf(point)
          : level === "city"
            ? point.placeCity ?? point.placeName ?? ""
            : point.placeName ?? point.placeCity ?? "";
      const group = groups.get(key) ?? { key, level, lat: 0, lng: 0, label, country: countryOf(point), points: [] };
      group.points.push(point);
      groups.set(key, group);
    }
    for (const group of groups.values()) {
      group.lat = group.points.reduce((sum, p) => sum + p.lat, 0) / group.points.length;
      group.lng = group.points.reduce((sum, p) => sum + p.lng, 0) / group.points.length;
    }
    return [...groups.values()];
  }, [points, level]);

  /*
    الأثرُ بترتيب الزيارة، ولكلّ درجةٍ خطوطُها (القاعدة ٣٨١): من بعيدٍ خطٌّ بين الدول، ثمّ
    مدنُ الدولة الواحدة، ثمّ أماكنُ المدينة الواحدة.
  */
  const lines = useMemo(() => {
    const byPoint = new Map<string, Pin>();
    for (const pin of pins) for (const point of pin.points) byPoint.set(point.id, pin);
    const groups = new Map<string, { coords: Coord[]; last: string | null }>();
    for (const point of points) {
      const pin = byPoint.get(point.id);
      if (!pin) continue;
      const area = level === "country" ? "world" : level === "city" ? countryOf(point) : cityOf(point);
      const group = groups.get(area) ?? { coords: [], last: null };
      if (group.last !== pin.key) {
        group.coords.push({ latitude: pin.lat, longitude: pin.lng });
        group.last = pin.key;
      }
      groups.set(area, group);
    }
    return [...groups.values()]
      .map((group) => group.coords)
      .filter((coords) => coords.length > 1)
      .sort((a, b) => b.length - a.length)
      .slice(0, TRAIL_SLOTS);
  }, [pins, points, level]);

  const fit = (coords: Coord[], bottom: number, animated = true) => {
    if (!coords.length) return;
    map.current?.fitToCoordinates(coords, {
      edgePadding: { top: insets.top + 150, right: 60, bottom, left: 60 },
      animated,
    });
  };
  const fitAll = (animated = true) =>
    fit(points.map((point) => ({ latitude: point.lat, longitude: point.lng })), insets.bottom + 120, animated);

  // الخريطةُ تبدأ على ما فيه لحظات، وتعود إليه مع كلّ سنة.
  useEffect(() => {
    if (!points.length) return;
    const timer = setTimeout(() => fitAll(true), 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  useEffect(() => {
    setTracking(true);
    const timer = setTimeout(() => setTracking(false), 1800);
    return () => clearTimeout(timer);
  }, [pins, open?.key]);

  const { height: screenH } = useWindowDimensions();
  const peek = 292 + insets.bottom;

  const select = (pin: Pin) => {
    setOpen(pin);
    const coords = pin.points.map((point) => ({ latitude: point.lat, longitude: point.lng }));
    if (pin.level === "place" || coords.length === 1) {
      map.current?.animateToRegion(
        {
          latitude: pin.lat - (pin.level === "place" ? 0.004 : 0.06),
          longitude: pin.lng,
          latitudeDelta: pin.level === "place" ? 0.014 : 0.25,
          longitudeDelta: pin.level === "place" ? 0.014 : 0.25,
        },
        500,
      );
      return;
    }
    fit(coords, peek + 40);
  };

  // مدينةٌ من قائمة الدولة: تُختار بعلامتها في درجة المدن ولو كانت الخريطةُ على الدول.
  const pickCity = (name: string, cityPoints: Point[]) => {
    const pin: Pin = {
      key: `c:${name}`,
      level: "city",
      lat: cityPoints.reduce((sum, p) => sum + p.lat, 0) / cityPoints.length,
      lng: cityPoints.reduce((sum, p) => sum + p.lng, 0) / cityPoints.length,
      label: name,
      country: countryOf(cityPoints[0]),
      points: cityPoints,
    };
    select(pin);
  };

  return (
    <View style={{ flex: 1, backgroundColor: NIGHT }}>
      {state.isLoading ? (
        <Spinner style={{ marginTop: insets.top + 160 }} color={AMBER} />
      ) : (
        <MapView
          ref={map}
          style={{ flex: 1 }}
          initialRegion={{ latitude: 24.71, longitude: 46.68, latitudeDelta: 30, longitudeDelta: 30 }}
          onRegionChangeComplete={(region: Region) => setDelta(region.latitudeDelta)}
          mapType={Platform.OS === "ios" ? "mutedStandard" : "standard"}
          userInterfaceStyle="dark"
          showsPointsOfInterest={false}
          showsBuildings={false}
          showsTraffic={false}
          showsCompass={false}
          showsScale={false}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
        >
          {Array.from({ length: TRAIL_SLOTS }, (_, slot) => {
            const line = trail ? lines[slot] : undefined;
            return [
              <Polyline
                key={`glow-${slot}`}
                coordinates={line ?? NOWHERE}
                geodesic
                strokeWidth={line ? 5 : 0}
                strokeColor={line ? "rgba(246,185,59,0.14)" : "transparent"}
              />,
              <Polyline
                key={`dash-${slot}`}
                coordinates={line ?? NOWHERE}
                geodesic
                strokeWidth={line ? 1.6 : 0}
                strokeColor={line ? "rgba(246,185,59,0.85)" : "transparent"}
                lineDashPattern={[2, 6]}
                lineCap="round"
              />,
            ];
          })}
          {pins.map((pin) => {
            const chosen = open?.key === pin.key;
            const dotted = pin.level !== "place";
            const core = coreOf(pin.points.length);
            const box = core * 3;
            // الارتكازُ على مركز النقطة: فوقها الكبسولةُ (٢٦) أو الصورةُ المختارة (٦٤).
            const above = chosen ? 64 : 26;
            return (
              <Marker
                key={pin.key}
                coordinate={{ latitude: pin.lat, longitude: pin.lng }}
                onPress={() => select(pin)}
                tracksViewChanges={tracking}
                anchor={dotted ? { x: 0.5, y: (above + box / 2) / (above + box) } : { x: 0.5, y: 1 }}
                zIndex={chosen ? 9999 : pin.points.length}
              >
                {dotted ? <DotPin pin={pin} chosen={chosen} /> : <PlacePin pin={pin} chosen={chosen} />}
              </Marker>
            );
          })}
        </MapView>
      )}

      {/* الرأسُ يطفو: رجوعٌ في طرف البداية (القاعدة ٣٣٠)، والعنوانُ، و«الكل» يعيد الخريطةَ إلى ما فيه لحظات. */}
      <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + 8, left: 14, right: 14, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <RoundGlass label="رجوع" onPress={() => (router.canGoBack() ? router.back() : router.replace("/me" as never))}>
            <BackChevron color={INK} />
          </RoundGlass>
          <Glass style={{ flex: 1, borderRadius: 26 }}>
            <View style={{ height: 52, alignItems: "center", justifyContent: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <AthrMark size={20} />
                <Text face="display" style={{ color: INK, fontSize: 16, fontWeight: "800" }}>
                  خريطتي
                </Text>
              </View>
              <Text style={{ color: SOFT, fontSize: 11 }}>لحظاتك حول العالم</Text>
            </View>
          </Glass>
          <RoundGlass label="اعرض كل الأماكن" onPress={() => fitAll()}>
            <LocateIcon />
          </RoundGlass>
        </View>

        {(state.data?.years.length ?? 0) > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, direction: "rtl" }}>
            <YearChip label="كل السنوات" on={year == null} onPress={() => setYear(null)} />
            {state.data?.years.map((one) => (
              <YearChip key={one} label={ar(one)} on={year === one} onPress={() => setYear(one)} />
            ))}
          </ScrollView>
        ) : null}
      </View>

      {/* أدواتُ الخريطة في طرفها: «أثري» يُظهر خطوطَ الرحلة ويُخفيها. */}
      {points.length && !open ? (
        <View pointerEvents="box-none" style={{ position: "absolute", right: 14, bottom: insets.bottom + 86, gap: 10 }}>
          <RoundGlass label="أثري" on={trail} onPress={() => setTrail((on) => !on)}>
            <TrailIcon on={trail} />
          </RoundGlass>
        </View>
      ) : null}

      {/* بلا اختيار: سطرٌ صغيرٌ في الأسفل لا بطاقةٌ تغطّي الخريطة. */}
      {stats && points.length && !open ? (
        <View pointerEvents="box-none" style={{ position: "absolute", left: 14, right: 14, bottom: insets.bottom + 16 }}>
          <Summary stats={stats} limited={state.data?.limited ?? false} />
        </View>
      ) : null}

      {!state.isLoading && !points.length ? (
        <View pointerEvents="none" style={{ position: "absolute", left: 22, right: 22, bottom: insets.bottom + 30 }}>
          <Glass>
            <View style={{ padding: 18, alignItems: "center", gap: 8 }}>
              <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(246,185,59,0.16)" }}>
                <MapIcon size={22} color={AMBER} />
              </View>
              <Text face="display" style={{ color: INK, fontSize: 15, fontWeight: "800", textAlign: "center" }}>
                خريطتك تنتظر أوّل أثر
              </Text>
              <Text style={{ color: SOFT, fontSize: 12.5, lineHeight: 20, textAlign: "center" }}>
                كلُّ لحظةٍ تنشرها تظهر هنا في مكانها ما دام إذنُ الموقع مسموحاً للتطبيق — لك وحدك.
              </Text>
            </View>
          </Glass>
        </View>
      ) : null}

      {open ? (
        <MapSheet
          key={open.key}
          pin={open}
          height={Math.round(screenH * 0.8)}
          peek={peek}
          bottomInset={insets.bottom}
          onClose={() => setOpen(null)}
          onMoment={(id) => router.push(`/m/${id}` as never)}
          onCity={pickCity}
        />
      ) : null}
    </View>
  );
}

/** زجاجٌ داكنٌ بحافّةٍ مضيئة — أندرويد بلا غبش فأرضيتُه أكثف. */
function Glass({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View
      style={[
        {
          borderRadius: 18,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: EDGE,
          backgroundColor: Platform.OS === "ios" ? "transparent" : "rgba(14,26,36,0.9)",
        },
        style,
      ]}
    >
      {Platform.OS === "ios" ? (
        <BlurView intensity={40} tint="dark" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      ) : null}
      <View style={{ backgroundColor: Platform.OS === "ios" ? GLASS : "transparent" }}>{children}</View>
    </View>
  );
}

function RoundGlass({ children, label, on, onPress }: { children: React.ReactNode; label: string; on?: boolean; onPress: () => void }) {
  return (
    <Glass style={{ borderRadius: 26, borderColor: on ? "rgba(246,185,59,0.5)" : EDGE }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={on == null ? undefined : { checked: on }}
        hitSlop={6}
        onPress={onPress}
        style={{ width: 50, height: 50, alignItems: "center", justifyContent: "center" }}
      >
        {children}
      </Pressable>
    </Glass>
  );
}

function LocateIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={6.5} stroke={INK} strokeWidth={1.7} />
      <Circle cx={12} cy={12} r={2.2} fill={INK} />
      <Path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" stroke={INK} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

function TrailIcon({ on }: { on: boolean }) {
  const color = on ? AMBER : INK;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M5 18c3-1 3-6 7-6s4-5 7-6" stroke={color} strokeWidth={1.8} strokeDasharray="2 3" strokeLinecap="round" />
      <Circle cx={5} cy={18} r={2.2} fill={color} />
      <Circle cx={19} cy={6} r={2.2} fill={color} />
    </Svg>
  );
}

/** الأرقامُ سطرٌ واحدٌ صغير (القاعدة ٣٨٣): الخريطةُ لها، والتفاصيلُ في البطاقة حين تُطلب. */
function Summary({ stats, limited }: { stats: Stats; limited: boolean }) {
  const cell = (value: number, label: string) => (
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
      <Text face="display" style={{ color: INK, fontSize: 15, fontWeight: "800" }}>
        {ar(value)}
      </Text>
      <Text style={{ color: SOFT, fontSize: 11.5 }}>{label}</Text>
    </View>
  );
  const dot = <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: FAINT }} />;
  return (
    <Glass style={{ alignSelf: "center", borderRadius: 22 }}>
      <View style={{ paddingHorizontal: 18, paddingVertical: 10, alignItems: "center", gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {cell(stats.places, "مكان")}
          {dot}
          {cell(stats.cities, "مدينة")}
          {dot}
          {cell(stats.countries, "دولة")}
        </View>
        {limited || stats.unplaced > 0 ? (
          <Text style={{ color: FAINT, fontSize: 10 }}>
            {limited ? "آخر ستة أشهر — الأقدم مع آثار+" : `${ar(stats.unplaced)} لحظة بلا نقطة على الخريطة`}
          </Text>
        ) : null}
      </View>
    </Glass>
  );
}

function YearChip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return on ? (
    <Pressable onPress={onPress} style={{ height: 32, paddingHorizontal: 14, borderRadius: 16, justifyContent: "center", backgroundColor: AMBER }}>
      <Text style={{ color: NIGHT, fontSize: 12.5, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  ) : (
    <Glass style={{ borderRadius: 16 }}>
      <Pressable onPress={onPress} style={{ height: 30, paddingHorizontal: 14, justifyContent: "center" }}>
        <Text style={{ color: INK, fontSize: 12.5, fontWeight: "700" }}>{label}</Text>
      </Pressable>
    </Glass>
  );
}

/**
 * الدولةُ والمدينة: نقطةٌ ذهبيّةٌ صغيرة بهالةٍ تتّسع بكثافة الذكريات، وفوقها كبسولةٌ باسمها
 * وعددها. والمختارةُ تكبر: صورةٌ منها في حلقةٍ ذهبيّة مكان الكبسولة.
 */
function DotPin({ pin, chosen }: { pin: Pin; chosen: boolean }) {
  const core = coreOf(pin.points.length) + (chosen ? 3 : 0);
  const box = coreOf(pin.points.length) * 3;
  const glow = Math.min(1, 0.35 + Math.log2(pin.points.length + 1) / 10);
  const photo = chosen ? photoOf(pin.points) : null;
  return (
    <View style={{ alignItems: "center" }}>
      {chosen ? (
        <View style={{ height: 64, justifyContent: "flex-start" }}>
          <View
            style={{
              width: 58,
              height: 58,
              borderRadius: 29,
              padding: 3,
              backgroundColor: AMBER,
              shadowColor: AMBER,
              shadowOpacity: 0.6,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 0 },
            }}
          >
            <View style={{ flex: 1, borderRadius: 26, overflow: "hidden", backgroundColor: NIGHT, alignItems: "center", justifyContent: "center" }}>
              {photo ? (
                <MediaImage mediaId={photo} style={{ width: 52, height: 52 }} fade={false} />
              ) : (
                <Text face="display" style={{ color: AMBER, fontSize: 16, fontWeight: "800" }}>
                  {ar(pin.points.length)}
                </Text>
              )}
            </View>
          </View>
        </View>
      ) : (
        <View style={{ height: 26, justifyContent: "flex-start" }}>
          <View
            style={{
              height: 22,
              paddingHorizontal: 8,
              borderRadius: 11,
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              backgroundColor: "rgba(14,26,36,0.82)",
              borderWidth: 1,
              borderColor: EDGE,
            }}
          >
            {pin.label ? (
              <Text numberOfLines={1} style={{ color: INK, fontSize: pin.level === "country" ? 11.5 : 10.5, fontWeight: "700", maxWidth: 110 }}>
                {pin.label}
              </Text>
            ) : null}
            <Text style={{ color: AMBER, fontSize: 10.5, fontWeight: "800" }}>{ar(pin.points.length)}</Text>
          </View>
        </View>
      )}
      <View style={{ width: box, height: box, alignItems: "center", justifyContent: "center" }}>
        <View style={{ position: "absolute", width: box, height: box, borderRadius: box / 2, backgroundColor: `rgba(246,185,59,${(0.1 * glow).toFixed(3)})` }} />
        <View
          style={{
            position: "absolute",
            width: core * 1.9,
            height: core * 1.9,
            borderRadius: core,
            backgroundColor: `rgba(246,185,59,${(0.26 * glow).toFixed(3)})`,
          }}
        />
        <View style={{ width: core, height: core, borderRadius: core / 2, backgroundColor: chosen ? "#FFF3D6" : AMBER, borderWidth: chosen ? 2 : 0, borderColor: AMBER }} />
      </View>
    </View>
  );
}

/** المكانُ من قريب: صورةُ آخر لحظةٍ فيه بذيلٍ يشير إلى موضعه، والمختارُ بحلقةٍ ذهبيّة. */
function PlacePin({ pin, chosen }: { pin: Pin; chosen: boolean }) {
  const photo = photoOf(pin.points);
  return (
    <View style={{ width: 60, height: 66, alignItems: "center" }}>
      <View style={{ width: 50, height: 50, borderRadius: 15, padding: 2.5, backgroundColor: chosen ? AMBER : "#fff" }}>
        <View style={{ flex: 1, borderRadius: 12.5, overflow: "hidden", backgroundColor: NIGHT, alignItems: "center", justifyContent: "center" }}>
          {photo ? <MediaImage mediaId={photo} style={{ width: 45, height: 45 }} fade={false} /> : <PinIcon size={18} color={AMBER} />}
        </View>
      </View>
      <Svg width={12} height={8} viewBox="0 0 12 8" style={{ marginTop: -1 }}>
        <Path d="M0 0 L6 8 L12 0 Z" fill={chosen ? AMBER : "#fff"} />
      </Svg>
      {pin.points.length > 1 ? (
        <View
          style={{
            position: "absolute",
            top: -5,
            right: 0,
            minWidth: 20,
            height: 20,
            borderRadius: 10,
            paddingHorizontal: 5,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: AMBER,
            borderWidth: 2,
            borderColor: NIGHT,
          }}
        >
          <Text style={{ color: NIGHT, fontSize: 10, fontWeight: "800" }}>{ar(pin.points.length)}</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * البطاقةُ السفليّة (القاعدة ٣٨٣): تصعد إلى نصفها، وتُسحب إلى أعلى فتعرض كلَّ ما في المكان،
 * وإلى أسفل فتُغلق وتعود الخريطة. السحبُ من رأسها وحده — قائمتُها تُمرَّر حين تُفتح كاملةً.
 * وحركتُها بمحرّك جافاسكربت: قيمةٌ واحدة لا تُقسَم بين محرّكين، ولا رسمةَ من React أثناء السحب.
 */
function MapSheet({
  pin,
  height,
  peek,
  bottomInset,
  onClose,
  onMoment,
  onCity,
}: {
  pin: Pin;
  height: number;
  peek: number;
  bottomInset: number;
  onClose: () => void;
  onMoment: (id: string) => void;
  onCity: (name: string, points: Point[]) => void;
}) {
  const low = height - peek;
  const y = useRef(new Animated.Value(height)).current;
  const at = useRef(low);
  const [full, setFull] = useState(false);

  const go = (to: number, done?: () => void) => {
    at.current = to;
    setFull(to === 0);
    Animated.spring(y, { toValue: to, useNativeDriver: false, damping: 22, stiffness: 220, mass: 0.9 }).start(() => done?.());
  };
  const close = () => {
    at.current = height;
    Animated.timing(y, { toValue: height, duration: 220, useNativeDriver: false }).start(() => onClose());
  };

  useEffect(() => {
    go(low);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => {
          const next = at.current + g.dy;
          y.setValue(next < 0 ? next / 4 : next);
        },
        onPanResponderRelease: (_, g) => {
          const now = at.current + g.dy;
          if (g.vy > 0.9 || now > low + 90) return close();
          if (g.vy < -0.6 || now < low / 2) return go(0);
          go(low);
        },
        onPanResponderTerminationRequest: () => false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [low, height],
  );

  const sorted = useMemo(() => [...pin.points].sort((a, b) => b.at.localeCompare(a.at)), [pin.points]);
  const photos = sorted.filter((point) => point.mediaId);
  const last = sorted[0];
  const places = new Set(pin.points.map((point) => point.placeName).filter(Boolean)).size;
  const cities = useMemo(() => {
    if (pin.level !== "country") return [];
    const groups = new Map<string, Point[]>();
    for (const point of pin.points) {
      const name = point.placeCity;
      if (!name) continue;
      groups.set(name, [...(groups.get(name) ?? []), point]);
    }
    return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [pin]);

  const subtitle =
    pin.level === "country"
      ? `${ar(cities.length)} ${cities.length === 1 ? "مدينة" : "مدن"} فيها لحظاتك`
      : pin.level === "city"
        ? pin.country
        : pin.points[0]?.placeCity ?? pin.country;
  const second =
    pin.level === "country"
      ? { value: ar(cities.length), label: "مدينة" }
      : { value: ar(places), label: places === 1 ? "مكان" : "أماكن" };
  const where = pin.label || (pin.level === "place" ? "هذا المكان" : "هنا");
  const thumbs = photos.slice(0, 5);
  const more = photos.length - thumbs.length;

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height,
        transform: [{ translateY: y }],
      }}
    >
      <Glass style={{ flex: 1, borderRadius: 28, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
        <View style={{ height }}>
          <View {...pan.panHandlers} style={{ paddingHorizontal: 18, paddingBottom: 14 }}>
            <View style={{ alignItems: "center", paddingTop: 9, paddingBottom: 12 }}>
              <View style={{ width: 40, height: 4.5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.28)" }} />
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={{ width: 76, height: 76, borderRadius: 18, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" }}>
                {photos[0]?.mediaId ? (
                  <MediaImage mediaId={photos[0].mediaId} style={{ width: 76, height: 76 }} />
                ) : (
                  <PinIcon size={24} color={AMBER} />
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <PinIcon size={15} color={AMBER} />
                  <Text face="display" numberOfLines={1} style={{ flexShrink: 1, color: INK, fontSize: 21, fontWeight: "800" }}>
                    {pin.label || "مكان"}
                  </Text>
                </View>
                {subtitle ? (
                  <Text numberOfLines={1} style={{ color: SOFT, fontSize: 12.5 }}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={full ? "صغّر" : "إغلاق"}
                hitSlop={8}
                onPress={() => (full ? go(low) : close())}
                style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: EDGE }}
              >
                <Svg width={14} height={14} viewBox="0 0 24 24">
                  {full ? (
                    <Path d="M6 9l6 6 6-6" stroke={INK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  ) : (
                    <Path d="M6 6l12 12M18 6L6 18" stroke={INK} strokeWidth={2.4} strokeLinecap="round" fill="none" />
                  )}
                </Svg>
              </Pressable>
            </View>

            {/* الأرقامُ ثلاثةٌ صغيرة بخطٍّ رفيع بينها. */}
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 14, paddingVertical: 10, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: EDGE }}>
              <StatCell icon="photo" value={ar(pin.points.length)} label="لحظة" />
              <View style={{ width: 1, alignSelf: "stretch", backgroundColor: EDGE }} />
              <StatCell icon={pin.level === "country" ? "city" : "pin"} value={second.value} label={second.label} />
              <View style={{ width: 1, alignSelf: "stretch", backgroundColor: EDGE }} />
              <StatCell icon="date" value={last ? dayLabel(new Date(last.at)) : "—"} label="آخر زيارة" small />
            </View>

            {thumbs.length ? (
              <View style={{ flexDirection: "row", gap: 7, marginTop: 12 }}>
                {thumbs.map((point) => (
                  <Pressable key={point.id} onPress={() => onMoment(point.id)} style={{ flex: 1, aspectRatio: 1, borderRadius: 12, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.06)" }}>
                    <MediaImage mediaId={point.mediaId!} style={{ width: "100%", height: "100%" }} />
                  </Pressable>
                ))}
                {more > 0 ? (
                  <View style={{ flex: 1, aspectRatio: 1, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: EDGE }}>
                    <Text style={{ color: INK, fontSize: 14, fontWeight: "800" }}>+{ar(more)}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {!full ? (
              <Pressable
                onPress={() => go(0)}
                style={{ marginTop: 14, height: 48, borderRadius: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.4, borderColor: AMBER }}
              >
                <Text style={{ color: AMBER, fontSize: 13.5, fontWeight: "800" }}>
                  {pin.level === "country" ? `مدن ${where} ولحظاتها` : `عرض جميع لحظاتي في ${where}`}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            scrollEnabled={full}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: bottomInset + 24, gap: 8 }}
          >
            {pin.level === "country" && cities.length ? (
              <>
                <Text style={{ color: SOFT, fontSize: 12, fontWeight: "700", marginBottom: 2 }}>المدن</Text>
                {cities.map(([name, cityPoints]) => (
                  <Row
                    key={name}
                    mediaId={photoOf(cityPoints)}
                    title={name}
                    note={`${ar(cityPoints.length)} ${cityPoints.length === 1 ? "لحظة" : "لحظات"}`}
                    onPress={() => onCity(name, cityPoints)}
                  />
                ))}
                <View style={{ height: 8 }} />
                <Text style={{ color: SOFT, fontSize: 12, fontWeight: "700", marginBottom: 2 }}>اللحظات</Text>
              </>
            ) : null}
            {sorted.map((point) => (
              <Row
                key={point.id}
                mediaId={point.mediaId}
                title={point.text || point.placeName || "لحظة"}
                note={[dayLabel(new Date(point.at)), pin.level !== "place" ? point.placeName : null].filter(Boolean).join(" · ")}
                onPress={() => onMoment(point.id)}
              />
            ))}
            {pin.level === "place" && pin.points[0]?.placeName ? (
              <Pressable
                onPress={() => void openMaps(pin.points[0])}
                style={{ marginTop: 6, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay }}
              >
                <Text style={{ color: colors.onBrand, fontSize: 13.5, fontWeight: "700" }}>افتح في الخرائط</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      </Glass>
    </Animated.View>
  );
}

function StatCell({ icon, value, label, small }: { icon: "photo" | "pin" | "city" | "date"; value: string; label: string; small?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 3 }}>
      <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
        {icon === "photo" ? (
          <>
            <Rect x={3.5} y={4.5} width={17} height={15} rx={3} stroke={SOFT} strokeWidth={1.6} />
            <Path d="M4 17l5-5 4 4 2.5-2.5L20 18" stroke={SOFT} strokeWidth={1.6} strokeLinejoin="round" />
            <Circle cx={15.5} cy={9} r={1.6} fill={SOFT} />
          </>
        ) : icon === "date" ? (
          <>
            <Rect x={3.5} y={5} width={17} height={15} rx={3} stroke={SOFT} strokeWidth={1.6} />
            <Path d="M3.5 10h17M8 3v4M16 3v4" stroke={SOFT} strokeWidth={1.6} strokeLinecap="round" />
          </>
        ) : icon === "city" ? (
          <Path d="M4 20V9l5-3v14M9 20V4l7 3v13M16 20v-8l4 2v6M3 20h18" stroke={SOFT} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
        ) : (
          <>
            <Path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0113 0c0 5-6.5 11-6.5 11z" stroke={AMBER} strokeWidth={1.6} />
            <Circle cx={12} cy={10} r={2.2} fill={AMBER} />
          </>
        )}
      </Svg>
      <Text face={small ? undefined : "display"} numberOfLines={1} style={{ color: INK, fontSize: small ? 12 : 16, fontWeight: "800" }}>
        {value}
      </Text>
      <Text style={{ color: SOFT, fontSize: 10.5 }}>{label}</Text>
    </View>
  );
}

function Row({ mediaId, title, note, onPress }: { mediaId: string | null; title: string; note: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 11, padding: 8, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.05)" }}
    >
      {mediaId ? (
        <MediaImage mediaId={mediaId} style={{ width: 50, height: 50, borderRadius: 12 }} />
      ) : (
        <View style={{ width: 50, height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" }}>
          <PinIcon size={18} color={AMBER} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={2} style={{ color: INK, fontSize: 13.5, fontWeight: "600" }}>
          {title}
        </Text>
        {note ? <Text numberOfLines={1} style={{ color: FAINT, fontSize: 11.5 }}>{note}</Text> : null}
      </View>
      <Svg width={14} height={14} viewBox="0 0 24 24">
        <Path d="M15 5 8 12l7 7" stroke={FAINT} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
    </Pressable>
  );
}
