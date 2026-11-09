package expo.modules.huaweihms

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * خدماتُ هواوي (القاعدة ٤٤٦): رمزُ Push Kit والدفعُ داخل التطبيق (IAP).
 *
 * الكودُ الحقيقيّ في `Hms` من `src/hms` ويُبنى في ملفّ `huawei` وحده، وفي غيره `Hms`
 * بديلٌ يقول «غير مضمّن» — فالوحدةُ موجودةٌ في كلّ بناء أندرويد وخدماتُ هواوي لا.
 */
class HuaweiHmsModule : Module() {
  private val context get() = appContext.reactContext ?: throw IllegalStateException("no context")

  override fun definition() = ModuleDefinition {
    Name("HuaweiHms")

    Function("enabled") { Hms.ENABLED }

    Function("available") { appContext.reactContext?.let { Hms.available(it) } ?: false }

    AsyncFunction("pushToken") { appId: String, promise: Promise ->
      Hms.pushToken(context, appId, promise)
    }

    AsyncFunction("deleteToken") { appId: String, promise: Promise ->
      Hms.deleteToken(context, appId, promise)
    }

    AsyncFunction("iapReady") { promise: Promise ->
      Hms.iapReady(appContext.currentActivity, promise)
    }

    AsyncFunction("products") { ids: List<String>, type: Int, promise: Promise ->
      Hms.products(context, ids, type, promise)
    }

    AsyncFunction("buy") { productId: String, type: Int, payload: String, promise: Promise ->
      Hms.buy(appContext.currentActivity, productId, type, payload, promise)
    }

    AsyncFunction("owned") { type: Int, promise: Promise ->
      Hms.owned(context, type, promise)
    }

    AsyncFunction("manage") { promise: Promise ->
      Hms.manage(appContext.currentActivity, promise)
    }

    OnActivityResult { activity, payload ->
      Hms.onResult(activity, payload.requestCode, payload.data)
    }
  }
}
