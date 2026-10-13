import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * شرطُ الرؤية — أخطرُ ما في المنظومة: استعلامٌ ينسى هذا الشرط يسرّب
 * لحظةً خاصة بلا رسالةِ خطأٍ تُنبّه.
 *
 * والقاعدةُ تُستبدل بجدولٍ في الذاكرة: الاختبارُ يفحص **المنطق** لا
 * Postgres، فيعمل في أيّ مكانٍ بلا خادم.
 */
const rows = {
  friendship: [] as { requesterId: string; addresseeId: string; status: string; follow?: boolean }[],
  block: [] as { blockerId: string; blockedId: string }[],
};

vi.mock("@athar/db", () => ({
  prisma: {
    friendship: {
      findMany: async ({ where }: {
        where: { OR?: { requesterId?: string; addresseeId?: string; follow?: boolean }[]; follow?: boolean; addresseeId?: string };
      }) => {
        const accepted = rows.friendship.filter((f) => f.status === "ACCEPTED");
        // متابِعو الحساب المفتوح (القاعدة ٢٧٨).
        if (where.follow === true) {
          return accepted.filter((f) => f.follow && f.addresseeId === where.addresseeId);
        }
        // الدائرة: صفوفي حين أطلب، وما أُضيف إليّ صداقةً لا متابعة (القاعدة ٢٦٣).
        const me = where.OR![0].requesterId!;
        return accepted.filter((f) => f.requesterId === me || (f.addresseeId === me && !f.follow));
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

  it("ومتابِعُ الحساب المفتوح تُقرأ لحظاتُه عنده، ولا يُقرأ الحسابُ عند غير متابِعه (القاعدة ٢٧٨)", async () => {
    rows.friendship.push({ requesterId: "fan", addresseeId: "me", status: "ACCEPTED", follow: true });
    expect((await visibleWhere("me")).authorId.in.sort()).toEqual(["fan", "friend", "me"]);
    // والمتابِعُ يرى الحسابَ كما كان، من صفّه هو.
    expect((await visibleWhere("fan")).authorId.in.sort()).toEqual(["fan", "me"]);
  });

  it("والمتابِعُ المحظورُ لا يُقرأ", async () => {
    rows.friendship.push({ requesterId: "fan", addresseeId: "me", status: "ACCEPTED", follow: true });
    rows.block = [{ blockerId: "fan", blockedId: "me" }];
    expect((await visibleWhere("me")).authorId.in.sort()).toEqual(["friend", "me"]);
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
