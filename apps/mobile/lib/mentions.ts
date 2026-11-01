import type { Moment } from "./queries";

/** من يُشار إليه في تعليق (القاعدة ٣٨٧): معلّقو اللحظة وصاحبُها، بلا تكرار وبلا نفسك. */
export type MentionPerson = { id: string; name: string; avatarMediaId: string | null };

export function mentionPeople(moment: Pick<Moment, "author" | "comments">, viewerId: string | null): MentionPerson[] {
  // `null`: الكلُّ ومعهم القارئ — لرسم «@الاسم» في التعليق، وفيه اسمُه هو أيضاً.
  const seen = new Set<string>(viewerId ? [viewerId] : []);
  const people: MentionPerson[] = [];
  const add = (person: { id: string; name: string; avatarMediaId?: string | null }) => {
    if (seen.has(person.id)) return;
    seen.add(person.id);
    people.push({ id: person.id, name: person.name, avatarMediaId: person.avatarMediaId ?? null });
  };
  add(moment.author);
  // الأحدثُ تعليقاً أوّلاً: من يُردّ عليه غالباً آخرُ من كتب.
  for (const comment of [...moment.comments].reverse()) add(comment.user);
  return people;
}

/** ما يُكتب بعد «@» في آخر النصّ — أو `null` حين لا يُشار إلى أحد الآن. */
export function mentionQuery(text: string): string | null {
  const match = /(?:^|\s)@([^\s@]{0,30})$/.exec(text);
  return match ? match[1] : null;
}

/** يستبدل «@ما كُتب» في آخر النصّ باسم المختار ومسافةٍ بعده. */
export function insertMention(text: string, person: MentionPerson): string {
  return text.replace(/@([^\s@]{0,30})$/, `@${person.name} `);
}

/** من بقي اسمُه في النصّ ممّن اختيروا — ما مُحي لا يُشار إليه. */
export function mentionIds(text: string, picked: MentionPerson[]): string[] {
  return picked.filter((person) => text.includes(`@${person.name}`)).map((person) => person.id);
}

/** المطابقةُ بالحروف مطويّةً: «ا» و«أ» و«إ» واحدة، و«ة» «ه»، و«ى» «ي». */
export function matchesName(name: string, query: string): boolean {
  const fold = (value: string) =>
    value
      .toLowerCase()
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/[ً-ٟـ]/g, "");
  return fold(name).includes(fold(query));
}

/** يقطع النصّ إلى قطعٍ: نصٌّ عاديّ، و«@اسم» لمن أُشير إليه — الأطولُ أوّلاً فلا يُقصّ اسمٌ في اسم. */
export function splitMentions(text: string, people: MentionPerson[]): { text: string; person?: MentionPerson }[] {
  const named = [...people].sort((a, b) => b.name.length - a.name.length);
  const parts: { text: string; person?: MentionPerson }[] = [];
  let rest = text;
  while (rest.length) {
    let best: { at: number; person: MentionPerson } | null = null;
    for (const person of named) {
      const at = rest.indexOf(`@${person.name}`);
      if (at >= 0 && (!best || at < best.at)) best = { at, person };
    }
    if (!best) {
      parts.push({ text: rest });
      break;
    }
    if (best.at > 0) parts.push({ text: rest.slice(0, best.at) });
    parts.push({ text: `@${best.person.name}`, person: best.person });
    rest = rest.slice(best.at + best.person.name.length + 1);
  }
  return parts;
}
