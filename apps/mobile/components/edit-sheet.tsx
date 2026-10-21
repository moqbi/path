import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { MOMENT_TEXT_MAX } from "@athar/shared";
import { Text, TextInput } from "./type";
import { GlassSheet } from "./glass-sheet";
import { PencilIcon } from "./icons";
import { api } from "../lib/api";
import { ar } from "../lib/format";
import { colors } from "../theme/tokens";

type Target = { kind: "moment" | "comment"; id: string; text: string; required?: boolean };

const useEditSheet = create<{ target: Target | null }>(() => ({ target: null }));

/**
 * تعديلُ نصّ لحظةٍ أو تعليق (القاعدة ٣١٩) — يُفتح بسحب صاحبها من اليسار إلى اليمين.
 * `required`: الخاطرةُ لا تُحفظ فارغةً، والصورةُ تُحفظ بلا نصّ.
 */
export const openEdit = (target: Target) => useEditSheet.setState({ target });

/** نافذةُ التعديل زجاجيّةٌ في الجذر (القاعدة ١٣٧). */
export function EditSheet() {
  const target = useEditSheet((s) => s.target);
  if (!target) return null;
  return <Body key={`${target.kind}:${target.id}`} target={target} close={() => useEditSheet.setState({ target: null })} />;
}

function Body({ target, close }: { target: Target; close: () => void }) {
  const client = useQueryClient();
  const [text, setText] = useState(target.text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const max = target.kind === "moment" ? MOMENT_TEXT_MAX : 500;
  const clean = text.trim();
  const ready = clean !== target.text.trim() && (clean.length > 0 || !target.required);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api(target.kind === "moment" ? `/v1/moments/${target.id}` : `/v1/comments/${target.id}`, {
        method: "PATCH",
        body: JSON.stringify(target.kind === "moment" ? { text: clean } : { body: clean }),
      });
      for (const key of [["feed"], ["moment"], ["user"], ["me", "moments"]]) {
        void client.invalidateQueries({ queryKey: key });
      }
      close();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <GlassSheet
      icon={<PencilIcon size={20} color="#fff" />}
      title={target.kind === "moment" ? "عدّل لحظتك" : "عدّل تعليقك"}
      subtitle="يظهر «عُدّلت» بجانبها لمن يراها"
      onClose={close}
    >
      <View style={{ paddingBottom: 8, gap: 10 }}>
        <TextInput
          value={text}
          onChangeText={(value) => setText(value.slice(0, max))}
          autoFocus
          multiline
          placeholder={target.kind === "moment" ? "اكتب شيئاً…" : "تعليقك…"}
          placeholderTextColor="rgba(255,255,255,.45)"
          accessibilityLabel="النصّ"
          style={{
            minHeight: 96,
            maxHeight: 220,
            borderRadius: 16,
            backgroundColor: "rgba(255,255,255,.1)",
            paddingHorizontal: 16,
            paddingVertical: 12,
            fontSize: 14.5,
            lineHeight: 24,
            color: "#fff",
            textAlignVertical: "top",
            textAlign: "right",
          }}
        />
        <Text style={{ color: "rgba(255,255,255,.5)", fontSize: 11, textAlign: "left" }}>
          {ar(text.length)} / {ar(max)}
        </Text>
        {error ? <Text style={{ color: "#FF9C84", fontSize: 12.5, textAlign: "center" }}>{error}</Text> : null}
        <Pressable
          disabled={!ready || busy}
          onPress={() => void save()}
          style={{
            height: 48,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.clay,
            opacity: !ready || busy ? 0.5 : 1,
          }}
        >
          {busy ? (
            <ActivityIndicator color={colors.onBrand} />
          ) : (
            <Text style={{ color: colors.onBrand, fontSize: 14.5, fontWeight: "700" }}>احفظ التعديل</Text>
          )}
        </Pressable>
      </View>
    </GlassSheet>
  );
}
