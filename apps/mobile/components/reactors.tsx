import { View, Pressable } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Text } from "./type";
import { useRouter } from "expo-router";
import { Avatar } from "./avatar";
import { ReactionGlyph } from "./reactions";
import { NameTag } from "./name-tag";
import { SwipeRow } from "./swipe-row";
import { colors } from "../theme/tokens";
import { relative } from "../lib/format";
import type { Moment } from "../lib/queries";

/**
 * من تفاعل: صورته وعليها وجهُه.
 *
 * الصور لا الأسماء: ستةٌ منها تُقرأ بلمحة، وسطرٌ بأسماء ستةٍ يُقرأ نصّاً.
 * وتُفتح ملفاتهم بالضغط.
 */
export function Reactors({
  reactions,
  viewerId,
  size = 32,
}: {
  reactions: Moment["reactions"];
  viewerId: string;
  size?: number;
}) {
  const router = useRouter();
  if (reactions.length === 0) return null;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 4 }}>
      {reactions.slice(0, 6).map((reaction) => (
        <Pressable
          key={reaction.userId}
          accessibilityLabel={`ملف ${reaction.name}`}
          onPress={() =>
            router.push((reaction.userId === viewerId ? "/me" : `/u/${reaction.userId}`) as never)
          }
          style={{ width: size, height: size }}
        >
          <Avatar name={reaction.name} size={size} mediaId={reaction.avatarMediaId} />
          <View
            style={{
              position: "absolute",
              top: -size * 0.1,
              insetInlineStart: -size * 0.1,
              width: size * 0.62,
              height: size * 0.62,
              borderRadius: size * 0.31,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.line,
            }}
          >
            <ReactionGlyph kind={reaction.kind} emoji={reaction.emoji} size={size * 0.42} />
          </View>
        </Pressable>
      ))}

      {reactions.length > 6 ? (
        <Text style={{ color: colors.muted, fontSize: 11.5 }}>+{reactions.length - 6}</Text>
      ) : null}
    </View>
  );
}

/**
 * التعليقات داخل الخط الزمني.
 * تُعرض ثلاثة، وما زاد يُقرأ بفتح اللحظة — فلا تبتلع لحظةٌ واحدة الشاشة.
 */
export function CommentList({
  comments,
  viewerId,
  size = 26,
  moderate = false,
}: {
  comments: Moment["comments"];
  viewerId: string;
  size?: number;
  /**
   * صلاحية الإشراف: سحبُ تعليق غيره يكشف «حذف بصلاحية».
   *
   * كاللحظة تماماً (القاعدة ١١٤): الحكمُ في مكان القراءة، والبابُ
   * `/v1/moderation/comments/:id` لا بابُ صاحب التعليق — ومعه سجلّ.
   */
  moderate?: boolean;
}) {
  const router = useRouter();
  const client = useQueryClient();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["feed"] });
    void client.invalidateQueries({ queryKey: ["moment"] });
    void client.invalidateQueries({ queryKey: ["user"] });
    void client.invalidateQueries({ queryKey: ["me", "moments"] });
  };
  /*
    بابان لا باب: صاحبُ التعليق من `/v1/comments/:id`، والمشرفُ من بابه
    خلف `requireModerator` ومعه سجلّ — ولا يُوسَّع أحدهما ليقبل الآخر.
  */
  const drop = useMutation({
    mutationFn: ({ id, mine }: { id: string; mine: boolean }) =>
      api(mine ? `/v1/comments/${id}` : `/v1/moderation/comments/${id}`, { method: "DELETE" }),
    onSettled: refresh,
  });

  if (comments.length === 0) return null;

  return (
    <View style={{ gap: 8 }}>
      {comments.map((comment) => {
        const mine = comment.user.id === viewerId;
        const row = (
        <View key={comment.id} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
          <Pressable
            onPress={() =>
              router.push((comment.user.id === viewerId ? "/me" : `/u/${comment.user.id}`) as never)
            }
          >
            <Avatar name={comment.user.name} size={size} mediaId={comment.user.avatarMediaId} />
          </Pressable>

          <View style={{ flex: 1, paddingTop: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
              {/* `writingDirection: auto` مكافئُ `dir="auto"` في الويب:
                  يبقى ترتيب الصفّ عربياً ويُقرأ الاسم اللاتيني باتجاهه
                  هو (القاعدة ٥٨). و`dir` خاصّيةُ ويب لا تعرفها `Text`. */}
              <Text
                numberOfLines={1}
                style={{
                  color: colors.ink,
                  fontSize: 12,
                  fontWeight: "600",
                  flexShrink: 1,
                  writingDirection: "auto",
                }}
              >
                {comment.user.name}
              </Text>
              <NameTag isPlus={comment.user.isPlus} tag={comment.user.tag} size={9.5} />
              <Text style={{ color: colors.faint, fontSize: 10 }}>
                {relative(new Date(comment.createdAt))}
              </Text>
            </View>
            <Text style={{ color: colors.ink2, fontSize: 12.5, lineHeight: 21 }}>{comment.body}</Text>
          </View>
        </View>
        );

        /*
          الحذفُ يُكشف بالسحب من اليسار إلى اليمين — لا زرٌّ تحت كلّ تعليق:
          عشرون تعليقاً تحت كلٍّ منها سطرٌ أحمر تُقرأ لوحةَ حذفٍ لا محادثة.
          صاحبُ التعليق يحذف تعليقه وحده، والمشرفُ تعليقَ غيره. والسحبةُ ثمّ
          الضغطةُ على الزرّ المكشوف خطوتان — وهما السؤالُ قبل الحذف.
        */
        if (!mine && !moderate) return row;
        return (
          <SwipeRow
            key={comment.id}
            surface={colors.card}
            width={mine ? 72 : 118}
            confirmLabel={mine ? "حذف" : "حذف بصلاحية"}
            onDelete={() => drop.mutateAsync({ id: comment.id, mine }).then(() => undefined)}
          >
            {row}
          </SwipeRow>
        );
      })}
    </View>
  );
}

/** قالبُ ما تحت الحدث: المتفاعلون ثم خطٌّ ثم التعليقات. */
export function Bubble({
  moment,
  viewerId,
  moderate = false,
}: {
  moment: Moment;
  viewerId: string;
  moderate?: boolean;
}) {
  const hasComments = moment.comments.length > 0;
  const hasReactions = moment.reactions.length > 0;
  if (!hasComments && !hasReactions) return null;

  return (
    <View
      style={{
        marginTop: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.card,
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      {hasReactions ? <Reactors reactions={moment.reactions} viewerId={viewerId} /> : null}
      {hasReactions && hasComments ? (
        <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 10 }} />
      ) : null}
      <CommentList comments={moment.comments} viewerId={viewerId} moderate={moderate} />
    </View>
  );
}
