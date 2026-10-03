import { useRef } from "react";
import { ActivityIndicator, Animated, Dimensions, Modal, PanResponder, Platform, Pressable, ScrollView, View } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { create } from "zustand";
import { Text } from "./type";
import { Avatar } from "./avatar";
import { NameTag } from "./name-tag";
import { CloseIcon, PinIcon, WithIcon } from "./icons";
import { api } from "../lib/api";
import { openMaps } from "../lib/maps";
import { ar, relative } from "../lib/format";
import { colors } from "../theme/tokens";
import type { Moment, Person } from "../lib/queries";

/**
 * «من كان هنا» — نافذةٌ زجاجيّة لصاحب لحظة المكان وحده (القاعدة ٢٣٠).
 *
 * أصدقاؤه الذين زاروا المكان نفسه في عشرة أيامٍ بأسمائهم، وغيرُهم عددٌ بلا
 * أسماء لا يُقال تحت خمسة. والخرائطُ زرٌّ فيها: الضغطةُ كانت تفتحها لصاحب
 * اللحظة أيضاً، وهو يعرف أين كان.
 *
 * وتُركَّب في الجذر كنافذة الصورة (القاعدة ١٣٧): داخل البطاقة جدُّها «اسحب
 * للتحديث» فيأخذ سحبتها.
 */
type Visitors = {
  place: string;
  days: number;
  friends: (Person & { momentId: string; visitedAt: string })[];
  others: number | null;
};

type Place = Pick<Moment, "id" | "placeName" | "placeCity" | "lat" | "lng">;

const useOpen = create<{ moment: Place | null }>(() => ({ moment: null }));

export const showVisitors = (moment: Place | null) => useOpen.setState({ moment });

const DISMISS = 90;

export function PlaceVisitors() {
  const moment = useOpen((s) => s.moment);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const drag = useRef(new Animated.Value(0)).current;
  const height = Dimensions.get("window").height;

  const query = useQuery({
    queryKey: ["visitors", moment?.id],
    queryFn: () => api<Visitors>(`/v1/moments/${moment!.id}/visitors`),
    enabled: Boolean(moment),
  });

  const close = () => {
    showVisitors(null);
    drag.setValue(0);
  };

  // تُغلق بسحبها إلى أسفل (القاعدة ٧٨) وتتبع الإصبع.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS || g.vy > 1.2) {
          Animated.timing(drag, { toValue: height, duration: 180, useNativeDriver: true }).start(close);
        } else {
          Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  if (!moment) return null;

  const data = query.data;
  const friends = data?.friends ?? [];
  const days = ar(data?.days ?? 10);
  const empty = data && friends.length === 0 && !data.others;

  const visit = (id: string) => {
    close();
    router.push(`/u/${id}` as never);
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(8,14,20,.38)" }} onPress={close} />

      <Animated.View
        {...pan.panHandlers}
        style={{
          position: "absolute",
          left: 10,
          right: 10,
          bottom: Math.max(insets.bottom, 12),
          maxHeight: height * 0.7,
          transform: [{ translateY: drag }],
          borderRadius: 30,
          shadowColor: "#000",
          shadowOpacity: 0.3,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 10 },
          elevation: 18,
        }}
      >
        <View
          style={{
            borderRadius: 30,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,.16)",
            // الزجاجُ نفسه الذي في الشريط السفليّ (القاعدة ٢٢٨).
            backgroundColor: Platform.OS === "android" ? "rgba(20,24,28,.94)" : "rgba(20,24,28,.6)",
          }}
        >
          {Platform.OS !== "android" ? (
            <BlurView
              intensity={70}
              tint="systemUltraThinMaterialDark"
              style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
            />
          ) : null}

          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,.3)", alignSelf: "center", marginTop: 10 }} />

          {/* الرأس: المكان، ثمّ زرّ الإغلاق. */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,122,90,.22)",
              }}
            >
              <PinIcon size={20} color={colors.live} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ color: "#fff", fontSize: 17, fontWeight: "700" }}>
                {moment.placeName}
              </Text>
              <Text style={{ color: "rgba(255,255,255,.62)", fontSize: 12, marginTop: 2 }}>
                {`من كان هنا خلال ${days} أيام`}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="إغلاق"
              onPress={close}
              hitSlop={8}
              style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.12)" }}
            >
              <CloseIcon size={16} color="#fff" />
            </Pressable>
          </View>

          <View style={{ height: 1, backgroundColor: "rgba(255,255,255,.1)", marginHorizontal: 18 }} />

          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10 }}>
            {query.isLoading ? (
              <ActivityIndicator color="#fff" style={{ marginVertical: 28 }} />
            ) : query.isError ? (
              <Text style={{ color: "rgba(255,255,255,.7)", textAlign: "center", marginVertical: 24 }}>
                تعذّر جلب الزوّار
              </Text>
            ) : empty ? (
              <View style={{ alignItems: "center", paddingVertical: 22, paddingHorizontal: 20, gap: 6 }}>
                <WithIcon size={22} color="rgba(255,255,255,.55)" />
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600", textAlign: "center" }}>
                  ما زاره أحدٌ من دائرتك مؤخّراً
                </Text>
                <Text style={{ color: "rgba(255,255,255,.55)", fontSize: 12, textAlign: "center" }}>
                  {`أوّلُ من يزوره منهم خلال ${days} أيام يظهر هنا`}
                </Text>
              </View>
            ) : (
              <>
                {friends.length > 0 ? (
                  <Text style={{ color: "rgba(255,255,255,.55)", fontSize: 11.5, fontWeight: "700", marginHorizontal: 8, marginBottom: 4 }}>
                    {`من دائرتك · ${ar(friends.length)}`}
                  </Text>
                ) : null}
                {friends.map((person) => (
                  <Pressable
                    key={person.id}
                    onPress={() => visit(person.id)}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingHorizontal: 8,
                      paddingVertical: 9,
                      borderRadius: 18,
                      backgroundColor: pressed ? "rgba(255,255,255,.08)" : "transparent",
                    })}
                  >
                    <Avatar
                      name={person.name}
                      size={42}
                      mediaId={person.avatarMediaId}
                      frame={person.frame ?? null}
                      charm={person.charm ?? null}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text numberOfLines={1} style={{ color: "#fff", fontSize: 14.5, fontWeight: "700", flexShrink: 1, writingDirection: "auto" }}>
                          {person.name}
                        </Text>
                        <NameTag isPlus={person.isPlus} tag={person.tag} size={10} />
                      </View>
                      <Text style={{ color: "rgba(255,255,255,.58)", fontSize: 12, marginTop: 2 }}>
                        {`زاره ${relative(new Date(person.visitedAt))}`}
                      </Text>
                    </View>
                  </Pressable>
                ))}

                {/* والباقون عددٌ بلا أسماء، ولا يُقال تحت خمسة. */}
                {data?.others ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      marginTop: friends.length > 0 ? 6 : 0,
                      paddingHorizontal: 12,
                      paddingVertical: 12,
                      borderRadius: 18,
                      backgroundColor: "rgba(255,255,255,.07)",
                    }}
                  >
                    <WithIcon size={18} color={colors.gold} />
                    <Text style={{ color: "rgba(255,255,255,.85)", fontSize: 13, flex: 1 }}>
                      {friends.length > 0
                        ? `و${ar(data.others)} غيرهم من مستخدمي آثار زاروه`
                        : `${ar(data.others)} من مستخدمي آثار زاروه`}
                    </Text>
                  </View>
                ) : null}
              </>
            )}
          </ScrollView>

          <Pressable
            accessibilityRole="link"
            onPress={() => {
              const place = moment;
              close();
              void openMaps(place);
            }}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              marginHorizontal: 16,
              marginTop: 4,
              marginBottom: 16,
              height: 48,
              borderRadius: 24,
              backgroundColor: pressed ? "rgba(255,255,255,.22)" : "rgba(255,255,255,.14)",
            })}
          >
            <PinIcon size={15} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>افتح في الخرائط</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}
