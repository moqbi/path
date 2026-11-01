import { Alert } from "react-native";
import { showToast } from "../components/accounts-sheet";

/**
 * ردُّ فتح المحادثة أو الإرسال (القاعدة ٣٨٥): «فلان مقفل الخاص — لا يستقبل الرسائل الخاصة»
 * سطرٌ زجاجيّ في أعلى الشاشة بصورة صاحبه، وغيرُه من الأخطاء نافذةٌ تقول سببَه — كانت
 * الضغطةُ تموت بصمتٍ فتُقرأ عطلاً.
 */
export function chatRefused(problem: unknown, avatarMediaId: string | null = null): void {
  const message = problem instanceof Error ? problem.message : "تعذّر فتح المحادثة";
  if (message.includes("مقفل الخاص")) {
    showToast({ name: message, avatarMediaId, lead: "", place: "top" });
    return;
  }
  Alert.alert("تعذّر فتح المحادثة", message);
}
