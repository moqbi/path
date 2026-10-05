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
  // A5 بالنقاط: ١٤٨×٢١٠ ملم.
  const { uri } = await Print.printToFileAsync({ html, width: 420, height: 595 });
  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    UTI: "com.adobe.pdf",
    dialogTitle: `كتاب ${year}`,
  });
}
