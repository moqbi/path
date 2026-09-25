import { useState } from "react";
import { View, Pressable, Modal } from "react-native";
import { Text } from "./type";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MediaImage } from "./media-image";
import { firstColor, frameInset } from "./avatar";
import { CheckIcon, LockIcon } from "./icons";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { keys, type StoreItem } from "../lib/queries";
import { ar, coinText } from "../lib/format";
import { colors } from "../theme/tokens";
import { Sheet } from "./sheet";

/** اسمُ النوع كما يُقرأ في بطاقته — كنسخة الويب. */
const KIND_LABEL: Record<string, string> = {
  FRAME: "إطار",
  THEME: "ثيم",
  CHARM: "تميمة",
  BACKGROUND: "ثيم",
  BUNDLE: "باقة",
};

/**
 * معاينة الصنف تتبع نوعه.
 *
 * الإطار حلقةٌ حول وجه، والثيم مساحةُ لون، والتميمة قطعةٌ صغيرة —
 * وعرضُها كلِّها مربّعاً واحداً كان يجعل الإطار يُقرأ قرصاً والتميمة
 * لطخة.
 */
function Preview({ item }: { item: StoreItem }) {
  const paint = firstColor(item.spec, colors.chip);

  /*
    الحزمة تُعرض بما فيها: رسومٌ متداخلة وعددُ ما بقي — فما يُشترى يُرى
    قبل شرائه (القاعدة ٦ تمنع الصناديق العشوائية).
  */
  if (item.kind === "BUNDLE") {
    const inside = (item.holds ?? []).map((row) => row.item);
    const shown = inside.slice(0, 3);
    return (
      <View style={{ height: 62, flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
        {shown.length === 0 ? (
          <View style={{ width: 54, height: 54, borderRadius: 12, backgroundColor: colors.chip }} />
        ) : (
          shown.map((one, index) => (
            <View
              key={one.id}
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                overflow: "hidden",
                marginLeft: index === 0 ? 0 : -14,
                borderWidth: 2,
                borderColor: colors.card,
                backgroundColor: firstColor(one.spec, colors.chip),
              }}
            >
              {one.mediaId ? (
                <MediaImage
                  mediaId={one.mediaId}
                  resizeMode={one.kind === "CHARM" ? "contain" : "cover"}
                  style={{ width: 40, height: 40 }}
                />
              ) : null}
            </View>
          ))
        )}
        {inside.length > shown.length ? (
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              marginLeft: -14,
              borderWidth: 2,
              borderColor: colors.card,
              backgroundColor: colors.chip,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: colors.ink2, fontSize: 11, fontWeight: "700" }}>
              +{ar(inside.length - shown.length)}
            </Text>
          </View>
        ) : null}
      </View>
    );
  }

  if (item.kind === "FRAME") {
    /*
      الإطار المصوَّر يُرسم **فوق** قرصٍ محايد لا خلفه — كما يُرى على
      الوجه تماماً (`Avatar`): كان يُدهن خلفيةً والقرصُ فوقه، فتُخفى
      حافّتُه الداخلية وزخرفتُها.
    */
    if (item.mediaId) {
      return (
        <View style={{ width: 62, height: 62 }}>
          {/* الوجهُ في فراغ الإطار لا في مربّع رسمه: رسمٌ بجناحين فراغُه
              نصفُ عرضه، فقرصٌ يملأ المربّع يخرج من تحته. */}
          {(() => {
            const off = frameInset(item, 62);
            const face = 62 - off * 2;
            return (
              <View
                style={{
                  position: "absolute",
                  left: off,
                  top: off,
                  width: face,
                  height: face,
                  borderRadius: face / 2,
                  backgroundColor: colors.chip,
                }}
              />
            );
          })()}
          <MediaImage
            mediaId={item.mediaId}
            resizeMode="contain"
            style={{ width: 62, height: 62 }}
          />
        </View>
      );
    }

    return (
      <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: paint, padding: 3 }}>
        <View style={{ flex: 1, borderRadius: 28, backgroundColor: colors.card }} />
      </View>
    );
  }

  if (item.kind === "CHARM") {
    return (
      <View style={{ width: 52, height: 52, marginVertical: 5, alignItems: "center", justifyContent: "center" }}>
        {item.mediaId ? (
          <MediaImage mediaId={item.mediaId} resizeMode="contain" style={{ width: 52, height: 52 }} />
        ) : (
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: paint }} />
        )}
      </View>
    );
  }

  return (
    <View style={{ width: "100%", height: 62, borderRadius: 12, backgroundColor: paint, overflow: "hidden" }}>
      {item.mediaId ? <MediaImage mediaId={item.mediaId} style={{ width: "100%", height: 62 }} /> : null}
    </View>
  );
}

/**
 * شبكة الأصناف.
 *
 * ما تملكه يُلبَس من هنا كما يُلبَس من ملفك، والملبوس يُقال «ملبوس» لا
 * يُخفى. والمنعُ يُشرَح: «رصيدك لا يكفي» أو «باقي ٥ أيام» — لا زرٌّ
 * ميّتٌ بلا سبب.
 */
export function StoreGrid({
  items,
  owned,
  isPlus,
  coins,
  daysHere,
  equipped,
}: {
  items: StoreItem[];
  owned: string[];
  isPlus: boolean;
  coins: number;
  daysHere: number;
  equipped: { frame: string | null; theme: string | null; charm: string | null };
}) {
  const client = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  /* البطاقة المفتوحة: الضغطة تعرض لا تشتري. */
  const [open, setOpen] = useState<StoreItem | null>(null);
  /* نتيجةُ الشراء تُقال نافذةً: «تمّ الشراء» أو «رصيدك لا يكفي». */
  const [said, setSaid] = useState<{ ok?: string; error?: string } | null>(null);
  const [showing, setShowing] = useState(false);

  const refresh = () => {
    /*
       وصاحبُ الجلسة نفسه يُعاد سؤاله: الصورةُ والإطار والتميمة في كل
       شاشةٍ تُرسم من `useSession` لا من ذاكرة الاستعلامات، فكان «ألبسه»
       يُحفظ على الخادم ولا يتغيّر شيءٌ على الشاشة حتى تُفتح «إكسسواراتي»
       — وهي التي كانت تسأل.
    */
    void useSession.getState().refresh();
    void client.invalidateQueries({ queryKey: keys.store });
    void client.invalidateQueries({ queryKey: keys.me });
    void client.invalidateQueries({ queryKey: ["me"] });
    void client.invalidateQueries({ queryKey: ["feed"] });
  };

  const buy = useMutation({
    mutationFn: (id: string) => api<{ ok: string }>(`/v1/store/${id}/buy`, { method: "POST" }),
    onSuccess: (row) => {
      refresh();
      setSaid({ ok: row.ok });
    },
    onError: (problem: Error) => setSaid({ error: problem.message }),
  });
  const wear = useMutation({
    mutationFn: (id: string) => api(`/v1/store/${id}/equip`, { method: "POST" }),
    onSuccess: refresh,
    onError: (problem: Error) => setError(problem.message),
  });
  const strip = useMutation({
    mutationFn: (kind: string) =>
      api("/v1/store/unequip", { method: "POST", body: JSON.stringify({ kind }) }),
    onSuccess: refresh,
    onError: (problem: Error) => setError(problem.message),
  });

  const ownedSet = new Set(owned);
  const price = (item: StoreItem) =>
    isPlus ? Math.round(item.priceCoins * 0.8) : item.priceCoins;

  const wornId = (item: StoreItem) =>
    item.kind === "FRAME" ? equipped.frame : item.kind === "CHARM" ? equipped.charm : equipped.theme;

  const pending = buy.isPending || wear.isPending || strip.isPending;

  if (items.length === 0) {
    return (
      <View style={{ marginBottom: 24, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, paddingVertical: 32, paddingHorizontal: 16 }}>
        <Text style={{ color: colors.muted, fontSize: 12.5, textAlign: "center" }}>
          ما فيه أصناف هنا بعد.
        </Text>
      </View>
    );
  }

  const chosen = open;

  return (
    <>
      {/* بطاقةُ الصنف: عرضٌ وشراء — الضغطة تفتح لا تشتري. */}
      {chosen ? (
        <Sheet onClose={() => { setShowing(false); setOpen(null); }} title={KIND_LABEL[chosen.kind] ?? "صنف"}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 8 }}>
            <View style={{ width: 80, height: 80, alignItems: "center", justifyContent: "center" }}>
              <Preview item={chosen} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "700", writingDirection: "auto" }}>
                {chosen.name}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 2 }}>
                {KIND_LABEL[chosen.kind] ?? "صنف"}
                {chosen.plusOnly ? " · لمشتركي آثار+" : ""}
                {chosen.kind === "BUNDLE" ? ` · ${ar(chosen.holds?.length ?? 0)} أصناف` : ""}
              </Text>
              <Text style={{ color: colors.clayInk, fontSize: 14, fontWeight: "600", marginTop: 4 }}>
                {chosen.earnedAfterDays !== null
                  ? `يُكتسب بعد ${ar(chosen.earnedAfterDays)} يوم`
                  : coinText(price(chosen))}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <Pressable
              onPress={() => setShowing(true)}
              style={{ height: 48, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: colors.ink2, fontSize: 13.5, fontWeight: "600" }}>عرض</Text>
            </Pressable>

            {ownedSet.has(chosen.id) ? (
              chosen.kind === "BUNDLE" ? (
                <View style={{ flex: 1, height: 48, borderRadius: 12, backgroundColor: colors.chip, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: colors.ink2, fontSize: 13, fontWeight: "600" }}>
                    صارت لك — ما فيها في إكسسواراتك
                  </Text>
                </View>
              ) : (
                <Pressable
                  disabled={pending}
                  onPress={() => {
                    if (wornId(chosen) === chosen.id) {
                      strip.mutate(
                        chosen.kind === "FRAME" ? "FRAME" : chosen.kind === "CHARM" ? "CHARM" : "BACKGROUND",
                      );
                    } else {
                      wear.mutate(chosen.id);
                    }
                    setOpen(null);
                  }}
                  style={{ flex: 1, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: wornId(chosen) === chosen.id ? colors.chip : colors.clay }}
                >
                  <Text
                    style={{
                      color: wornId(chosen) === chosen.id ? colors.ink2 : colors.onBrand,
                      fontSize: 14,
                      fontWeight: "700",
                    }}
                  >
                    {wornId(chosen) === chosen.id ? "انزعه" : "ألبسه"}
                  </Text>
                </Pressable>
              )
            ) : (chosen.plusOnly && !isPlus) ||
              (chosen.earnedAfterDays !== null && daysHere < chosen.earnedAfterDays) ? (
              <View style={{ flex: 1, height: 48, borderRadius: 12, backgroundColor: colors.chip, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>
                  {chosen.plusOnly && !isPlus
                    ? "هذا الصنف لمشتركي آثار+"
                    : `باقي ${ar((chosen.earnedAfterDays ?? 0) - daysHere)} يوم`}
                </Text>
              </View>
            ) : chosen.earnedAfterDays !== null ? (
              <View style={{ flex: 1, height: 48, borderRadius: 12, backgroundColor: colors.chip, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: colors.ink2, fontSize: 13, fontWeight: "600" }}>
                  صار لك — البسه من إكسسواراتك
                </Text>
              </View>
            ) : (
              <Pressable
                disabled={pending}
                onPress={() => buy.mutate(chosen.id)}
                style={{ flex: 1, height: 48, borderRadius: 12, backgroundColor: colors.clay, alignItems: "center", justifyContent: "center", opacity: pending ? 0.6 : 1 }}
              >
                <Text style={{ color: colors.onBrand, fontSize: 14, fontWeight: "700" }}>
                  {pending ? "نشتري…" : `اشترِ بـ${coinText(price(chosen))}`}
                </Text>
              </Pressable>
            )}
          </View>

          {/* والرصيد يُقال قبل الضغط لا بعده. */}
          {!ownedSet.has(chosen.id) &&
          chosen.earnedAfterDays === null &&
          !(chosen.plusOnly && !isPlus) &&
          coins < price(chosen) ? (
            <Text style={{ color: colors.muted, fontSize: 11.5, textAlign: "center", marginTop: 8 }}>
              رصيدك {coinText(coins)} — ينقصك {coinText(price(chosen) - coins)}
            </Text>
          ) : null}

          {/*
            نافذتا «عرض» والنتيجة **داخل** البطاقة لا بجانبها: آبل
            تعرض نافذةً واحدةً فوق الشاشة، فنافذةٌ أختٌ لنافذةٍ مفتوحة
            تُقدَّم خلفها فلا تُرى — وهذا سببُ أنّ «عرض» لم يكن يفعل شيئاً.
          */}
          {/* «عرض»: الرسم كاملاً. */}
          {showing && chosen ? (
            <Modal transparent animationType="fade" onRequestClose={() => setShowing(false)}>
              <Pressable
                onPress={() => setShowing(false)}
                style={{ flex: 1, backgroundColor: "rgba(14,26,36,.88)", alignItems: "center", justifyContent: "center", padding: 32 }}
              >
                {chosen.mediaId ? (
                  <MediaImage
                    mediaId={chosen.mediaId}
                    resizeMode="contain"
                    style={{ width: 280, height: 280 }}
                  />
                ) : (
                  <View style={{ width: 240, height: 240, borderRadius: 24, backgroundColor: firstColor(chosen.spec, colors.chip) }} />
                )}
              </Pressable>
            </Modal>
          ) : null}

          {/* والنتيجة نافذةٌ تُقرأ، لا سطرٌ في طرف الشاشة. */}
          {said ? (
            <Modal transparent animationType="fade" onRequestClose={() => setSaid(null)}>
              <View style={{ flex: 1, backgroundColor: "rgba(14,26,36,.5)", alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
                <View style={{ width: "100%", maxWidth: 300, borderRadius: 24, backgroundColor: colors.card, padding: 24 }}>
                  <Text
                    style={{
                      color: said.ok ? colors.clayInk : colors.live,
                      fontSize: 15,
                      fontWeight: "700",
                      textAlign: "center",
                    }}
                  >
                    {said.ok ? "تمّ الشراء" : said.error}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12.5, lineHeight: 21, textAlign: "center", marginTop: 6 }}>
                    {said.ok
                      ? chosen.kind === "BUNDLE"
                        ? "ما فيها صار لك — تلبسه من إكسسواراتك في «أنا»."
                        : "صار لك — تلبسه الآن أو من إكسسواراتك في «أنا»."
                      : "اشحن نقاطك من زرّ الرصيد في أعلى المتجر ثم أعِد المحاولة."}
                  </Text>
                  {/* ما اشتُري يُلبَس من مكانه: لا رحلةَ إلى «أنا» ليلبس ما رآه للتوّ. */}
                  {said.ok && chosen.kind !== "BUNDLE" ? (
                    <Pressable
                      disabled={wear.isPending}
                      onPress={() => {
                        wear.mutate(chosen.id);
                        setSaid(null);
                        setOpen(null);
                      }}
                      style={{ height: 46, borderRadius: 12, backgroundColor: colors.clay, alignItems: "center", justifyContent: "center", marginTop: 16 }}
                    >
                      <Text style={{ color: colors.onBrand, fontSize: 13.5, fontWeight: "700" }}>ألبسه الآن</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => {
                      setSaid(null);
                      setOpen(null);
                    }}
                    style={{
                      height: 46,
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: said.ok && chosen.kind !== "BUNDLE" ? 8 : 16,
                      backgroundColor: said.ok && chosen.kind !== "BUNDLE" ? colors.chip : colors.clay,
                    }}
                  >
                    <Text
                      style={{
                        color: said.ok && chosen.kind !== "BUNDLE" ? colors.ink2 : colors.onBrand,
                        fontSize: 13.5,
                        fontWeight: "700",
                      }}
                    >
                      {said.ok && chosen.kind !== "BUNDLE" ? "لاحقاً" : "تمام"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </Modal>
          ) : null}
        </Sheet>
      ) : null}


      {error ? (
        <View style={{ marginBottom: 12, borderRadius: 12, backgroundColor: colors.claySoft, paddingHorizontal: 16, paddingVertical: 12 }}>
          <Text accessibilityRole="alert" style={{ color: colors.clayInk, fontSize: 12.5, fontWeight: "600" }}>
            {error}
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        {items.map((item) => {
          const have = ownedSet.has(item.id);
          const worn = have && wornId(item) === item.id;
          const locked =
            (item.plusOnly && !isPlus) ||
            (item.earnedAfterDays !== null && daysHere < item.earnedAfterDays);

          return (
            <Pressable
              key={item.id}
              disabled={pending}
              onPress={() => {
                setError(null);
                setOpen(item);
              }}
              style={{
                width: "30.7%",
                alignItems: "center",
                gap: 10,
                paddingTop: 14,
                paddingBottom: 12,
                paddingHorizontal: 8,
                borderRadius: 16,
                backgroundColor: colors.card,
                borderWidth: worn ? 1.5 : 1,
                borderColor: worn ? colors.clay : colors.line,
                opacity: pending ? 0.6 : 1,
              }}
            >
              {item.earnedAfterDays !== null ? (
                <View style={{ position: "absolute", top: -8, alignSelf: "center", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, backgroundColor: colors.gold }}>
                  <Text style={{ color: colors.card, fontSize: 9.5, fontWeight: "600" }}>يُكتسب</Text>
                </View>
              ) : item.limited ? (
                <View style={{ position: "absolute", top: -8, alignSelf: "center", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, backgroundColor: colors.live }}>
                  <Text style={{ color: "#fff", fontSize: 9.5, fontWeight: "600" }}>محدودة</Text>
                </View>
              ) : null}

              <Preview item={item} />

              <Text style={{ color: colors.ink, fontSize: 11.5, fontWeight: "500" }} numberOfLines={1}>
                {item.name}
              </Text>

              {item.kind === "BUNDLE" && have ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <CheckIcon size={12} color={colors.clay} />
                  <Text style={{ color: colors.clayInk, fontSize: 10.5, fontWeight: "600" }}>
                    صارت لك
                  </Text>
                </View>
              ) : item.kind === "BUNDLE" ? (
                <>
                  <Text style={{ color: colors.faint, fontSize: 10 }}>
                    {ar(item.holds?.length ?? 0)} أصناف
                  </Text>
                  <Text style={{ color: colors.clayInk, fontSize: 11, fontWeight: "600" }}>
                    {coinText(price(item))}
                  </Text>
                </>
              ) : worn ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <CheckIcon size={12} color={colors.clay} />
                  <Text style={{ color: colors.clayInk, fontSize: 10.5, fontWeight: "600" }}>ملبوس</Text>
                </View>
              ) : have ? (
                <Text style={{ color: colors.clayInk, fontSize: 10.5, fontWeight: "600" }}>ألبسه</Text>
              ) : locked ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <LockIcon size={11} color={colors.faint} />
                  <Text style={{ color: colors.faint, fontSize: 10.5 }}>
                    {item.earnedAfterDays !== null ? `${ar(item.earnedAfterDays)} يوم` : "آثار+"}
                  </Text>
                </View>
              ) : (
                <Text style={{ color: colors.clayInk, fontSize: 11, fontWeight: "600" }}>
                  {coinText(price(item))}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </>
  );
}
