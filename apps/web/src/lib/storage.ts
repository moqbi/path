import "server-only";

/**
 * باب تخزين الملفات إلى اللوحة.
 *
 * الآلة في `packages/storage` يشترك فيها الخادم واللوحة — توقيعٌ واحد
 * لدلوٍ واحد، فلا تفترق نسختان في ترويسةٍ فيقبل الخادمُ ما ترفضه اللوحة.
 * وهذا البابُ عليه الحارس: لا تُستورد من مكوّن عميل بالغلط.
 */
export { cloudReady, deleteObjects, getObject, putObject, signRequest } from "@athar/storage";
