import { Spinner } from "./spinner";
import { DEV_FEATURES } from "../lib/dev-features";
import { CommentField, FloatLayer, OwnerComments } from "./floats";
import { useEffect } from "react";
import { Image, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Text } from "./type";
import { GlassSheet, SheetScrollView } from "./glass-sheet";
import { Avatar } from "./avatar";
import { NoteBubble } from "./note-bubble";
import { ReactionGlyph } from "./reactions";
import { CameraIcon, MusicIcon, PauseIcon, PlayIcon, TrashIcon, EyeIcon } from "./icons";
import { create } from "zustand";
import { api } from "../lib/api";
import { relative } from "../lib/format";
import { useSession } from "../lib/session";
import {
  noteKeys,
  openNote,
  playNote,
  stopClip,
  useClip,
  useOpenNote,
  useStatusNotes,
  type NotePerson,
  type StatusNote,
} from "../lib/status-notes";

const FACES = ["SMILE", "LAUGH", "GASP", "SAD", "LOVE"] as const;

/**
 * نافذةُ النوت (القاعدة ٢٦٩) — زجاجيّةٌ كنافذة التفاعل (القاعدة ٢٤٧)، ومركّبةٌ في
 * الجذر (القاعدة ١٣٧). للصديق: الفقاعةُ، وأغنيتُها تُسمع حين تُفتح، والوجوهُ
 * الخمسة (القاعدة ٣). ولصاحبها: من رآها ومن سمعها وبماذا تفاعل، وحذفُها.
 */
export function NoteSheet() {
  const noteId = useOpenNote((s) => s.noteId);
  const notes = useStatusNotes();
  const note = notes.data?.notes.find((row) => row.id === noteId) ?? null;
  if (!noteId || !note) return null;
  return <Body key={note.id} note={note} />;
}

function Body({ note }: { note: StatusNote }) {
  const me = useSession((s) => s.me);
  const mine = note.authorId === me?.id;
  const client = useQueryClient();
  const router = useRouter();
  const clip = useClip(`note:${note.id}`);

  const close = () => {
    void stopClip();
    openNote(null);
  };

  const listen = () => {
    if (!note.trackId) return;
    if (clip.playing || clip.loading) return void stopClip();
    void playNote(note.id).catch(() => {});
    if (!mine) {
      void api(`/v1/notes/${note.id}/seen`, { method: "POST", body: JSON.stringify({ listened: true }) }).catch(() => {});
    }
  };

  // فتحُها رؤيتُها، والأغنيةُ تبدأ معها كما في إنستقرام.
  useEffect(() => {
    if (!mine) {
      void api(`/v1/notes/${note.id}/seen`, { method: "POST", body: JSON.stringify({ listened: false }) })
        .then(() => client.invalidateQueries({ queryKey: noteKeys.all }))
        .catch(() => {});
    }
    if (note.trackId) listen();
    return () => void stopClip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  const react = useMutation({
    mutationFn: (kind: string | null) =>
      api(`/v1/notes/${note.id}/react`, { method: "POST", body: JSON.stringify({ kind }) }),
    onSettled: () => void client.invalidateQueries({ queryKey: noteKeys.all }),
  });

  const drop = useMutation({
    mutationFn: () => api("/v1/notes/mine", { method: "DELETE" }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: noteKeys.all });
      close();
    },
  });

  return (
    <GlassSheet
      title={mine ? "نوتك" : note.author.name}
      subtitle={relative(new Date(note.createdAt))}
      onClose={close}
    >
      {/* `GlassSheet` بلا حشوةٍ لما فيه: كانت الوجوهُ تلتصق بحافّتها السفلى فتُقصّ،
          وشريطُ الأغنية بحافّتيها. والحشوةُ حشوةُ نافذة التفاعل نفسُها. */}
      {/* ما تفاعل به الناسُ وما كتبوه يطير داخل النافذة وحدها لا على الصفحة (القاعدة ٣٤٥). */}
      <View style={{ flexShrink: 1 }}>
      <SheetScrollView
        name="body"
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 22 }}
      >
        <View style={{ alignItems: "center", paddingTop: 4 }}>
          <NoteBubble size="large" text={note.text} trackTitle={note.trackTitle} trackArtist={note.trackArtist} playing={clip.playing} gif={note.gifId ? { id: note.gifId, w: note.gifW, h: note.gifH } : null} />
          <View style={{ marginTop: 4 }}>
            <Avatar name={note.author.name} size={72} mediaId={note.author.avatarMediaId} frame={note.author.frame} charm={note.author.charm} />
          </View>
        </View>

        {note.trackId ? (
          <Pressable
            onPress={listen}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14, padding: 10, borderRadius: 14, backgroundColor: "rgba(255,255,255,.08)" }}
          >
            {note.trackCover ? (
              <Image source={{ uri: note.trackCover }} style={{ width: 44, height: 44, borderRadius: 8 }} />
            ) : (
              <View style={{ width: 44, height: 44, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.1)" }}>
                <MusicIcon size={18} color="#fff" />
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ color: "#fff", fontSize: 14, fontWeight: "700", writingDirection: "auto" }}>
                {note.trackTitle}
              </Text>
              <Text numberOfLines={1} style={{ color: "rgba(255,255,255,.6)", fontSize: 12, writingDirection: "auto" }}>
                {note.trackArtist} · {note.trackId.startsWith("am:") ? "Apple Music" : "Deezer"}
              </Text>
            </View>
            <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.14)" }}>
              {clip.loading ? <Spinner size="small" color="#fff" /> : clip.playing ? <PauseIcon size={15} color="#fff" /> : <PlayIcon size={15} color="#fff" />}
            </View>
          </Pressable>
        ) : null}

        {mine ? (
          <>
            {note.groupName ? (
              <Text style={{ color: "rgba(255,255,255,.6)", fontSize: 12, textAlign: "center", marginTop: 10 }}>
                لتصنيف {note.groupName} وحده
              </Text>
            ) : null}
            <Viewers noteId={note.id} hasTrack={Boolean(note.trackId)} />
            {DEV_FEATURES ? <OwnerComments target={{ kind: "note", id: note.id }} /> : null}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <Pressable
                onPress={() => {
                  close();
                  router.push("/note/new" as never);
                }}
                style={{ flex: 1, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.14)" }}
              >
                <Text style={{ color: "#fff", fontSize: 13.5, fontWeight: "700" }}>نوت جديدة</Text>
              </Pressable>
              <Pressable
                onPress={() => drop.mutate()}
                disabled={drop.isPending}
                style={{ flex: 1, height: 46, borderRadius: 14, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,122,90,.18)" }}
              >
                <TrashIcon size={15} color="#FF7A5A" />
                <Text style={{ color: "#FF7A5A", fontSize: 13.5, fontWeight: "700" }}>احذفها</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 16 }}>
            {FACES.map((kind) => {
              const on = note.myReaction === kind;
              return (
                <Pressable
                  key={kind}
                  accessibilityLabel="تفاعل"
                  onPress={() => react.mutate(on ? null : kind)}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: on ? "rgba(246,185,59,.28)" : "rgba(255,255,255,.08)",
                    transform: [{ scale: on ? 1.08 : 1 }],
                  }}
                >
                  <ReactionGlyph kind={kind} size={38} />
                </Pressable>
              );
            })}
          </View>
        )}
        {/* حقلُ التعليق تحت الوجوه في الصندوق نفسه (القاعدة ٣٤٤). */}
        {DEV_FEATURES && !mine ? (
          <View style={{ marginTop: 12 }}>
            <CommentField target={{ kind: "note", id: note.id }} />
          </View>
        ) : null}
      </SheetScrollView>
      {DEV_FEATURES ? <FloatLayer target={{ kind: "note", id: note.id }} top={0.08} bottom={0.92} /> : null}
      </View>
    </GlassSheet>
  );
}

type Viewer = { seenAt: string; listenedAt: string | null; reaction: string | null; user: NotePerson };

/** من رأى نوتي — المتفاعلُ أوّلاً، وبجانب كلٍّ سمّاعةٌ إن سمع الأغنية ووجهُه إن تفاعل. */
function Viewers({ noteId, hasTrack }: { noteId: string; hasTrack: boolean }) {
  const viewers = useQuery({
    queryKey: ["noteViewers", noteId],
    queryFn: () => api<{ viewers: Viewer[] }>(`/v1/notes/${noteId}/viewers`),
    refetchInterval: 30_000,
  });
  const rows = viewers.data?.viewers ?? [];
  return (
    <View style={{ marginTop: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <EyeIcon size={14} color="rgba(255,255,255,.7)" />
        <Text style={{ color: "rgba(255,255,255,.75)", fontSize: 12.5, fontWeight: "700" }}>
          {hasTrack ? "من شاف واستمع" : "من شاف"}
        </Text>
      </View>
      {viewers.isLoading ? (
        <Spinner color="#fff" style={{ marginVertical: 12 }} />
      ) : rows.length === 0 ? (
        <Text style={{ color: "rgba(255,255,255,.5)", fontSize: 12.5, paddingVertical: 8 }}>ما أحد شافها بعد.</Text>
      ) : (
        <SheetScrollView name="note-viewers" style={{ maxHeight: 260 }}>
          {rows.map((row) => (
            <View key={row.user.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 }}>
              <View>
                <Avatar name={row.user.name} size={38} mediaId={row.user.avatarMediaId} frame={row.user.frame} />
                {row.reaction ? (
                  <View style={{ position: "absolute", bottom: -4, left: -4 }}>
                    <ReactionGlyph kind={row.reaction} size={20} />
                  </View>
                ) : null}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ color: "#fff", fontSize: 13.5, fontWeight: "600", writingDirection: "auto" }}>
                  {row.user.name}
                </Text>
                <Text style={{ color: "rgba(255,255,255,.5)", fontSize: 11 }}>{relative(new Date(row.seenAt))}</Text>
              </View>
              {row.listenedAt ? <MusicIcon size={15} color="#F6B93B" /> : null}
            </View>
          ))}
        </SheetScrollView>
      )}
    </View>
  );
}

/** «قصة أو نوت» — من ضغط صورته في شريط القصص (القاعدة ٢٦٩). */
export const useCreateSheet = create<{ open: boolean; hasStory: boolean }>(() => ({ open: false, hasStory: false }));
export const openCreateSheet = (hasStory: boolean) => useCreateSheet.setState({ open: true, hasStory });

export function CreateSheet() {
  const { open, hasStory } = useCreateSheet();
  const router = useRouter();
  const me = useSession((s) => s.me);
  if (!open) return null;
  const close = () => useCreateSheet.setState({ open: false });
  const go = (path: string) => {
    close();
    router.push(path as never);
  };
  const Option = ({ label, hint, icon, path }: { label: string; hint: string; icon: React.ReactNode; path: string }) => (
    <Pressable
      onPress={() => go(path)}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, backgroundColor: "rgba(255,255,255,.08)", marginBottom: 10 }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.12)" }}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>{label}</Text>
        <Text style={{ color: "rgba(255,255,255,.6)", fontSize: 12 }}>{hint}</Text>
      </View>
    </Pressable>
  );
  return (
    <GlassSheet title="أضف" onClose={close}>
      <Option label="قصة" hint="صورة أو مقطع لدائرتك يوماً" icon={<CameraIcon size={20} color="#fff" />} path="/stories/new" />
      <Option label="نوت" hint="عبارة أو أغنية فوق صورتك" icon={<MusicIcon size={20} color="#F6B93B" />} path="/note/new" />
      {hasStory && me ? (
        <Option label="شاهد قصتك" hint="ومن شاهدها" icon={<EyeIcon size={20} color="#fff" />} path={`/stories/${me.id}`} />
      ) : null}
    </GlassSheet>
  );
}
