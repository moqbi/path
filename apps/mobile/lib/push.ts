import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { api } from "./api";
import { openThread } from "./open-thread";

/**
 * ثلاثةُ أصواتٍ للتنبيهات (القاعدة ٢٥٣) — **بقرار المالك**: الأذنُ تعرف ما جرى
 * قبل أن تُرى الشاشة. الملفّاتُ في `assets/sounds` تُحزَم في البناء (`app.json`
 * ← `expo-notifications sounds`)، والخادمُ يختار الصوتَ والقناةَ بنوع التنبيه.
 */
const SOUND_CHANNELS = [
  { id: "general", name: "التفاعلات والتعليقات والطلبات", sound: "athr_general.wav" },
  { id: "dm", name: "المحادثات", sound: "athr_dm.wav" },
  { id: "athar", name: "آثار والذكريات والمناسبات", sound: "athr_athar.wav" },
] as const;

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

/**
 * ما يفعله التطبيق بتنبيهٍ يصل وهو مفتوح: يُعرض ويُسمع — إلّا رسالةً في
 * المحادثة المفتوحة نفسها: صاحبُها يراها تظهر أمامه، وشريطٌ فوقها تكرار.
 */
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const here = notification.request.content.data?.path === openThread();
    return {
      shouldShowBanner: !here,
      shouldShowList: !here,
      shouldPlaySound: !here,
      shouldSetBadge: false,
    };
  },
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

/** التسجيلُ نفسه، ويقول أين وقف — والإقلاعُ يبلعه. */
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

  // أندرويد يحتاج قناةً وإلّا وصل التنبيه صامتاً بلا بانر — ولكلّ صوتٍ قناتُه:
  // صوتُ القناة يُضبط عند إنشائها ولا يُغيَّر بعدها (القاعدة ٢٥٣).
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "التنبيهات",
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: "#F6B93B",
    });
    for (const channel of SOUND_CHANNELS) {
      await Notifications.setNotificationChannelAsync(channel.id, {
        name: channel.name,
        importance: Notifications.AndroidImportance.HIGH,
        sound: channel.sound,
        lightColor: "#F6B93B",
      });
    }
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
