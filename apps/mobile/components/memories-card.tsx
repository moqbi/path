import { useState } from "react";
import { ActivityIndicator, Image, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Text } from "./type";
import { Avatar, firstColor } from "./avatar";
import { MediaImage } from "./media-image";
import { PeopleSheet } from "./people-sheet";
import { ClockIcon, CloseIcon, FlameIcon, ShareIcon, SparkIcon, WithIcon } from "./icons";
import { api } from "../lib/api";
import { useToday, type MemoryGroup, type Occasion, type ShareAudience } from "../lib/memories";
import { useCircle, type Moment } from "../lib/queries";
import { ar, MONTHS } from "../lib/format";
import { colors } from "../theme/tokens";

/** «٣ أكتوبر ٢٠٢٥» — ميلاديٌّ بالعربية (القاعدة ١١٨). */
export function dateText(iso: string) {
  const date = new Date(iso);
  return `${ar(date.getDate())} ${MONTHS[date.getMonth()]} ${ar(date.getFullYear())}`;
}

/** ما تقوله الذكرى في سطر — بلسان صاحبها. */
function memoryTitle(moment: Moment) {
  switch (moment.kind) {
    case "PLACE":
      return `كنت في ${moment.placeName ?? moment.placeCity ?? "مكانٍ تذكره"}`;
    case "CITY":
      return `وصلت إلى ${moment.text ?? moment.placeCity ?? "مدينةٍ جديدة"}`;
    case "MUSIC":
      return moment.musicTitle ? `كنت تسمع «${moment.musicTitle}»` : "شاركت أغنية";
    case "JOINED":
      return "انضممت إلى آثار مومنتس";
    case "PHOTO":
      return moment.text || "صورة";
    default:
      return moment.text || "لحظة";
  }
}

const SHAREABLE = new Set(["PHOTO", "PLACE", "THOUGHT", "MUSIC", "CITY"]);

/**
 * «شاركها»: سؤالٌ في مكانه لا نافذة — نافذةٌ فوق نافذةٍ لا تُرى في آبل
 * (القاعدة ١٢٦)، و«أشخاص أختارهم» يفتح نافذةَ الاختيار وحدها (القاعدة ٦٧).
 * والمشاركةُ نسخةٌ باسم صاحبها لمن يختار الآن، لا جمهورُ الأصل.
 */
export function ShareChoice({
  onShare,
  onCancel,
  dark = false,
}: {
  onShare: (audience: ShareAudience) => Promise<void>;
  onCancel: () => void;
  dark?: boolean;
}) {
  const circle = useCircle();
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async (audience: ShareAudience) => {
    setBusy(true);
    setError(null);
    try {
      await onShare(audience);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "تعذّرت المشاركة");
    } finally {
      setBusy(false);
    }
  };

  const ink = dark ? "#f7f5ef" : colors.ink;
  const chip = {
    flex: 1,
    height: 40,
    borderRadius: 12,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 1,
    borderColor: dark ? "rgba(255,255,255,.22)" : colors.line,
    backgroundColor: dark ? "rgba(255,255,255,.08)" : colors.paper,
  };

  return (
    <View style={{ marginTop: 10, gap: 8 }}>
      <Text style={{ color: dark ? "rgba(247,245,239,.75)" : colors.muted, fontSize: 11.5 }}>
        تُنشر لحظةً جديدةً في خطّك — لمن؟
      </Text>
      {busy ? (
        <ActivityIndicator color={dark ? "#fff" : colors.clay} />
      ) : (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable onPress={() => void go({ audience: "CIRCLE" })} style={chip}>
            <Text style={{ color: ink, fontSize: 12.5, fontWeight: "700" }}>دائرتي كلها</Text>
          </Pressable>
          <Pressable onPress={() => setPicking(true)} style={chip}>
            <Text style={{ color: ink, fontSize: 12.5, fontWeight: "700" }}>أشخاص أختارهم</Text>
          </Pressable>
          <Pressable onPress={onCancel} style={[chip, { flex: 0, paddingHorizontal: 14 }]}>
            <Text style={{ color: dark ? "rgba(247,245,239,.75)" : colors.muted, fontSize: 12.5 }}>إلغاء</Text>
          </Pressable>
        </View>
      )}
      {error ? <Text style={{ color: colors.clayInk, fontSize: 12 }}>{error}</Text> : null}

      {picking ? (
        <PeopleSheet
          title="من يرى هذه الذكرى؟"
          friends={circle.data?.members ?? []}
          picked={picked}
          onToggle={(id) => setPicked((now) => (now.includes(id) ? now.filter((one) => one !== id) : [...now, id]))}
          onClose={() => {
            setPicking(false);
            // الإغلاقُ باختيارٍ تأكيدٌ، وبلا اختيارٍ تراجع.
            if (picked.length > 0) void go({ audience: "PICKED", viewers: picked });
          }}
        />
      ) : null}
    </View>
  );
}

/** الذكرى سطراً: صورتُها أو أيقونتُها، وما تقوله وتاريخُها، وزرُّ مشاركتها. */
function MemoryRow({ moment, onShared }: { moment: Moment; onShared: () => void }) {
  const router = useRouter();
  const client = useQueryClient();
  const [sharing, setSharing] = useState(false);
  const [done, setDone] = useState(false);

  const share = async (audience: ShareAudience) => {
    await api(`/v1/memories/${moment.id}/share`, { method: "POST", body: JSON.stringify(audience) });
    setSharing(false);
    setDone(true);
    void client.invalidateQueries({ queryKey: ["feed"] });
    onShared();
  };

  return (
    <View style={{ paddingVertical: 8 }}>
      <Pressable onPress={() => router.push(`/m/${moment.id}` as never)} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 54, height: 54, borderRadius: 12, overflow: "hidden", backgroundColor: colors.chip, alignItems: "center", justifyContent: "center" }}>
          {moment.mediaId ? (
            <MediaImage mediaId={moment.mediaId} style={{ width: 54, height: 54 }} />
          ) : moment.imageSpec ? (
            <View style={{ width: 54, height: 54, backgroundColor: firstColor(moment.imageSpec, colors.chip) }} />
          ) : moment.musicThumb ? (
            <MediaThumb uri={moment.musicThumb} />
          ) : (
            <ClockIcon size={20} color={colors.ink2} />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={2} style={{ color: colors.ink, fontSize: 13.5, fontWeight: "600", lineHeight: 21 }}>
            {memoryTitle(moment)}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11.5, marginTop: 2 }}>{dateText(moment.createdAt)}</Text>
        </View>
        {SHAREABLE.has(moment.kind) && !done ? (
          <Pressable
            accessibilityLabel="شاركها"
            hitSlop={6}
            onPress={() => setSharing((now) => !now)}
            style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper }}
          >
            <ShareIcon size={16} color={colors.ink2} />
          </Pressable>
        ) : null}
      </Pressable>
      {done ? <Text style={{ color: colors.goldInk, fontSize: 12, marginTop: 6 }}>نُشرت في خطّك</Text> : null}
      {sharing ? <ShareChoice onShare={share} onCancel={() => setSharing(false)} /> : null}
    </View>
  );
}

function MediaThumb({ uri }: { uri: string }) {
  return <Image source={{ uri }} style={{ width: 54, height: 54 }} resizeMode="cover" />;
}

function OccasionRow({ occasion, moment }: { occasion: Occasion; moment: Moment | null }) {
  const router = useRouter();
  return (
    <View style={{ paddingVertical: 8 }}>
      <Pressable onPress={() => router.push(`/u/${occasion.friend.id}` as never)} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View>
          <Avatar name={occasion.friend.name} size={46} mediaId={occasion.friend.avatarMediaId} />
          <View style={{ position: "absolute", bottom: -2, right: -2, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line }}>
            {occasion.kind === "STREAK" ? <FlameIcon size={12} color={colors.live} /> : <WithIcon size={12} color={colors.ink2} />}
          </View>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "700", lineHeight: 21 }}>{occasion.title}</Text>
          {occasion.detail ? (
            <Text style={{ color: colors.ink2, fontSize: 12, marginTop: 2, lineHeight: 19 }}>{occasion.detail}</Text>
          ) : null}
        </View>
      </Pressable>
      {moment ? (
        <Pressable
          onPress={() => router.push(`/m/${moment.id}` as never)}
          style={{ marginTop: 8, marginRight: 58, flexDirection: "row", alignItems: "center", gap: 10, padding: 8, borderRadius: 12, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line }}
        >
          {moment.mediaId ? (
            <MediaImage mediaId={moment.mediaId} style={{ width: 36, height: 36, borderRadius: 8 }} />
          ) : null}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12.5, fontWeight: "600" }}>
              {memoryTitle(moment)}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>أول لحظة جمعتكما، {dateText(moment.createdAt)}</Text>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * بطاقةُ اليوم أعلى اللحظات (القاعدة ٢٣٥) — **بقرار المالك**: لصاحبها وحده،
 * فيها ذكرياتُ اليوم ومناسباتُ الصداقة و«آثرك جاهز» في نافذته. و«×» يطويها
 * لليوم كلّه على الجهازين (الخادم يحفظ اليوم)، وتعود غداً بما يقع فيه.
 */
export function MemoriesCard() {
  const router = useRouter();
  const client = useQueryClient();
  const today = useToday(true);
  const data = today.data;
  if (!data) return null;
  const { memories, occasions, moments, recapYear } = data;
  if (memories.length === 0 && occasions.length === 0 && !recapYear) return null;

  const byId = new Map(moments.map((moment) => [moment.id, moment]));
  const dismiss = () => {
    client.setQueryData(["memories", "today"], { ...data, memories: [], occasions: [] });
    void api("/v1/memories/today/dismiss", { method: "POST" }).catch(() => undefined);
  };

  return (
    <View style={{ marginTop: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6 }}>
      {recapYear ? (
        <Pressable
          onPress={() => router.push(`/recap/${recapYear}` as never)}
          style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, marginBottom: 8, borderRadius: 14, backgroundColor: colors.night }}
        >
          <SparkIcon size={18} color="#F6B93B" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#f7f5ef", fontSize: 14, fontWeight: "700" }}>آثرك في {ar(recapYear)} جاهز</Text>
            <Text style={{ color: "rgba(247,245,239,.7)", fontSize: 11.5, marginTop: 1 }}>سنتك في دقيقة — لحظاتك وأماكنك ومن كان معك</Text>
          </View>
        </Pressable>
      ) : null}

      {memories.length > 0 || occasions.length > 0 ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ClockIcon size={16} color={colors.clayInk} />
          <Text style={{ flex: 1, color: colors.ink, fontSize: 14.5, fontWeight: "700" }}>
            {memories.length > 0 ? "في مثل هذا اليوم" : "مناسبات اليوم"}
          </Text>
          <Pressable accessibilityLabel="إخفاء لليوم" hitSlop={8} onPress={dismiss} style={{ padding: 4 }}>
            <CloseIcon size={14} color={colors.muted} />
          </Pressable>
        </View>
      ) : null}

      {memories.map((group: MemoryGroup) => (
        <View key={group.months} style={{ marginTop: 8 }}>
          <Text style={{ alignSelf: "flex-start", color: colors.ink2, fontSize: 11.5, fontWeight: "700", backgroundColor: colors.paper, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, overflow: "hidden" }}>
            {group.label}
          </Text>
          {group.moments.map((moment) => (
            <MemoryRow key={moment.id} moment={moment} onShared={() => undefined} />
          ))}
        </View>
      ))}

      {occasions.length > 0 ? (
        <View style={{ marginTop: memories.length ? 6 : 8, borderTopWidth: memories.length ? 1 : 0, borderTopColor: colors.line, paddingTop: memories.length ? 6 : 0 }}>
          {occasions.map((occasion) => (
            <OccasionRow key={occasion.id} occasion={occasion} moment={occasion.momentId ? (byId.get(occasion.momentId) ?? null) : null} />
          ))}
        </View>
      ) : null}
    </View>
  );
}
