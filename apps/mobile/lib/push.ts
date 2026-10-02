import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { api } from "./api";

/**
 * تنبيهاتُ الجهاز.
 *
 * **ولا يُطلب الإذن عند الإقلاع**: من فتح التطبيق أوّل مرّةٍ لم يُعطَ
 * شيئاً بعد، وإذنٌ يُطلب بلا سببٍ يُرفض بلا تفكير — ورفضُه في آبل
 * لا يُسأل بعده ثانيةً. يُطلب بعد الدخول، وقد صار له أصدقاءُ ولحظات
 * يُنبَّه عليها (كإذن الموقع في القاعدة ٦٨).
 *
 * والرمزُ من Expo لا من آبل وقوقل: خدمتُها توصّله، فلا يحمل خادمُنا
 * بروتوكولين ولا شهادتين.
 */

/** ما يفعله التطبيق بتنبيهٍ يصل وهو مفتوح: يُعرض ويُسمع. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** معرّفُ مشروع EAS — منه تُصدر خدمةُ Expo رمزَ الجهاز. */
function projectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig
      ?.projectId
  );
}

/**
 * يطلب الإذن، ويسجّل الرمز عند الخادم.
 *
 * يردّ الرمز إن تمّ، و`null` إن رُفض الإذن أو كان المحاكي — والمحاكي لا
 * يستقبل تنبيهاتٍ أصلاً، فلا معنى لأن يُسأل صاحبُه.
 */
export async function enablePush(): Promise<string | null> {
  try {
    return (await registerPush()).token;
  } catch {
    // تنبيهٌ لم يُسجَّل لا يمنع أحداً من استعمال التطبيق.
    return null;
  }
}

/**
 * التسجيلُ نفسه، ويقول أين وقف: الإقلاعُ يبلعه، وزرُّ «جرّب تنبيهاً»
 * في الإعدادات يعرضه — فلا يبقى «لم يصل شيء» بلا سبب.
 */
async function registerPush(): Promise<{
  token: string | null;
  reason?: string;
}> {
  if (!Device.isDevice)
    return {
      token: null,
      reason: "هذا محاكٍ — التنبيهات على جهازٍ حقيقي وحده",
    };

  /*
       الجوابُ يُقرأ من الحقلين معاً: نسخُ `expo-notifications` تختلف
       بينهما (`granted` أو `status`)، وقراءةُ أحدهما وحده تكسر عند
       الترقية بلا خطأٍ يظهر — يُقرأ «مرفوض» فلا تُطلب التنبيهات أصلاً.
    */
  const ok = (answer: unknown) => {
    const reply = answer as { granted?: boolean; status?: string };
    return reply.granted === true || reply.status === "granted";
  };

  if (!ok(await Notifications.getPermissionsAsync())) {
    if (!ok(await Notifications.requestPermissionsAsync())) {
      return {
        token: null,
        reason:
          "إذن التنبيهات مرفوض — فعّله من إعدادات الجهاز ← آثار مومنتس ← الإشعارات",
      };
    }
  }

  // أندرويد يحتاج قناةً وإلّا وصل التنبيه صامتاً بلا بانر.
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "التنبيهات",
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: "#F6B93B",
    });
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({
    projectId: projectId(),
  });
  if (!token) return { token: null, reason: "لم تُعطِ Expo رمزاً للجهاز" };

  await api("/v1/me/devices", {
    method: "PUT",
    body: JSON.stringify({
      token,
      platform: Platform.OS === "ios" ? "ios" : "android",
    }),
  });
  return { token };
}

/** يسجّل الجهاز ثمّ يطلب تنبيهاً تجريبيّاً، ويردّ ما جرى نصّاً يُقرأ. */
export async function testPush(): Promise<string> {
  let step = "تسجيل الجهاز";
  try {
    const { token, reason } = await registerPush();
    if (!token) return reason ?? "تعذّر تسجيل الجهاز";
    step = "الإرسال";
    const reply = await api<{ devices: number; results: string[] }>(
      "/v1/me/devices/test",
      { method: "POST" },
    );
    if (reply.devices === 0) return "لم يُسجَّل جهازٌ عند الخادم";
    const failed = reply.results.filter((row) => row !== "ok");
    if (failed.length === 0) return "أُرسل — يصلك التنبيه خلال ثوانٍ";
    return `رفضته خدمة التنبيهات: ${failed.join(" · ")}`;
  } catch (problem) {
    return `تعذّر ${step}: ${problem instanceof Error ? problem.message : String(problem)}`;
  }
}

/** نزعُ الجهاز عند الخروج: من خرج لا تصله تنبيهاتُ حسابه. */
export async function disablePush(): Promise<void> {
  try {
    if (!Device.isDevice) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: projectId(),
    });
    if (token) {
      await api("/v1/me/devices", {
        method: "DELETE",
        body: JSON.stringify({ token }),
      });
    }
  } catch {
    // لا شيء: الخروج لا ينتظر جواب خادمٍ ثالث.
  }
}
