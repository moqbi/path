import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Avatar } from "../../components/avatar";
import { MediaImage } from "../../components/media-image";
import { MomentCard } from "../../components/moment-card";
import { ScreenHeader } from "../../components/screen-header";
import { StarIcon } from "../../components/icons";
import { api } from "../../lib/api";
import { keys, type Moment } from "../../lib/queries";
import { ar, withUs } from "../../lib/format";
import { colors } from "../../theme/tokens";

type Person = {
  id: string;
  memberNo: number;
  name: string;
  handle: string | null;
  city: string | null;
  bio: string | null;
  isPlus: boolean;
  createdAt: string;
  avatarMediaId: string | null;
  coverMediaId: string | null;
  frame: { spec: string; mediaId: string | null } | null;
  charm: { spec: string; mediaId: string | null } | null;
  tag: { name: string; bg: string; fg: string } | null;
};

/**
 * ملفّ صديق.
 *
 * والشعار يبقى في الرأس ثم يأتي الاسم: كان الاسم يحلّ محلّ الشعار فتبدو
 * كل صفحةٍ تطبيقاً آخر.
 */
export default function Profile() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const person = useQuery({
    queryKey: keys.user(id),
    queryFn: () => api<{ person: Person }>(`/v1/users/${id}`),
  });
  const moments = useQuery({
    queryKey: keys.userMoments(id),
    queryFn: () => api<{ moments: Moment[] }>(`/v1/users/${id}/moments?limit=20`),
    enabled: !!person.data,
  });

  const who = person.data?.person;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScreenHeader title={who?.name ?? "ملف"} back="/circle" />

      {person.isLoading ? (
        <ActivityIndicator style={{ marginTop: 50 }} color={colors.clay} />
      ) : !who ? (
        <Text style={{ color: colors.muted, fontSize: 13.5, textAlign: "center", marginTop: 50 }}>
          لا يوجد هذا الحساب.
        </Text>
      ) : (
        <FlatList
          data={moments.data?.moments ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MomentCard moment={item} />}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListHeaderComponent={
            <>
              <View style={{ height: 120, backgroundColor: colors.chip }}>
                {who.coverMediaId ? (
                  <MediaImage mediaId={who.coverMediaId} style={{ width: "100%", height: "100%" }} />
                ) : null}
              </View>

              <View style={{ alignItems: "center", marginTop: -32, paddingHorizontal: 16, marginBottom: 14 }}>
                <Avatar
                  name={who.name}
                  size={78}
                  mediaId={who.avatarMediaId}
                  frameSpec={who.frame?.spec}
                  charm={who.charm}
                />
                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, marginTop: 8 }}>
                  <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "700" }}>{who.name}</Text>
                  {who.isPlus ? <StarIcon size={14} color={colors.clay} /> : null}
                </View>
                <Text style={{ color: colors.muted, fontSize: 11.5, marginTop: 2 }}>
                  لك معانا {withUs(who.createdAt)} · عضو {ar(who.memberNo)}
                </Text>
                {who.bio ? (
                  <Text style={{ color: colors.ink2, fontSize: 13, textAlign: "center", marginTop: 7, lineHeight: 22 }}>
                    {who.bio}
                  </Text>
                ) : null}
              </View>
            </>
          }
          ListEmptyComponent={
            moments.isLoading ? null : (
              <Text style={{ color: colors.faint, fontSize: 12.5, textAlign: "center", paddingVertical: 24 }}>
                لا لحظات تراها.
              </Text>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}
