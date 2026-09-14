import { useMemo } from "react";
import { View, Text, SectionList, Pressable, ActivityIndicator, Alert, Share } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AvatarMenu } from "../../components/avatar-menu";
import { CoverLayer } from "../../components/cover";
import { MomentCard, SPINE_W } from "../../components/moment-card";
import { AthrMark } from "../../components/brand";
import {
  BookIcon, ExitIcon, GearIcon, GiftIcon, ShareIcon, SparkIcon, StarIcon, WithIcon,
} from "../../components/icons";
import { api } from "../../lib/api";
import { keys, type Moment } from "../../lib/queries";
import { useSession } from "../../lib/session";
import { ar, dayLabel, MONTHS } from "../../lib/format";
import { colors } from "../../theme/tokens";

const COVER = 176;

function Stat({ icon, value, label, first }: { icon: React.ReactNode; value: string; label: string; first: boolean }) {
  return (
    <View
      style={{
        flex: 1,
        paddingHorizontal: 4,
        alignItems: "center",
        borderRightWidth: first ? 0 : 1,
        borderRightColor: colors.line,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.chip,
          marginBottom: 4,
        }}
      >
        {icon}
      </View>
      <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "700" }}>{value}</Text>
      <Text style={{ color: colors.muted, fontSize: 10, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function Action({
  label,
  icon,
  onPress,
  grow,
}: {
  label?: string;
  icon?: React.ReactNode;
  onPress: () => void;
  grow?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      style={{
        height: 46,
        flexGrow: grow ? 1 : 0,
        width: grow ? undefined : 44,
        paddingHorizontal: grow ? 14 : 0,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.card,
      }}
    >
      {label && grow ? (
        <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "600" }}>{label}</Text>
      ) : (
        icon
      )}
    </Pressable>
  );
}

/**
 * «أنا».
 *
 * الرأس ثابت — الغلاف والصورة والأرقام والأزرار — ولحظاتي وحدها تمرّ
 * تحته على الخيط نفسه الذي في «اللحظات».
 */
export default function Me() {
  const { me, signOut } = useSession();
  const router = useRouter();

  const stats = useQuery({
    queryKey: ["me", "stats"],
    queryFn: () => api<{ moments: number; friends: number; sent: number; got: number }>("/v1/me/stats"),
  });
  const mine = useQuery({
    queryKey: ["me", "moments"],
    queryFn: () => api<{ moments: Moment[] }>("/v1/me/moments?limit=40"),
  });

  const days = useMemo(() => {
    const out: { title: string; data: Moment[] }[] = [];
    for (const moment of mine.data?.moments ?? []) {
      const label = dayLabel(new Date(moment.createdAt));
      const last = out.at(-1);
      if (last && last.title === label) last.data.push(moment);
      else out.push({ title: label, data: [moment] });
    }
    return out;
  }, [mine.data]);

  if (!me) return null;

  const joined = `${MONTHS[new Date(me.createdAt).getMonth()]} ${ar(new Date(me.createdAt).getFullYear())}`;
  const s = stats.data;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.paper }}>
      {/* الرأس: العلامة، ففاصل، فاسم الشاشة — والمشاركة في الطرف المقابل. */}
      <View
        style={{
          flexDirection: "row-reverse",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingTop: 6,
          paddingBottom: 10,
          backgroundColor: colors.chrome,
        }}
      >
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
          <AthrMark size={24} />
          <View style={{ width: 1, height: 18, backgroundColor: colors.chromeLine }} />
          <Text style={{ color: colors.chromeInk, fontSize: 16, fontWeight: "700" }}>
            الملف الشخصي
          </Text>
        </View>

        <Pressable
          accessibilityLabel="مشاركة الملف"
          onPress={() =>
            void Share.share({
              message: `ملف ${me.name} في أثر · عضوية رقم ${ar(me.memberNo)}\nhttps://athr.app/u/${me.id}`,
            })
          }
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,.12)",
          }}
        >
          <ShareIcon size={17} color={colors.chromeInk} />
        </Pressable>
      </View>

      <SectionList
        sections={days}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: 30 }}
        ListHeaderComponent={
          <>
            <View style={{ height: COVER, overflow: "hidden" }}>
              <CoverLayer mediaId={me.coverMediaId} spec={me.background?.spec} height={COVER} />
            </View>

            <View style={{ alignItems: "center", marginTop: -52, paddingHorizontal: 20 }}>
              <AvatarMenu
                name={me.name}
                size={104}
                mediaId={me.avatarMediaId}
                frameSpec={me.frame?.spec}
                charm={me.charm}
                frame={me.frame}
                charmItem={me.charm}
              />

              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, marginTop: 10 }}>
                <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "600" }}>{me.name}</Text>
                {me.isPlus ? <StarIcon size={14} color={colors.clay} /> : null}
                {me.tag ? (
                  <View style={{ backgroundColor: me.tag.bg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
                    <Text style={{ color: me.tag.fg, fontSize: 11, fontWeight: "700" }}>{me.tag.name}</Text>
                  </View>
                ) : null}
              </View>

              {me.handle ? (
                <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>@{me.handle}</Text>
              ) : null}

              {me.bio ? (
                <Text style={{ color: colors.ink2, fontSize: 12.5, textAlign: "center", lineHeight: 22, marginTop: 8, maxWidth: 300 }}>
                  {me.bio}
                </Text>
              ) : null}

              <Text style={{ color: colors.muted, fontSize: 11.5, marginTop: 6, textAlign: "center" }}>
                عضوية رقم {ar(me.memberNo)}
                {me.city ? ` · ${me.city}` : ""} · انضم {joined}
              </Text>

              {/* أربعة أرقام بأيقوناتها. */}
              <View style={{ flexDirection: "row-reverse", alignItems: "stretch", maxWidth: 330, width: "100%", marginTop: 14, marginBottom: 6 }}>
                <Stat first icon={<BookIcon size={14} color={colors.ink2} />} value={ar(s?.moments ?? 0)} label="لحظة" />
                <Stat first={false} icon={<WithIcon size={14} color={colors.ink2} />} value={ar(s?.friends ?? 0)} label="صديق" />
                <Stat first={false} icon={<GiftIcon size={14} color={colors.ink2} />} value={ar(s?.sent ?? 0)} label="أهديت" />
                <Stat first={false} icon={<GiftIcon size={14} color={colors.ink2} />} value={ar(s?.got ?? 0)} label="أُهدي لك" />
              </View>
            </View>

            <View style={{ flexDirection: "row-reverse", gap: 10, paddingHorizontal: 20, marginTop: 10, marginBottom: 18 }}>
              <Action grow label="تعديل الملف" onPress={() => router.push("/me/edit" as never)} />
              <Action grow label="إكسسواراتي" onPress={() => router.push("/me/accessories" as never)} />
              <Action label="الخصوصية" icon={<GearIcon size={18} color={colors.ink2} />} onPress={() => router.push("/settings/privacy" as never)} />
              <Action
                label="خروج"
                icon={<ExitIcon size={18} color={colors.ink2} />}
                onPress={() =>
                  Alert.alert("تسجيل الخروج", "تريد الخروج من حسابك؟", [
                    { text: "لا", style: "cancel" },
                    {
                      text: "اخرج",
                      style: "destructive",
                      onPress: () => void signOut().then(() => router.replace("/login")),
                    },
                  ])
                }
              />
            </View>

            <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 4 }}>
              <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "700" }}>لحظاتي</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{ar(s?.moments ?? 0)}</Text>
            </View>
          </>
        }
        renderSectionHeader={({ section }) => (
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 16 }}>
            <View style={{ width: SPINE_W, alignItems: "center" }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.line }} />
            </View>
            <Text style={{ color: colors.ink2, fontSize: 15, fontWeight: "700" }}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 20 }}>
            <MomentCard moment={item} viewerId={me.id} isPlus={me.isPlus} />
          </View>
        )}
        ListEmptyComponent={
          mine.isLoading ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={colors.clay} />
          ) : (
            <View style={{ marginHorizontal: 20, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, paddingVertical: 32, paddingHorizontal: 16 }}>
              <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center" }}>
                ما نشرت شي بعد. اضغط الزائد في «اللحظات».
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}
