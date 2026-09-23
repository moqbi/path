import { useState } from "react";
import { View, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Text, TextInput } from "./type";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ReactionGlyph, facesFor, CUSTOM, EMOJI_GROUPS } from "./reactions";
import { LockIcon } from "./icons";
import { ReportButton } from "./report-sheet";
import { api } from "../lib/api";
import { keys, useComment, useReact } from "../lib/queries";
import { colors } from "../theme/tokens";

type Mine = { kind: string; emoji: string | null } | null;

/**
 * شريط اللحظة: زرٌّ واحد في طرف المنشور.
 *
 * بالضغط عليه تُفتح الوجوه ومساحةُ التعليق معاً، ويُغلق نفسه بعد اختيار
 * وجهٍ أو إرسال تعليق — فالصندوق المفتوح على كل منشور ضجيج، والعودة
 * إليه ضغطةٌ واحدة.
 *
 * منقولٌ من `src/components/moment-bar.tsx`: الوجوه، فالفاصل، فالإيموجي
 * الحرّ (اثنان ثم «＋» يفتح الكيبورد كاملاً لمشتركي آثار+، وقفلٌ يقود إلى
 * الاشتراك لغيرهم)، ثم «احذف اللحظة» لصاحبها، ثم حقل التعليق.
 *
 * **وحذفُ المشرف هنا لا في شاشةٍ أخرى** (`moderate`): البلاغ يصل على
 * منشور، فيفتحه المشرف حيث يقرؤه الناس ويحكم في مكانه. وزرُّ البلاغ
 * وزرُّ الحذف في اللوحة نفسها، فيرى المشرفُ ما بُلّغ عنه ويتصرّف بضغطة —
 * لا يحفظ معرّفاً ويبحث عنه في لوحة تحكّم.
 *
 * والبابان مختلفان وإن تشابه الزرّان: صاحبُها يحذف بـ`/v1/moments/:id`،
 * والمشرف بـ`/v1/moderation/moments/:id` خلف `requireModerator` ومعه
 * سجلّ. فلا يُوسَّع بابُ الصاحب ليقبل غيره.
 */
export function MomentBar({
  momentId,
  momentKind,
  mine,
  isPlus,
  author = false,
  /** صلاحية الإشراف: يحذف لحظةَ غيره من هنا، ويُكتب حذفُه في السجلّ. */
  moderate = false,
  head,
  extra,
  inset = false,
  panelFirst = false,
}: {
  momentId: string;
  momentKind?: string;
  mine: Mine;
  isPlus: boolean;
  author?: boolean;
  moderate?: boolean;
  head?: React.ReactNode;
  extra?: React.ReactNode;
  inset?: boolean;
  panelFirst?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [board, setBoard] = useState(false);
  const [asking, setAsking] = useState(false);
  const [body, setBody] = useState("");
  const router = useRouter();
  const client = useQueryClient();

  const react = useReact(momentId);
  const comment = useComment(momentId);
  const faces = facesFor(momentKind);

  /* صاحبُها من بابه، والمشرفُ من بابه — لا بابَ واحد يقبل الاثنين. */
  const remove = useMutation({
    mutationFn: () =>
      api(author ? `/v1/moments/${momentId}` : `/v1/moderation/moments/${momentId}`, {
        method: "DELETE",
      }),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ["feed"] });
      void client.invalidateQueries({ queryKey: ["me", "moments"] });
      void client.invalidateQueries({ queryKey: ["user"] });
    },
  });

  function choose(kind: string, emoji?: string) {
    // الوجه فعلٌ كامل بنفسه: يُختار فيُطوى الشريط.
    setOpen(false);
    setBoard(false);
    setAsking(false);
    react.mutate({ kind, emoji });
  }

  const pending = react.isPending || comment.isPending || remove.isPending;

  const button = (
    <Pressable
      accessibilityLabel="تفاعل"
      onPress={() => {
        setBoard(false);
        setOpen((v) => !v);
      }}
      style={{
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        // أرضيةٌ صلبة لا شفافة: فوق صورة الثيم كان الزرّ يكاد يختفي.
        backgroundColor: mine ? colors.claySoft : colors.card,
        borderColor: mine ? colors.clay : colors.line,
      }}
    >
      <View style={{ opacity: mine ? 1 : 0.72 }}>
        <ReactionGlyph kind={mine?.kind ?? "SMILE"} emoji={mine?.emoji} size={20} />
      </View>
    </Pressable>
  );

  return (
    <View style={head ? undefined : { marginTop: 8 }}>
      {/* الزرّ في الطرف الأيسر من المنشور — كما في الويب. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: head ? "flex-start" : "center",
          justifyContent: head ? "flex-start" : "flex-end",
          gap: head ? 8 : 0,
          paddingHorizontal: inset ? 12 : 0,
          paddingTop: inset ? 10 : 0,
          paddingBottom: inset ? 8 : 0,
        }}
      >
        {head ? <View style={{ flex: 1 }}>{head}</View> : null}
        {button}
      </View>

      {panelFirst ? null : extra}

      {open ? (
        <View style={{ marginTop: 8, gap: 8, paddingHorizontal: inset ? 12 : 0 }}>
          {/*
            الصفّ ينزل سطراً ثانياً ولا يُقصّ.

            خمسة وجوه، ففاصل، فإيموجيان، فـ«＋» — مجموعها أعرض من شاشةٍ
            ضيّقة، فكان آخرها يخرج عن الحافة. وآخرها هو «＋» الذي يفتح
            لوحة الإيموجي كاملة، فكان المشترك لا يرى ما دفع ثمنه.
            والالتفاف لا التمرير: ما يُمرَّر إليه يحتاج أن يُكتشف، وهذا
            بابُ ميزةٍ مدفوعة لا يُخبّأ.
          */}
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
            {faces.map((kind) => (
              <Pressable
                key={kind}
                accessibilityLabel={kind}
                onPress={() => choose(kind)}
                style={{ width: 36, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 12 }}
              >
                <ReactionGlyph kind={kind} size={25} />
              </Pressable>
            ))}

            <View style={{ width: 1, height: 24, backgroundColor: colors.line, marginHorizontal: 2 }} />

            {isPlus ? (
              <>
                {CUSTOM.slice(0, 2).map((emoji) => (
                  <Pressable
                    key={emoji}
                    onPress={() => choose("CUSTOM", emoji)}
                    style={{ width: 36, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 12 }}
                  >
                    <Text style={{ fontSize: 21 }}>{emoji}</Text>
                  </Pressable>
                ))}
                {/* «＋» يفتح الكيبورد كاملاً — الاشتراك يَعِد بكل الإيموجي لا باثنين. */}
                <Pressable
                  accessibilityLabel="كل الإيموجي"
                  onPress={() => setBoard((v) => !v)}
                  style={{ width: 36, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 12 }}
                >
                  <Text style={{ fontSize: 18, fontWeight: "700", color: colors.clayInk }}>
                    {board ? "×" : "＋"}
                  </Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                accessibilityLabel="الإيموجي الحر لمشتركي آثار+"
                onPress={() => router.push("/subscribe" as never)}
                style={{ width: 36, height: 40, alignItems: "center", justifyContent: "center" }}
              >
                <LockIcon size={16} color={colors.goldInk} />
              </Pressable>
            )}
          </View>

          {board ? (
            <ScrollView
              /*
                لوحةٌ تنزل داخل قائمةٍ تنزل: أندرويد يعطي الإيماءة للأعلى
                ما لم يُؤذن للداخل صراحةً، فكانت اللوحة لا تتحرّك تحت
                الإصبع ويبقى نصفُها مخفيّاً.
              */
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 208, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card }}
              contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", padding: 6 }}
            >
              {EMOJI_GROUPS.map((group) => (
                <View key={group.label} style={{ width: "100%" }}>
                  {/*
                    عنوانُ المجموعة فوق صفوفها: لوحةٌ من مئاتٍ بلا عناوين
                    تُقرأ كومةً، ومن نزل فيها لا يعرف أين هو.
                  */}
                  <Text
                    style={{
                      width: "100%",
                      color: colors.muted,
                      fontSize: 10.5,
                      fontWeight: "600",
                      paddingHorizontal: 4,
                      paddingVertical: 4,
                      textAlign: "right",
                    }}
                  >
                    {group.label}
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                    {group.items.map((emoji) => (
                      <Pressable
                        // المفتاح يحمل اسم المجموعة: الوجه الواحد يجلس في مجموعتين.
                        key={`${group.label}:${emoji}`}
                        onPress={() => choose("CUSTOM", emoji)}
                        style={{ width: "12.5%", height: 36, alignItems: "center", justifyContent: "center" }}
                      >
                        <Text style={{ fontSize: 20 }}>{emoji}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : null}

          {author || moderate ? (
            <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
              {asking ? (
                <>
                  <Pressable
                    disabled={pending}
                    onPress={() => {
                      setOpen(false);
                      setAsking(false);
                      remove.mutate();
                    }}
                    style={{ height: 32, paddingHorizontal: 12, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: colors.live }}
                  >
                    <Text style={{ color: "#fff", fontSize: 11.5, fontWeight: "700" }}>أحذفها</Text>
                  </Pressable>
                  <Pressable onPress={() => setAsking(false)} style={{ height: 32, paddingHorizontal: 10, justifyContent: "center" }}>
                    <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>تراجع</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable onPress={() => setAsking(true)} style={{ height: 32, paddingHorizontal: 10, justifyContent: "center" }}>
                  {/*
                    ويُقال للمشرف إنّه يحذف بصلاحية لا بملكية: زرٌّ بنصِّ
                    صاحبِها يُنسيه أنّ الحذف يُسجَّل باسمه.
                  */}
                  <Text style={{ color: colors.live, fontSize: 11.5, fontWeight: "600" }}>
                    {author ? "احذف اللحظة" : "احذفها بصلاحية الإشراف"}
                  </Text>
                </Pressable>
              )}
            </View>
          ) : null}

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="علّق…"
              placeholderTextColor={colors.faint}
              maxLength={500}
              accessibilityLabel="تعليق"
              style={{
                flex: 1,
                height: 36,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.line,
                backgroundColor: colors.paper,
                paddingHorizontal: 14,
                fontSize: 12.5,
                color: colors.ink,
              }}
              onSubmitEditing={() => {
                const text = body.trim();
                if (!text) return;
                setBody("");
                setOpen(false);
                comment.mutate(text);
              }}
            />
            {body.trim() ? (
              <Pressable
                disabled={pending}
                onPress={() => {
                  const text = body.trim();
                  if (!text) return;
                  setBody("");
                  setOpen(false);
                  comment.mutate(text);
                }}
                style={{ height: 36, paddingHorizontal: 14, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay }}
              >
                {pending ? (
                  <ActivityIndicator size="small" color={colors.onBrand} />
                ) : (
                  <Text style={{ color: colors.onBrand, fontSize: 12, fontWeight: "700" }}>إرسال</Text>
                )}
              </Pressable>
            ) : null}

            {/*
              الإبلاغ بجانب «إرسال»: المكان الذي يُفتح قصداً على اللحظة.
              ولا يُبلّغ أحدٌ عن لحظته، فلا يُعرض لصاحبها.
            */}
            {/*
              والمشرف لا يُبلغ: يحكم. زرُّ «بلاغ» أمامه يرسل القضيّة إلى
              نفسه، و«احذفها بصلاحية الإشراف» فوقه يؤدّي الغرض بضغطة.
            */}
            {author || moderate ? null : <ReportButton target="MOMENT" targetId={momentId} />}
          </View>
        </View>
      ) : null}

      {panelFirst ? extra : null}
    </View>
  );
}
