import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * شرطُ الرؤية — أخطرُ ما في المنظومة: استعلامٌ ينسى هذا الشرط يسرّب
 * لحظةً خاصة بلا رسالةِ خطأٍ تُنبّه.
 *
 * والقاعدةُ تُستبدل بجدولٍ في الذاكرة: الاختبارُ يفحص **المنطق** لا
 * Postgres، فيعمل في أيّ مكانٍ بلا خادم.
 */
const rows = {
  friendship: [] as { requesterId: string; addresseeId: string; status: string }[],
  block: [] as { blockerId: string; blockedId: string }[],
};

vi.mock("@athar/db", () => ({
  prisma: {
    friendship: {
      findMany: async ({ where }: { where: { OR: { requesterId?: string; addresseeId?: string }[] } }) => {
        const me = where.OR[0].requesterId!;
        return rows.friendship.filter(
          (f) => f.status === "ACCEPTED" && (f.requesterId === me || f.addresseeId === me),
        );
      },
    },
    block: {
      findMany: async ({ where }: { where: { OR: { blockerId?: string; blockedId?: string }[] } }) => {
        const me = where.OR[0].blockerId!;
        return rows.block.filter((b) => b.blockerId === me || b.blockedId === me);
      },
    },
  },
}));

const { visibleWhere } = await import("../src/services/visibility");

beforeEach(() => {
  rows.friendship = [{ requesterId: "me", addresseeId: "friend", status: "ACCEPTED" }];
  rows.block = [];
});

describe("شرط الرؤية", () => {
  it("يقصر الكتّاب على الدائرة وصاحبها", async () => {
    const where = await visibleWhere("me");
    expect(where.authorId.in.sort()).toEqual(["friend", "me"]);
    expect(where.authorId.in).not.toContain("stranger");
  });

  it("والمحظورُ يخرج من الدائرة", async () => {
    rows.block = [{ blockerId: "me", blockedId: "friend" }];
    const where = await visibleWhere("me");
    expect(where.authorId.in).toEqual(["me"]);
  });

  it("والحظرُ في الاتجاهين: من حظرني أخرج من دائرته وخرج من دائرتي", async () => {
    rows.block = [{ blockerId: "friend", blockedId: "me" }];
    const where = await visibleWhere("me");
    expect(where.authorId.in).toEqual(["me"]);
  });

  it("والجمهورُ خمسةُ أبواب لا بابٌ واحد", async () => {
    const where = await visibleWhere("me");
    const kinds = where.OR.map((one: Record<string, unknown>) =>
      one.authorId ? "MINE" : (one.audience as string),
    );
    // لحظاتي، والدائرة، والتصنيف، والأشخاص بأعيانهم، والكلُّ ما عدا تصنيفاً — ولا سادس.
    expect(kinds).toEqual(["MINE", "CIRCLE", "GROUP", "PICKED", "EXCEPT"]);
  });

  it("و«ما عدا» تُفتح لمن ليس في التصنيف وحده (القاعدة ٢٥٥)", async () => {
    const where = await visibleWhere("me");
    const except = where.OR.find((one: Record<string, unknown>) => one.audience === "EXCEPT");
    // `none` لا `some`: عضوُ التصنيف المستثنى لا يراها. وعلاقةٌ مطلوبة —
    // تصنيفٌ حُذف لا يُطابق شيئاً، فلا تنفتح لحظةٌ لمن استُثني بحذفه.
    expect(except).toEqual({ audience: "EXCEPT", audienceGroup: { members: { none: { userId: "me" } } } });
  });
});
