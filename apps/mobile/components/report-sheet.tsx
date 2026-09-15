import { useState } from "react";
import { View, Text, Pressable, Modal, TextInput, ActivityIndicator } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { CloseIcon, ShieldIcon } from "./icons";
import { api } from "../lib/api";
import { colors } from "../theme/tokens";

/**
 * الإبلاغ — شرط متجر آبل: على **كل** منشور لا على الحساب وحده.
 *
 * سببٌ من قائمةٍ قصيرة ونصٌّ اختياريّ، ثم يقرؤه المشرف في اللوحة. ولا
 * حذفَ تلقائيّ ببلاغٍ واحد: الإبلاغ الذي يحذف يصير سلاحاً يُسكت به
 * الناسُ بعضهم.
 */
export type ReportTarget = "MOMENT" | "STORY" | "MESSAGE" | "USER";

const REASONS: { key: string; label: string }[] = [
  { key: "SPAM", label: "إزعاج أو إعلان" },
  { key: "HATE", label: "كراهية أو إساءة" },
  { key: "SEXUAL", label: "محتوى جنسي" },
  { key: "VIOLENCE", label: "عنف" },
  { key: "SELF_HARM", label: "إيذاء النفس" },
  { key: "OTHER", label: "شيء آخر" },
];

export function ReportButton({
  target,
  targetId,
  label = "بلاغ",
  tone = "quiet",
}: {
  target: ReportTarget;
  targetId: string;
  label?: string;
  /** الهادئ في شريط التفاعل، والظاهر في القصة والمحادثة. */
  tone?: "quiet" | "loud";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        accessibilityLabel="إبلاغ"
        onPress={() => setOpen(true)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
          height: 36,
          paddingHorizontal: 12,
          borderRadius: 999,
          borderWidth: tone === "loud" ? 1 : 0,
          borderColor: colors.line,
          backgroundColor: tone === "loud" ? colors.card : "transparent",
        }}
      >
        <ShieldIcon size={13} color={colors.muted} />
        <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{label}</Text>
      </Pressable>

      {open ? (
        <ReportSheet target={target} targetId={targetId} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function ReportSheet({
  target,
  targetId,
  onClose,
}: {
  target: ReportTarget;
  targetId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [said, setSaid] = useState<{ ok?: string; error?: string } | null>(null);

  const send = useMutation({
    mutationFn: () =>
      api<{ ok?: string }>("/v1/reports", {
        method: "POST",
        body: JSON.stringify({ target, targetId, reason, note: note.trim() || undefined }),
      }),
    onSuccess: (data) => setSaid({ ok: data.ok ?? "وصلنا بلاغك" }),
    onError: (problem) =>
      setSaid({ error: problem instanceof Error ? problem.message : "تعذّر الإرسال" }),
  });

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(14,26,36,.55)" }} onPress={onClose} />

      <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.ink, fontSize: 15.5, fontWeight: "700" }}>إبلاغ</Text>
            <Text style={{ color: colors.muted, fontSize: 11.5, marginTop: 2 }}>
              نقرأ كل بلاغ ونتصرّف — ولا يُحذف شيء بضغطة.
            </Text>
          </View>

          <Pressable
            onPress={onClose}
            accessibilityLabel="إغلاق"
            style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line }}
          >
            <CloseIcon size={16} color={colors.muted} />
          </Pressable>
        </View>

        {said?.ok ? (
          <View style={{ paddingVertical: 12 }}>
            <Text style={{ color: colors.clayInk, fontSize: 13, fontWeight: "600", textAlign: "center" }}>
              {said.ok}
            </Text>
            <Pressable onPress={onClose} style={{ marginTop: 14, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip }}>
              <Text style={{ color: colors.ink2, fontSize: 13.5, fontWeight: "600" }}>تمام</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {REASONS.map((one) => {
                const on = reason === one.key;
                return (
                  <Pressable
                    key={one.key}
                    onPress={() => setReason(one.key)}
                    style={{
                      height: 38,
                      paddingHorizontal: 14,
                      borderRadius: 999,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: on ? colors.clay : colors.line,
                      backgroundColor: on ? colors.clay : colors.paper,
                    }}
                  >
                    <Text style={{ color: on ? colors.onBrand : colors.ink2, fontSize: 12.5, fontWeight: "600" }}>
                      {one.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="تشرح أكثر؟ (اختياري)"
              placeholderTextColor={colors.faint}
              maxLength={500}
              multiline
              style={{ height: 86, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: 14, paddingTop: 12, fontSize: 13, lineHeight: 22, color: colors.ink, textAlign: "right", textAlignVertical: "top", marginBottom: 12 }}
            />

            {said?.error ? (
              <Text accessibilityRole="alert" style={{ color: colors.live, fontSize: 12, marginBottom: 8, textAlign: "right" }}>
                {said.error}
              </Text>
            ) : null}

            <Pressable
              disabled={!reason || send.isPending}
              onPress={() => {
                setSaid(null);
                send.mutate();
              }}
              style={{ height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.live, opacity: !reason || send.isPending ? 0.6 : 1 }}
            >
              {send.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>أرسل البلاغ</Text>
              )}
            </Pressable>
          </>
        )}
      </View>
    </Modal>
  );
}
