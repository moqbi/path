import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Switch,
  ScrollView,
  ActivityIndicator,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScreenHeader } from "../../components/screen-header";
import { CheckIcon, InfoIcon, ShieldIcon } from "../../components/icons";
import { api } from "../../lib/api";
import { keys } from "../../lib/queries";
import { useSession } from "../../lib/session";
import { SITE_URL } from "@athar/shared";
import { ar } from "../../lib/format";
import { brandGradient, colors } from "../../theme/tokens";

type Group = { id: string; name: string; count: number };

/**
 * الخصوصية في شاشة واحدة: من يرى، ومن يتفاعل، والموقع، وإشعار الإشارة،
 * والمحظورون — ومعها التصنيفات لأن كل حدٍّ هنا يُقاس بتصنيف.
 */
export default function Privacy() {
  const router = useRouter();
  const client = useQueryClient();
  const me = useSession((state) => state.me);
  const refresh = useSession((state) => state.refresh);

  const circle = useQuery({
    queryKey: keys.circle,
    queryFn: () => api<{ groups: Group[] }>("/v1/circle"),
  });
  const blocked = useQuery({
    queryKey: ["circle", "blocked"],
    queryFn: () => api<{ people: { id: string }[] }>("/v1/circle/blocked"),
  });

  const [view, setView] = useState<string | null>(me?.viewGroupId ?? null);
  const [interact, setInteract] = useState<string | null>(me?.interactGroupId ?? null);
  const [place, setPlace] = useState(me?.shareLocation !== false);
  const [notify, setNotify] = useState(me?.notifyOnTag !== false);
  const [said, setSaid] = useState<string | null>(null);
  const [name, setName] = useState("");

  const groups = circle.data?.groups ?? [];

  const save = useMutation({
    mutationFn: () =>
      api("/v1/me/privacy", {
        method: "PUT",
        body: JSON.stringify({
          viewGroupId: view,
          interactGroupId: interact,
          shareLocation: place,
          notifyOnTag: notify,
        }),
      }),
    onSuccess: async () => {
      setSaid("حُفظ");
      await refresh();
      await client.invalidateQueries({ queryKey: keys.me });
    },
    onError: (problem) =>
      setSaid(problem instanceof Error ? problem.message : "تعذّر الحفظ"),
  });

  const add = useMutation({
    mutationFn: (groupName: string) =>
      api("/v1/circle/groups", { method: "POST", body: JSON.stringify({ name: groupName }) }),
    onSuccess: async () => {
      setName("");
      await client.invalidateQueries({ queryKey: keys.circle });
    },
  });

  const drop = useMutation({
    mutationFn: (id: string) => api(`/v1/circle/groups/${id}`, { method: "DELETE" }),
    onSuccess: async () => client.invalidateQueries({ queryKey: keys.circle }),
  });

  if (!me) return null;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScreenHeader title="الخصوصية" back="/me" />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, direction: "rtl" }} keyboardShouldPersistTaps="handled">
        <Card
          title="من يمكنه رؤية لحظاتي؟"
          note="الافتراضي لكل لحظة جديدة. تقدر تغيّره لكل لحظة عند نشرها."
        >
          <Choices groups={groups} value={view} onPick={setView} />
        </Card>

        <Card
          title="من يمكنه التفاعل معك؟"
          note="التفاعل والتعليق على لحظاتك. الخادم يفحصه، لا إخفاء الأزرار."
        >
          <Choices groups={groups} value={interact} onPick={setInteract} />
        </Card>

        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, overflow: "hidden", marginBottom: 12 }}>
          <Toggle
            title="إظهار موقعي"
            note="مطفأً تُنشر المدينة وحدها بلا اسم المكان ولا إحداثياته"
            value={place}
            onChange={setPlace}
          />
          <View style={{ height: 1, backgroundColor: colors.line }} />
          <Toggle
            title="إشعارات الإشارة"
            note="حين يشير إليك أحدٌ في لحظة «مع فلان»"
            value={notify}
            onChange={setNotify}
          />
        </View>

        <Pressable onPress={() => { setSaid(null); save.mutate(); }} disabled={save.isPending}>
          <LinearGradient
            colors={[brandGradient[0], brandGradient[1]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center", opacity: save.isPending ? 0.6 : 1 }}
          >
            {save.isPending ? (
              <ActivityIndicator color={colors.onBrand} />
            ) : (
              <Text style={{ color: colors.onBrand, fontSize: 14.5, fontWeight: "700" }}>احفظ</Text>
            )}
          </LinearGradient>
        </Pressable>

        {said ? (
          <Text style={{ color: colors.clayInk, fontSize: 12, marginTop: 8, textAlign: "center" }}>
            {said}
          </Text>
        ) : null}

        <Text style={{ color: colors.ink, fontSize: 14.5, fontWeight: "700", marginTop: 26, marginBottom: 6, textAlign: "right" }}>
          تصنيفات أصدقائك
        </Text>
        <Text style={{ color: colors.muted, fontSize: 11.5, lineHeight: 19, marginBottom: 12, textAlign: "right" }}>
          التصنيف لك وحدك: من صنّفته «عائلة» لا يرى تصنيفك ولا يراه غيرك.
        </Text>

        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={20}
            placeholder="اسم التصنيف (العائلة، الزملاء…)"
            placeholderTextColor={colors.faint}
            style={{ flex: 1, minWidth: 0, height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, paddingHorizontal: 14, fontSize: 13, color: colors.ink, textAlign: "right" }}
          />
          <Pressable
            onPress={() => name.trim() && add.mutate(name.trim())}
            style={{ height: 44, borderRadius: 12, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay }}
          >
            <Text style={{ color: colors.onBrand, fontSize: 13, fontWeight: "700" }}>أضف</Text>
          </Pressable>
        </View>

        {groups.length === 0 ? (
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, paddingVertical: 20 }}>
            <Text style={{ color: colors.muted, fontSize: 12.5, textAlign: "center" }}>
              لا تصنيفات بعد.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {groups.map((group) => (
              <View
                key={group.id}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, padding: 12 }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "600", textAlign: "right" }}>
                    {group.name}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11.5, textAlign: "right" }}>
                    {ar(group.count)} من أصدقائك
                  </Text>
                </View>
                <Pressable
                  onPress={() => drop.mutate(group.id)}
                  style={{ height: 40, borderRadius: 12, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ color: colors.live, fontSize: 12, fontWeight: "600" }}>حذف</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* البريد قبل الدعم والحذف: بيانات الحساب أولاً ثم ما يُفعل بها. */}
        <View style={{ marginTop: 24 }}>
          <ChangeEmail current={me.email} />
        </View>

        {/*
          لوحة التحكم للمشرف وحده، وبابُها هنا: الخصوصية هي درج الإعدادات
          في هذا التطبيق، ولا تستحق اللوحةُ تبويباً دائماً يراه الجميع
          ولا يفتحه أحد. والدرجة تُفحص في اللوحة نفسها لا هنا — إخفاء
          الرابط ليس حماية (القاعدة ١٣).
        */}
        {me?.role === "ADMIN" ? (
          <Link
            title="لوحة التحكم"
            note="تُفتح في المتصفّح — الأصناف والباقات والبلاغات والحسابات"
            right={<ShieldIcon size={18} color={colors.clayInk} />}
            onPress={() => void Linking.openURL(`${SITE_URL}/admin`)}
          />
        ) : null}

        {/* الدعم داخل الخصوصية: هنا يبحث الناس عمّن يكلّمونه. */}
        <Link
          title="الدعم الفني وتواصل معنا"
          note="مشكلة أو اقتراح أو بلاغ — نردّ عليك داخل التطبيق"
          right={<InfoIcon size={18} color={colors.clayInk} />}
          onPress={() => router.push("/settings/support" as never)}
        />

        <Link
          title="حظر المستخدمين"
          right={
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {ar(blocked.data?.people.length ?? 0)} محظور
            </Text>
          }
          onPress={() => router.push("/settings/blocked" as never)}
        />

        {/* حذف الحساب في الخصوصية: هنا يُبحث عنه، لا في أسفل الملف. */}
        <DeleteAccount />

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16 }}>
          <ShieldIcon size={15} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: 11.5 }}>
            ما يُنشر لأصدقائك لا يخرج عنهم.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Card({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, padding: 16, marginBottom: 12 }}>
      <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "600", marginBottom: 6, textAlign: "right" }}>
        {title}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 11.5, lineHeight: 19, marginBottom: 10, textAlign: "right" }}>
        {note}
      </Text>
      {children}
    </View>
  );
}

/**
 * بديل `<select>`: صفوفٌ تُضغط.
 *
 * لا قائمةَ منسدلة في React Native، وقائمةُ خياراتٍ ظاهرةٍ أصدق على شاشةٍ
 * تُلمس: الخيارات هنا ثلاثة أو أربعة لا مئة.
 */
function Choices({
  groups,
  value,
  onPick,
}: {
  groups: Group[];
  value: string | null;
  onPick: (id: string | null) => void;
}) {
  const rows: { id: string | null; label: string }[] = [
    { id: null, label: "كل أصدقائي" },
    ...groups.map((group) => ({ id: group.id, label: `${group.name} (${ar(group.count)})` })),
  ];

  return (
    <View style={{ gap: 6 }}>
      {rows.map((row) => {
        const on = row.id === value;
        return (
          <Pressable
            key={row.id ?? "all"}
            onPress={() => onPick(row.id)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              height: 44,
              paddingHorizontal: 14,
              borderRadius: 12,
              borderWidth: on ? 1.5 : 1,
              borderColor: on ? colors.clay : colors.line,
              backgroundColor: colors.paper,
            }}
          >
            <Text style={{ color: colors.ink, fontSize: 13 }}>{row.label}</Text>
            {on ? <CheckIcon size={15} color={colors.clay} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function Toggle({
  title,
  note,
  value,
  onChange,
}: {
  title: string;
  note: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "600", textAlign: "right" }}>
          {title}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 11.5, marginTop: 2, textAlign: "right" }}>
          {note}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.clay, false: colors.chip }}
        thumbColor="#fff"
      />
    </View>
  );
}

function Link({
  title,
  note,
  right,
  onPress,
}: {
  title: string;
  note?: string;
  right?: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, padding: 16, marginBottom: 12 }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "600", textAlign: "right" }}>
          {title}
        </Text>
        {note ? (
          <Text style={{ color: colors.muted, fontSize: 11.5, marginTop: 2, textAlign: "right" }}>
            {note}
          </Text>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

/**
 * تغيير البريد — مطويٌّ كحذف الحساب: تغييرٌ لا يُفعل كل يوم ولا يُضغط
 * بالخطأ. وكلمة المرور شرط: البريد اسمُ الدخول، وتغييرُه نقلٌ للحساب.
 */
function ChangeEmail({ current }: { current: string }) {
  const refresh = useSession((state) => state.refresh);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [said, setSaid] = useState<{ ok?: string; error?: string } | null>(null);

  const change = useMutation({
    mutationFn: () =>
      api("/v1/me/email", { method: "PUT", body: JSON.stringify({ email, password }) }),
    onSuccess: async () => {
      setSaid({ ok: "تغيّر بريدك" });
      setPassword("");
      await refresh();
    },
    onError: (problem) =>
      setSaid({ error: problem instanceof Error ? problem.message : "تعذّر التغيير" }),
  });

  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, marginBottom: 12, overflow: "hidden" }}>
      <Pressable
        onPress={() => setOpen((was) => !was)}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "600", textAlign: "right" }}>
            البريد الإلكتروني
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11.5, textAlign: "right" }}>{current}</Text>
        </View>
        <Text style={{ color: colors.clayInk, fontSize: 11.5 }}>غيّره</Text>
      </Pressable>

      {open ? (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.line, padding: 16, gap: 12 }}>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 20, textAlign: "right" }}>
            البريد هو اسم دخولك. بعد تغييره تدخل بالبريد الجديد وكلمة المرور نفسها.
          </Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="البريد الجديد"
            placeholderTextColor={colors.faint}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={SETTING_FIELD}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="كلمة المرور"
            placeholderTextColor={colors.faint}
            secureTextEntry
            style={SETTING_FIELD}
          />

          {said?.error ? (
            <Text accessibilityRole="alert" style={{ color: colors.live, fontSize: 12, textAlign: "right" }}>
              {said.error}
            </Text>
          ) : null}
          {said?.ok ? (
            <Text style={{ color: colors.clayInk, fontSize: 12, fontWeight: "500", textAlign: "right" }}>
              {said.ok}
            </Text>
          ) : null}

          <Pressable
            onPress={() => { setSaid(null); change.mutate(); }}
            disabled={change.isPending}
            style={{ height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay, opacity: change.isPending ? 0.6 : 1 }}
          >
            <Text style={{ color: colors.onBrand, fontSize: 14, fontWeight: "700" }}>
              {change.isPending ? "نحفظ…" : "احفظ البريد"}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/**
 * حذف الحساب داخل التطبيق — شرط متجر آبل لكل تطبيق فيه تسجيل دخول.
 *
 * مطويٌّ فلا يُضغط بالخطأ، ومكتوبٌ فيه ما يذهب قبل أن يذهب، وكلمة المرور
 * شرطٌ لأن جهازاً مفتوحاً في يد غيرك لا يجب أن يمحو حسابك بضغطتين.
 * والخطأ فيها يُردّ رسالةً في الشاشة لا استثناءً.
 */
function DeleteAccount() {
  const router = useRouter();
  const signOut = useSession((state) => state.signOut);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function wipe() {
    setBusy(true);
    setError(null);
    try {
      await api("/v1/me/delete", { method: "POST", body: JSON.stringify({ password }) });
      await signOut();
      router.replace("/login?deleted=1" as never);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "تعذّر الحذف");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, marginBottom: 20, overflow: "hidden" }}>
      <Pressable
        onPress={() => setOpen((was) => !was)}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 }}
      >
        <Text style={{ color: colors.live, fontSize: 13.5, fontWeight: "600" }}>حذف الحساب</Text>
        <Text style={{ color: colors.muted, fontSize: 11.5 }}>نهائي</Text>
      </Pressable>

      {open ? (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.line, padding: 16, gap: 12 }}>
          <Text style={{ color: colors.muted, fontSize: 12.5, lineHeight: 21, textAlign: "right" }}>
            يذهب حسابك ومعه كل ما فيه: لحظاتك وصورك ومحادثاتك وتفاعلاتك وتعليقاتك
            وأصدقاؤك. لا نُبقي نسخة ولا يمكن التراجع. اكتب كلمة مرورك لتأكيد أنك أنت.
          </Text>

          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="كلمة المرور"
            placeholderTextColor={colors.faint}
            secureTextEntry
            style={SETTING_FIELD}
          />

          {error ? (
            <Text accessibilityRole="alert" style={{ color: colors.live, fontSize: 12, textAlign: "right" }}>
              {error}
            </Text>
          ) : null}

          {/* لا سؤالَ إضافيّ: الطيّ أوّلاً، وكلمة المرور هي التأكيد — كما في
              الويب حرفاً بحرف. */}
          <Pressable
            onPress={() => void wipe()}
            disabled={busy}
            style={{ height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.live, opacity: busy ? 0.6 : 1 }}
          >
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>
              {busy ? "نحذف…" : "احذف حسابي نهائياً"}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const SETTING_FIELD = {
  height: 48,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: colors.line,
  backgroundColor: colors.paper,
  paddingHorizontal: 16,
  fontSize: 13.5,
  color: colors.ink,
  textAlign: "right",
} as const;
