/** نواةُ `qrcode` بلا رسم — الحزمةُ لا تُعلن أنواعَ هذا المسار. */
declare module "qrcode/lib/core/qrcode" {
  export function create(
    text: string,
    options?: { errorCorrectionLevel?: "L" | "M" | "Q" | "H" },
  ): { modules: { size: number; get(x: number, y: number): boolean | number } };
}
