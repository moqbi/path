import { describe, expect, it } from "vitest";
import { counted, dayKey, monthsBefore, riyadhDay, spanText } from "../src/lib/riyadh-day";
import { openYear } from "../src/services/recap";

describe("أيّامُ الرياض (القاعدة ٢٣٥)", () => {
  it("اليومُ بتوقيت الرياض لا بتوقيت الخادم", () => {
    // ٢٢:٣٠ بالتوقيت العالميّ = ١:٣٠ فجراً في الرياض من اليوم التالي.
    expect(dayKey(riyadhDay(new Date("2026-10-02T22:30:00Z")))).toBe("2026-10-03");
  });

  it("ما لا مثيل له في الشهر السابق يسقط ولا يُقرَّب", () => {
    expect(monthsBefore({ y: 2026, m: 10, d: 31 }, 1)).toBeNull();
    expect(monthsBefore({ y: 2026, m: 10, d: 3 }, 1)).toEqual({ y: 2026, m: 9, d: 3 });
    expect(monthsBefore({ y: 2026, m: 3, d: 15 }, 6)).toEqual({ y: 2025, m: 9, d: 15 });
  });

  it("٢٩ فبراير لا يعود إلا في سنةٍ كبيسة", () => {
    expect(monthsBefore({ y: 2029, m: 2, d: 28 }, 12)).toEqual({ y: 2028, m: 2, d: 28 });
    expect(monthsBefore({ y: 2028, m: 2, d: 29 }, 12)).toBeNull();
    expect(monthsBefore({ y: 2028, m: 2, d: 29 }, 48)).toEqual({ y: 2024, m: 2, d: 29 });
  });

  it("المدّةُ والعددُ بالعربية", () => {
    expect(spanText(1)).toBe("شهر");
    expect(spanText(6)).toBe("٦ أشهر");
    expect(spanText(12)).toBe("سنة");
    expect(spanText(24)).toBe("سنتين");
    expect(spanText(36)).toBe("٣ سنوات");
    expect(counted(12, "لحظة واحدة", "لحظتين", "لحظات", "لحظة")).toBe("١٢ لحظة");
    expect(counted(7, "لحظة واحدة", "لحظتين", "لحظات", "لحظة")).toBe("٧ لحظات");
  });

  it("نافذةُ آثرك: من ٢٥ ديسمبر إلى آخر يناير", () => {
    expect(openYear(new Date("2026-12-24T12:00:00Z"))).toBeNull();
    expect(openYear(new Date("2026-12-24T21:30:00Z"))).toBe(2026); // ٠٠:٣٠ فجر ٢٥ في الرياض
    expect(openYear(new Date("2027-01-31T12:00:00Z"))).toBe(2026);
    expect(openYear(new Date("2027-02-01T12:00:00Z"))).toBeNull();
  });
});
