import { useState } from "react";
import { View, Text, Pressable, Modal, ActivityIndicator } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, firstColor, type Charm } from "./avatar";
import { MediaImage } from "./media-image";
import { CloseIcon } from "./icons";
import { api } from "../lib/api";
import { keys, useStore } from "../lib/queries";
import { coinText } from "../lib/format";
import { colors } from "../theme/tokens";

/** صنفٌ يلبسه صاحب الملف — إطارٌ أو تميمة — كما يُعرض في المتجر. */
export type WornItem = {
  id: string;
  name: string;
  kind: string;
  spec: string;
  mediaId: string | null;
  priceCoins: number;
  plusOnly: boolean;
} | null;

const KIND_LABEL: Record<string, string> = {
  FRAME: "إطار",
  CHARM: "تميمة",
  THEME: "ثيم",
  BACKGROUND: "خلفية",
};

/**
 * صورة العرض تُضغط فتُسأل: أيّها تريد؟
 *
 * الصورة نفسها، أو الصنف الذي يلبسه صاحبها — فالإطار والتميمة يُريان على
 * الناس قبل أن يُريا في المتجر، ومن أعجبه ما رأى يعرف اسمه وسعره من
 * مكانه. وما لا يلبسه لا يُعرض سطراً فارغاً.
 */
export function AvatarMenu({
  name,
  size,
  mediaId,
  frameSpec,
  charm,
  frame,
  charmItem,
}: {
  name: string;
  size: number;
  mediaId: string | null;
  frameSpec?: string | null;
  charm?: Charm;
  frame: WornItem;
  charmItem: WornItem;
}) {
  const [view, setView] = useState<"none" | "menu" | "photo" | "frame" | "charm">("none");
  const close = () => setView("none");

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`صورة ${name}`}
        onPress={() => setView("menu")}
      >
        <Avatar name={name} size={size} frameSpec={frameSpec} charm={charm} mediaId={mediaId} />
      </Pressable>

      {view === "menu" ? (
        <Sheet onClose={close} title={name}>
          <Row label="عرض صورة الملف الشخصي" onPress={() => setView("photo")} />
          {charmItem ? (
            <Row
              label="عرض معلومات التميمة"
              hint={charmItem.name}
              art={charmItem}
              onPress={() => setView("charm")}
            />
          ) : null}
          {frame ? (
            <Row
              label="عرض معلومات الإطار"
              hint={frame.name}
              art={frame}
              onPress={() => setView("frame")}
            />
          ) : null}
        </Sheet>
      ) : null}

      {view === "photo" ? (
        <Modal transparent animationType="fade" onRequestClose={close}>
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
                top: 16,
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
      {view === "frame" && frame ? <ItemSheet item={frame} onClose={close} /> : null}
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

  const buy = useMutation({
    mutationFn: () => api<{ ok?: string }>(`/v1/store/${item.id}/buy`, { method: "POST" }),
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
  const free = item.priceCoins === 0;

  return (
    <Sheet onClose={onClose} title={KIND_LABEL[item.kind] ?? "صنف"}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 4, paddingVertical: 8 }}>
        <ItemArt item={item} size={80} radius={16} />

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "700", textAlign: "right" }}>
            {item.name}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 2, textAlign: "right" }}>
            {KIND_LABEL[item.kind] ?? "صنف"}
            {item.plusOnly ? " · لمشتركي آثار+" : ""}
          </Text>
          <Text style={{ color: colors.clayInk, fontSize: 14, fontWeight: "600", marginTop: 4, textAlign: "right" }}>
            {item.priceCoins > 0 ? coinText(item.priceCoins) : "يُكتسب بالوقت"}
          </Text>
        </View>
      </View>

      {owned || said?.ok ? (
        <View style={{ marginTop: 12, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip }}>
          <Text style={{ color: colors.ink2, fontSize: 13.5, fontWeight: "600" }}>
            {said?.ok ?? "تملكه — البسه من إكسسواراتك"}
          </Text>
        </View>
      ) : free ? (
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
            <ActivityIndicator color={colors.onBrand} />
          ) : (
            <Text style={{ color: colors.onBrand, fontSize: 14, fontWeight: "700" }}>
              {`اشترِ بـ${coinText(item.priceCoins)}`}
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
 * التميمة تُحتوى ولا تُقصّ — رسمٌ شفّافٌ حرّ، وقصُّه في قرصٍ يأكل طرفه.
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
        backgroundColor: firstColor(item.spec, colors.chip),
      }}
    >
      {item.mediaId ? (
        <MediaImage
          mediaId={item.mediaId}
          resizeMode={item.kind === "CHARM" ? "contain" : "cover"}
          style={{ width: size, height: size }}
        />
      ) : null}
    </View>
  );
}

/** نافذةٌ من الأسفل تُغلق باللمس خارجها. */
function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(14,26,36,.42)" }} onPress={onClose} />

      <View
        style={{
          backgroundColor: colors.paper,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          borderTopWidth: 1,
          borderTopColor: colors.line,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 32,
        }}
      >
        {/* مقبضٌ يقول إنّ النافذة تُغلق بسحبها. */}
        <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: "center", marginBottom: 12 }} />

        <Text style={{ color: colors.ink2, fontSize: 13, fontWeight: "700", textAlign: "center", marginBottom: 8 }}>
          {title}
        </Text>

        {children}
      </View>
    </Modal>
  );
}

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
