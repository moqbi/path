import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "../../components/avatar";
import { Filtered } from "../../components/filtered";
import { CloseIcon, EyeIcon } from "../../components/icons";
import { api } from "../../lib/api";
import { useSession } from "../../lib/session";
import { ar, relative } from "../../lib/format";
import { colors } from "../../theme/tokens";

/** مدّة شريحة الصورة. والفيديو مدّته مدّته. */
const SLIDE_MS = 5000;

type Story = {
  id: string;
  mediaId: string;
  caption: string | null;
  filter: string | null;
  seconds: number | null;
  createdAt: string;
  media: { mime: string };
  author: { id: string; name: string; avatarMediaId: string | null };
  _count: { views: number };
};

/**
 * عارض القصص.
 *
 * شريط تقدّم لكل شريحة، ولمسةٌ على النصف الأيمن ترجع وعلى الأيسر تتقدّم
 * (وهو المعتاد في RTL)، والضغط المطوّل يوقف العدّ — من يقرأ تعليقاً على
 * صورة لا يجب أن تُسحب من تحته.
 */
export default function StoryViewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const me = useSession((s) => s.me);
  const client = useQueryClient();

  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const started = useRef(Date.now());

  const feed = useQuery({
    queryKey: ["stories", id],
    queryFn: () => api<{ stories: Story[] }>(`/v1/stories/user/${id}`),
  });

  const stories = feed.data?.stories ?? [];
  const story = stories[index];
  const mine = id === me?.id;
  const video = story?.media.mime.startsWith("video/") ?? false;
  const span = video && story?.seconds ? story.seconds * 1000 : SLIDE_MS;

  const remove = useMutation({
    mutationFn: (storyId: string) => api(`/v1/stories/${storyId}`, { method: "DELETE" }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["stories"] });
      router.back();
    },
  });

  // إيصال المشاهدة يُرسل مرّةً لكل شريحة تُفتح.
  useEffect(() => {
    if (!story) return;
    void api(`/v1/stories/${story.id}/seen`, { method: "POST" }).catch(() => {});
  }, [story]);

  useEffect(() => {
    started.current = Date.now();
    setProgress(0);
  }, [index]);

  useEffect(() => {
    if (paused || !story) return;
    const tick = setInterval(() => {
      const done = (Date.now() - started.current) / span;
      if (done >= 1) {
        if (index + 1 < stories.length) setIndex(index + 1);
        else router.back();
        return;
      }
      setProgress(done);
    }, 60);
    return () => clearInterval(tick);
  }, [index, paused, span, stories.length, router, story]);

  const screen = Dimensions.get("window");

  if (feed.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0b1219", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!story) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0b1219", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#fff", fontSize: 13.5 }}>لا قصص هنا.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 14 }}>
          <Text style={{ color: colors.clay, fontSize: 13 }}>رجوع</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  function step(next: number) {
    if (next < 0) return;
    if (next >= stories.length) {
      router.back();
      return;
    }
    setIndex(next);
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0b1219" }}>
      <Filtered
        mediaId={story.mediaId}
        filter={story.filter}
        width={screen.width}
        height={screen.height}
      />

      {/* نصفان للتنقّل: يمينٌ يرجع ويسارٌ يتقدّم، والضغط المطوّل يوقف. */}
      <Pressable
        accessibilityLabel="السابق"
        style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: "50%" }}
        onPressIn={() => setPaused(true)}
        onPressOut={() => setPaused(false)}
        onPress={() => step(index - 1)}
      />
      <Pressable
        accessibilityLabel="التالي"
        style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "50%" }}
        onPressIn={() => setPaused(true)}
        onPressOut={() => setPaused(false)}
        onPress={() => step(index + 1)}
      />

      <SafeAreaView edges={["top"]} pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, top: 0 }}>
        <View pointerEvents="box-none" style={{ padding: 12 }}>
          <View style={{ flexDirection: "row", gap: 4, marginBottom: 12 }}>
            {stories.map((item, position) => (
              <View key={item.id} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,.28)", overflow: "hidden" }}>
                <View
                  style={{
                    height: "100%",
                    borderRadius: 2,
                    backgroundColor: "#fff",
                    width: position < index ? "100%" : position === index ? `${Math.min(100, progress * 100)}%` : "0%",
                  }}
                />
              </View>
            ))}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Avatar name={story.author.name} size={34} mediaId={story.author.avatarMediaId} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontSize: 13.5, fontWeight: "600" }}>
                {story.author.name}
              </Text>
              <Text style={{ color: "rgba(255,255,255,.75)", fontSize: 11 }}>
                {relative(new Date(story.createdAt))}
              </Text>
            </View>

            <Pressable
              accessibilityLabel="إغلاق"
              onPress={() => router.back()}
              style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.16)" }}
            >
              <CloseIcon size={17} color="#fff" />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      {mine ? (
        <SafeAreaView edges={["bottom"]} pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <EyeIcon size={15} color="rgba(255,255,255,.85)" />
              <Text style={{ color: "rgba(255,255,255,.85)", fontSize: 12 }}>
                {ar(story._count.views)}
              </Text>
            </View>

            <Pressable
              onPress={() => remove.mutate(story.id)}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,.16)" }}
            >
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>احذف القصة</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      ) : null}
    </View>
  );
}
