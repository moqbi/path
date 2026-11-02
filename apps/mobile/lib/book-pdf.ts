import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import { api } from "./api";

/**
 * «سنتك في كتاب» ملفَّ PDF (القاعدة ٢٥٦).
 *
 * الخادمُ يكتب الكتاب صفحةَ HTML بصورها مضمّنة، والجهازُ يطبعها بمحرّكه
 * (`expo-print` ← WebKit) ثمّ يفتح نافذةَ المشاركة فيُحفظ في «الملفّات» أو
 * يُرسل. **والوحدتان اختياريّتان** (القاعدة ١٢٤): تحديثٌ يصل إلى بناءٍ قديمٍ
 * بلاهما لا يسقط — يقول إنّ التحميل يحتاج تحديث التطبيق. ولذلك تُستوردان بعد
 * أن يثبت وجودُهما لا في رأس الملفّ.
 */
const ready =
  Platform.OS !== "web" &&
  requireOptionalNativeModule("ExpoPrint") !== null &&
  requireOptionalNativeModule("ExpoSharing") !== null;

export const canDownloadBook = ready;

export async function downloadBook(year: number): Promise<void> {
  if (!ready) throw new Error("تحميل الكتاب يحتاج تحديث التطبيق من المتجر");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Print = require("expo-print") as typeof import("expo-print");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Sharing = require("expo-sharing") as typeof import("expo-sharing");

  const { html } = await api<{ html: string; name: string }>(`/v1/archive/book/${year}/print`);
  /*
    ورقةٌ بنسبة A5 بكسلُها نقطة بلا هامش (القاعدة ٤١٠) — هامشُ الطابعة يُرسم أبيضَ خارج الصفحة،
    فالهامشُ حشوةُ كلّ ورقةٍ في الصفحة نفسها. كانت ٤٢٠×٥٩٥ فصُغّرت الصفحةُ إلى ثلاثة أرباعها.
  */
  const { uri } = await Print.printToFileAsync({ html, width: 560, height: 794, margins: { top: 0, bottom: 0, left: 0, right: 0 } });
  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    UTI: "com.adobe.pdf",
    dialogTitle: `كتاب ${year}`,
  });
}
