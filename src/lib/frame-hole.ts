/**
 * قياسُ الفراغ الأوسط في صورة الإطار — في المتصفّح عند الرفع.
 *
 * رسمُ الإطار قد يمتدّ بعيداً عن حلقته (جناحان، سعفٌ، تاج)، فلو وُضع
 * في مربّع الوجه كما هو جلست الحلقةُ **داخل** الصورة وبقي الوجه ظاهراً
 * من حولها. فالمقياس من الفراغ: كم يتّسع وسطُ الرسم نسبةً من عرضه،
 * ثمّ يُكبَّر الرسمُ بمقلوبه فيطابق الفراغُ الوجه (`frameZoom`).
 *
 * والقياس يُؤخذ من ثماني جهاتٍ ويُؤخذ **أضيقُها**: حلقةٌ بيضاويةٌ
 * قليلاً لا يُقاس نصفُها الواسع فيخرج الوجه من ضيّقها.
 *
 * ويُقاس هنا لا على الخادم: فكّ PNG في Node يحتاج مكتبةً، والمتصفّح
 * يفكّه بـ`canvas` بلا اعتمادية. وبلا قياسٍ يبقى الإطار كما هو.
 */
export async function measureHole(file: Blob): Promise<number | null> {
  try {
    const url = URL.createObjectURL(file);
    try {
      const img = document.createElement("img");
      await new Promise<void>((done, fail) => {
        img.onload = () => done();
        img.onerror = () => fail(new Error("image"));
        img.src = url;
      });

      // ٢٥٦ يكفي لقياس نسبة: القياسُ نسبةٌ لا بكسلات.
      const side = 256;
      const canvas = document.createElement("canvas");
      canvas.width = side;
      canvas.height = side;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      ctx.clearRect(0, 0, side, side);
      ctx.drawImage(img, 0, 0, side, side);
      const data = ctx.getImageData(0, 0, side, side).data;

      const alpha = (x: number, y: number) =>
        data[(Math.round(y) * side + Math.round(x)) * 4 + 3] ?? 0;

      const mid = side / 2;
      // وسطٌ مصمت يعني صورةً بلا فراغ — لا إطار.
      if (alpha(mid, mid) >= 32) return null;

      let narrow = mid;
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        let r = 0;
        while (r < mid && alpha(mid + dx * r, mid + dy * r) < 32) r += 1;
        if (r < narrow) narrow = r;
      }

      const hole = Math.round((2 * narrow * 100) / side);
      return hole >= 20 && hole <= 99 ? hole : null;
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    // قياسٌ فاشل ليس عطلاً: يُرفع الإطار بلا قياس ويُرسم كما هو.
    return null;
  }
}
