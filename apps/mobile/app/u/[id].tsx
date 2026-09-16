import { View, FlatList, Pressable, ActivityIndicator, Alert } from "react-native";
import { Text } from "../../components/type";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AvatarMenu } from "../../components/avatar-menu";
import { CoverLayer } from "../../components/cover";
import { MediaImage } from "../../components/media-image";
import { MomentCard } from "../../components/moment-card";
import { ScreenHeader } from "../../components/screen-header";
import { GiftButton } from "../../components/gift-sheet";
import { MessageIcon, StarIcon, WithIcon } from "../../components/icons";
import { api } from "../../lib/api";
import { keys, type Moment } from "../../lib/queries";
import { ar, membership } from "../../lib/format";
import { useSession } from "../../lib/session";
import { NameTag } from "../../components/name-tag";
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
  /* الصنف الملبوس كاملاً: نافذةُ الصورة تعرض اسمه وسعره وتبيعه. */
  frame: {
    id: string;
    name: string;
    kind: string;
    spec: string;
    mediaId: string | null;
    priceCoins: number;
    plusOnly: boolean;
  } | null;
  charm: {
    id: string;
    name: string;
    kind: string;
    spec: string;
    mediaId: string | null;
    priceCoins: number;
    plusOnly: boolean;
  } | null;
  tag: { name: string; bg: string; fg: string } | null;
};

/**
 * ملفّ صديق.
 *
 * والشعار يبقى في الرأس ثم يأتي الاسم: كان الاسم يحلّ محلّ الشعار فتبدو
 * كل صفحةٍ تطبيقاً آخر.
 */
export default function Profile() {
  const me = useSession((state) => state.me);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const person = useQuery({
    queryKey: keys.user(id),
    queryFn: () => api<{ person: Person; friend: boolean; owned: string[] }>(`/v1/users/${id}`),
  });

  /** المحادثة تُفتح من هنا: تُنشأ إن لم تكن، ثم نذهب إليها. */
  const talk = useMutation({
    mutationFn: () => api<{ id: string }>(`/v1/dm/with/${id}`, { method: "POST" }),
    onSuccess: (row) => router.push(`/dm/${row.id}` as never),
  });
  /*
    الإشراف: بطاقةُ من ليس في دائرتك تُفتح بلا لحظات (القاعدة ٢٠)، وهذا
    يبقى كما هو لكلّ أحد — إلا لمن مُنح صلاحية الإشراف، فالبلاغ يصل على
    منشورٍ ولا بدّ أن يُقرأ ليُحكم فيه.

    وبابٌ ثانٍ ظاهرٌ لا توسعةٌ للأوّل: `/v1/moderation` من خلف
    `requireModerator`، و`/v1/users/:id/moments` يبقى على شرط الرؤية
    كما هو — فلا يحمل استعلامُ اللحظات العاديّ ثقباً.
  */
  const moderating = Boolean(me?.canModerate) && person.data?.friend === false;

  const moments = useQuery({
    queryKey: [...keys.userMoments(id), moderating],
    queryFn: () =>
      api<{ moments: Moment[] }>(
        moderating
          ? `/v1/moderation/users/${id}/moments?limit=20`
          : `/v1/users/${id}/moments?limit=20`,
      ),
    enabled: !!person.data,
  });

  /* الحذف: سؤالٌ ثم حذف (القاعدة ٦١)، والسجلّ يُكتب في الخادم. */
  const remove = useMutation({
    mutationFn: (momentId: string) =>
      api<{ ok: string }>(`/v1/moderation/moments/${momentId}`, { method: "DELETE" }),
    onSuccess: () => void moments.refetch(),
    onError: (error: Error) => Alert.alert("تعذّر الحذف", error.message),
  });

  const askRemove = (momentId: string) =>
    Alert.alert("حذف اللحظة", "تُحذف بتفاعلاتها وتعليقاتها، ويُسجَّل الحذف باسمك.", [
      { text: "تراجع", style: "cancel" },
      { text: "احذف", style: "destructive", onPress: () => remove.mutate(momentId) },
    ]);

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
          renderItem={({ item }) => (
            <View>
              <MomentCard moment={item} viewerId={me?.id ?? ""} isPlus={me?.isPlus ?? false} />
              {moderating ? (
                <Pressable
                  onPress={() => askRemove(item.id)}
                  style={{
                    alignSelf: "flex-start",
                    marginBottom: 12,
                    paddingHorizontal: 12,
                    height: 32,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.live,
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: colors.live, fontSize: 12, fontWeight: "700" }}>
                    احذف هذه اللحظة
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}
          /*
            اللحظات تحتاج حشوة الخطّ الزمني نفسها: بدونها تلتصق البطاقات
            بالحافتين ويمشي عمود الصور خارج الخيط، فتُقرأ الصفحة مكسورة.
          */
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          ListHeaderComponent={
            <>
              {/*
                الغلاف طبقةٌ واحدة في كل الشاشات (القاعدة ٧١): صورةٌ ودرعٌ
                تحت قناع الذوبان نفسه. وصورةٌ عاريةٌ في مربّعٍ رماديّ تنتهي
                بحدٍّ حادّ، فيبدو الملف صفحةً من تطبيقٍ آخر.
              */}
              <View style={{ height: 120, marginHorizontal: -20, overflow: "hidden" }}>
                <CoverLayer mediaId={who.coverMediaId} spec={null} height={120} />
              </View>

              <View style={{ alignItems: "center", marginTop: -32, paddingHorizontal: 16, marginBottom: 14 }}>
                <AvatarMenu
                  name={who.name}
                  size={78}
                  mediaId={who.avatarMediaId}
                  frameSpec={who.frame?.spec}
                  charm={who.charm}
                  frame={who.frame}
                  charmItem={who.charm}
                />
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
                  <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "700", writingDirection: "auto" }}>
                    {who.name}
                  </Text>
                  <NameTag isPlus={who.isPlus} tag={who.tag} size={11} />
                </View>
                <Text style={{ color: colors.muted, fontSize: 11.5, marginTop: 2 }}>
                  لك معانا {membership(who.createdAt)} · عضو {ar(who.memberNo)}
                </Text>

                {/*
                  ويُقال للمشرف إنّه يقرأ بصلاحية: من يرى لحظات من ليس في
                  دائرته بلا خبرٍ يظنّ الحدّ قد سقط عن الجميع.
                */}
                {moderating ? (
                  <View
                    style={{
                      marginTop: 12,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 12,
                      backgroundColor: colors.liveSoft,
                    }}
                  >
                    <Text style={{ color: colors.live, fontSize: 11.5, fontWeight: "700", textAlign: "center" }}>
                      تقرأ بصلاحية إشراف · كلّ حذفٍ يُسجَّل باسمك
                    </Text>
                  </View>
                ) : null}

                {/*
                  ثلاثة أفعال: إهداءٌ من مكانه، وآثارنا، ومحادثة. والحظر
                  ليس هنا — مكانه صفّ الصديق في الدائرة (القاعدة ٣٨).
                */}
                {person.data?.friend ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
                    <GiftButton
                      friendId={who.id}
                      friendName={who.name}
                      friendIsPlus={who.isPlus}
                      friendOwned={person.data.owned ?? []}
                    />

                    <Pressable
                      onPress={() => router.push({ pathname: "/", params: { view: "together", with: who.id } } as never)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 42, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card }}
                    >
                      <WithIcon size={16} color={colors.ink2} />
                      <Text style={{ color: colors.ink2, fontSize: 13, fontWeight: "600" }}>آثارنا</Text>
                    </Pressable>

                    <Pressable
                      accessibilityLabel="محادثة"
                      onPress={() => talk.mutate()}
                      style={{ width: 44, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card }}
                    >
                      <MessageIcon size={17} color={colors.ink2} />
                    </Pressable>
                  </View>
                ) : null}
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
