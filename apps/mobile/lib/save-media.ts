import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import { baseUrl, currentAccess } from "./api";

/**
 * حفظُ القصّة في الاستديو (القاعدة ٣٢٢) — **بقرار المالك**، لصاحبها وحده.
 *
 * يُنزَّل الملفّ من بابه نفسه (`/v1/media/:id` بالتوكن — معرّفُ الملف ليس صلاحية،
 * القاعدة ٢٣ب) إلى مخبأ الجهاز، ثمّ تُفتح نافذةُ المشاركة وفيها «حفظ الصورة» أو «حفظ
 * الفيديو». **لا `expo-media-library`**: وحدةٌ أصليّةٌ وإذنُ ألبومٍ جديد يحتاجان بناءً
 * ومراجعة (القاعدة ٢٣٩)؛ ووحدتا الملفّات والمشاركة في البناء من قبل، فيصل بتحديث.
 * والصورةُ كما رُفعت: النصوصُ والملصقاتُ والفلترُ تُرسم عند العرض ولا تُحرق فيها
 * (القاعدة ٩٧)، فلا تخرج معها.
 */
const ready =
  Platform.OS !== "web" &&
  requireOptionalNativeModule("ExpoSharing") !== null &&
  requireOptionalNativeModule("ExponentFileSystem") !== null;

export const canSaveMedia = ready;

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

export async function saveMedia(mediaId: string, mime: string): Promise<void> {
  if (!ready) throw new Error("الحفظ يحتاج تحديث التطبيق من المتجر");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const FileSystem = require("expo-file-system/legacy") as typeof import("expo-file-system/legacy");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Sharing = require("expo-sharing") as typeof import("expo-sharing");

  const ext = EXT[mime] ?? (mime.startsWith("video/") ? "mp4" : "jpg");
  const target = `${FileSystem.cacheDirectory}athar-story-${mediaId}.${ext}`;
  const token = currentAccess();
  const { status, uri } = await FileSystem.downloadAsync(`${baseUrl}/v1/media/${mediaId}`, target, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (status !== 200) throw new Error("تعذّر تنزيل القصة");
  await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: "احفظ القصة" });
}
