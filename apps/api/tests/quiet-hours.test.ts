import { describe, expect, it } from "vitest";
import { inQuietHours } from "../src/services/push";

/**
 * الوضع الهادئ — أخطرُ ما فيه المدّةُ العابرة لمنتصف الليل، وهي الحال
 * الغالبة («من العاشرة مساءً إلى السابعة صباحاً»).
 *
 * والوقتُ بتوقيت الرياض لا بتوقيت الخادم، فالساعاتُ هنا تُبنى بالإزاحة.
 */
const at = (hour: number, minute = 0) =>
  new Date(Date.UTC(2026, 0, 1, (hour - 3 + 24) % 24, minute));

describe("الوضع الهادئ", () => {
  const from = 22 * 60;
  const to = 7 * 60;

  it("يسكت عند بدايته", () => expect(inQuietHours(from, to, at(22))).toBe(true));
  it("يسكت بعد منتصف الليل", () => expect(inQuietHours(from, to, at(3))).toBe(true));
  it("ينطق عند نهايته", () => expect(inQuietHours(from, to, at(7))).toBe(false));
  it("ينطق في الظهيرة", () => expect(inQuietHours(from, to, at(12))).toBe(false));
  it("ينطق قبل بدايته بدقيقة", () => expect(inQuietHours(from, to, at(21, 59))).toBe(false));

  it("ومدّةٌ داخل اليوم تُقرأ كما هي", () => {
    expect(inQuietHours(13 * 60, 16 * 60, at(14))).toBe(true);
    expect(inQuietHours(13 * 60, 16 * 60, at(17))).toBe(false);
  });

  it("وبلا طرفين لا وضعَ هادئ", () => {
    expect(inQuietHours(null, null, at(3))).toBe(false);
    expect(inQuietHours(from, null, at(3))).toBe(false);
  });
});
