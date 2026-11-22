import { Spinner } from "../../components/spinner";
import { useEffect, useState } from "react";
import { View, ScrollView, Pressable, Alert } from "react-native";
import { Text, TextInput } from "../../components/type";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "../../components/avatar";
import { ScreenHeader } from "../../components/screen-header";
import { CameraIcon, CloseIcon, CrownIcon, MuteIcon, PlusIcon, UserMinusIcon } from "../../components/icons";
import { SwipeRow } from "../../components/swipe-row";
import * as Picker from "expo-image-picker";
import { GroupFace } from "../../components/group-face";
import { uploadFile } from "../../lib/upload";
import { api } from "../../lib/api";
import { keys, useCircle } from "../../lib/queries";
import { useAddFriend } from "../../lib/add-friend";
import { useSession } from "../../lib/session";
import { ar } from "../../lib/format";
import { RANK, type GroupPerson, type GroupRole, type GroupThread } from "../../lib/groups";
import { colors } from "../../theme/tokens";

const NAME_MAX = 60;

/** لونُ تاج المدير — غيرُ لون اللمسة الذي للمالك (القاعدة ٤٧٥). */
const ADMIN_CROWN = "#4E8FD8";

/** تاجُ الرتبة بجانب الاسم: المالكُ باللمسة، والمديرُ بلونٍ آخر، والمشرفُ مفرَّغ. */
export function RoleCrown({ role, size = 15 }: { role?: GroupRole; size?: number }) {
  if (role === "OWNER") return <CrownIcon size={size} color={colors.clay} />;
  if (role === "ADMIN") return <CrownIcon size={size} color={ADMIN_CROWN} />;
  if (role === "MODERATOR") return <CrownIcon size={size} color={colors.groundInk} hollow />;
  return null;
}

const ROLE_LABEL: Record<GroupRole, string> = { OWNER: "المالك", ADMIN: "مدير", MODERATOR: "مشرف", MEMBER: "" };

/** صفُّ شخصٍ: صورةٌ واسمٌ ورقمُ عضويّة، وفعلٌ في طرفه. */
function PersonRow({ person, action, onOpen }: { person: GroupPerson; action?: React.ReactNode; onOpen?: () => void }) {
  return (
    <Pressable disabled={!onOpen} onPress={onOpen} style={{ flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 9 }}>
      <Avatar name={person.name} size={38} mediaId={person.avatarMediaId} frame={person.frame} charm={person.charm} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text numberOfLines={1} style={{ flexShrink: 1, color: colors.groundInk, fontSize: 14, fontWeight: "600", writingDirection: "auto" }}>
            {person.name}
          </Text>
          <RoleCrown role={person.role} />
          {person.muted ? <MuteIcon size={14} color={colors.groundInk} /> : null}
        </View>
        <Text style={{ color: colors.groundInk, fontSize: 11 }}>
          #{ar(person.memberNo)}
          {person.role && person.role !== "MEMBER" ? ` · ${ROLE_LABEL[person.role]}` : ""}
          {person.muted ? " · مكتوم" : ""}
        </Text>
      </View>
      {action}
    </Pressable>
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

  const circle = useCircle();
  const friendIds = new Set((circle.data?.members ?? []).map((m) => m.id));
  const { add: befriend, done, error: addError } = useAddFriend();

  const canManage = editing ? Boolean(group.data?.canManage) : Boolean(me?.canGroups);

  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [needle, setNeedle] = useState("");
  const [picked, setPicked] = useState<GroupPerson[]>([]);
  const [error, setError] = useState<string | null>(null);
  /*
    صورةُ المجموعة (القاعدة ٢٤١): تُرفع ساعةَ تُختار، وتُثبَّت للمجموعة القائمة في
    الحال، وللجديدة بعد إنشائها — لا مجموعةَ بعدُ تُعلَّق عليها.
  */
  const [photo, setPhoto] = useState<string | null | undefined>(undefined);
  const [uploading, setUploading] = useState(false);

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
    mutationFn: async () => {
      const row = await api<{ id: string }>("/v1/groups", {
        method: "POST",
        body: JSON.stringify({ name, memberIds: picked.map((p) => p.id) }),
      });
      // الصورةُ بعد الإنشاء: فشلُها لا يُلغي مجموعةً قامت — تُختار ثانيةً من إدارتها.
      if (photo) {
        await api(`/v1/groups/${row.id}/photo`, { method: "PUT", body: JSON.stringify({ mediaId: photo }) }).catch(() => undefined);
      }
      return row;
    },
    onSuccess: (row) => {
      refresh();
      router.replace(`/group/${row.id}` as never);
    },
    onError: fail,
  });

  const savePhoto = useMutation({
    mutationFn: (mediaId: string | null) =>
      api(`/v1/groups/${id}/photo`, { method: "PUT", body: JSON.stringify({ mediaId }) }),
    onSuccess: () => {
      setError(null);
      setPhoto(undefined);
      void client.invalidateQueries({ queryKey: keys.group(id ?? "new") });
      void client.invalidateQueries({ queryKey: keys.groups });
    },
    onError: fail,
  });

  async function pickPhoto() {
    setError(null);
    const granted = await Picker.requestMediaLibraryPermissionsAsync();
    if (!granted.granted) {
      setError("لازم تسمح بالوصول لألبومك.");
      return;
    }
    const result = await Picker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const mediaId = await uploadFile(asset.uri, asset.mimeType ?? "image/jpeg", "MESSAGE", asset);
      setPhoto(mediaId);
      if (editing) savePhoto.mutate(mediaId);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "تعذّر رفع الصورة");
    } finally {
      setUploading(false);
    }
  }

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

  // الرتبةُ والكتم (القاعدة ٤٧٥) — والخادمُ يفحص من فوق من.
  const setRole = useMutation({
    mutationFn: (input: { userId: string; role: "ADMIN" | "MODERATOR" | "MEMBER" }) =>
      api(`/v1/groups/${id}/members/${input.userId}/role`, { method: "PUT", body: JSON.stringify({ role: input.role }) }),
    onSuccess: () => {
      setError(null);
      void client.invalidateQueries({ queryKey: keys.group(id ?? "new") });
    },
    onError: fail,
  });
  const setMuted = useMutation({
    mutationFn: (input: { userId: string; muted: boolean }) =>
      api(`/v1/groups/${id}/members/${input.userId}/mute`, { method: "PUT", body: JSON.stringify({ muted: input.muted }) }),
    onSuccess: () => {
      setError(null);
      void client.invalidateQueries({ queryKey: keys.group(id ?? "new") });
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
        <Spinner style={{ marginTop: 50 }} color={colors.clay} />
      </SafeAreaView>
    );
  }

  const members = group.data?.members ?? [];
  // رتبتي ورتبةُ كلّ عضو (القاعدة ٤٧٥): لا يمسّ أحدٌ من هو في رتبته أو فوقه.
  const myRank = group.data?.myRank ?? (group.data?.canManage ? 4 : 0);
  const rankOf = (person: GroupPerson) => (person.role ? RANK[person.role] : person.id === group.data?.ownerId ? 3 : 0);
  const nameChanged = editing && name.trim() !== (group.data?.name ?? "");

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.ground }}>
      <ScreenHeader title={editing ? "المجموعة" : "مجموعة جديدة"} back={editing ? `/group/${id}` : "/messages"} />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, paddingBottom: Math.max(insets.bottom, 20) + 20, gap: 18 }}
      >
        {/* الصورة: يختارها المشرف ويراها الأعضاء (القاعدة ٢٤١). */}
        <View style={{ alignItems: "center", gap: 8 }}>
          <Pressable
            disabled={!canManage || uploading || savePhoto.isPending}
            onPress={() => void pickPhoto()}
            accessibilityLabel="صورة المجموعة"
          >
            <GroupFace photoMediaId={photo !== undefined ? photo : group.data?.photoMediaId} size={92} />
            {canManage ? (
              <View
                style={{
                  position: "absolute",
                  right: -2,
                  bottom: -2,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.night,
                  borderWidth: 2,
                  borderColor: colors.ground,
                }}
              >
                {uploading || savePhoto.isPending ? (
                  <Spinner size="small" color="#f7f5ef" />
                ) : (
                  <CameraIcon size={15} color="#f7f5ef" />
                )}
              </View>
            ) : null}
          </Pressable>
          {canManage && (photo ?? group.data?.photoMediaId) ? (
            <Pressable
              hitSlop={8}
              disabled={savePhoto.isPending}
              onPress={() => (editing ? savePhoto.mutate(null) : setPhoto(null))}
            >
              <Text style={{ color: colors.groundInk, fontSize: 12, fontWeight: "700" }}>إزالة الصورة</Text>
            </Pressable>
          ) : null}
        </View>

        {/* الاسم: يكتبه المشرف ويُقرأ لغيره. */}
        {canManage ? (
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.groundInk, fontSize: 12, fontWeight: "700" }}>اسم المجموعة</Text>
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
          <Text style={{ color: colors.groundInk, fontSize: 18, fontWeight: "700", textAlign: "center" }}>{group.data?.name}</Text>
        )}

        {/* الأعضاء الحاليّون. */}
        {editing ? (
          <View>
            <Text style={{ color: colors.groundInk, fontSize: 12, fontWeight: "700", marginBottom: 4 }}>
              الأعضاء ({ar(members.length)})
            </Text>
            {members.length > 1 && myRank >= 1 ? (
              <Text style={{ color: colors.groundInk, fontSize: 11, marginBottom: 6 }}>
                اسحب العضو من اليسار إلى اليمين: إخراجٌ وكتمٌ ورتبة.
              </Text>
            ) : null}
            {members.map((person) => {
              const row = (
                <PersonRow
                  person={person}
                  onOpen={person.id !== me?.id ? () => router.push(`/u/${person.id}` as never) : undefined}
                  action={
                    /* أعضاءُ المجموعة يُضيف بعضُهم بعضاً (القاعدة ٢٨٠) — طلبٌ يُقبل أو يُترك. */
                    person.id !== me?.id && !friendIds.has(person.id) ? (
                      <Pressable
                        disabled={Boolean(done[person.id]) || (befriend.isPending && befriend.variables === person.id)}
                        onPress={() => befriend.mutate(person.id)}
                        hitSlop={6}
                        style={{
                          height: 32,
                          paddingHorizontal: 12,
                          borderRadius: 16,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: done[person.id] ? colors.paper : colors.claySoft,
                          borderWidth: 1,
                          borderColor: done[person.id] ? colors.line : colors.clay,
                        }}
                      >
                        <Text style={{ color: done[person.id] ? colors.muted : colors.clayInk, fontSize: 12, fontWeight: "700" }}>
                          {done[person.id] === "friend" ? "صديقك" : done[person.id] ? "أُرسل" : "أضف"}
                        </Text>
                      </Pressable>
                    ) : null
                  }
                />
              );
              const target = rankOf(person);
              // من فوقه وحده (القاعدة ٤٧٥): المشرفُ فما فوق يُخرج ويكتم، والمديرُ يعيّن المشرف، والمالكُ المدير.
              if (person.id === me?.id || myRank < 1 || myRank <= target) return <View key={person.id}>{row}</View>;
              const moderator = person.role === "MODERATOR";
              const admin = person.role === "ADMIN";
              return (
                <SwipeRow
                  key={person.id}
                  width={60}
                  radius={14}
                  surface={colors.groundSolid}
                  onSwiping={() => undefined}
                  confirmLabel={`أخرج ${person.name}`}
                  onDelete={() =>
                    Alert.alert(`إخراج ${person.name}؟`, undefined, [
                      { text: "إلغاء", style: "cancel" },
                      { text: "أخرج", style: "destructive", onPress: () => removeMember.mutate(person.id) },
                    ])
                  }
                  onSecond={() => setMuted.mutate({ userId: person.id, muted: !person.muted })}
                  secondLabel={person.muted ? `ارفع الكتم عن ${person.name}` : `اكتم ${person.name}`}
                  secondTint={colors.night}
                  lead={
                    myRank >= 2 && !admin
                      ? {
                          label: moderator ? `أزل الإشراف عن ${person.name}` : `اجعل ${person.name} مشرفاً`,
                          run: () => setRole.mutate({ userId: person.id, role: moderator ? "MEMBER" : "MODERATOR" }),
                        }
                      : undefined
                  }
                  extra={
                    myRank >= 3
                      ? {
                          label: admin ? `أزل الإدارة عن ${person.name}` : `اجعل ${person.name} مديراً`,
                          run: () => setRole.mutate({ userId: person.id, role: admin ? "MEMBER" : "ADMIN" }),
                        }
                      : undefined
                  }
                  icons={{
                    delete: <UserMinusIcon size={22} color="#fff" />,
                    second: <MuteIcon size={22} color={person.muted ? colors.clay : "#fff"} />,
                    lead: moderator ? <CloseIcon size={18} color={colors.onBrand} /> : <CrownIcon size={22} color={colors.onBrand} hollow />,
                    extra: admin ? <CloseIcon size={18} color={colors.night} /> : <CrownIcon size={22} color={ADMIN_CROWN} />,
                  }}
                >
                  <View style={{ paddingHorizontal: 4 }}>{row}</View>
                </SwipeRow>
              );
            })}
            {addError ? <Text style={{ color: colors.live, fontSize: 12, marginTop: 4 }}>{addError}</Text> : null}
          </View>
        ) : null}

        {/* المختارون قبل الإنشاء أو قبل الإضافة. */}
        {picked.length > 0 ? (
          <View>
            <Text style={{ color: colors.groundInk, fontSize: 12, fontWeight: "700", marginBottom: 4 }}>
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
            <Text style={{ color: colors.groundInk, fontSize: 12, fontWeight: "700", marginBottom: 8 }}>
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
            <Text style={{ color: colors.groundInk, fontSize: 11, marginTop: 6 }}>
              أكثر من رقم؟ افصل بينها بمسافة أو فاصلة.
            </Text>

            {needle && candidates.isFetching && offered.length === 0 ? (
              <Spinner style={{ marginTop: 14 }} color={colors.clay} />
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
              <Spinner color={colors.onBrand} />
            ) : (
              <Text style={{ color: colors.onBrand, fontSize: 14.5, fontWeight: "700" }}>أنشئ المجموعة</Text>
            )}
          </Pressable>
        ) : myRank >= 3 ? (
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
