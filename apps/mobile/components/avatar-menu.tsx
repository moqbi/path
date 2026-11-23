import { Spinner } from "./spinner";
import { ORIENTATIONS } from "../lib/stage";
import { useState } from "react";
import { View, Pressable, Modal } from "react-native";
import { Text } from "./type";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, firstColor, type Charm, type Frame } from "./avatar";
import { MediaImage } from "./media-image";
import { CloseIcon } from "./icons";
import { api } from "../lib/api";
import { keys, useStore } from "../lib/queries";
import { ar, coinText, daysLabel } from "../lib/format";
import { colors } from "../theme/tokens";
import { Sheet } from "./sheet";
import { Preview } from "./store-grid";
import { TagPill } from "./name-tag";
import { viewPhoto } from "./photo-viewer";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** صنفٌ يلبسه صاحب الملف — إطارٌ أو تشارم — كما يُعرض في المتجر. */
export type WornItem = {
  id: string;
  name: string;
  kind: string;
  spec: string;
  mediaId: string | null;
  priceCoins: number;
  plusOnly: boolean;
  /** تشارمٌ حصريٌّ لوسم (القاعدة ٤٧٩) — لا يُباع، ويُقال لمن رآه لمن هو. */
  exclusiveTag?: { name: string; bg: string; fg: string } | null;
} | null;

const KIND_LABEL: Record<string, string> = {
  FRAME: "إطار",
  CHARM: "تشارم",
  THEME: "ثيم",
  BACKGROUND: "خلفية",
};

/**
 * صورة العرض تُضغط فتُسأل: أيّها تريد؟
 *
 * الصورة نفسها، أو الصنف الذي يلبسه صاحبها — فالإطار والتشارم يُريان على
 * الناس قبل أن يُريا في المتجر، ومن أعجبه ما رأى يعرف اسمه وسعره من
 * مكانه. وما لا يلبسه لا يُعرض سطراً فارغاً.
 */
export function AvatarMenu({
  name,
  size,
  mediaId,
  frame,
  charm,
  frameItem,
  charmItem,
}: {
  name: string;
  size: number;
  mediaId: string | null;
  frame?: Frame;
  charm?: Charm;
  frameItem: WornItem;
  charmItem: WornItem;
}) {
  const [view, setView] = useState<"none" | "menu" | "photo" | "frame" | "charm">("none");
  const insets = useSafeAreaInsets();
  const close = () => setView("none");

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`صورة ${name}`}
        onPress={() => setView("menu")}
      >
        <Avatar name={name} size={size} frame={frame} charm={charm} mediaId={mediaId} />
      </Pressable>

      {view === "menu" ? (
        <Sheet onClose={close} title={name}>
          <Row
            label="عرض صورة الملف الشخصي"
            onPress={() => {
              /*
                الصورةُ في نافذة الصور العامّة (`viewPhoto`): زرُّ إغلاقها تحت
                شريط الحالة لا فوقه، وتُغلق بالسحب إلى أسفل. وكانت هنا نافذةٌ
                ثانية زرُّها على بُعد ١٦ من أعلى الشاشة — تحت الجزيرة الديناميكية
                حيث لا تصله الضغطة. والتأخيرُ حتى تُغلق هذه النافذة: آبل لا تعرض
                نافذةً وأختُها تُغلق (القاعدة ١٢٦).
              */
              if (mediaId) {
                setView("none");
                setTimeout(() => viewPhoto(mediaId), 380);
              } else {
                setView("photo");
              }
            }}
          />
          {charmItem ? (
            <Row
              label="عرض معلومات التشارم"
              hint={charmItem.name}
              art={charmItem}
              onPress={() => setView("charm")}
            />
          ) : null}
          {frameItem ? (
            <Row
              label="عرض معلومات الإطار"
              hint={frameItem.name}
              art={frameItem}
              onPress={() => setView("frame")}
            />
          ) : null}
        </Sheet>
      ) : null}

      {view === "photo" ? (
        <Modal supportedOrientations={ORIENTATIONS} transparent animationType="fade" onRequestClose={close}>
          <Pressable
            onPress={close}
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              backgroundColor: "rgba(8,14,20,.94)",
            }}
          >
            {mediaId ? (
              <MediaImage
                mediaId={mediaId}
                resizeMode="contain"
                style={{ width: "100%", height: "100%", borderRadius: 18 }}
              />
            ) : (
              <Avatar name={name} size={220} />
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="إغلاق"
              onPress={close}
              style={{
                position: "absolute",
                left: 16,
                top: insets.top + 12,
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,.16)",
              }}
            >
              <CloseIcon size={18} color="#fff" />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {view === "charm" && charmItem ? <ItemSheet item={charmItem} onClose={close} /> : null}
      {view === "frame" && frameItem ? <ItemSheet item={frameItem} onClose={close} /> : null}
    </>
  );
}

/**
 * بطاقة الصنف: شكله واسمه وسعره — ويُشترى من مكانه.
 *
 * «افتحه في المتجر» كان يرمي صاحبه إلى واجهةٍ فيها عشرات الأصناف ليبحث
 * عمّا رآه قبل لحظة. الشراء هنا، ثم يُلبَس من الإكسسوارات.
 *
 * وما تملكه يُقرأ من المتجر نفسه (`useStore`) لا يُمرَّر مع كل صورة:
 * السؤال يُطرح حين تُفتح البطاقة وحدها، وردّه محفوظٌ لبقية الشاشات.
 */
function ItemSheet({ item, onClose }: { item: NonNullable<WornItem>; onClose: () => void }) {
  const store = useStore();
  const client = useQueryClient();
  const [said, setSaid] = useState<{ ok?: string; error?: string } | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  /*
    الصنفُ كما في المتجر لا كما يُرسل مع الملفّ: هناك مُدَدُه وأسعارُها (القاعدة ٤٤ج)
    وشرطُ اكتسابه. كان يُقرأ `priceCoins` وحده — وصنفٌ بمُددٍ سعرُه المفرد صفر — فيُقال
    «يُكتسب بالوقت» ويُشترى بلا مدّةٍ فيردّه الخادم «حدّد المدّة».
  */
  const full = store.data?.items.find((one) => one.id === item.id) ?? null;
  const plans = full?.plans ?? [];
  const plan = plans.find((one) => one.id === planId) ?? plans[0] ?? null;
  const isPlus = store.data?.isPlus ?? false;
  const price = (coins: number) => (isPlus ? Math.round(coins * 0.8) : coins);
  const earned = full ? full.earnedAfterDays !== null : item.priceCoins === 0;
  const cost = plan ? price(plan.priceCoins) : price(full?.priceCoins ?? item.priceCoins);

  const buy = useMutation({
    mutationFn: () =>
      api<{ ok?: string }>(`/v1/store/${item.id}/buy`, {
        method: "POST",
        body: JSON.stringify(plan ? { plan: plan.id } : {}),
      }),
    onSuccess: (data) => {
      setSaid({ ok: data.ok ?? "صار لك — البسه من إكسسواراتك" });
      void client.invalidateQueries({ queryKey: keys.store });
      void client.invalidateQueries({ queryKey: keys.me });
    },
    // الإجراء يردّ نصّ الخطأ ولا يرميه إلى الشاشة: الرمي يُسقطها فيرى
    // صاحبها فشلاً بلا سبب.
    onError: (problem) =>
      setSaid({ error: problem instanceof Error ? problem.message : "تعذّر الشراء" }),
  });

  const owned = store.data?.owned.includes(item.id) ?? false;
  // صنفٌ ليس في المتجر (مخفيٌّ أو داخل حزمة) لا يُشترى من هنا.
  const sold = store.isSuccess && !full;

  return (
    <Sheet onClose={onClose} title={KIND_LABEL[item.kind] ?? "صنف"}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 4, paddingVertical: 8 }}>
        <View style={{ width: 80, height: 80, alignItems: "center", justifyContent: "center" }}>
          {full ? <Preview item={full} /> : <ItemArt item={item} size={72} radius={16} />}
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "700", textAlign: "right" }}>
            {item.name}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 2, textAlign: "right" }}>
            {KIND_LABEL[item.kind] ?? "صنف"}
            {item.plusOnly ? " · لمشتركي آثار+" : ""}
          </Text>
          {item.exclusiveTag ? (
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              <Text style={{ color: colors.ink2, fontSize: 13.5, fontWeight: "600", textAlign: "right" }}>
                {KIND_LABEL[item.kind] === "تشارم" ? "هذا التشارم خاص لـ" : "هذا الصنف خاص لـ"}
              </Text>
              <TagPill tag={item.exclusiveTag} size={12} />
            </View>
          ) : store.isLoading ? null : (
            <Text style={{ color: colors.clayInk, fontSize: 14, fontWeight: "600", marginTop: 4, textAlign: "right" }}>
              {full && full.earnedAfterDays !== null
                ? `يُكتسب بعد ${ar(full.earnedAfterDays)} يوم`
                : sold
                  ? "غير متاح في المتجر الآن"
                  : plan
                    ? `${coinText(cost)} · ${daysLabel(plan.days)}`
                    : earned
                      ? "يُكتسب بالوقت"
                      : coinText(cost)}
            </Text>
          )}
        </View>
      </View>

      {/* المُدد كما في بطاقة المتجر: المختارةُ ظاهرة، والضغطُ يفتح البقيّة. */}
      {plans.length > 0 && !owned && !said?.ok && !earned ? (
        <View style={{ marginTop: 8 }}>
          <Pressable
            onPress={() => setPicking((was) => !was)}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 44, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card }}
          >
            <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "600", textAlign: "right" }}>
              المدّة: {plan ? daysLabel(plan.days) : ""}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13 }}>{picking ? "▴" : "▾"}</Text>
          </Pressable>
          {picking ? (
            <View style={{ marginTop: 4, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, overflow: "hidden" }}>
              {plans.map((one) => {
                const on = plan?.id === one.id;
                return (
                  <Pressable
                    key={one.id}
                    onPress={() => {
                      setPlanId(one.id);
                      setPicking(false);
                    }}
                    style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 11, backgroundColor: on ? colors.claySoft : "transparent" }}
                  >
                    <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: on ? "700" : "500" }}>{daysLabel(one.days)}</Text>
                    <Text style={{ color: colors.clayInk, fontSize: 13, fontWeight: "600" }}>{coinText(price(one.priceCoins))}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}

      {item.exclusiveTag ? (
        <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center", marginTop: 12 }}>
          لا يُباع في المتجر — يلبسه من يحمل هذا الوسم.
        </Text>
      ) : owned || said?.ok ? (
        <View style={{ marginTop: 12, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip }}>
          <Text style={{ color: colors.ink2, fontSize: 13.5, fontWeight: "600" }}>
            {said?.ok ?? "تملكه — البسه من إكسسواراتك"}
          </Text>
        </View>
      ) : store.isLoading || sold ? null : earned ? (
        <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center", marginTop: 12 }}>
          هذا الصنف يُكتسب بالوقت لا يُشترى.
        </Text>
      ) : (
        <Pressable
          disabled={buy.isPending}
          onPress={() => {
            setSaid(null);
            buy.mutate();
          }}
          style={{
            marginTop: 12,
            height: 48,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.clay,
            opacity: buy.isPending ? 0.6 : 1,
          }}
        >
          {buy.isPending ? (
            <Spinner color={colors.onBrand} />
          ) : (
            <Text style={{ color: colors.onBrand, fontSize: 14, fontWeight: "700" }}>
              {plan ? `اشترِ ${daysLabel(plan.days)} بـ${coinText(cost)}` : `اشترِ بـ${coinText(cost)}`}
            </Text>
          )}
        </Pressable>
      )}

      {said?.error ? (
        <Text style={{ color: colors.live, fontSize: 12, textAlign: "center", marginTop: 8 }}>
          {said.error}
        </Text>
      ) : null}
    </Sheet>
  );
}

/**
 * شكل الصنف: صورته إن رُفعت، وإلا لونه.
 *
 * التشارم تُحتوى ولا تُقصّ — رسمٌ شفّافٌ حرّ، وقصُّه في قرصٍ يأكل طرفه.
 */
function ItemArt({
  item,
  size,
  radius,
}: {
  item: NonNullable<WornItem>;
  size: number;
  radius: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: "hidden",
        // الرسمُ المرفوع بلا أرضيّةٍ تحته: التدرّجُ الافتراضيّ كهرمانيّ فيُقرأ جزءاً من الصنف.
        backgroundColor: item.mediaId ? "transparent" : firstColor(item.spec, colors.chip),
      }}
    >
      {item.mediaId ? (
        <MediaImage
          mediaId={item.mediaId}
          resizeMode={item.kind === "CHARM" || item.kind === "FRAME" ? "contain" : "cover"}
          style={{ width: size, height: size }}
        />
      ) : null}
    </View>
  );
}

/** نافذةٌ من الأسفل تُغلق باللمس خارجها. */
function Row({
  label,
  hint,
  art,
  onPress,
}: {
  label: string;
  hint?: string;
  art?: NonNullable<WornItem>;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        marginTop: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.card,
        padding: 14,
      }}
    >
      {art ? <ItemArt item={art} size={36} radius={18} /> : null}

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "600", textAlign: "right" }}>
          {label}
        </Text>
        {hint ? (
          <Text style={{ color: colors.muted, fontSize: 11.5, textAlign: "right" }}>{hint}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}
