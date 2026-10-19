import { describe, expect, it } from "vitest";
import { normalizePhone } from "@athar/shared";
import { hashPhone } from "../src/services/phone";

// التطبيعُ نسخةٌ واحدة للجهاز والخادم (القاعدة ٢٩٧): رقمٌ يُكتب بصيغتين يُطابَق بصيغةٍ واحدة.
describe("normalizePhone", () => {
  it("يقرأ صيغ الجوال السعوديّ كلّها رقماً واحداً", () => {
    for (const raw of ["0551234567", "551234567", "+966551234567", "00966551234567", "966551234567", "+966 0551234567", "(055) 123-4567", "٠٥٥١٢٣٤٥٦٧"]) {
      expect(normalizePhone(raw)).toBe("+966551234567");
    }
  });
  it("يُبقي الأرقام الدوليّة كما كُتبت", () => {
    expect(normalizePhone("+971 50 123 4567")).toBe("+971501234567");
    expect(normalizePhone("0044 7700 900123")).toBe("+447700900123");
  });
  it("يردّ ما ليس رقماً", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("1234567")).toBeNull();
  });
  it("التجزئةُ sha256 بالسداسيّ — كما يجزّئ الجهاز", () => {
    expect(hashPhone("+966551234567")).toMatch(/^[0-9a-f]{64}$/);
  });
});
