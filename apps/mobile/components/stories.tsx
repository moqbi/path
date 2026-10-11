import { useEffect } from "react";
import { View, Pressable, ScrollView } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Text } from "./type";
import { useRouter } from "expo-router";
import { Spot } from "./spot";
import { Avatar } from "./avatar";
import { PlusIcon } from "./icons";
import { colors } from "../theme/tokens";
import type { StoryRing } from "../lib/queries";
import { LockIcon } from "./icons";
import { prefetchStories } from "../lib/story-prefetch";
import { NoteBubble } from "./note-bubble";
import { openCreateSheet } from "./note-sheet";
import { openNote, useStatusNotes, type StatusNote } from "../lib/status-notes";
import { useSession } from "../lib/session";

/** ما يُرسم في الشريط: صاحبُ قصّةٍ أو نوتٍ أو الاثنين. */
type Entry = {
  userId: string;
  name: string;
  avatarMediaId: string | null;
  frame: StoryRing["frame"];
  ring: StoryRing | null;
  note: StatusNote | null;
};

/**
 * شريط القصص — وفوق صُوَره نوتاتُ أصحابها (القاعدة ٢٦٩).
 *
 * الحلقة الملوّنة تعني «فيها ما لم تره»، والرمادية «رأيتها كلها» — كما
 * تعوّد الناس. وأوّلُ الشريط صورتُك: ضغطُها يسأل «قصة أو نوت»، وضغطُ فقاعتها
 * يفتح نوتك أو يكتب واحدة. ومن له نوتٌ بلا قصّة يُرسم بلا حلقة.
 */
export function StoryStrip({ rings, meId }: { rings: StoryRing[]; meId: string }) {
  const client = useQueryClient();
  const me = useSession((s) => s.me);
  const notes = useStatusNotes().data?.notes ?? [];

  const mineRing = rings.find((ring) => ring.userId === meId) ?? null;
  const mineNote = notes.find((note) => note.authorId === meId) ?? null;

  const entries: Entry[] = [];
  const seen = new Set<string>([meId]);
  // من له قصّة أوّلاً بترتيب الخادم (الجديدُ قبل المُشاهَد)، ثمّ من له نوتٌ وحدها.
  for (const ring of rings) {
    if (seen.has(ring.userId)) continue;
    seen.add(ring.userId);
    entries.push({
      userId: ring.userId,
      name: ring.name,
      avatarMediaId: ring.avatarMediaId,
      frame: ring.frame,
      ring,
      note: notes.find((note) => note.authorId === ring.userId) ?? null,
    });
  }
  for (const note of notes) {
    if (seen.has(note.authorId)) continue;
    seen.add(note.authorId);
    entries.push({
      userId: note.authorId,
      name: note.author.name,
      avatarMediaId: note.author.avatarMediaId,
      frame: note.author.frame,
      ring: null,
      note,
    });
  }
  // ما بقي من النوت أوّلاً: نوتٌ لم تُرَ تسبق ما رُئي في الجزء الذي بلا قصص.
  const withStories = entries.filter((entry) => entry.ring);
  const notesOnly = entries.filter((entry) => !entry.ring).sort((a, b) => Number(a.note?.seen) - Number(b.note?.seen));

  // ما فيه جديدٌ يُجلب سلفاً فتُفتح القصّةُ بلا شاشةٍ سوداء (`story-prefetch`).
  const freshIds = withStories.filter((entry) => entry.ring?.fresh).slice(0, 4).map((entry) => entry.userId).join(",");
  useEffect(() => {
    if (!freshIds) return;
    for (const userId of freshIds.split(",")) void prefetchStories(client, userId);
  }, [client, freshIds]);

  return (
    // هدفُ الجولة: شريطُ القصص كلُّه.
    <Spot id="stories">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}
      >
        <Item
          label="قصتك"
          entry={{
            userId: meId,
            name: me?.name ?? "",
            avatarMediaId: me?.avatarMediaId ?? null,
            frame: (me?.frame as StoryRing["frame"]) ?? null,
            ring: mineRing,
            note: mineNote,
          }}
          mine
          onAvatar={() => openCreateSheet(Boolean(mineRing))}
          onBubble={() => (mineNote ? openNote(mineNote.id) : openCreateSheet(Boolean(mineRing)))}
        />
        {[...withStories, ...notesOnly].map((entry) => (
          <Item
            key={entry.userId}
            label={entry.name}
            entry={entry}
            onAvatar={() => (entry.note && !entry.ring ? openNote(entry.note.id) : null)}
            onBubble={() => entry.note && openNote(entry.note.id)}
          />
        ))}
      </ScrollView>
    </Spot>
  );
}

/** ارتفاعُ مكان الفقاعة فوق الصورة — ثابتٌ فتصطفّ الصورُ كلُّها على سطرٍ واحد. */
const BUBBLE_ROOM = 34;

function Item({
  entry,
  label,
  mine = false,
  onAvatar,
  onBubble,
}: {
  entry: Entry;
  label: string;
  mine?: boolean;
  onAvatar: () => void;
  onBubble: () => void;
}) {
  const router = useRouter();
  const client = useQueryClient();
  const { ring, note } = entry;

  return (
    <View style={{ width: 76, alignItems: "center" }}>
      {/* الفقاعة: نوتُه، أو «نوت +» فارغةً لصاحب الشريط. */}
      <View style={{ height: BUBBLE_ROOM, justifyContent: "flex-end", zIndex: 2, marginBottom: -8 }}>
        {note || mine ? (
          <Pressable accessibilityLabel={note ? "النوت" : "نوت جديدة"} hitSlop={6} onPress={onBubble}>
            <NoteBubble text={note?.text} trackTitle={note?.trackTitle} trackArtist={note?.trackArtist} empty={!note} />
          </Pressable>
        ) : null}
      </View>

      <Pressable
        accessibilityLabel={mine ? "قصة أو نوت" : `قصة ${label}`}
        // الضغطةُ تبدأ الجلبَ قبل أن تكتمل — جزءٌ من ثانيةٍ يُكسب.
        onPressIn={() => ring && !mine && void prefetchStories(client, entry.userId)}
        onPress={() => (ring && !mine ? router.push(`/stories/${entry.userId}` as never) : onAvatar())}
        style={{ alignItems: "center", gap: 6 }}
      >
        <View
          style={{
            width: 62,
            height: 62,
            borderRadius: 31,
            padding: 2.5,
            alignItems: "center",
            justifyContent: "center",
            // التدرّج حلقةً: لونٌ واحد يقوم مقامه — والفرق بين «جديد»
            // و«مقروء» يبقى ظاهراً وهو المقصود. وبلا قصّةٍ لا حلقة.
            backgroundColor: ring ? (ring.fresh && !mine ? colors.clay : colors.groundLine) : "transparent",
          }}
        >
          <View style={{ width: "100%", height: "100%", borderRadius: 29, backgroundColor: colors.groundSolid, padding: 2, alignItems: "center", justifyContent: "center" }}>
            <Avatar name={entry.name} size={52} mediaId={entry.avatarMediaId} frame={entry.frame} />
          </View>
          {/* قصّةٌ خاصّة: قفلٌ على الحلقة (القاعدة ٢١٩). */}
          {ring?.private ? (
            <View
              accessibilityLabel="قصة خاصة"
              style={{ position: "absolute", bottom: -1, left: -1, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay, borderWidth: 2, borderColor: colors.groundSolid }}
            >
              <LockIcon size={11} color={colors.onBrand} />
            </View>
          ) : null}
          {/* صورتُك تحمل زائداً: منها تُضاف قصّةٌ أو نوت. */}
          {mine ? (
            <View style={{ position: "absolute", bottom: -1, right: -1, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay, borderWidth: 2, borderColor: colors.groundSolid }}>
              <PlusIcon size={11} color={colors.onBrand} />
            </View>
          ) : null}
        </View>
        <Text numberOfLines={1} style={{ color: mine ? colors.groundMuted : colors.groundInk2, fontSize: 10.5, textAlign: "center", maxWidth: 72 }}>
          {label}
        </Text>
      </Pressable>
    </View>
  );
}
