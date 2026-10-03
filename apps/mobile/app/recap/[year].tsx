import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, useWindowDimensions, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { Text } from "../../components/type";
import { Avatar } from "../../components/avatar";
import { MediaImage } from "../../components/media-image";
import { ShareChoice } from "../../components/memories-card";
import { CloseIcon, PlayIcon, SparkIcon } from "../../components/icons";
import { api } from "../../lib/api";
import { openIn } from "../../lib/browse";
import { useRecap, type Recap, type ShareAudience } from "../../lib/memories";
import { ar } from "../../lib/format";
import { colors } from "../../theme/tokens";

const SLIDE_MS = 7000;
const AMBER = "#F6B93B";
const PAPER = "#f7f5ef";
const SOFT = "rgba(247,245,239,.72)";

/** «مرة» و«مرتين» و«٥ مرات» و«١١ مرة». */
function times(n: number) {
  if (n <= 1) return "مرة";
  if (n === 2) return "مرتين";
  return `${ar(n)} ${n <= 10 ? "مرات" : "مرة"}`;
}

/**
 * العددُ وتمييزُه: «لحظة واحدة»، «لحظتين»، «٧ لحظات»، «١٢ لحظة». والفاصلُ
 * بين عددين فاصلةٌ لا «·»: الصفرُ العربيّ نقطة، فكان «١ · مدينة» يُقرأ «١٠».
 */
function counted(n: number, one: string, two: string, few: string, many: string) {
  if (n <= 1) return one;
  if (n === 2) return two;
  return `${ar(n)} ${n <= 10 ? few : many}`;
}
const dayCount = (n: number) => counted(n, "يوم واحد", "يومين", "أيام", "يوماً");
const momentCount = (n: number) => counted(n, "لحظة واحدة", "لحظتين", "لحظات", "لحظة");
const cityCount = (n: number) => counted(n, "مدينة واحدة", "مدينتين", "مدن", "مدينة");
const friendCount = (n: number) => counted(n, "صديق جديد", "صديقين جديدين", "أصدقاء جدد", "صديقاً جديداً");

type Slide = { key: string; body: React.ReactNode };

/**
 * «آثرك السنويّ» — **بقرار المالك** (القاعدة ٢٣٥): شرائحُ كالقصة على الأرضية
 * الداكنة، تتقدّم وحدها وتُوقفها الضغطةُ المطوّلة، ونصفاها للتنقّل كالقصّة.
 * وما لا بيانات له لا شريحةَ له — سنةٌ بلا أغنيةٍ لا تُعرض فيها «أكثر أغنية: —».
 * والأخيرةُ «شارك آثرك»: أرقامٌ بلا أسماء، فمن تفاعل معك أكثر خبرٌ عنه هو.
 */
export default function RecapScreen() {
  const { year: raw } = useLocalSearchParams<{ year: string }>();
  const year = Number(raw);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const recap = useRecap(year);
  const data = recap.data?.recap ?? null;

  const slides = useMemo(() => (data ? build(data, router) : []), [data, router]);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [held, setHeld] = useState(false);
  const [sharing, setSharing] = useState(false);
  const elapsed = useRef(0);
  const last = index === slides.length - 1;
  const paused = held || sharing || last;

  useEffect(() => {
    elapsed.current = 0;
    setProgress(0);
  }, [index]);

  useEffect(() => {
    if (paused || slides.length === 0) return;
    const started = Date.now() - elapsed.current;
    const tick = setInterval(() => {
      elapsed.current = Date.now() - started;
      const done = elapsed.current / SLIDE_MS;
      if (done >= 1) {
        setIndex((now) => Math.min(now + 1, slides.length - 1));
        return;
      }
      setProgress(done);
    }, 80);
    return () => clearInterval(tick);
  }, [index, paused, slides.length]);

  const close = () => (router.canGoBack() ? router.back() : router.replace("/" as never));

  if (recap.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.night, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={PAPER} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.night, alignItems: "center", justifyContent: "center", padding: 32 }}>
        <Text style={{ color: PAPER, fontSize: 15, fontWeight: "700", textAlign: "center" }}>
          {recap.error ? (recap.error as Error).message : `ما فيه لحظات في ${ar(year)}`}
        </Text>
        <Pressable onPress={close} style={{ marginTop: 16 }}>
          <Text style={{ color: AMBER, fontSize: 13 }}>رجوع</Text>
        </Pressable>
      </View>
    );
  }

  const slide = slides[index];

  return (
    /*
      الشاشةُ كلُّها ضغطةٌ واحدة يُقرأ اتّجاهُها من موضع الإصبع: يمينٌ يرجع
      ويسارٌ يتقدّم كالقصّة، والمطوّلةُ توقف. لا طبقتان شفّافتان فوق المحتوى:
      تلك تبتلع ضغطةَ الأغنية واللحظة تحتها. وما فيه زرٌّ يأخذ ضغطتَه أوّلاً.
    */
    <Pressable
      style={{ flex: 1, backgroundColor: colors.night }}
      onPressIn={() => setHeld(true)}
      onPressOut={() => setHeld(false)}
      onPress={(event) => {
        if (event.nativeEvent.pageX > width * 0.6) setIndex((now) => Math.max(0, now - 1));
        else setIndex((now) => Math.min(slides.length - 1, now + 1));
      }}
    >
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 14 }}>
        <View style={{ flexDirection: "row", gap: 4 }}>
          {slides.map((one, position) => (
            <View key={one.key} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,.22)", overflow: "hidden" }}>
              <View
                style={{
                  height: "100%",
                  backgroundColor: PAPER,
                  width: position < index ? "100%" : position === index ? `${Math.min(100, (last ? 1 : progress) * 100)}%` : "0%",
                }}
              />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 12 }}>
          <SparkIcon size={16} color={AMBER} />
          <Text style={{ flex: 1, color: PAPER, fontSize: 13.5, fontWeight: "700", marginRight: 8 }}>آثرك في {ar(data.year)}</Text>
          <Pressable accessibilityLabel="إغلاق" hitSlop={10} onPress={close} style={{ padding: 6 }}>
            <CloseIcon size={18} color={PAPER} />
          </Pressable>
        </View>
      </View>

      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 28, paddingBottom: insets.bottom + 30 }}>
        {slide.key === "outro" ? (
          <Outro recap={data} sharing={sharing} setSharing={setSharing} close={close} />
        ) : (
          slide.body
        )}
      </View>
    </Pressable>
  );
}

const Kicker = ({ children }: { children: React.ReactNode }) => (
  <Text style={{ color: AMBER, fontSize: 14, fontWeight: "700", marginBottom: 10 }}>{children}</Text>
);
const Big = ({ children }: { children: React.ReactNode }) => (
  <Text style={{ color: PAPER, fontSize: 44, fontWeight: "800", lineHeight: 60 }}>{children}</Text>
);
const Sub = ({ children }: { children: React.ReactNode }) => (
  <Text style={{ color: SOFT, fontSize: 15, lineHeight: 26, marginTop: 6 }}>{children}</Text>
);

function PersonBlock({ label, person, unit }: { label: string; person: NonNullable<Recap["youLoved"]>; unit: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 22 }}>
      <Avatar name={person.name} size={64} mediaId={person.avatarMediaId} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: SOFT, fontSize: 12.5 }}>{label}</Text>
        <Text style={{ color: PAPER, fontSize: 22, fontWeight: "800", marginTop: 2 }} numberOfLines={1}>
          {person.name}
        </Text>
        <Text style={{ color: AMBER, fontSize: 12.5, marginTop: 2 }}>
          {ar(person.count)} {unit}
        </Text>
      </View>
    </View>
  );
}

function build(recap: Recap, router: ReturnType<typeof useRouter>): Slide[] {
  const slides: Slide[] = [];

  slides.push({
    key: "intro",
    body: (
      <View>
        <Kicker>سنتك في آثار</Kicker>
        <Big>{momentCount(recap.moments)}</Big>
        <Sub>كتبتها في {dayCount(recap.activeDays)} من {ar(recap.year)}</Sub>
      </View>
    ),
  });

  const kinds = [
    { label: "صور", n: recap.byKind.photos },
    { label: "أماكن", n: recap.byKind.places },
    { label: "خواطر", n: recap.byKind.thoughts },
    { label: "أغاني", n: recap.byKind.songs },
  ].filter((row) => row.n > 0);
  if (kinds.length > 1) {
    slides.push({
      key: "kinds",
      body: (
        <View>
          <Kicker>كيف كتبتها</Kicker>
          {kinds.map((row) => (
            <View key={row.label} style={{ flexDirection: "row", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
              <Text style={{ color: PAPER, fontSize: 36, fontWeight: "800", minWidth: 80 }}>{ar(row.n)}</Text>
              <Text style={{ color: SOFT, fontSize: 18 }}>{row.label}</Text>
            </View>
          ))}
        </View>
      ),
    });
  }

  if (recap.topPlace || recap.cities.length > 0) {
    slides.push({
      key: "places",
      body: (
        <View>
          {recap.topPlace ? (
            <>
              <Kicker>أكثر مكان رجعت له</Kicker>
              <Big>{recap.topPlace.name}</Big>
              <Sub>{times(recap.topPlace.count)}</Sub>
            </>
          ) : null}
          {recap.cities.length > 0 ? (
            <View style={{ marginTop: recap.topPlace ? 30 : 0 }}>
              <Kicker>{cityCount(recap.cities.length)} وصلتها</Kicker>
              <Text style={{ color: PAPER, fontSize: 20, fontWeight: "700", lineHeight: 32 }}>{recap.cities.join("، ")}</Text>
            </View>
          ) : null}
        </View>
      ),
    });
  }

  if (recap.topSong) {
    const song = recap.topSong;
    slides.push({
      key: "song",
      body: (
        <View style={{ alignItems: "center" }}>
          <Kicker>أغنيتك</Kicker>
          {song.thumb ? (
            <Pressable
              accessibilityLabel="استمع"
              disabled={!song.url}
              onPress={() => song.url && void openIn(song.url)}
              style={{ width: 180, height: 180, borderRadius: 20, overflow: "hidden", marginVertical: 14 }}
            >
              <Image source={{ uri: song.thumb }} style={{ width: 180, height: 180 }} />
              {song.url ? (
                <View style={{ position: "absolute", bottom: 10, left: 10, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(14,26,36,.7)" }}>
                  <PlayIcon size={15} color="#fff" />
                </View>
              ) : null}
            </Pressable>
          ) : null}
          <Text style={{ color: PAPER, fontSize: 26, fontWeight: "800", textAlign: "center" }}>{song.title}</Text>
          {song.artist ? <Sub>{song.artist}</Sub> : null}
          <Text style={{ color: AMBER, fontSize: 13, marginTop: 8 }}>شاركتها {times(song.count)}</Text>
        </View>
      ),
    });
  }

  if (recap.youLoved || recap.lovedYou) {
    slides.push({
      key: "people",
      body: (
        <View>
          <Kicker>ناسك هذي السنة</Kicker>
          {recap.lovedYou ? <PersonBlock label="أكثر من تفاعل معك" person={recap.lovedYou} unit="تفاعل وتعليق" /> : null}
          {recap.youLoved ? <PersonBlock label="أكثر من تفاعلت معه" person={recap.youLoved} unit="تفاعل وتعليق" /> : null}
        </View>
      ),
    });
  }

  if (recap.reactionsGot || recap.commentsGot || recap.newFriends) {
    slides.push({
      key: "numbers",
      body: (
        <View>
          <Kicker>وصلك</Kicker>
          {[
            { n: recap.reactionsGot, label: "تفاعل على لحظاتك" },
            { n: recap.commentsGot, label: "تعليق" },
            { n: recap.newFriends, label: recap.newFriends === 1 ? "صديق جديد" : recap.newFriends <= 10 ? "أصدقاء جدد" : "صديقاً جديداً" },
          ]
            .filter((row) => row.n > 0)
            .map((row) => (
              <View key={row.label} style={{ marginBottom: 14 }}>
                <Text style={{ color: PAPER, fontSize: 38, fontWeight: "800" }}>{ar(row.n)}</Text>
                <Text style={{ color: SOFT, fontSize: 15 }}>{row.label}</Text>
              </View>
            ))}
        </View>
      ),
    });
  }

  if (recap.topMoment) {
    const moment = recap.topMoment;
    slides.push({
      key: "top",
      body: (
        <View>
          <Kicker>اللحظة اللي حرّكت دائرتك</Kicker>
          <Pressable onPress={() => router.push(`/m/${moment.id}` as never)} style={{ borderRadius: 18, overflow: "hidden", backgroundColor: "rgba(255,255,255,.08)" }}>
            {moment.mediaId ? <MediaImage mediaId={moment.mediaId} style={{ width: "100%", aspectRatio: 1.25 }} /> : null}
            <View style={{ padding: 14 }}>
              {moment.text ? (
                <Text numberOfLines={4} style={{ color: PAPER, fontSize: 16, lineHeight: 26 }}>
                  {moment.text}
                </Text>
              ) : null}
              <Text style={{ color: AMBER, fontSize: 12.5, marginTop: 6 }}>
                {ar(moment._count.reactions)} تفاعل، {ar(moment._count.comments)} تعليق
              </Text>
            </View>
          </Pressable>
        </View>
      ),
    });
  }

  slides.push({ key: "outro", body: null });
  return slides;
}

function Outro({
  recap,
  sharing,
  setSharing,
  close,
}: {
  recap: Recap;
  sharing: boolean;
  setSharing: (on: boolean) => void;
  close: () => void;
}) {
  const client = useQueryClient();
  const [done, setDone] = useState(false);

  const share = async (audience: ShareAudience) => {
    await api(`/v1/recap/${recap.year}/share`, { method: "POST", body: JSON.stringify(audience) });
    setSharing(false);
    setDone(true);
    void client.invalidateQueries({ queryKey: ["feed"] });
  };

  return (
    <View>
      <Kicker>هذا آثرك</Kicker>
      <Big>{ar(recap.year)}</Big>
      <Sub>
        {[
          momentCount(recap.moments),
          recap.cities.length ? cityCount(recap.cities.length) : null,
          recap.newFriends ? friendCount(recap.newFriends) : null,
        ]
          .filter(Boolean)
          .join("، ")}
      </Sub>

      <View style={{ marginTop: 30 }}>
        {done ? (
          <Text style={{ color: AMBER, fontSize: 14, fontWeight: "700" }}>نُشر في خطّك</Text>
        ) : sharing ? (
          <ShareChoice dark onShare={share} onCancel={() => setSharing(false)} />
        ) : (
          <Pressable
            onPress={() => setSharing(true)}
            style={{ height: 50, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: AMBER }}
          >
            <Text style={{ color: colors.night, fontSize: 15, fontWeight: "800" }}>شارك آثرك مع دائرتك</Text>
          </Pressable>
        )}
        <Pressable onPress={close} style={{ height: 46, alignItems: "center", justifyContent: "center", marginTop: 8 }}>
          <Text style={{ color: SOFT, fontSize: 13.5 }}>سكّر</Text>
        </Pressable>
        <Text style={{ color: "rgba(247,245,239,.45)", fontSize: 11, textAlign: "center", lineHeight: 18 }}>
          المشاركة أرقامٌ بلا أسماء — من تفاعل معك يبقى بينك وبينه
        </Text>
      </View>
    </View>
  );
}
