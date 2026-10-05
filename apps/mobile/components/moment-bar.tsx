import { View, Pressable } from "react-native";
import { ReactionGlyph } from "./reactions";
import { LockIcon } from "./icons";
import { openReactSheet } from "./react-sheet";
import { useAudience } from "../lib/queries";
import { colors } from "../theme/tokens";

type Mine = { kind: string; emoji: string | null } | null;

/**
 * شريط اللحظة: زرٌّ واحد في طرف المنشور.
 *
 * **وبالضغط عليه تُفتح نافذةٌ زجاجيّة** (`ReactSheet` في الجذر — القاعدة ٢٤٧)
 * فيها الوجوه ومساحةُ التعليق والبلاغ والحذف — **بقرار المالك**: كانت لوحةً
 * تنفتح داخل البطاقة فتدفع ما تحتها. والبطاقةُ لا تتحرّك الآن.
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
  media,
  footer,
  locked = false,
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
  /**
   * صورةُ البطاقة: تحت صفّ الزرّ لا تحته — كان الزرّ يطفو على الصورة نفسها
   * فيُقرأ بقعةً عليها. والبطاقةُ تترك لها حشوةَ صفّ الزرّ من أعلاها.
   */
  media?: React.ReactNode;
  /**
   * ما تحت اللوحة: الوجوه والتعليقات. اللوحةُ تُفتح بين المتن وبينه —
   * **بقرار المالك**: كانت تُفتح في أعلى البطاقة فوق النصّ، وصفُّ وجوهها
   * يتكرّر مع صفّ الوجوه تحتها.
   */
  footer?: React.ReactNode;
  /** التعليقاتُ مقفلة بيد صاحبها: يبقى التفاعل، ويذهب الحقل. */
  locked?: boolean;
}) {
  const audience = useAudience(momentId, author);
  const isLocked = author ? (audience.data?.commentsLocked ?? locked) : locked;

  const button = (
    <Pressable
      accessibilityLabel={isLocked ? "تفاعل — التعليقات مقفلة" : "تفاعل"}
      onPress={() =>
        openReactSheet({ momentId, momentKind, mine, isPlus, author, moderate, locked: isLocked })
      }
      style={{
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        // أرضيةٌ صلبة لا شفافة: فوق صورة الثيم كان الزرّ يكاد يختفي.
        backgroundColor: mine || isLocked ? colors.claySoft : colors.card,
        borderColor: mine || isLocked ? colors.clay : colors.line,
      }}
    >
      {/* التعليقاتُ مقفلة: الزرّ نفسه يقولها قبل أن يُفتح — بقرار المالك. */}
      {isLocked ? (
        <LockIcon size={15} color={colors.clayInk} />
      ) : (
        <View style={{ opacity: mine ? 1 : 0.72 }}>
          <ReactionGlyph kind={mine?.kind ?? "SMILE"} emoji={mine?.emoji} size={20} />
        </View>
      )}
    </Pressable>
  );

  return (
    <View style={head || inset ? undefined : { marginTop: 8 }}>
      {inset ? (
        <>
          {/*
            الزرُّ في ركن البطاقة الأعلى — **بقرار المالك** — والصورةُ تنزل تحته
            في إطارها، والمتنُ بعدها. وبلا صورةٍ يبدأ المتنُ بجانبه.
          */}
          <View style={{ position: "absolute", top: 10, left: 12, zIndex: 2 }}>{button}</View>
          {media}
          {extra}
        </>
      ) : (
        /* الزرّ في الطرف الأيسر من المنشور — كما في الويب. */
        <View
          style={{
            flexDirection: "row",
            alignItems: head ? "flex-start" : "center",
            justifyContent: head ? "flex-start" : "flex-end",
            gap: head ? 8 : 0,
          }}
        >
          {head ? <View style={{ flex: 1 }}>{head}</View> : null}
          {/*
            على خطّ زرّ البطاقة نفسه: ذاك داخل حدّها (١) وحشوتها (١٢)، فزرُّ سطر
            الحدث يدخل بالمقدار نفسه — وإلّا تعرّج عمودُ الأزرار بين بطاقةٍ وسطر.
          */}
          <View style={head ? { marginLeft: 13 } : undefined}>{button}</View>
        </View>
      )}

      {inset ? null : extra}

      {footer}
    </View>
  );
}
