import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { Text, TextInput } from "./type";
import { GlassSheet } from "./glass-sheet";
import { ReactionGlyph, facesFor, CUSTOM, EMOJI_GROUPS } from "./reactions";
import { EyeIcon, LockIcon, TrashIcon, UnlockIcon } from "./icons";
import { ReportButton } from "./report-sheet";
import { api } from "../lib/api";
import { ar } from "../lib/format";
import { useAudience, useComment, useLockComments, useReact } from "../lib/queries";
import { colors } from "../theme/tokens";

type Mine = { kind: string; emoji: string | null } | null;

export type ReactTarget = {
  momentId: string;
  momentKind?: string;
  mine: Mine;
  isPlus: boolean;
  author: boolean;
  moderate: boolean;
  locked: boolean;
};

const useTarget = create<{ target: ReactTarget | null }>(() => ({ target: null }));

/** يفتح لوحة التفاعل لهذه اللحظة — من زرّ البطاقة (`MomentBar`). */
export const openReactSheet = (target: ReactTarget | null) => useTarget.setState({ target });

/**
 * لوحةُ التفاعل نافذةٌ زجاجيّة (القاعدة ٢٤٧) — **بقرار المالك**، بهيئة «من كان
 * هنا» (القاعدة ٢٣٠): كانت تنفتح داخل البطاقة فتدفع ما تحتها وتزاحم المتن —
 * وجوهٌ وإيموجي وحقلُ تعليقٍ وحذفٌ في صندوقٍ يكبر في وسط الخطّ الزمنيّ. الآن
 * البطاقةُ لا تتحرّك، وما يُفعل باللحظة كلُّه في النافذة: الوجوه الخمسة
 * (القاعدة ٣) والإيموجي الحرّ لمشتركي آثار+، والتعليقُ وإرسالُه، والبلاغ،
 * والحذفُ لصاحبها أو بصلاحية الإشراف — ولصاحبها قفلُ التعليقات ومشاهداتُها.
 *
 * وتُركَّب في الجذر (القاعدة ١٣٧): داخل البطاقة جدُّها «اسحب للتحديث».
 */
export function ReactSheet() {
  const target = useTarget((s) => s.target);
  if (!target) return null;
  // مفتاحٌ لكلّ لحظة: حالةُ الحقل لا تنتقل من لحظةٍ إلى أخرى.
  return <Body key={target.momentId} target={target} close={() => openReactSheet(null)} />;
}

function Body({ target, close }: { target: ReactTarget; close: () => void }) {
  const { momentId, momentKind, mine, isPlus, author, moderate } = target;
  const router = useRouter();
  const client = useQueryClient();
  const [board, setBoard] = useState(false);
  const [asking, setAsking] = useState(false);
  const [body, setBody] = useState("");

  const react = useReact(momentId);
  const comment = useComment(momentId);
  const audience = useAudience(momentId, author);
  const lock = useLockComments(momentId);
  const locked = author ? (audience.data?.commentsLocked ?? target.locked) : target.locked;

  const remove = useMutation({
    mutationFn: () =>
      api(author ? `/v1/moments/${momentId}` : `/v1/moderation/moments/${momentId}`, { method: "DELETE" }),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ["feed"] });
      void client.invalidateQueries({ queryKey: ["me", "moments"] });
      void client.invalidateQueries({ queryKey: ["user"] });
    },
  });

  function choose(kind: string, emoji?: string) {
    // الوجهُ فعلٌ كامل بنفسه: يُختار فتُغلق النافذة.
    close();
    react.mutate({ kind, emoji });
  }

  function send() {
    const text = body.trim();
    if (!text) return;
    setBody("");
    close();
    comment.mutate(text);
  }

  const faces = facesFor(momentKind);
  const pending = comment.isPending || remove.isPending;

  return (
    <GlassSheet
      title={author ? "لحظتك" : "تفاعل"}
      subtitle={author ? "قفلُ التعليقات ومن شاهدها" : locked ? "التعليقات مقفلة — التفاعل مفتوح" : "وجهٌ أو تعليق"}
      onClose={close}
    >
      <ScrollView
        style={{ flexGrow: 0 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, gap: 14 }}
      >
        {author ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: locked }}
              accessibilityLabel={locked ? "افتح التعليقات" : "أقفل التعليقات"}
              onPress={() => lock.mutate(!locked)}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                height: 48,
                borderRadius: 24,
                backgroundColor: locked ? "rgba(246,185,59,.22)" : "rgba(255,255,255,.1)",
              }}
            >
              {locked ? <LockIcon size={16} color={colors.gold} /> : <UnlockIcon size={16} color="#fff" />}
              <Text style={{ color: locked ? colors.gold : "#fff", fontSize: 13.5, fontWeight: "700" }}>
                {locked ? "التعليقات مقفلة" : "التعليقات مفتوحة"}
              </Text>
            </Pressable>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 48, paddingHorizontal: 16, borderRadius: 24, backgroundColor: "rgba(255,255,255,.1)" }}>
              <EyeIcon size={16} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 13.5, fontWeight: "700" }}>
                {audience.data ? ar(audience.data.views) : "…"}
              </Text>
            </View>
          </View>
        ) : (
          <>
            {/* الوجوه الخمسة كبيرةً — القاعدة ٣ — والمختارُ في قرصٍ مضيء. */}
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              {faces.map((kind) => {
                const on = mine?.kind === kind;
                return (
                  <Pressable
                    key={kind}
                    accessibilityLabel={kind}
                    onPress={() => choose(kind)}
                    style={({ pressed }) => ({
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: on ? "rgba(246,185,59,.3)" : pressed ? "rgba(255,255,255,.16)" : "rgba(255,255,255,.08)",
                      transform: [{ scale: pressed ? 1.12 : 1 }],
                    })}
                  >
                    <ReactionGlyph kind={kind} size={36} />
                  </Pressable>
                );
              })}
            </View>

            {/* الإيموجي الحرّ — لمشتركي آثار+، ولغيرهم بابُ الاشتراك. */}
            {isPlus ? (
              <View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  {CUSTOM.slice(0, 6).map((emoji) => (
                    <Pressable
                      key={emoji}
                      onPress={() => choose("CUSTOM", emoji)}
                      style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: mine?.emoji === emoji ? "rgba(246,185,59,.3)" : "transparent" }}
                    >
                      <Text style={{ fontSize: 22 }}>{emoji}</Text>
                    </Pressable>
                  ))}
                  <Pressable
                    accessibilityLabel="كل الإيموجي"
                    onPress={() => setBoard((v) => !v)}
                    style={{ marginLeft: "auto", height: 36, paddingHorizontal: 12, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.1)" }}
                  >
                    <Text style={{ color: "#fff", fontSize: 12.5, fontWeight: "700" }}>{board ? "إخفاء" : "كل الإيموجي"}</Text>
                  </Pressable>
                </View>
                {board ? (
                  <ScrollView
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    style={{ maxHeight: 220, marginTop: 8, borderRadius: 18, backgroundColor: "rgba(255,255,255,.07)" }}
                    contentContainerStyle={{ padding: 6 }}
                  >
                    {EMOJI_GROUPS.map((group) => (
                      <View key={group.label}>
                        <Text style={{ color: "rgba(255,255,255,.55)", fontSize: 10.5, fontWeight: "600", padding: 4 }}>{group.label}</Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                          {group.items.map((emoji) => (
                            <Pressable
                              key={`${group.label}:${emoji}`}
                              onPress={() => choose("CUSTOM", emoji)}
                              style={{ width: "12.5%", height: 38, alignItems: "center", justifyContent: "center" }}
                            >
                              <Text style={{ fontSize: 21 }}>{emoji}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                ) : null}
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  close();
                  router.push("/subscribe" as never);
                }}
                style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: "rgba(246,185,59,.14)", alignSelf: "flex-start" }}
              >
                <LockIcon size={14} color={colors.gold} />
                <Text style={{ color: colors.gold, fontSize: 12.5, fontWeight: "700" }}>كل الإيموجي مع آثار+</Text>
              </Pressable>
            )}
          </>
        )}

        {/* التعليق — أو سطرُ القفل لغير صاحبها. */}
        {locked && !author ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: "rgba(255,255,255,.07)" }}>
            <LockIcon size={14} color="rgba(255,255,255,.6)" />
            <Text style={{ color: "rgba(255,255,255,.7)", fontSize: 12.5, fontWeight: "600" }}>أقفل صاحبُ اللحظة التعليقات</Text>
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder={author ? "علّق على لحظتك…" : "اكتب تعليقك…"}
              placeholderTextColor="rgba(255,255,255,.45)"
              maxLength={500}
              multiline
              accessibilityLabel="تعليق"
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 46,
                maxHeight: 120,
                borderRadius: 23,
                backgroundColor: "rgba(255,255,255,.1)",
                paddingHorizontal: 16,
                paddingTop: 13,
                paddingBottom: 13,
                fontSize: 14,
                color: "#fff",
              }}
            />
            <Pressable
              disabled={!body.trim() || pending}
              onPress={send}
              style={{
                height: 46,
                paddingHorizontal: 18,
                borderRadius: 23,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: body.trim() ? colors.clay : "rgba(255,255,255,.1)",
              }}
            >
              {comment.isPending ? (
                <ActivityIndicator size="small" color={colors.onBrand} />
              ) : (
                <Text style={{ color: body.trim() ? colors.onBrand : "rgba(255,255,255,.45)", fontSize: 13.5, fontWeight: "700" }}>إرسال</Text>
              )}
            </Pressable>
          </View>
        )}

        {/* البلاغُ لغير صاحبها، والمشرفُ لا يُبلغ بل يحكم (القاعدة ١٣٦). */}
        {author || moderate ? (
          asking ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ flex: 1, color: "#fff", fontSize: 13, fontWeight: "600" }}>
                {author ? "تحذف اللحظة؟ تذهب معها التفاعلات والتعليقات." : "تحذفها بصلاحية الإشراف؟ يُكتب في السجلّ باسمك."}
              </Text>
              <Pressable
                disabled={pending}
                onPress={() => {
                  close();
                  remove.mutate();
                }}
                style={{ height: 38, paddingHorizontal: 16, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: colors.live }}
              >
                <Text style={{ color: "#fff", fontSize: 12.5, fontWeight: "700" }}>احذفها</Text>
              </Pressable>
              <Pressable onPress={() => setAsking(false)} style={{ height: 38, paddingHorizontal: 10, justifyContent: "center" }}>
                <Text style={{ color: "rgba(255,255,255,.7)", fontSize: 12.5, fontWeight: "600" }}>تراجع</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => setAsking(true)}
              style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: "rgba(255,122,90,.14)", alignSelf: "flex-start" }}
            >
              <TrashIcon size={15} color="#ff9d84" />
              <Text style={{ color: "#ff9d84", fontSize: 13, fontWeight: "700" }}>
                {author ? "احذف اللحظة" : "احذفها بصلاحية الإشراف"}
              </Text>
            </Pressable>
          )
        ) : (
          <View style={{ alignSelf: "flex-start" }}>
            <ReportButton target="MOMENT" targetId={momentId} tone="glass" />
          </View>
        )}
      </ScrollView>
    </GlassSheet>
  );
}
