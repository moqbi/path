import * as WebBrowser from "expo-web-browser";
import { Linking } from "react-native";
import { colors } from "../theme/tokens";

/**
 * الرابط يُفتح داخل التطبيق لا في متصفّحٍ خارجي.
 *
 * `Linking.openURL` تُخرج المستخدم إلى سفاري أو كروم ثمّ تتركه هناك:
 * من ضغط أغنيةَ صديقه وجد نفسه في تطبيقٍ آخر ولا طريق إلى خطّه الزمني
 * إلا الرجوع بالنظام. والمتصفّح المدمج يفتح فوق الشاشة ويُغلق بزرٍّ
 * فيعود إلى مكانه من الخطّ.
 *
 * ويلبس ألوان العلامة: شريطُه داكنٌ كشريط التطبيق العلويّ، فلا يبدو
 * نافذةً من نظامٍ آخر.
 *
 * والفشل يرجع إلى الفتح الخارجي: الرابط الذي لا يفتحه متصفّحٌ مدمج
 * (مخطّطٌ لتطبيقٍ أصليّ مثلاً) يُفتح بالنظام بدل ألّا يُفتح أصلاً.
 */
export async function openIn(url: string): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(url, {
      toolbarColor: colors.chrome,
      controlsColor: colors.clay,
      enableBarCollapsing: true,
    });
  } catch {
    await Linking.openURL(url).catch(() => {});
  }
}
