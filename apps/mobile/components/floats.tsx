import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, TextInput as RNTextInput, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { STATUS_COMMENT_MAX } from "@athar/shared";
import { Text, TextInput } from "./type";
import { ReactionGlyph } from "./reactions";
import { SendIcon } from "./icons";
import { Spinner } from "./spinner";
import { api } from "../lib/api";
import { colors } from "../theme/tokens";

/**
 * التفاعلاتُ والتعليقاتُ تطفو على القصّة والنوت (القاعدة ٣٤٤) — **بقرار المالك**، كساوندكلاود:
 * من يفتحها يرى وجوهَ من تفاعل وما كتبوه تصعد من أسفل الشاشة وتتمايل وتذوب، **بلا أسماء**.
 * تُعرض مرّةً لكلّ فتح، وما يُكتب بعدها — منك أو من غيرك — يطير لحظةَ يصل.
 */

export type FloatComment = { id: string; body: string; at: string; mine: boolean; canDelete: boolean };
type Floats = { reactions: { kind: string; at: string }[]; comments: FloatComment[] };
type Target = { kind: "story" | "note"; id: string };

const base = (target: Target) => (target.kind === "story" ? `/v1/stories/${target.id}` : `/v1/notes/${target.id}`);

export function useFloats(target: Target | null) {
  return useQuery({
    queryKey: ["floats", target?.kind, target?.id],
    queryFn: () => api<Floats>(`${base(target!)}/floats`),
    enabled: Boolean(target),
    // ما يُكتب الآن يصل وأنت تشاهد — ربعُ دقيقة يكفي لشيءٍ يعيش يوماً.
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}

type Flyer = { key: string; kind: "face"; face: string } | { key: string; kind: "text"; body: string; mine: boolean };

/** طبقةٌ فوق القصّة أو النوت تُطيّر ما فيها — لا تأخذ لمسةً من أحد. */
export function FloatLayer({ target, top = 0.22, bottom = 0.78 }: { target: Target | null; top?: number; bottom?: number }) {
  const data = useFloats(target).data;
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const seen = useRef(new Set<string>());
  const queue = useRef<Flyer[]>([]);
  const [still, setStill] = useState(false);
  // يطير داخل ما فيه وحده — القصّةُ أو نافذةُ النوت — لا على الشاشة كلّها (القاعدة ٣٤٥).
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => undefined);
  }, []);

  // شيءٌ جديد يُضاف إلى الطابور — ما طار مرّةً لا يُعاد في هذا الفتح.
  useEffect(() => {
    if (!data) return;
    const fresh: Flyer[] = [];
    for (const row of data.reactions) {
      // بالنوع والوقت لا بالترتيب: جلبٌ جديد يزيح الترتيبَ فيُعاد ما طار.
      const key = `r-${row.kind}-${row.at}`;
      if (!seen.current.has(key)) fresh.push({ key, kind: "face", face: row.kind });
    }
    for (const row of data.comments) {
      const key = `c-${row.id}`;
      if (!seen.current.has(key)) fresh.push({ key, kind: "text", body: row.body, mine: row.mine });
    }
    // تتناوب الوجوهُ والتعليقات فلا يمرّ هذا كلُّه ثمّ ذاك.
    const faces = fresh.filter((one) => one.kind === "face");
    const texts = fresh.filter((one) => one.kind === "text");
    const mixed: Flyer[] = [];
    while (faces.length || texts.length) {
      if (texts.length) mixed.push(texts.shift()!);
      if (faces.length) mixed.push(faces.shift()!);
      if (faces.length) mixed.push(faces.shift()!);
    }
    for (const one of mixed) seen.current.add(one.key);
    queue.current.push(...mixed);
  }, [data]);

  // واحدٌ كلّ ٦٥٠ مللي، وعلى الشاشة عشرةٌ على الأكثر.
  useEffect(() => {
    if (still) return;
    const tick = setInterval(() => {
      const next = queue.current.shift();
      if (!next) return;
      setFlyers((now) => [...now.slice(-9), next]);
    }, 650);
    return () => clearInterval(tick);
  }, [still]);

  if (!target || still) return null;
  return (
    <View
      pointerEvents="none"
      onLayout={(event) => setBox({ w: event.nativeEvent.layout.width, h: event.nativeEvent.layout.height })}
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 3, overflow: "hidden" }}
    >
      {box.h
        ? flyers.map((one) => (
            <Flyer key={one.key} item={one} box={box} top={top} bottom={bottom} done={() => setFlyers((now) => now.filter((x) => x.key !== one.key))} />
          ))
        : null}
    </View>
  );
}

/** ما يطفو: يصعد ويتمايل ويذوب في أربع ثوانٍ ونصف — على الخيط الأصليّ. */
function Flyer({
  item,
  box,
  top,
  bottom,
  done,
}: {
  item: Flyer;
  box: { w: number; h: number };
  top: number;
  bottom: number;
  done: () => void;
}) {
  const screen = { width: box.w, height: box.h };
  const t = useRef(new Animated.Value(0)).current;
  const lane = useRef({
    // التعليقاتُ في وسطٍ يتّسع لها، والوجوهُ على طرفٍ ما.
    x: item.kind === "text" ? screen.width * (0.12 + Math.random() * 0.26) : screen.width * (0.08 + Math.random() * 0.74),
    sway: 10 + Math.random() * 18,
    side: Math.random() < 0.5 ? -1 : 1,
    ms: item.kind === "text" ? 5200 : 4200 + Math.random() * 800,
  }).current;

  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: lane.ms, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(done);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rise = (bottom - top) * screen.height;
  return (
    <Animated.View
      style={{
        position: "absolute",
        left: lane.x,
        top: bottom * screen.height,
        opacity: t.interpolate({ inputRange: [0, 0.08, 0.7, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -rise] }) },
          {
            translateX: t.interpolate({
              inputRange: [0, 0.25, 0.5, 0.75, 1],
              outputRange: [0, lane.side * lane.sway, 0, -lane.side * lane.sway, 0],
            }),
          },
          { scale: t.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0.5, 1, 0.92] }) },
        ],
      }}
    >
      {item.kind === "face" ? (
        <ReactionGlyph kind={item.face} size={34} />
      ) : (
        <View
          style={{
            maxWidth: screen.width * 0.7,
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 16,
            backgroundColor: item.mine ? "rgba(246,185,59,.85)" : "rgba(14,26,36,.62)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,.16)",
          }}
        >
          <Text style={{ color: item.mine ? "#0E1A24" : "#fff", fontSize: 13.5, fontWeight: "600", writingDirection: "auto" }}>
            {item.body}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

/**
 * حقلُ التعليق داخل صندوق التفاعل نفسه (القاعدة ٣٤٤) — لا بابٌ ثانٍ. يُرسل ويطير
 * التعليقُ لحظتَها، ويُقال تحته إنّه بلا اسم.
 */
export function CommentField({
  target,
  onFocus,
  onBlur,
  dark = true,
}: {
  target: Target;
  onFocus?: () => void;
  onBlur?: () => void;
  dark?: boolean;
}) {
  const client = useQueryClient();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const field = useRef<RNTextInput>(null);

  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const row = await api<FloatComment>(`${base(target)}/comments`, { method: "POST", body: JSON.stringify({ body }) });
      setText("");
      client.setQueryData<Floats>(["floats", target.kind, target.id], (old) =>
        old ? { ...old, comments: [...old.comments, row] } : { reactions: [], comments: [row] },
      );
      field.current?.blur();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "تعذّر الإرسال");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 4 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          height: 40,
          paddingStart: 14,
          paddingEnd: 4,
          borderRadius: 20,
          backgroundColor: dark ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.08)",
        }}
      >
        <TextInput
          ref={field}
          value={text}
          onChangeText={setText}
          onFocus={onFocus}
          onBlur={onBlur}
          maxLength={STATUS_COMMENT_MAX}
          placeholder="اكتب تعليق…"
          placeholderTextColor="rgba(255,255,255,.5)"
          returnKeyType="send"
          onSubmitEditing={() => void send()}
          style={{ flex: 1, color: "#fff", fontSize: 14 }}
        />
        <Pressable
          accessibilityLabel="أرسل"
          onPress={() => void send()}
          disabled={!text.trim() || busy}
          style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#F6B93B", opacity: text.trim() ? 1 : 0.4 }}
        >
          {busy ? <Spinner size="small" color="#0E1A24" /> : <SendIcon size={15} color="#0E1A24" />}
        </Pressable>
      </View>
      {problem ? <Text style={{ color: "#FF9C82", fontSize: 11.5, textAlign: "center" }}>{problem}</Text> : null}
    </View>
  );
}

/** تعليقاتُ ما نشرتُه — لصاحبها، وفي كلٍّ زرُّ حذف. والكاتبُ لا يُذكر. */
export function OwnerComments({ target, light = false }: { target: Target; light?: boolean }) {
  const client = useQueryClient();
  const data = useFloats(target).data;
  if (!data?.comments.length) return null;
  return (
    <View style={{ gap: 6, marginTop: 12 }}>
      <Text style={{ color: light ? colors.muted : "rgba(255,255,255,.6)", fontSize: 12, fontWeight: "700" }}>تعليقات بلا أسماء</Text>
      {data.comments.map((row) => (
        <View key={row.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 12, backgroundColor: light ? colors.paper : "rgba(255,255,255,.08)" }}>
          <Text style={{ flex: 1, color: light ? colors.ink : "#fff", fontSize: 13.5, writingDirection: "auto" }}>{row.body}</Text>
          {row.canDelete ? (
            <Pressable
              accessibilityLabel="احذف التعليق"
              hitSlop={8}
              onPress={() => {
                client.setQueryData<Floats>(["floats", target.kind, target.id], (old) =>
                  old ? { ...old, comments: old.comments.filter((c) => c.id !== row.id) } : old,
                );
                void api(`/v1/stories/comments/${row.id}`, { method: "DELETE" }).catch(() => undefined);
              }}
            >
              <Text style={{ color: "#FF9C82", fontSize: 12, fontWeight: "700" }}>حذف</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}
