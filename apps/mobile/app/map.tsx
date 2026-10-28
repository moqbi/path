import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Text } from "../components/type";
import { ScreenHeader } from "../components/screen-header";
import { Spinner } from "../components/spinner";
import { MediaImage } from "../components/media-image";
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
type Pin = { key: string; lat: number; lng: number; label: string; points: Point[] };

/** ما فوق هذا من عرض الخريطة (بالدرجات) يُجمع مدناً، وما دونه أماكن. */
const CITY_ZOOM = 0.6;

/**
 * «خريطتي» (القاعدة ٣٦٨): لحظاتُ صاحبها وحده على خرائط آبل الحيّة. من بعيدٍ مدنٌ
 * دوائرُ بعددها، والتقريبُ يفرّقها أماكنَ بصورة آخر لحظةٍ فيها، والضغطُ نافذةٌ زجاجيّة
 * بلحظات المكان وزرّ الخرائط. وفوقها الأماكنُ والمدنُ والدولُ وأكثرُ مكانٍ رجع له،
 * وشرائحُ السنوات تُصفّي.
 */
export default function MyMap() {
  const router = useRouter();
  const map = useRef<MapView>(null);
  const [year, setYear] = useState<number | null>(null);
  const [delta, setDelta] = useState(30);
  const [open, setOpen] = useState<Pin | null>(null);
  // صورُ العلامات تُرسم مرّةً ثمّ تُجمَّد: علامةٌ تتابع تغيّرها تُعيد رسمَ الخريطة مع كلّ إطار.
  const [tracking, setTracking] = useState(true);

  const state = useQuery({
    queryKey: ["my-map"],
    queryFn: () => api<MapData>("/v1/archive/map"),
  });

  const points = useMemo(
    () => (state.data?.points ?? []).filter((point) => year == null || point.year === year),
    [state.data, year],
  );
  const stats = state.data?.stats[year == null ? "all" : String(year)];

  const pins = useMemo<Pin[]>(() => {
    const groups = new Map<string, Pin>();
    for (const point of points) {
      const far = delta > CITY_ZOOM;
      const key = far
        ? `c:${point.placeCity ?? `${point.lat.toFixed(1)},${point.lng.toFixed(1)}`}`
        : `p:${point.placeName ?? ""}:${point.lat.toFixed(3)},${point.lng.toFixed(3)}`;
      const label = far ? point.placeCity ?? point.placeName ?? "" : point.placeName ?? point.placeCity ?? "";
      const group = groups.get(key) ?? { key, lat: 0, lng: 0, label, points: [] };
      group.points.push(point);
      groups.set(key, group);
    }
    for (const group of groups.values()) {
      group.lat = group.points.reduce((sum, p) => sum + p.lat, 0) / group.points.length;
      group.lng = group.points.reduce((sum, p) => sum + p.lng, 0) / group.points.length;
    }
    return [...groups.values()];
  }, [points, delta]);

  // الخريطةُ تبدأ على ما فيه لحظات، وتعود إليه مع كلّ سنة.
  useEffect(() => {
    if (!points.length) return;
    const timer = setTimeout(() => {
      map.current?.fitToCoordinates(
        points.map((point) => ({ latitude: point.lat, longitude: point.lng })),
        { edgePadding: { top: 220, right: 50, bottom: 80, left: 50 }, animated: true },
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [points]);

  useEffect(() => {
    setTracking(true);
    const timer = setTimeout(() => setTracking(false), 1500);
    return () => clearTimeout(timer);
  }, [pins]);

  const zoomInto = (pin: Pin) => {
    if (pin.points.length === 1 || delta <= CITY_ZOOM) return setOpen(pin);
    map.current?.fitToCoordinates(
      pin.points.map((point) => ({ latitude: point.lat, longitude: point.lng })),
      { edgePadding: { top: 240, right: 70, bottom: 120, left: 70 }, animated: true },
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.groundSolid }}>
      <ScreenHeader title="خريطتي" back="/me" />

      {state.isLoading ? (
        <Spinner style={{ marginTop: 60 }} color={colors.clay} />
      ) : (
        <View style={{ flex: 1 }}>
          <MapView
            ref={map}
            style={{ flex: 1 }}
            initialRegion={{ latitude: 24.71, longitude: 46.68, latitudeDelta: 30, longitudeDelta: 30 }}
            onRegionChangeComplete={(region: Region) => setDelta(region.latitudeDelta)}
            showsPointsOfInterest={false}
            pitchEnabled={false}
            rotateEnabled={false}
          >
            {pins.map((pin) => (
              <Marker
                key={pin.key}
                coordinate={{ latitude: pin.lat, longitude: pin.lng }}
                onPress={() => zoomInto(pin)}
                tracksViewChanges={tracking}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                {delta > CITY_ZOOM ? <CityDot pin={pin} /> : <PlaceDot pin={pin} />}
              </Marker>
            ))}
          </MapView>

          {/* الأرقامُ والسنواتُ تطفو فوق الخريطة. */}
          <View pointerEvents="box-none" style={{ position: "absolute", top: 12, left: 12, right: 12, gap: 8 }}>
            {stats ? <StatsCard stats={stats} limited={state.data?.limited ?? false} /> : null}
            {(state.data?.years.length ?? 0) > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                <YearChip label="الكل" on={year == null} onPress={() => setYear(null)} />
                {state.data?.years.map((one) => (
                  <YearChip key={one} label={ar(one)} on={year === one} onPress={() => setYear(one)} />
                ))}
              </ScrollView>
            ) : null}
          </View>

          {!points.length ? (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                bottom: 40,
                left: 24,
                right: 24,
                borderRadius: 18,
                padding: 16,
                backgroundColor: "rgba(14,26,36,0.86)",
                alignItems: "center",
                gap: 6,
              }}
            >
              <MapIcon size={22} color="#F6B93B" />
              <Text style={{ color: "#fff", fontSize: 13.5, fontWeight: "700", textAlign: "center" }}>
                ما فيه لحظات على الخريطة بعد
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, lineHeight: 19, textAlign: "center" }}>
                لحظةُ المكان والصورة تظهر هنا حين تنشرها و«إظهار موقعي» مفتوح في الخصوصية.
              </Text>
            </View>
          ) : null}
        </View>
      )}

      {open ? (
        <GlassSheet
          icon={<PinIcon size={18} color="#fff" />}
          title={open.label || "مكان"}
          subtitle={`${ar(open.points.length)} ${open.points.length === 1 ? "لحظة" : "لحظات"}`}
          onClose={() => setOpen(null)}
        >
          <SheetScrollView name="map-place" style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
            {open.points.map((point) => (
              <Pressable
                key={point.id}
                onPress={() => {
                  setOpen(null);
                  router.push(`/m/${point.id}` as never);
                }}
                style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 8, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.08)" }}
              >
                {point.mediaId ? (
                  <MediaImage mediaId={point.mediaId} style={{ width: 46, height: 46, borderRadius: 10 }} />
                ) : (
                  <View style={{ width: 46, height: 46, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)" }}>
                    <PinIcon size={18} color="#F6B93B" />
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text numberOfLines={2} style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>
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
              style={{ marginTop: 10, height: 44, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay }}
            >
              <Text style={{ color: colors.onBrand, fontSize: 13.5, fontWeight: "700" }}>افتح في الخرائط</Text>
            </Pressable>
          ) : null}
        </GlassSheet>
      ) : null}
    </View>
  );
}

function StatsCard({ stats, limited }: { stats: Stats; limited: boolean }) {
  const cell = (value: number, label: string) => (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={{ color: "#fff", fontSize: 17, fontWeight: "700" }}>{ar(value)}</Text>
      <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>{label}</Text>
    </View>
  );
  return (
    <View style={{ borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: "rgba(14,26,36,0.86)", gap: 8 }}>
      <View style={{ flexDirection: "row" }}>
        {cell(stats.places, "مكان")}
        {cell(stats.cities, "مدينة")}
        {cell(stats.countries, "دولة")}
      </View>
      {stats.top ? (
        <Text numberOfLines={1} style={{ color: "#F6B93B", fontSize: 12, fontWeight: "600", textAlign: "center" }}>
          أكثر مكان رجعت له: {stats.top.name} · {ar(stats.top.count)} مرات
        </Text>
      ) : null}
      {stats.unplaced > 0 || limited ? (
        <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 10.5, textAlign: "center", lineHeight: 16 }}>
          {[
            stats.unplaced > 0 ? `${ar(stats.unplaced)} لحظة بمكانٍ بلا نقطة على الخريطة` : null,
            limited ? "آخر ستة أشهر — الأقدم مع آثار+" : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      ) : null}
    </View>
  );
}

function YearChip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        height: 32,
        paddingHorizontal: 14,
        borderRadius: 999,
        justifyContent: "center",
        backgroundColor: on ? colors.clay : "rgba(14,26,36,0.8)",
      }}
    >
      <Text style={{ color: on ? colors.onBrand : "#fff", fontSize: 12.5, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

/** المدينةُ دائرةٌ يكبر قطرُها بعدد لحظاتها. */
function CityDot({ pin }: { pin: Pin }) {
  const size = Math.min(64, 34 + Math.sqrt(pin.points.length) * 6);
  return (
    <View style={{ alignItems: "center" }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(246,185,59,0.92)",
          borderWidth: 3,
          borderColor: "#fff",
        }}
      >
        <Text style={{ color: "#0E1A24", fontSize: 13, fontWeight: "700" }}>{ar(pin.points.length)}</Text>
      </View>
      {pin.label ? (
        <Text numberOfLines={1} style={{ marginTop: 3, color: "#0E1A24", fontSize: 11, fontWeight: "700", maxWidth: 110, textAlign: "center" }}>
          {pin.label}
        </Text>
      ) : null}
    </View>
  );
}

/** المكانُ صورةُ آخر لحظةٍ فيه، وبلا صورةٍ دبّوس — ومعه عددُها إن زاد على واحدة. */
function PlaceDot({ pin }: { pin: Pin }) {
  const photo = pin.points.find((point) => point.mediaId)?.mediaId ?? null;
  return (
    <View style={{ width: 52, height: 52 }}>
      <View style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 3, borderColor: "#fff", overflow: "hidden", backgroundColor: "#0E1A24", alignItems: "center", justifyContent: "center" }}>
        {photo ? (
          <MediaImage mediaId={photo} style={{ width: 42, height: 42 }} fade={false} />
        ) : (
          <PinIcon size={20} color="#F6B93B" />
        )}
      </View>
      {pin.points.length > 1 ? (
        <View style={{ position: "absolute", top: -2, right: -2, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: "center", justifyContent: "center", backgroundColor: "#FF7A5A" }}>
          <Text style={{ color: "#fff", fontSize: 10.5, fontWeight: "700" }}>{ar(pin.points.length)}</Text>
        </View>
      ) : null}
    </View>
  );
}
