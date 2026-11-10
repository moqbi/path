package expo.modules.huaweihms

import android.app.Activity
import android.content.Context
import android.content.Intent
import expo.modules.kotlin.Promise

/** بناءٌ بلا خدمات هواوي: كلُّ نداءٍ يقول ذلك ولا يسقط. */
object Hms {
  const val ENABLED = false

  fun available(context: Context) = false

  private fun off(promise: Promise) = promise.reject("ERR_HMS", "خدمات هواوي غير مضمّنة في هذا البناء", null)

  fun pushToken(context: Context, appId: String, promise: Promise) = off(promise)

  fun deleteToken(context: Context, appId: String, promise: Promise) = off(promise)

  fun iapReady(activity: Activity?, promise: Promise) = promise.resolve("off")

  fun products(context: Context, ids: List<String>, type: Int, promise: Promise) = off(promise)

  fun buy(activity: Activity?, productId: String, type: Int, payload: String, promise: Promise) = off(promise)

  fun owned(context: Context, type: Int, promise: Promise) = off(promise)

  fun checkUpdate(activity: Activity?, promise: Promise) = promise.resolve("off")

  fun manage(activity: Activity?, promise: Promise) = promise.resolve(false)

  fun onResult(activity: Activity, requestCode: Int, data: Intent?) {}
}
