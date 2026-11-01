import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import MapView, { Marker, Polyline, type Region } from "react-native-maps";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import Svg, { Circle, Path } from "react-native-svg";
import { Text } from "../components/type";
import { Spinner } from "../components/spinner";
import { MediaImage } from "../components/media-image";
import { AthrMark } from "../components/brand";
import { BackChevron } from "../components/screen-header";
import { GlassSheet, SheetScrollView } from "../components/glass-sheet";
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

/** ما يُرسم على الخريطة: مدينةٌ بعددها من بعيد، ومكانٌ بصورة لحظته من قريب. */
type Pin = { key: string; lat: number; lng: number; label: string; points: Point[]; first: number };

/** ما فوق هذا من عرض الخريطة (بالدرجات) يُجمع مدناً، وما دونه أماكن. */
const CITY_ZOOM = 0.6;

/**
 * خطوطُ الأثر خاناتٌ ثابتةُ العدد تُركَّب مع الخريطة ولا تُنزع (القاعدة ٣٨١): تركيبُ
 * `Polyline` ونزعُها في الطبقة القديمة داخل Fabric أسقطا التطبيقَ عند «أثري». فالخانةُ
 * الفارغة نقطتان متطابقتان بلا لون، وما زاد عن العدد يُترك أقصرُه.
 */
const TRAIL_SLOTS = 24;
type Coord = { latitude: number; longitude: number };
const NOWHERE: Coord[] = [
  { latitude: 0, longitude: 0 },
  { latitude: 0, longitude: 0 },
];

// ألوانُ الخريطة ثابتةٌ لا تتبع الثيم (القاعدة ٣٧٨): أرضٌ داكنةٌ هادئة وكهرمانُ آثار عليها.
const AMBER = "#F6B93B";
const CORAL = "#FF7A5A";
const NIGHT = "#0E1A24";
const INK = "#F7F5EF";
const SOFT = "rgba(247,245,239,0.68)";
const GLASS = "rgba(14,26,36,0.55)";
const EDGE = "rgba(255,255,255,0.14)";

/**
 * «خريطتي» (القاعدة ٣٦٨، وهيئتُها القاعدة ٣٨٠): خرائطُ آبل بملء الشاشة بأرضٍ داكنةٍ هادئة
 * (`mutedStandard` + `dark`) تُبرز الكهرمان، و**أثرُه** خطٌّ متقطّع يصل أماكنه بترتيب زيارتها —
 * والتطبيقُ اسمُه آثار. من بعيدٍ مدنٌ بهالةٍ وعددها، ومن قريبٍ أماكنُ بصورة لحظتها، والضغطُ
 * يطير إليها ثمّ نافذةٌ زجاجيّة بلحظاتها. والرأسُ والأرقامُ والسنواتُ زجاجٌ يطفو فوقها.
 */
export default function MyMap() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const map = useRef<MapView>(null);
  const [year, setYear] = useState<number | null>(null);
  const [delta, setDelta] = useState(30);
  const [open, setOpen] = useState<Pin | null>(null);
  const [trail, setTrail] = useState(true);
  // صورُ العلامات تُرسم مرّةً ثمّ تُجمَّد: علامةٌ تتابع تغيّرها تُعيد رسمَ الخريطة مع كلّ إطار.
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
  const far = delta > CITY_ZOOM;

  const pins = useMemo<Pin[]>(() => {
    const groups = new Map<string, Pin>();
    points.forEach((point, order) => {
      const key = far
        ? `c:${point.placeCity ?? `${point.lat.toFixed(1)},${point.lng.toFixed(1)}`}`
        : `p:${point.placeName ?? ""}:${point.lat.toFixed(3)},${point.lng.toFixed(3)}`;
      const label = far ? point.placeCity ?? point.placeName ?? "" : point.placeName ?? point.placeCity ?? "";
      const group = groups.get(key) ?? { key, lat: 0, lng: 0, label, points: [], first: order };
      group.points.push(point);
      groups.set(key, group);
    });
    for (const group of groups.values()) {
      group.lat = group.points.reduce((sum, p) => sum + p.lat, 0) / group.points.length;
      group.lng = group.points.reduce((sum, p) => sum + p.lng, 0) / group.points.length;
    }
    return [...groups.values()];
  }, [points, far]);

  /*
    الأثرُ بترتيب الزيارة، **ولكلّ دولةٍ أو مدينةٍ خطوطُها** (القاعدة ٣٨١): من بعيدٍ تصل
    مدنَ الدولة الواحدة، ومن قريبٍ أماكنَ المدينة الواحدة — لا خطٌّ واحد يعبر من حيٍّ
    في الرياض إلى دبي.
  */
  const lines = useMemo(() => {
    const byPoint = new Map<string, Pin>();
    for (const pin of pins) for (const point of pin.points) byPoint.set(point.id, pin);
    const groups = new Map<string, { coords: Coord[]; last: string | null }>();
    for (const point of points) {
      const pin = byPoint.get(point.id);
      if (!pin) continue;
      const area = far
        ? point.country ?? "السعودية"
        : point.placeCity ?? `${point.lat.toFixed(1)},${point.lng.toFixed(1)}`;
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
  }, [pins, points, far]);

  const fitAll = (animated = true) => {
    if (!points.length) return;
    map.current?.fitToCoordinates(
      points.map((point) => ({ latitude: point.lat, longitude: point.lng })),
      { edgePadding: { top: insets.top + 140, right: 60, bottom: insets.bottom + 200, left: 60 }, animated },
    );
  };

  // الخريطةُ تبدأ على ما فيه لحظات، وتعود إليه مع كلّ سنة.
  useEffect(() => {
    if (!points.length) return;
    const timer = setTimeout(() => fitAll(true), 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  useEffect(() => {
    setTracking(true);
    const timer = setTimeout(() => setTracking(false), 1500);
    return () => clearTimeout(timer);
  }, [pins]);

  const select = (pin: Pin) => {
    if (far && pin.points.length > 1) {
      map.current?.fitToCoordinates(
        pin.points.map((point) => ({ latitude: point.lat, longitude: point.lng })),
        { edgePadding: { top: insets.top + 160, right: 80, bottom: insets.bottom + 220, left: 80 }, animated: true },
      );
      return;
    }
    // يطير إلى المكان ثمّ تُفتح نافذتُه.
    map.current?.animateToRegion(
      { latitude: pin.lat - 0.0025, longitude: pin.lng, latitudeDelta: 0.012, longitudeDelta: 0.012 },
      450,
    );
    setTimeout(() => setOpen(pin), 380);
  };

  return (
    <View style={{ flex: 1, backgroundColor: NIGHT }}>
      {state.isLoading ? (
        <Spinner style={{ marginTop: insets.top + 120 }} color={AMBER} />
      ) : (
        <MapView
          ref={map}
          style={{ flex: 1 }}
          initialRegion={{ latitude: 24.71, longitude: 46.68, latitudeDelta: 30, longitudeDelta: 30 }}
          onRegionChangeComplete={(region: Region) => setDelta(region.latitudeDelta)}
          mapType={Platform.OS === "ios" ? "mutedStandard" : "standard"}
          userInterfaceStyle="dark"
          showsPointsOfInterest={false}
          showsBuildings
          showsCompass={false}
          showsScale={false}
          rotateEnabled={false}
          toolbarEnabled={false}
        >
          {Array.from({ length: TRAIL_SLOTS }, (_, slot) => {
            const line = trail ? lines[slot] : undefined;
            return [
              <Polyline
                key={`glow-${slot}`}
                coordinates={line ?? NOWHERE}
                geodesic
                strokeWidth={line ? 6 : 0}
                strokeColor={line ? "rgba(246,185,59,0.18)" : "transparent"}
              />,
              <Polyline
                key={`dash-${slot}`}
                coordinates={line ?? NOWHERE}
                geodesic
                strokeWidth={line ? 2 : 0}
                strokeColor={line ? AMBER : "transparent"}
                lineDashPattern={[2, 7]}
                lineCap="round"
              />,
            ];
          })}
          {pins.map((pin) => (
            <Marker
              key={pin.key}
              coordinate={{ latitude: pin.lat, longitude: pin.lng }}
              onPress={() => select(pin)}
              tracksViewChanges={tracking}
              anchor={far ? { x: 0.5, y: 0.35 } : { x: 0.5, y: 1 }}
              zIndex={pin.points.length}
            >
              {far ? <CityPin pin={pin} /> : <PlacePin pin={pin} />}
            </Marker>
          ))}
        </MapView>
      )}

      {/* الرأسُ يطفو: رجوعٌ، والعلامةُ والاسم، و«الكل» يعيد الخريطةَ إلى ما فيه لحظات. */}
      <View
        pointerEvents="box-none"
        style={{ position: "absolute", top: insets.top + 8, left: 14, right: 14, gap: 10 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Glass round>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="رجوع"
              hitSlop={8}
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/me" as never))}
              style={{ width: 42, height: 42, alignItems: "center", justifyContent: "center" }}
            >
              <BackChevron color={INK} />
            </Pressable>
          </Glass>
          <Glass style={{ flex: 1 }}>
            <View style={{ height: 42, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14 }}>
              <AthrMark size={22} />
              <Text face="display" style={{ color: INK, fontSize: 15.5, fontWeight: "800" }}>
                خريطتي
              </Text>
              <View style={{ flex: 1 }} />
              {points.length ? (
                <Text style={{ color: SOFT, fontSize: 11.5 }}>
                  {ar(points.length)} {points.length === 1 ? "لحظة" : "لحظة على الخريطة"}
                </Text>
              ) : null}
            </View>
          </Glass>
          <Glass round>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="اعرض كل الأماكن"
              hitSlop={8}
              onPress={() => fitAll()}
              style={{ width: 42, height: 42, alignItems: "center", justifyContent: "center" }}
            >
              <FitIcon />
            </Pressable>
          </Glass>
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

      {/* الأرقامُ في أسفلها كجواز سفر: أماكن ومدن ودول، وأكثرُ مكانٍ رجع له، ومفتاحُ الأثر. */}
      {stats && points.length ? (
        <View pointerEvents="box-none" style={{ position: "absolute", left: 14, right: 14, bottom: insets.bottom + 14 }}>
          <StatsCard
            stats={stats}
            limited={state.data?.limited ?? false}
            trail={trail}
            onTrail={() => setTrail((on) => !on)}
          />
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
        <GlassSheet
          icon={<PinIcon size={18} color="#fff" />}
          title={open.label || "مكان"}
          subtitle={`${ar(open.points.length)} ${open.points.length === 1 ? "لحظة" : "لحظات"} · أوّلها ${dayLabel(new Date(open.points[0].at))}`}
          onClose={() => setOpen(null)}
        >
          <SheetScrollView name="map-place" style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
            {[...open.points].reverse().map((point) => (
              <Pressable
                key={point.id}
                onPress={() => {
                  setOpen(null);
                  router.push(`/m/${point.id}` as never);
                }}
                style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 8, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.08)" }}
              >
                {point.mediaId ? (
                  <MediaImage mediaId={point.mediaId} style={{ width: 52, height: 52, borderRadius: 12 }} />
                ) : (
                  <View style={{ width: 52, height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)" }}>
                    <PinIcon size={18} color={AMBER} />
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text numberOfLines={2} style={{ color: "#fff", fontSize: 13.5, fontWeight: "600" }}>
                    {point.text || point.placeName || "لحظة"}
                  </Text>
                  <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 11.5 }}>{dayLabel(new Date(point.at))}</Text>
                </View>
              </Pressable>
            ))}
          </SheetScrollView>
          {open.points[0]?.placeName ? (
            <Pressable
              onPress={() => void openMaps(open.points[0])}
              style={{ marginTop: 10, height: 46, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay }}
            >
              <Text style={{ color: colors.onBrand, fontSize: 13.5, fontWeight: "700" }}>افتح في الخرائط</Text>
            </Pressable>
          ) : null}
        </GlassSheet>
      ) : null}
    </View>
  );
}

/** زجاجٌ داكنٌ بحافّةٍ مضيئة — أندرويد بلا غبش فأرضيتُه أكثف. */
function Glass({ children, round, style }: { children: React.ReactNode; round?: boolean; style?: object }) {
  const radius = round ? 21 : 18;
  return (
    <View
      style={[
        {
          borderRadius: radius,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: EDGE,
          backgroundColor: Platform.OS === "ios" ? "transparent" : "rgba(14,26,36,0.88)",
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

function FitIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M4 9V5a1 1 0 011-1h4M15 4h4a1 1 0 011 1v4M20 15v4a1 1 0 01-1 1h-4M9 20H5a1 1 0 01-1-1v-4" stroke={INK} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={12} cy={12} r={2.4} fill={AMBER} />
    </Svg>
  );
}

function StatsCard({ stats, limited, trail, onTrail }: { stats: Stats; limited: boolean; trail: boolean; onTrail: () => void }) {
  const cell = (value: number, label: string) => (
    <View style={{ flex: 1, alignItems: "center", gap: 1 }}>
      <Text face="display" style={{ color: INK, fontSize: 24, fontWeight: "800", lineHeight: 30 }}>
        {ar(value)}
      </Text>
      <Text style={{ color: SOFT, fontSize: 11 }}>{label}</Text>
    </View>
  );
  const rule = <View style={{ width: 1, alignSelf: "stretch", marginVertical: 6, backgroundColor: EDGE }} />;
  return (
    <Glass>
      <View style={{ paddingVertical: 12, paddingHorizontal: 14, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {cell(stats.places, "مكان")}
          {rule}
          {cell(stats.cities, "مدينة")}
          {rule}
          {cell(stats.countries, "دولة")}
        </View>
        <View style={{ height: 1, backgroundColor: EDGE }} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {stats.top ? (
              <Text numberOfLines={1} style={{ color: AMBER, fontSize: 12.5, fontWeight: "700" }}>
                مكانك المفضّل: {stats.top.name} · {ar(stats.top.count)} مرات
              </Text>
            ) : (
              <Text style={{ color: SOFT, fontSize: 12 }}>كلّ نقطةٍ لحظةٌ نشرتها بموقعها</Text>
            )}
            {stats.unplaced > 0 || limited ? (
              <Text numberOfLines={2} style={{ color: "rgba(247,245,239,0.5)", fontSize: 10.5, lineHeight: 16, marginTop: 2 }}>
                {[
                  stats.unplaced > 0 ? `${ar(stats.unplaced)} لحظة بلا نقطة على الخريطة` : null,
                  limited ? "آخر ستة أشهر — الأقدم مع آثار+" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={onTrail}
            accessibilityRole="switch"
            accessibilityState={{ checked: trail }}
            accessibilityLabel="أثري"
            style={{
              height: 30,
              paddingHorizontal: 12,
              borderRadius: 15,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: trail ? "rgba(246,185,59,0.18)" : "rgba(255,255,255,0.06)",
              borderWidth: 1,
              borderColor: trail ? "rgba(246,185,59,0.55)" : EDGE,
            }}
          >
            <Svg width={16} height={10} viewBox="0 0 16 10">
              <Path d="M1 8 C5 1, 9 9, 15 2" stroke={trail ? AMBER : SOFT} strokeWidth={1.8} strokeDasharray="1.5 3" strokeLinecap="round" fill="none" />
            </Svg>
            <Text style={{ color: trail ? AMBER : SOFT, fontSize: 12, fontWeight: "700" }}>أثري</Text>
          </Pressable>
        </View>
      </View>
    </Glass>
  );
}

function YearChip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return on ? (
    <Pressable
      onPress={onPress}
      style={{ height: 32, paddingHorizontal: 14, borderRadius: 16, justifyContent: "center", backgroundColor: AMBER }}
    >
      <Text style={{ color: NIGHT, fontSize: 12.5, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  ) : (
    <Glass round>
      <Pressable onPress={onPress} style={{ height: 30, paddingHorizontal: 14, justifyContent: "center" }}>
        <Text style={{ color: INK, fontSize: 12.5, fontWeight: "700" }}>{label}</Text>
      </Pressable>
    </Glass>
  );
}

/** المدينةُ قرصٌ كهرمانيّ بهالةٍ يكبر بعدد لحظاتها، واسمُها في كبسولةٍ داكنة تحته. */
function CityPin({ pin }: { pin: Pin }) {
  const size = Math.min(58, 30 + Math.sqrt(pin.points.length) * 6);
  const halo = size + 18;
  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ width: halo, height: halo, alignItems: "center", justifyContent: "center" }}>
        <View style={{ position: "absolute", width: halo, height: halo, borderRadius: halo / 2, backgroundColor: "rgba(246,185,59,0.16)" }} />
        <View style={{ position: "absolute", width: size + 8, height: size + 8, borderRadius: (size + 8) / 2, backgroundColor: "rgba(246,185,59,0.28)" }} />
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: AMBER,
            borderWidth: 2,
            borderColor: "#FFE7AE",
          }}
        >
          <Text face="display" style={{ color: NIGHT, fontSize: 14, fontWeight: "800" }}>
            {ar(pin.points.length)}
          </Text>
        </View>
      </View>
      {pin.label ? (
        <View style={{ marginTop: -4, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, backgroundColor: "rgba(14,26,36,0.85)", borderWidth: 1, borderColor: EDGE }}>
          <Text numberOfLines={1} style={{ color: INK, fontSize: 11, fontWeight: "700", maxWidth: 120 }}>
            {pin.label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** المكانُ دبّوسٌ بصورة آخر لحظةٍ فيه وذيلٍ يشير إلى موضعه، وعددُه إن زاد على واحدة. */
function PlacePin({ pin }: { pin: Pin }) {
  const photo = [...pin.points].reverse().find((point) => point.mediaId)?.mediaId ?? null;
  return (
    <View style={{ width: 60, height: 70, alignItems: "center" }}>
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          padding: 3,
          backgroundColor: "#fff",
          shadowColor: "#000",
          shadowOpacity: 0.35,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 3 },
          elevation: 5,
        }}
      >
        <View style={{ flex: 1, borderRadius: 13, overflow: "hidden", backgroundColor: NIGHT, alignItems: "center", justifyContent: "center" }}>
          {photo ? (
            <MediaImage mediaId={photo} style={{ width: 46, height: 46 }} fade={false} />
          ) : (
            <PinIcon size={20} color={AMBER} />
          )}
        </View>
      </View>
      <Svg width={14} height={9} viewBox="0 0 14 9" style={{ marginTop: -1 }}>
        <Path d="M0 0 L7 9 L14 0 Z" fill="#fff" />
      </Svg>
      <View style={{ width: 8, height: 4, borderRadius: 4, marginTop: 1, backgroundColor: "rgba(0,0,0,0.35)" }} />
      {pin.points.length > 1 ? (
        <View
          style={{
            position: "absolute",
            top: -4,
            right: 0,
            minWidth: 22,
            height: 22,
            borderRadius: 11,
            paddingHorizontal: 5,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: CORAL,
            borderWidth: 2,
            borderColor: "#fff",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 10.5, fontWeight: "800" }}>{ar(pin.points.length)}</Text>
        </View>
      ) : null}
    </View>
  );
}
