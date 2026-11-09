package expo.modules.huaweihms

import android.os.Bundle
import com.huawei.hms.push.HmsMessageService

/**
 * رمزُ Push Kit قد يصل متأخّراً (أنظمةُ EMUI القديمة لا تردّه من `getToken` بل هنا) — فيُحفظ،
 * وتقرؤه `pushToken` في المرّة التالية. والتنبيهاتُ نفسُها يعرضها HMS Core بلا كودٍ منّا.
 */
class AtharHmsService : HmsMessageService() {
  override fun onNewToken(token: String?) {
    if (!token.isNullOrEmpty()) TokenStore.write(this, token)
  }

  override fun onNewToken(token: String?, bundle: Bundle?) {
    if (!token.isNullOrEmpty()) TokenStore.write(this, token)
  }
}
