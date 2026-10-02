import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import { Text } from "./type";
import { Avatar } from "./avatar";
import { NameTag } from "./name-tag";
import { ar, timeOfDay } from "../lib/format";
import { colors } from "../theme/tokens";

type Worn = { spec: string; mediaId: string | null; frameHole?: number | null } | null;

export type ChatPerson = {
  name: string;
  avatarMediaId: string | null;
  frame?: Worn;
  charm?: { spec: string; mediaId: string | null } | null;
  isPlus?: boolean;
  tag?: { name: string; bg: string; fg: string } | null;
};

/** «٢٠٢٦/١٠/١، ١:٤٠ ص» — ميلاديٌّ بأرقامٍ عربيّة (القاعدة ١١٨). */
export function stamp(iso: string): string {
  const date = new Date(iso);
  return `${ar(date.getFullYear())}/${ar(date.getMonth() + 1)}/${ar(date.getDate())}، ${timeOfDay(date)}`;
}

/** رأسُ الرسالة يُعاد إذا تبدّل المرسل أو مضت خمس دقائق — وإلّا فالفقاعةُ وحدها. */
export function needsHead(
  line: { senderId: string; createdAt: string },
  before: { senderId: string; createdAt: string } | undefined,
): boolean {
  if (!before || before.senderId !== line.senderId) return true;
  return new Date(line.createdAt).getTime() - new Date(before.createdAt).getTime() > 5 * 60_000;
}

/** الفقاعةُ بعرض عمودها: رسالتي بلمسة العلامة، ورسالةُ غيري على البطاقة. */
export const bubbleStyle = (mine: boolean): ViewStyle => ({
  alignSelf: "stretch",
  borderRadius: 18,
  paddingHorizontal: 16,
  paddingVertical: 12,
  backgroundColor: mine ? colors.claySoft : colors.card,
  borderWidth: 1,
  borderColor: mine ? colors.claySoft : colors.line,
});

const AVATAR = 44;

/**
 * سطرُ رسالةٍ في المحادثة الخاصّة والجماعيّة (القاعدة ٢١٦) — **بقرار المالك**:
 * صورةُ المرسل بإطاره وتميمته، وبجانبها اسمُه ووسمُه، وفي الطرف المقابل
 * التاريخُ والساعة، ثمّ الفقاعةُ بعرض العمود تحتها. كانت المحادثةُ فقاعاتٍ
 * صامتة بلا وجهٍ ولا اسم.
 *
 * غيري في جهة البداية (اليمين) وأنا في المقابلة — فالصفُّ يُقلب لرسالتي
 * (`row-reverse` مقصودٌ هنا: انعكاسُ الجهة لا تصحيحُ اتجاه). ورسائلُ السلسلة
 * الواحدة بلا رأسٍ مكرّر، بفراغٍ بعرض الصورة يُبقيها على عمودها.
 */
export function ChatLine({
  person,
  mine,
  at,
  head,
  meta,
  children,
}: {
  person: ChatPerson;
  mine: boolean;
  at: string;
  head: boolean;
  /** ما تحت الفقاعة: الإيصالُ و«عُدّلت» وأفعالُ الضغطة. */
  meta?: ReactNode;
  children: ReactNode;
}) {
  const direction = mine ? "row-reverse" : "row";

  return (
    <View style={{ flexDirection: direction, alignItems: "flex-start", gap: 10, marginTop: head ? 10 : 0 }}>
      {head ? (
        <Avatar
          name={person.name}
          size={AVATAR}
          mediaId={person.avatarMediaId}
          frame={person.frame ?? null}
          charm={person.charm ?? null}
        />
      ) : (
        <View style={{ width: AVATAR }} />
      )}

      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        {head ? (
          <View style={{ flexDirection: direction, alignItems: "center", gap: 8 }}>
            <View style={{ flexDirection: direction, alignItems: "center", gap: 6, flexShrink: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{ color: colors.ink, fontSize: 14, fontWeight: "700", flexShrink: 1, writingDirection: "auto" }}
              >
                {person.name}
              </Text>
              <NameTag isPlus={person.isPlus} tag={person.tag ?? null} size={10} />
            </View>
            <View style={{ flex: 1 }} />
            <Text style={{ color: colors.faint, fontSize: 11 }}>{stamp(at)}</Text>
          </View>
        ) : null}

        <View style={{ alignItems: mine ? "flex-end" : "flex-start" }}>{children}</View>

        {meta ? (
          <View style={{ flexDirection: direction, alignItems: "center", gap: 6 }}>{meta}</View>
        ) : null}
      </View>
    </View>
  );
}
