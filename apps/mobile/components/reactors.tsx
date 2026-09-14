import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Avatar } from "./avatar";
import { ReactionGlyph } from "./reactions";
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
    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10, paddingTop: 4 }}>
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
}: {
  comments: Moment["comments"];
  viewerId: string;
  size?: number;
}) {
  const router = useRouter();
  if (comments.length === 0) return null;

  return (
    <View style={{ gap: 8 }}>
      {comments.map((comment) => (
        <View key={comment.id} style={{ flexDirection: "row-reverse", alignItems: "flex-start", gap: 8 }}>
          <Pressable
            onPress={() =>
              router.push((comment.user.id === viewerId ? "/me" : `/u/${comment.user.id}`) as never)
            }
          >
            <Avatar name={comment.user.name} size={size} mediaId={comment.user.avatarMediaId} />
          </Pressable>

          <View style={{ flex: 1, paddingTop: 1 }}>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "600" }}>
                {comment.user.name}
              </Text>
              <Text style={{ color: colors.faint, fontSize: 10 }}>
                {relative(new Date(comment.createdAt))}
              </Text>
            </View>
            <Text style={{ color: colors.ink2, fontSize: 12.5, lineHeight: 21 }}>{comment.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/** قالبُ ما تحت الحدث: المتفاعلون ثم خطٌّ ثم التعليقات. */
export function Bubble({ moment, viewerId }: { moment: Moment; viewerId: string }) {
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
      <CommentList comments={moment.comments} viewerId={viewerId} />
    </View>
  );
}
