import "server-only";

/**
 * باب تخزين الملفات إلى التطبيق.
 *
 * الآلة في `r2.ts` بلا حارس ليستوردها سكربت الترحيل خارج Next، وهذا
 * البابُ عليه الحارس: لا تُستورد من مكوّن عميل بالغلط.
 */
export { cloudReady, deleteObjects, getObject, putObject, signRequest } from "@/lib/r2";
