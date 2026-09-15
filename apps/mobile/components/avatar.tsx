import { View, Text, type StyleProp, type ViewStyle } from "react-native";
import { MediaImage } from "./media-image";
import { initial } from "../lib/format";
import { colors } from "../theme/tokens";

/**
 * خلفية الحرف تُشتقّ من الاسم لا تُخزَّن، فتبقى ثابتة لكل شخص بلا عمود.
 * نفس القائمة التي في `src/components/ui.tsx` حرفاً بحرف.
 */
const TINTS = ["#f3e3cd", "#e8ddd0", "#f0e0d6", "#e4e0d4", "#f2e7d9", "#e9dcd2"];

function tintFor(name: string): string {
  let sum = 0;
  for (const ch of name) sum += ch.codePointAt(0) ?? 0;
  return TINTS[sum % TINTS.length];
}

export type Charm = { spec: string; mediaId: string | null } | null | undefined;

/**
 * صورة العرض.
 *
 * الإطار المشترى حلقةٌ حول الصورة مباشرة بلا حلقةٍ بيضاء بينهما: البيضاء
 * كانت تفصل الإطار عن الوجه فيُقرآن قرصين لا إطاراً على صورة.
 *
 * والتدرّجات هنا لونٌ واحد لا تدرّج: `linear-gradient` نصٌّ من CSS لا
 * يفهمه الموبايل. يُقرأ منه أوّل لونٍ حتى تُركَّب طبقةُ التدرّجات —
 * ولونٌ من التدرّج أقربُ إلى المقصود من رماديّ افتراضي.
 */
export function firstColor(spec: string | null | undefined, fallback: string): string {
  if (!spec) return fallback;
  const match = /#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/.exec(spec);
  return match ? match[0] : fallback;
}

export function Avatar({
  name,
  size = 40,
  frameSpec,
  mediaId,
  charm,
  style,
}: {
  name: string;
  size?: number;
  frameSpec?: string | null;
  mediaId?: string | null;
  charm?: Charm;
  style?: StyleProp<ViewStyle>;
}) {
  const pad = frameSpec ? Math.max(2, Math.round(size * 0.045)) : 0;
  const inner = size - pad * 2;

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          padding: pad,
          backgroundColor: frameSpec ? firstColor(frameSpec, colors.clay) : "transparent",
        },
        style,
      ]}
    >
      <View
        style={{
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: mediaId ? colors.chip : tintFor(name),
        }}
      >
        {mediaId ? (
          <MediaImage mediaId={mediaId} style={{ width: inner, height: inner }} />
        ) : (
          <Text
            style={{
              // الحرف على تدرّجٍ فاتح دائماً، فحبره ثابت لا يتبع الوضع.
              color: "#14212b",
              fontSize: Math.round(size * 0.36),
              fontWeight: "600",
            }}
          >
            {initial(name)}
          </Text>
        )}
      </View>

      {charm && size >= 22 ? <CharmBadge charm={charm} size={size} /> : null}
    </View>
  );
}

/**
 * التميمة: شعارٌ يتدلّى من حافة الصورة، حرّاً بلا إطارٍ يخنقه.
 * و`contain` كي يُرى كاملاً لا مقصوصاً ليملأ مربّعاً.
 */
function CharmBadge({ charm, size }: { charm: NonNullable<Charm>; size: number }) {
  const badge = Math.round(size * 0.68);

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: badge,
        height: badge,
        left: -badge * 0.22,
        bottom: -badge * 0.18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: charm.mediaId ? "transparent" : firstColor(charm.spec, colors.clay),
        borderRadius: charm.mediaId ? 0 : badge / 2,
      }}
    >
      {charm.mediaId ? (
        <MediaImage
          mediaId={charm.mediaId}
          resizeMode="contain"
          style={{ width: badge, height: badge }}
        />
      ) : null}
    </View>
  );
}
