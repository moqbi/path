import { View } from "react-native";
import { Text } from "./type";
import { Avatar } from "./avatar";
import { AthrMark } from "./brand";
import { ar } from "../lib/format";
import type { Book } from "../lib/archive";

// ورقُ الكتاب وحبرُه — كالـPDF (`book-print.ts`) لا ألوانُ الثيم.
const PAPER = "#FBF8F1";
const INK = "#182830";
const MUTED = "#8a949a";
const KICKER = "#b07d1c";
const NIGHT = "#0E1A24";
const GOLD = "#F6B93B";

/** الغلافُ بتصميمه (القاعدة ٣٧٨) — كالـPDF: ليليٌّ كما كان، وكلاسيكيٌّ بورقه وإطاره، وبسيطٌ بخطٍّ مرجانيّ. */
export function BookCoverPage({ book, scale = 1 }: { book: Pick<Book, "year" | "name" | "memberNo" | "avatarMediaId" | "prefs">; scale?: number }) {
  const cover = book.prefs?.cover ?? "night";
  const title = book.prefs?.title ?? null;
  const k = (n: number) => n * scale;
  if (cover === "minimal") {
    return (
      <View style={{ flex: 1, backgroundColor: "#EDE6D8", padding: k(26), paddingTop: k(36) }}>
        <View style={{ position: "absolute", right: k(20), top: k(36), width: Math.max(2, k(3)), height: "58%", borderRadius: 2, backgroundColor: "#FF7A5A" }} />
        <View style={{ marginRight: k(10) }}>
          <Text style={{ color: KICKER, fontSize: k(10.5), letterSpacing: k(3) }}>كتاب السنة</Text>
          <Text face="display" style={{ color: INK, fontSize: k(title ? 30 : 46), fontWeight: "700", lineHeight: k(title ? 44 : 58), marginTop: k(6) }}>
            {title ?? ar(book.year)}
          </Text>
          {title ? <Text style={{ color: "#6b7880", fontSize: k(14), marginTop: k(4) }}>{ar(book.year)}</Text> : null}
        </View>
        <View style={{ flex: 1, minHeight: k(40) }} />
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
          <Text style={{ color: "#3c4a52", fontSize: k(12) }}>
            {book.name} · عضوية {ar(book.memberNo)}
          </Text>
          <AthrMark size={k(30)} />
        </View>
      </View>
    );
  }
  const paper = cover === "paper";
  const ink = paper ? INK : "#f7f5ef";
  const soft = paper ? MUTED : "rgba(247,245,239,.5)";
  return (
    <View style={{ flex: 1, alignItems: "center", backgroundColor: paper ? PAPER : NIGHT, paddingTop: k(44), paddingBottom: k(28), paddingHorizontal: k(24) }}>
      {paper ? (
        <View pointerEvents="none" style={{ position: "absolute", top: k(14), bottom: k(14), left: k(14), right: k(14), borderWidth: 1, borderColor: "#D9C9A3" }}>
          <View style={{ position: "absolute", top: k(4), bottom: k(4), left: k(4), right: k(4), borderWidth: 1, borderColor: "#EBDFC4" }} />
        </View>
      ) : null}
      <AthrMark size={k(60)} />
      <Text style={{ color: paper ? KICKER : "rgba(247,245,239,.55)", fontSize: k(11), letterSpacing: k(3), marginTop: k(28) }}>كتاب السنة</Text>
      <Text face="display" style={{ color: paper ? "#B9A27A" : ink, fontSize: k(78), fontWeight: "700", lineHeight: k(92), marginTop: k(4) }}>{ar(book.year)}</Text>
      <View style={{ marginTop: k(14), width: k(36), height: 2, borderRadius: 2, backgroundColor: GOLD }} />
      {title ? (
        <Text face="display" style={{ color: ink, fontSize: k(paper ? 24 : 21), fontWeight: "700", lineHeight: k(paper ? 36 : 32), marginTop: k(16), textAlign: "center" }}>
          {title}
        </Text>
      ) : null}
      <View style={{ flex: 1, minHeight: k(24) }} />
      <Avatar name={book.name} mediaId={book.avatarMediaId} size={k(64)} />
      <Text face="display" style={{ color: ink, fontSize: k(19), fontWeight: "700", marginTop: k(10) }}>{book.name}</Text>
      <Text style={{ color: soft, fontSize: k(11), marginTop: k(2) }}>عضوية رقم {ar(book.memberNo)}</Text>
      <Text style={{ color: paper ? KICKER : GOLD, fontSize: k(12.5), letterSpacing: k(1), marginTop: k(26) }}>لحظاتك، مع ناسك.</Text>
    </View>
  );
}
