import { useState } from "react";
import { View, Pressable, Switch, ScrollView, ActivityIndicator, Linking } from "react-native";
import { Text, TextInput } from "../../components/type";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScreenHeader } from "../../components/screen-header";
import { BookIcon, CheckIcon, InfoIcon, ShieldIcon } from "../../components/icons";
import { Sheet } from "../../components/sheet";
import { openIn } from "../../lib/browse";
import { api } from "../../lib/api";
import { keys } from "../../lib/queries";
import { useSession } from "../../lib/session";
import { SITE_URL, hasSite } from "@athar/shared";
import { ar } from "../../lib/format";
import { brandGradient, colors } from "../../theme/tokens";
import { FollowRow } from "../../components/social";

type Group = { id: string; name: string; count: number };

/**
 * الإعدادات والخصوصية: شاشةٌ واحدة بأقسامٍ تُفتح — نسخةُ الويب
 * (`src/app/settings/page.tsx`).
 *
 * ثلاثةُ أقسامٍ تُطوى: الحساب والتنبيهات والخصوصية، وبابان يخرجان منها:
 * سياسةُ الخصوصية والدعم. وأقسامٌ تُطوى لا شاشاتٌ متسلسلة: الإعداد
 * يُقرأ مرّةً ويُغيَّر نادراً، وشاشةٌ لكل بندٍ تجعل تغييرَ مفتاحٍ رحلةً
 * من ثلاث ضغطات.
 */
export default function Settings() {
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
          // وإشعارُ الإشارة يُحفظ من «التنبيهات»، فلا يُرسل من هنا.
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
      <ScreenHeader title="الإعدادات والخصوصية" back="/me" />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, direction: "rtl" }} keyboardShouldPersistTaps="handled">
        {/* ── الحساب ── */}
        <Section title="الحساب" note="بريدك وكلمتك، ومن منعتَه، وبابُ الخروج الأخير">
          <VerifyEmail verified={Boolean(me.emailVerifiedAt)} hasEmail={Boolean(me.email)} />
          <ChangePassword hasPassword={me.hasPassword !== false} />
          <ChangeEmail current={me.email} hasPassword={me.hasPassword !== false} />

          <Link
            title="قائمة الحظر"
            right={
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {ar(blocked.data?.people.length ?? 0)} محظور
              </Text>
            }
            onPress={() => router.push("/settings/blocked" as never)}
          />

          {/* حذف الحساب هنا يُبحث عنه، لا في أسفل الملف. */}
          <DeleteAccount />
        </Section>

        {/* ── التنبيهات ── */}
        <Section title="التنبيهات" note="ما يصل جهازك، ومتى يسكت">
          <NotifyPrefs />
        </Section>

        {/* ── الخصوصية ── */}
        <Section title="الخصوصية" note="من يرى، ومن يتفاعل، وأين أنت">
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
        </Section>

        {/*
          لوحة التحكم للمشرف وحده، وبابُها هنا: الإعدادات درجُ التطبيق،
          ولا تستحق اللوحةُ تبويباً دائماً يراه الجميع ولا يفتحه أحد.
          والدرجة تُفحص في اللوحة نفسها لا هنا (القاعدة ١٣).
        */}
        {me?.role === "ADMIN" && hasSite() ? (
          <Link
            title="لوحة التحكم"
            note="تُفتح في المتصفّح — الأصناف والباقات والبلاغات والحسابات"
            right={<ShieldIcon size={18} color={colors.clayInk} />}
            onPress={() => void Linking.openURL(`${SITE_URL}/admin`)}
          />
        ) : null}

        {/* السياسة في متصفّحٍ داخل التطبيق: من قرأها يعود بزرٍّ إلى مكانه
            لا يخرج إلى سفاري ويبقى هناك (القاعدة ٦٢). */}
        {/*
           الوثيقتان تُفتحان في المتصفّح الداخليّ (القاعدة ٦٢)، وتبقيان
           ظاهرتين دائماً: المتجران يشترطان أن يجدهما المستخدم، وصفٌّ
           يختفي لأنّ بيئةً لم تُضبط يُقرأ «لا وجود له».
        */}
        <LegalLink title="سياسة الخصوصية" note="ما نجمعه وما لا نجمعه" path="/privacy" />
        <LegalLink title="شروط الاستخدام" note="ما لك وما عليك في آثار" path="/terms" />

        <Link
          title="الدعم الفني — تواصل معنا"
          note="مشكلة أو اقتراح أو بلاغ — نردّ عليك داخل التطبيق"
          right={<InfoIcon size={18} color={colors.clayInk} />}
          onPress={() => router.push("/settings/support" as never)}
        />

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16 }}>
          <ShieldIcon size={15} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: 11.5 }}>
            ما يُنشر لأصدقائك لا يخرج عنهم.
          </Text>
        </View>

        {/*
          «تابعنا» في أسفل الإعدادات: مكانُ حسابات المنصّات لا الخط
          الزمني — لا استكشاف عام في آثار (القاعدة ٢).
          وروابطُها من اللوحة، هي نفسها التي يعرضها ذيلُ الموقع.
        */}
        <FollowRow />
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
function ChangeEmail({
  current,
  hasPassword,
}: {
  current: string | null;
  hasPassword: boolean;
}) {
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
            {current ? "البريد الإلكتروني" : "اربط بريدك"}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11.5, textAlign: "right" }}>
            {current ?? "لا بريدَ على حسابك — وبه تستعيده إن ضاع"}
          </Text>
        </View>
        <Text style={{ color: colors.clayInk, fontSize: 11.5 }}>{current ? "غيّره" : "اربطه"}</Text>
      </Pressable>

      {open ? (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.line, padding: 16, gap: 12 }}>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 20, textAlign: "right" }}>
            {current
              ? "البريد هو اسم دخولك. بعد تغييره تدخل بالبريد الجديد وكلمة المرور نفسها."
              : "من دخل بسناب لا بريدَ له، وبلا بريدٍ لا نستطيع أن نعيد إليه حسابه إن فقد سنابه. اربطه الآن."}
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
          {/* وكلمةُ المرور تُطلب ممّن له كلمة: من دخل بمزوّدٍ الجلسةُ دليلُه. */}
          {hasPassword ? (
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="كلمة المرور"
              placeholderTextColor={colors.faint}
              secureTextEntry
              style={SETTING_FIELD}
            />
          ) : null}

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
              {change.isPending ? "نحفظ…" : current ? "احفظ البريد" : "اربط البريد"}
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

/**
 * قسمٌ يُطوى: عنوانه وسطرُ وصفٍ تحته، وما فيه يُفتح بضغطة.
 * نسخةُ `Section` في الويب (`<details>` هناك).
 */
function Section({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, marginBottom: 12, overflow: "hidden" }}>
      <Pressable
        onPress={() => setOpen((was) => !was)}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 16 }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.ink, fontSize: 14.5, fontWeight: "700", textAlign: "right" }}>
            {title}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11.5, marginTop: 2, textAlign: "right" }}>
            {note}
          </Text>
        </View>
        <Text style={{ color: colors.clayInk, fontSize: 11.5 }}>{open ? "أغلق" : "افتح"}</Text>
      </Pressable>

      {open ? (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.line, padding: 16 }}>{children}</View>
      ) : null}
    </View>
  );
}

/**
 * تغيير كلمة المرور — مطويٌّ كتغيير البريد.
 *
 * القديمةُ شرط، والجديدةُ مرّتين: خطأٌ في حرفٍ واحد يُقفل الحساب على
 * صاحبه، ولا بريدَ في المنظومة بعد يستعيده به.
 */
function ChangePassword({ hasPassword }: { hasPassword: boolean }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [said, setSaid] = useState<{ ok?: string; error?: string } | null>(null);

  const change = useMutation({
    mutationFn: () =>
      api("/v1/me/password", { method: "PUT", body: JSON.stringify({ current, next }) }),
    onSuccess: () => {
      setSaid({ ok: "تم تغيير كلمة المرور" });
      setCurrent("");
      setNext("");
      setAgain("");
    },
    onError: (problem) =>
      setSaid({ error: problem instanceof Error ? problem.message : "تعذّر التغيير" }),
  });

  function submit() {
    setSaid(null);
    if (next.length < 8) return setSaid({ error: "كلمة المرور الجديدة ٨ أحرف فأكثر" });
    if (next !== again) return setSaid({ error: "الكلمتان الجديدتان غير متطابقتين" });
    change.mutate();
  }

  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, marginBottom: 12, overflow: "hidden" }}>
      <Pressable
        onPress={() => setOpen((was) => !was)}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 }}
      >
        <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "600" }}>
          {hasPassword ? "كلمة المرور" : "اضبط كلمة مرور"}
        </Text>
        <Text style={{ color: colors.clayInk, fontSize: 11.5 }}>
          {hasPassword ? "غيّرها" : "اضبطها"}
        </Text>
      </Pressable>

      {open ? (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.line, padding: 16, gap: 12 }}>
          {/* ومن دخل بمزوّدٍ لا قديمةَ له تُطلب: الجلسةُ دليلُه. */}
          {hasPassword ? (
            <TextInput
              value={current}
              onChangeText={setCurrent}
              placeholder="كلمة المرور الحالية"
              placeholderTextColor={colors.faint}
              secureTextEntry
              style={SETTING_FIELD}
            />
          ) : null}
          <TextInput
            value={next}
            onChangeText={setNext}
            placeholder="الجديدة (٨ أحرف فأكثر)"
            placeholderTextColor={colors.faint}
            secureTextEntry
            style={SETTING_FIELD}
          />
          <TextInput
            value={again}
            onChangeText={setAgain}
            placeholder="الجديدة مرّةً أخرى"
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
            onPress={submit}
            disabled={change.isPending}
            style={{ height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay, opacity: change.isPending ? 0.6 : 1 }}
          >
            <Text style={{ color: colors.onBrand, fontSize: 14, fontWeight: "700" }}>
              {change.isPending ? "نحفظ…" : hasPassword ? "احفظ كلمة المرور" : "اضبط كلمة المرور"}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/** بنودُ التنبيهات: مفتاحُها عمودٌ في القاعدة، ونصُّها ما يقرأه صاحبها. */
const NOTIFY_ITEMS = [
  { key: "notifyDm", label: "محادثة جديدة", note: "رسالةٌ تصلك من صديق" },
  { key: "notifyFriend", label: "طلبات صداقة جديدة", note: "من أراد الدخول في دائرتك" },
  { key: "notifyOnTag", label: "إشارات «مع فلان»", note: "حين يذكرك أحدٌ في لحظته" },
  { key: "notifyReaction", label: "تفاعلات على اللحظات", note: "وجهٌ أو إيموجي على ما نشرت" },
  { key: "notifyComment", label: "تعليق على لحظة", note: "كلامٌ يُكتب تحت لحظتك" },
  { key: "notifyStoreNew", label: "من آثار: محتوى جديد في المتجر", note: "إطارٌ أو ثيمٌ أو تميمة" },
  { key: "notifyStoreDeals", label: "من آثار: عروض وخصومات", note: "ما يُخفَّض سعره أو يُعرض لمدّة" },
] as const;

/** دقائقُ منتصف الليل ← «١٠:٣٠ م» كما تُقرأ. */
function clockText(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const half = hour < 12 ? "ص" : "م";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${ar(twelve)}:${ar(String(minute).padStart(2, "0"))} ${half}`;
}

/**
 * التنبيهات: ما يصل الجهاز ومتى يسكت.
 *
 * والوضع الهادئ يُختار من قائمةٍ بنصف ساعة لا يُكتب حرفاً: حقلُ وقتٍ
 * حرٌّ يقبل «٢٥:٧٠»، والقائمة تعطي ما يقوله الناس فعلاً.
 */
function NotifyPrefs() {
  const me = useSession((state) => state.me);
  const refresh = useSession((state) => state.refresh);

  const [on, setOn] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      NOTIFY_ITEMS.map((item) => [
        item.key,
        (me as Record<string, unknown> | null)?.[item.key] !== false,
      ]),
    ),
  );
  const [from, setFrom] = useState<number | null>(me?.quietFrom ?? null);
  const [to, setTo] = useState<number | null>(me?.quietTo ?? null);
  const [said, setSaid] = useState<string | null>(null);

  const quiet = from !== null && to !== null;

  const save = useMutation({
    mutationFn: () =>
      api("/v1/me/notifications", {
        method: "PUT",
        body: JSON.stringify({ ...on, quietFrom: from, quietTo: to }),
      }),
    onSuccess: async () => {
      setSaid("حُفظ");
      await refresh();
    },
    onError: (problem) =>
      setSaid(problem instanceof Error ? problem.message : "تعذّر الحفظ"),
  });

  return (
    <View>
      <Text style={{ color: colors.muted, fontSize: 11.5, lineHeight: 19, marginBottom: 12, textAlign: "right" }}>
        هذه تنبيهات جهازك. وتبويب الإشعارات يبقى كما هو — سجلُّ ما جرى، لا يُمحى بإطفاء تنبيه.
      </Text>

      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, overflow: "hidden", marginBottom: 12 }}>
        {NOTIFY_ITEMS.map((item, index) => (
          <View key={item.key}>
            {index === 0 ? null : <View style={{ height: 1, backgroundColor: colors.line }} />}
            <Toggle
              title={item.label}
              note={item.note}
              value={on[item.key] !== false}
              onChange={(next) => setOn((was) => ({ ...was, [item.key]: next }))}
            />
          </View>
        ))}
      </View>

      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, overflow: "hidden", marginBottom: 12 }}>
        <Toggle
          title="الوضع الهادئ"
          note="لا يصلك تنبيهٌ بين الوقتين — ويبقى كلُّ شيء في مكانه حتى تفتح التطبيق"
          value={quiet}
          onChange={(next) => {
            setFrom(next ? 22 * 60 : null);
            setTo(next ? 7 * 60 : null);
          }}
        />

        {quiet ? (
          <View style={{ flexDirection: "row", gap: 12, borderTopWidth: 1, borderTopColor: colors.line, padding: 16 }}>
            <TimeField label="من" value={from} onPick={setFrom} />
            <TimeField label="إلى" value={to} onPick={setTo} />
          </View>
        ) : null}
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
            <Text style={{ color: colors.onBrand, fontSize: 14.5, fontWeight: "700" }}>
              احفظ التنبيهات
            </Text>
          )}
        </LinearGradient>
      </Pressable>

      {said ? (
        <Text style={{ color: colors.clayInk, fontSize: 12, marginTop: 8, textAlign: "center" }}>
          {said}
        </Text>
      ) : null}
    </View>
  );
}

/** حقلُ وقتٍ يُختار من نافذةٍ بنصف ساعة — لا كتابةَ أرقام. */
function TimeField({
  label,
  value,
  onPick,
}: {
  label: string;
  value: number | null;
  onPick: (minutes: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const options = Array.from({ length: 48 }, (_, index) => index * 30);

  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={{ color: colors.muted, fontSize: 11.5, marginBottom: 6, textAlign: "right" }}>
        {label}
      </Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={{ height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center" }}
      >
        <Text style={{ color: colors.ink, fontSize: 13 }}>
          {value === null ? "اختر" : clockText(value)}
        </Text>
      </Pressable>

      {open ? (
        <Sheet title={`الوضع الهادئ — ${label}`} onClose={() => setOpen(false)}>
          <ScrollView style={{ maxHeight: 360 }} nestedScrollEnabled>
            {options.map((minutes) => {
              const picked = minutes === value;
              return (
                <Pressable
                  key={minutes}
                  onPress={() => {
                    onPick(minutes);
                    setOpen(false);
                  }}
                  style={{ height: 44, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: picked ? colors.chip : "transparent" }}
                >
                  <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: picked ? "700" : "400" }}>
                    {clockText(minutes)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Sheet>
      ) : null}
    </View>
  );
}


/**
 * حالُ البريد: مؤكَّدٌ أو لا، ومعه زرُّ إعادة الإرسال.
 *
 * ولا يُمنع شيءٌ على غير المؤكَّد: حسابٌ قائمٌ لا يُقفل على صاحبه لأنّ
 * رسالةً لم تصل. التأكيد بابُ الاستعادة يوم ينسى كلمته.
 */
function VerifyEmail({ verified, hasEmail }: { verified: boolean; hasEmail: boolean }) {
  const [said, setSaid] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: () => api("/v1/me/verify/send", { method: "POST" }),
    onSuccess: () => setSaid("أرسلنا رابط التأكيد إلى بريدك"),
    onError: (problem) =>
      setSaid(problem instanceof Error ? problem.message : "تعذّر الإرسال"),
  });

  // ومن لا بريدَ له يقرأ «اربط بريدك» تحته، فلا يُقال له شيئان.
  if (!hasEmail) return null;

  if (verified) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, padding: 16, marginBottom: 12 }}>
        <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "600" }}>البريد مؤكَّد</Text>
        <CheckIcon size={18} color={colors.clayInk} />
      </View>
    );
  }

  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, padding: 16, marginBottom: 12, gap: 8 }}>
      <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "600", textAlign: "right" }}>
        بريدك غير مؤكَّد
      </Text>
      <Text style={{ color: colors.muted, fontSize: 11.5, lineHeight: 19, textAlign: "right" }}>
        التأكيد بابُ استعادة حسابك يوم تنسى كلمة مرورك. لا يمنعك من شيء اليوم.
      </Text>

      {said ? (
        <Text style={{ color: colors.clayInk, fontSize: 12, textAlign: "right" }}>{said}</Text>
      ) : null}

      <Pressable
        onPress={() => { setSaid(null); send.mutate(); }}
        disabled={send.isPending}
        style={{ height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", opacity: send.isPending ? 0.6 : 1 }}
      >
        <Text style={{ color: colors.clayInk, fontSize: 13, fontWeight: "600" }}>
          {send.isPending ? "نرسل…" : "أرسل رابط التأكيد"}
        </Text>
      </Pressable>
    </View>
  );
}


/**
 * بابُ وثيقةٍ على الموقع، يُفتح في متصفّحٍ داخل التطبيق.
 *
 * وبلا `EXPO_PUBLIC_SITE_URL` يبقى الصفُّ ظاهراً ويقول لماذا لم يُفتح:
 * صفٌّ يختفي يُقرأ «لا وجود للوثيقة»، وهذا ما يسأل عنه مراجعُ المتجر.
 */
function LegalLink({ title, note, path }: { title: string; note: string; path: string }) {
  const [said, setSaid] = useState<string | null>(null);

  return (
    <View>
      <Link
        title={title}
        note={said ?? note}
        right={<BookIcon size={18} color={colors.clayInk} />}
        onPress={() => {
          if (!hasSite()) {
            setSaid("لم يُضبط عنوان الموقع في هذه النسخة");
            return;
          }
          void openIn(`${SITE_URL}${path}`);
        }}
      />
    </View>
  );
}
