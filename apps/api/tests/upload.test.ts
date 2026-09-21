import { describe, expect, it } from "vitest";
import { isAnimated } from "../src/services/upload";

/**
 * شمُّ بايتات الملفّ — لا يُصدَّق ما قاله العميل عن نوعه.
 *
 * وصورةٌ متحرّكة تُرفع بملفّها (ميزةُ آثار+)، فمن قال «ثابتة» وهي
 * متحرّكة يتجاوز حدّاً، ومن قال «متحرّكة» وهي ثابتة يأخذ ميزةً بلا حقّ.
 */
const gif = (frames: number) => {
  const head = Buffer.from("GIF89a", "ascii");
  const block = Buffer.from([0x21, 0xf9, 0x04]); // امتدادُ التحكّم بالرسم
  return new Uint8Array(Buffer.concat([head, ...Array(frames).fill(block)]));
};

describe("شمُّ الصور المتحرّكة", () => {
  it("يعرف GIF بإطارين فأكثر", () => {
    expect(isAnimated("image/gif", gif(2))).toBe(true);
  });

  it("ولا يعدّ GIF بإطارٍ واحد متحرّكة", () => {
    expect(isAnimated("image/gif", gif(1))).toBe(false);
  });

  it("ولا يعدّ JPEG متحرّكة مهما قيل", () => {
    expect(isAnimated("image/jpeg", gif(5))).toBe(false);
  });

  it("و`ANIM` في WebP علامتُها", () => {
    const webp = Buffer.concat([
      Buffer.from("RIFF", "ascii"),
      Buffer.alloc(4),
      Buffer.from("WEBPVP8X", "ascii"),
      Buffer.alloc(10),
      Buffer.from("ANIM", "ascii"),
      Buffer.alloc(16),
    ]);
    expect(isAnimated("image/webp", new Uint8Array(webp))).toBe(true);
  });

  it("وWebP ثابتة ليست متحرّكة", () => {
    const still = Buffer.concat([
      Buffer.from("RIFF", "ascii"),
      Buffer.alloc(4),
      Buffer.from("WEBPVP8 ", "ascii"),
      Buffer.alloc(40),
    ]);
    expect(isAnimated("image/webp", new Uint8Array(still))).toBe(false);
  });
});
