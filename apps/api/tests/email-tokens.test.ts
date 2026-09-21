import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * رمزُ البريد — مرّةً واحدةً وبعمرٍ محدود.
 *
 * ولأنّه بابُ إعادة ضبط كلمة المرور، فإسقاطُ أحد شرطيه يفتح الحساب
 * لمن التقط رابطاً قديماً.
 */
type Row = {
  id: string;
  userId: string;
  kind: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
};

const table: Row[] = [];

vi.mock("@athar/db", () => ({
  prisma: {
    emailToken: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        table.find((r) => r.tokenHash === where.tokenHash) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        const row = table.find((r) => r.id === where.id)!;
        Object.assign(row, data);
        return row;
      },
      findFirst: async () => null,
      create: async () => ({}),
    },
  },
}));

vi.mock("../src/services/mail", () => ({ sendMail: async () => true, letterHtml: () => "" }));
vi.mock("@athar/shared", () => ({ SITE_URL: "https://example.test" }));

const { consume } = await import("../src/services/email-tokens");
const { createHash } = await import("node:crypto");
const digest = (t: string) => createHash("sha256").update(t).digest("hex");

beforeEach(() => {
  table.length = 0;
  table.push({
    id: "t1",
    userId: "u1",
    kind: "RESET",
    tokenHash: digest("good"),
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null,
  });
});

describe("رمز البريد", () => {
  it("يُقبل مرّةً ويردّ صاحبه", async () => {
    expect(await consume("good", "RESET")).toEqual({ userId: "u1" });
  });

  it("ولا يُقبل مرّتين", async () => {
    await consume("good", "RESET");
    const again = await consume("good", "RESET");
    expect(again).toHaveProperty("error");
    expect((again as { error: string }).error).toContain("استُعمل");
  });

  it("والمنتهي يُقال له «انتهت» لا «غير صحيح»", async () => {
    table[0].expiresAt = new Date(Date.now() - 1000);
    const read = await consume("good", "RESET");
    expect((read as { error: string }).error).toContain("انتهت");
  });

  it("ورمزُ تأكيدٍ لا يصلح لإعادة الضبط", async () => {
    const read = await consume("good", "VERIFY");
    expect(read).toHaveProperty("error");
  });

  it("والمزوَّرُ يُردّ", async () => {
    expect(await consume("forged", "RESET")).toHaveProperty("error");
    expect(await consume("", "RESET")).toHaveProperty("error");
  });
});
