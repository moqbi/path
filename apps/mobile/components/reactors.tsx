import { View, Pressable, Alert } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Text } from "./type";
import { useRouter } from "expo-router";
import { Avatar } from "./avatar";
import { ReactionGlyph } from "./reactions";
import { NameTag } from "./name-tag";
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
   * صلاحية الإشراف: «احذفه بصلاحية الإشراف» تحت تعليق غيره.
   *
   * كاللحظة تماماً (القاعدة ١١٤): الحكمُ في مكان القراءة، والبابُ
   * `/v1/moderation/comments/:id` لا بابُ صاحب التعليق — ومعه سجلّ.
   */
  moderate?: boolean;
}) {
  const router = useRouter();
  const client = useQueryClient();
  const remove = useMutation({
    mutationFn: (id: string) => api(`/v1/moderation/comments/${id}`, { method: "DELETE" }),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ["feed"] });
      void client.invalidateQueries({ queryKey: ["moment"] });
      void client.invalidateQueries({ queryKey: ["user"] });
    },
  });

  // سؤالٌ قبل الحذف: لا رجعة فيه، وضغطةٌ عابرة على تعليقٍ لا تكفي.
  const ask = (id: string) =>
    Alert.alert("حذف التعليق", "يُحذف بصلاحية الإشراف ويُكتب في السجلّ.", [
      { text: "إلغاء", style: "cancel" },
      { text: "احذف", style: "destructive", onPress: () => remove.mutate(id) },
    ]);

  if (comments.length === 0) return null;

  return (
    <View style={{ gap: 8 }}>
      {comments.map((comment) => (
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
            {moderate && comment.user.id !== viewerId ? (
              <Pressable
                accessibilityRole="button"
                disabled={remove.isPending}
                onPress={() => ask(comment.id)}
                hitSlop={8}
                style={{ alignSelf: "flex-start", marginTop: 3 }}
              >
                <Text style={{ color: colors.live, fontSize: 11, fontWeight: "600" }}>
                  احذفه بصلاحية الإشراف
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}
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
