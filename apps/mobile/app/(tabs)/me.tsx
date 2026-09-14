import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Avatar } from "../../components/avatar";
import { MediaImage } from "../../components/media-image";
import { ScreenHeader } from "../../components/screen-header";
import { StarIcon } from "../../components/icons";
import { useSession } from "../../lib/session";
import { ar, riyals, withUs } from "../../lib/format";
import { colors } from "../../theme/tokens";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
      <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "700" }}>{value}</Text>
      <Text style={{ color: colors.faint, fontSize: 10.5 }}>{label}</Text>
    </View>
  );
}

/**
 * «أنا».
 *
 * الغلاف ثم الصورة ثم الاسم — ترتيبُ الويب نفسه. و«لك معانا» تحت الاسم:
 * المدّة خبرٌ عن العلاقة لا رقمٌ في جدول إحصاءات.
 */
export default function Me() {
  const { me, signOut } = useSession();
  const router = useRouter();

  if (!me) return null;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScreenHeader title="الملف الشخصي" />

      <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
        <View style={{ height: 132, backgroundColor: colors.chip }}>
          {me.coverMediaId ? (
            <MediaImage mediaId={me.coverMediaId} style={{ width: "100%", height: "100%" }} />
          ) : null}
        </View>

        <View style={{ alignItems: "center", marginTop: -34, paddingHorizontal: 16 }}>
          <Avatar
            name={me.name}
            size={84}
            mediaId={me.avatarMediaId}
            frameSpec={me.frame?.spec}
            charm={me.charm}
          />

          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, marginTop: 9 }}>
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "700" }}>{me.name}</Text>
            {me.isPlus ? <StarIcon size={15} color={colors.clay} /> : null}
          </View>

          {me.handle ? (
            <Text style={{ color: colors.faint, fontSize: 12 }}>@{me.handle}</Text>
          ) : null}

          <Text style={{ color: colors.muted, fontSize: 11.5, marginTop: 3 }}>
            لك معانا {withUs(me.createdAt)}
          </Text>

          {me.bio ? (
            <Text style={{ color: colors.ink2, fontSize: 13, textAlign: "center", marginTop: 8, lineHeight: 22 }}>
              {me.bio}
            </Text>
          ) : null}
        </View>

        <View
          style={{
            flexDirection: "row-reverse",
            marginHorizontal: 16,
            marginTop: 18,
            padding: 14,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.card,
          }}
        >
          <Stat label="رقم العضوية" value={ar(me.memberNo)} />
          <Stat label="الرصيد" value={riyals(me.storeCredit)} />
          <Stat label="المدينة" value={me.city ?? "—"} />
        </View>

        <Pressable
          onPress={() =>
            Alert.alert("تسجيل الخروج", "تريد الخروج من حسابك؟", [
              { text: "لا", style: "cancel" },
              {
                text: "اخرج",
                style: "destructive",
                onPress: () => {
                  void signOut().then(() => router.replace("/login"));
                },
              },
            ])
          }
          style={{
            marginHorizontal: 16,
            marginTop: 18,
            height: 48,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.card,
          }}
        >
          <Text style={{ color: colors.live, fontSize: 13.5, fontWeight: "600" }}>تسجيل الخروج</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
