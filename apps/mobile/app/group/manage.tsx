import { useEffect, useState } from "react";
import { View, ScrollView, Pressable, ActivityIndicator, Alert } from "react-native";
import { Text, TextInput } from "../../components/type";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "../../components/avatar";
import { ScreenHeader } from "../../components/screen-header";
import { CloseIcon, PlusIcon } from "../../components/icons";
import { api } from "../../lib/api";
import { keys } from "../../lib/queries";
import { useSession } from "../../lib/session";
import { ar } from "../../lib/format";
import type { GroupPerson, GroupThread } from "../../lib/groups";
import { colors } from "../../theme/tokens";

const NAME_MAX = 60;

/** صفُّ شخصٍ: صورةٌ واسمٌ ورقمُ عضويّة، وفعلٌ في طرفه. */
function PersonRow({ person, action }: { person: GroupPerson; action?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 9 }}>
      <Avatar name={person.name} size={38} mediaId={person.avatarMediaId} frame={person.frame} charm={person.charm} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 14, fontWeight: "600", writingDirection: "auto" }}>
          {person.name}
        </Text>
        <Text style={{ color: colors.faint, fontSize: 11 }}>#{ar(person.memberNo)}</Text>
      </View>
      {action}
    </View>
  );
}

function Round({ label, onPress, tone }: { label: string; onPress: () => void; tone: "add" | "remove" }) {
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: tone === "add" ? colors.clay : colors.line,
        backgroundColor: tone === "add" ? colors.claySoft : colors.card,
      }}
    >
      {tone === "add" ? <PlusIcon size={15} color={colors.clayInk} /> : <CloseIcon size={14} color={colors.live} />}
    </Pressable>
  );
}

/**
 * إنشاءُ المجموعة وإدارتُها (القاعدة ٢١٥) — شاشةٌ واحدة بوجهين.
 *
 * بلا `id` إنشاءٌ: اسمٌ وأعضاءٌ يُضافون برقم العضويّة — للمشرف وحده، فلا ينقض
 * منعَ البحث عن الناس (القاعدة ٢٠). وبـ`id` الأعضاءُ
 * لكل عضو، ومعهم للمشرف: إعادةُ التسمية، والإضافةُ والإخراج، وحذفُ المجموعة.
 * ولغيره «غادر».
 */
export default function ManageGroup() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const me = useSession((s) => s.me);
  const router = useRouter();
  const client = useQueryClient();
  const insets = useSafeAreaInsets();

  const editing = Boolean(id);
  const group = useQuery({
    queryKey: keys.group(id ?? "new"),
    queryFn: () => api<GroupThread>(`/v1/groups/${id}?limit=1`),
    enabled: editing,
  });

  const canManage = editing ? Boolean(group.data?.canManage) : Boolean(me?.canGroups);

  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [needle, setNeedle] = useState("");
  const [picked, setPicked] = useState<GroupPerson[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (group.data) setName(group.data.name);
  }, [group.data?.name]);

  // البحثُ بعد أن يقف الإصبع.
  useEffect(() => {
    const timer = setTimeout(() => setNeedle(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const candidates = useQuery({
    queryKey: ["groups", "candidates", needle],
    queryFn: () =>
      api<{ people: GroupPerson[]; missing: number[] }>(`/v1/groups/candidates?q=${encodeURIComponent(needle)}`),
    enabled: canManage && needle.length > 0,
  });

  const inGroup = new Set([...(group.data?.members ?? []).map((p) => p.id), ...picked.map((p) => p.id)]);
  const offered = needle ? (candidates.data?.people ?? []).filter((p) => !inGroup.has(p.id)) : [];
  const missing = needle ? (candidates.data?.missing ?? []) : [];

  const refresh = () => void client.invalidateQueries({ queryKey: keys.dm });
  const fail = (problem: Error) => setError(problem.message);

  const create = useMutation({
    mutationFn: () =>
      api<{ id: string }>("/v1/groups", {
        method: "POST",
        body: JSON.stringify({ name, memberIds: picked.map((p) => p.id) }),
      }),
    onSuccess: (row) => {
      refresh();
      router.replace(`/group/${row.id}` as never);
    },
    onError: fail,
  });

  const rename = useMutation({
    mutationFn: () => api(`/v1/groups/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError: fail,
  });

  const add = useMutation({
    mutationFn: (ids: string[]) =>
      api(`/v1/groups/${id}/members`, { method: "POST", body: JSON.stringify({ ids }) }),
    onSuccess: () => {
      setPicked([]);
      refresh();
    },
    onError: fail,
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) => api(`/v1/groups/${id}/members/${userId}`, { method: "DELETE" }),
    onSuccess: (_result, userId) => {
      refresh();
      if (userId === me?.id) router.replace("/messages" as never);
    },
    onError: fail,
  });

  const destroy = useMutation({
    mutationFn: () => api(`/v1/groups/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      refresh();
      router.replace("/messages" as never);
    },
    onError: fail,
  });

  if (editing && group.isLoading) {
    return (
      <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.ground }}>
        <ScreenHeader title="المجموعة" back="/messages" />
        <ActivityIndicator style={{ marginTop: 50 }} color={colors.clay} />
      </SafeAreaView>
    );
  }

  const members = group.data?.members ?? [];
  const nameChanged = editing && name.trim() !== (group.data?.name ?? "");

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.ground }}>
      <ScreenHeader title={editing ? "المجموعة" : "مجموعة جديدة"} back={editing ? `/group/${id}` : "/messages"} />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, paddingBottom: Math.max(insets.bottom, 20) + 20, gap: 18 }}
      >
        {/* الاسم: يكتبه المشرف ويُقرأ لغيره. */}
        {canManage ? (
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>اسم المجموعة</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <TextInput
                value={name}
                onChangeText={setName}
                maxLength={NAME_MAX}
                placeholder="مثلاً: فريق التجارب"
                placeholderTextColor={colors.faint}
                style={{ flex: 1, minWidth: 0, height: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, paddingHorizontal: 14, fontSize: 14, color: colors.ink, textAlign: "right" }}
              />
              {nameChanged ? (
                <Pressable
                  disabled={rename.isPending || !name.trim()}
                  onPress={() => rename.mutate()}
                  style={{ height: 46, paddingHorizontal: 16, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay }}
                >
                  <Text style={{ color: colors.onBrand, fontSize: 13, fontWeight: "700" }}>حفظ</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : (
          <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "700", textAlign: "center" }}>{group.data?.name}</Text>
        )}

        {/* الأعضاء الحاليّون. */}
        {editing ? (
          <View>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", marginBottom: 4 }}>
              الأعضاء ({ar(members.length)})
            </Text>
            {members.map((person) => (
              <PersonRow
                key={person.id}
                person={person}
                action={
                  canManage && person.id !== me?.id ? (
                    <Round
                      label={`أخرج ${person.name}`}
                      tone="remove"
                      onPress={() =>
                        Alert.alert(`إخراج ${person.name}؟`, undefined, [
                          { text: "إلغاء", style: "cancel" },
                          { text: "أخرج", style: "destructive", onPress: () => removeMember.mutate(person.id) },
                        ])
                      }
                    />
                  ) : null
                }
              />
            ))}
          </View>
        ) : null}

        {/* المختارون قبل الإنشاء أو قبل الإضافة. */}
        {picked.length > 0 ? (
          <View>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", marginBottom: 4 }}>
              {editing ? "سيُضافون" : "الأعضاء"} ({ar(picked.length)})
            </Text>
            {picked.map((person) => (
              <PersonRow
                key={person.id}
                person={person}
                action={
                  <Round
                    label={`أزل ${person.name}`}
                    tone="remove"
                    onPress={() => setPicked((list) => list.filter((p) => p.id !== person.id))}
                  />
                }
              />
            ))}
            {editing ? (
              <Pressable
                disabled={add.isPending}
                onPress={() => add.mutate(picked.map((p) => p.id))}
                style={{ marginTop: 6, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay }}
              >
                <Text style={{ color: colors.onBrand, fontSize: 13.5, fontWeight: "700" }}>
                  أضفهم ({ar(picked.length)})
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/*
          الإضافةُ برقم العضويّة — **بقرار المالك**: رقمٌ أو أكثر يفصلها فراغ أو
          فاصلة («١٢ ٣٤ ٥٦»)، فتظهر أصحابُها ويُضافون بضغطة. ورقمٌ بلا حسابٍ يُقال.
        */}
        {canManage ? (
          <View>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", marginBottom: 8 }}>
              أضف أعضاء برقم العضوية
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 46, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card }}>
              <Text style={{ color: colors.muted, fontSize: 15, fontWeight: "700" }}>#</Text>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="مثلاً: ١٢ ٣٤ ٥٦"
                placeholderTextColor={colors.faint}
                keyboardType="numbers-and-punctuation"
                returnKeyType="done"
                style={{ flex: 1, color: colors.ink, fontSize: 15, textAlign: "right" }}
              />
            </View>
            <Text style={{ color: colors.faint, fontSize: 11, marginTop: 6 }}>
              أكثر من رقم؟ افصل بينها بمسافة أو فاصلة.
            </Text>

            {needle && candidates.isFetching && offered.length === 0 ? (
              <ActivityIndicator style={{ marginTop: 14 }} color={colors.clay} />
            ) : null}

            {offered.map((person) => (
              <PersonRow
                key={person.id}
                person={person}
                action={
                  <Round
                    label={`أضف ${person.name}`}
                    tone="add"
                    onPress={() => setPicked((list) => [...list, person])}
                  />
                }
              />
            ))}

            {offered.length > 1 ? (
              <Pressable
                onPress={() => {
                  setPicked((list) => [...list, ...offered]);
                  setQuery("");
                }}
                style={{ marginTop: 4, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.clay, backgroundColor: colors.claySoft }}
              >
                <Text style={{ color: colors.clayInk, fontSize: 13, fontWeight: "700" }}>
                  اختر الكل ({ar(offered.length)})
                </Text>
              </Pressable>
            ) : null}

            {missing.length > 0 ? (
              <Text style={{ color: colors.live, fontSize: 12, marginTop: 8 }}>
                لا حساب بالرقم {missing.map((n) => `#${ar(n)}`).join("، ")}
              </Text>
            ) : null}
          </View>
        ) : null}

        {error ? (
          <Text accessibilityRole="alert" style={{ color: colors.live, fontSize: 12, textAlign: "center" }}>
            {error}
          </Text>
        ) : null}

        {!editing ? (
          <Pressable
            disabled={create.isPending || !name.trim() || picked.length === 0}
            onPress={() => {
              setError(null);
              create.mutate();
            }}
            style={{
              height: 50,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.clay,
              opacity: create.isPending || !name.trim() || picked.length === 0 ? 0.5 : 1,
            }}
          >
            {create.isPending ? (
              <ActivityIndicator color={colors.onBrand} />
            ) : (
              <Text style={{ color: colors.onBrand, fontSize: 14.5, fontWeight: "700" }}>أنشئ المجموعة</Text>
            )}
          </Pressable>
        ) : canManage ? (
          <Pressable
            onPress={() =>
              Alert.alert("حذف المجموعة؟", "تُحذف رسائلها عند الجميع.", [
                { text: "إلغاء", style: "cancel" },
                { text: "احذف", style: "destructive", onPress: () => destroy.mutate() },
              ])
            }
            style={{ height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.live }}
          >
            <Text style={{ color: colors.live, fontSize: 13.5, fontWeight: "700" }}>احذف المجموعة</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() =>
              Alert.alert("مغادرة المجموعة؟", undefined, [
                { text: "إلغاء", style: "cancel" },
                { text: "غادر", style: "destructive", onPress: () => me && removeMember.mutate(me.id) },
              ])
            }
            style={{ height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.live }}
          >
            <Text style={{ color: colors.live, fontSize: 13.5, fontWeight: "700" }}>غادر المجموعة</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
