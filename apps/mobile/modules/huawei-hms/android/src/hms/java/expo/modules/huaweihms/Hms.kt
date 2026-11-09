package expo.modules.huaweihms

import android.app.Activity
import android.content.Context
import android.content.Intent
import com.huawei.hms.aaid.HmsInstanceId
import com.huawei.hms.api.ConnectionResult
import com.huawei.hms.api.HuaweiApiAvailability
import com.huawei.hms.iap.Iap
import com.huawei.hms.iap.IapApiException
import com.huawei.hms.iap.entity.OrderStatusCode
import com.huawei.hms.iap.entity.OwnedPurchasesReq
import com.huawei.hms.iap.entity.ProductInfoReq
import com.huawei.hms.iap.entity.PurchaseIntentReq
import com.huawei.hms.iap.entity.StartIapActivityReq
import com.huawei.hms.iap.util.IapClientHelper
import expo.modules.kotlin.Promise

/**
 * خدماتُ هواوي الحقيقيّة (القاعدة ٤٤٦) — في بناء هواوي وحده.
 *
 * الدفعُ نافذةُ هواوي نفسها: `createPurchaseIntent` ثمّ `startResolutionForResult`، والنتيجةُ
 * تعود في `onActivityResult`. وما يعود يُرسل كما هو إلى خادمنا ليتحقّق منه عند هواوي —
 * الجهازُ لا يُصدَّق، ولا يُودَع شيءٌ هنا.
 */
object Hms {
  const val ENABLED = true

  private const val REQ_BUY = 4461
  private const val REQ_LOGIN = 4462

  private var pendingBuy: Promise? = null
  private var pendingLogin: Promise? = null

  fun available(context: Context): Boolean =
    try {
      HuaweiApiAvailability.getInstance().isHuaweiMobileServicesAvailable(context) == ConnectionResult.SUCCESS
    } catch (e: Throwable) {
      false
    }

  /** رمزُ Push Kit. يُطلب خارج الخيط الرئيس — `getToken` يحجب. */
  fun pushToken(context: Context, appId: String, promise: Promise) {
    Thread {
      try {
        val token = HmsInstanceId.getInstance(context).getToken(appId, "HCM")
        promise.resolve(if (token.isNullOrEmpty()) TokenStore.read(context) else token)
      } catch (e: Throwable) {
        promise.reject("ERR_HMS_PUSH", e.message ?: "تعذّر رمز التنبيهات", e)
      }
    }.start()
  }

  fun deleteToken(context: Context, appId: String, promise: Promise) {
    Thread {
      try {
        HmsInstanceId.getInstance(context).deleteToken(appId, "HCM")
        TokenStore.clear(context)
        promise.resolve(true)
      } catch (e: Throwable) {
        promise.resolve(false)
      }
    }.start()
  }

  /**
   * أجاهزٌ الدفع؟ «ok»، أو «login» (حسابُ هواوي لم يُدخل — تُفتح نافذتُه)، أو «area» (بلدُ
   * الحساب لا يدعم الدفع)، أو «code:N».
   */
  fun iapReady(activity: Activity?, promise: Promise) {
    if (activity == null) {
      promise.resolve("no-activity")
      return
    }
    Iap.getIapClient(activity).isEnvReady()
      .addOnSuccessListener { promise.resolve("ok") }
      .addOnFailureListener { e ->
        if (e !is IapApiException) {
          promise.resolve("error:${e.message}")
          return@addOnFailureListener
        }
        val status = e.status
        when (status.statusCode) {
          OrderStatusCode.ORDER_HWID_NOT_LOGIN -> {
            if (status.hasResolution()) {
              try {
                pendingLogin = promise
                status.startResolutionForResult(activity, REQ_LOGIN)
              } catch (x: Throwable) {
                pendingLogin = null
                promise.resolve("login")
              }
            } else promise.resolve("login")
          }
          OrderStatusCode.ORDER_ACCOUNT_AREA_NOT_SUPPORTED -> promise.resolve("area")
          else -> promise.resolve("code:${status.statusCode}")
        }
      }
  }

  /** أسعارُ المنتجات كما يقولها متجرُ هواوي. النوع: ٠ يُستهلك، ٢ اشتراك. */
  fun products(context: Context, ids: List<String>, type: Int, promise: Promise) {
    val req = ProductInfoReq()
    req.priceType = type
    req.productIds = ids
    Iap.getIapClient(context).obtainProductInfo(req)
      .addOnSuccessListener { result ->
        val list = (result.productInfoList ?: emptyList()).map {
          mapOf(
            "productId" to it.productId,
            "price" to it.price,
            "micros" to it.microsPrice.toDouble(),
            "currency" to it.currency,
            "name" to it.productName,
            "period" to (it.subPeriod ?: ""),
          )
        }
        promise.resolve(list)
      }
      .addOnFailureListener { e -> promise.reject("ERR_HMS_IAP", codeOf(e), e) }
  }

  /** يفتح نافذةَ الدفع. النتيجة `{ code, data, signature }` — والرمزُ صفرٌ للنجاح. */
  fun buy(activity: Activity?, productId: String, type: Int, payload: String, promise: Promise) {
    if (activity == null) {
      promise.reject("ERR_HMS_IAP", "no-activity", null)
      return
    }
    val req = PurchaseIntentReq()
    req.productId = productId
    req.priceType = type
    req.developerPayload = payload
    Iap.getIapClient(activity).createPurchaseIntent(req)
      .addOnSuccessListener { result ->
        val status = result.status
        if (status != null && status.hasResolution()) {
          try {
            pendingBuy?.resolve(mapOf("code" to OrderStatusCode.ORDER_STATE_CANCEL))
            pendingBuy = promise
            status.startResolutionForResult(activity, REQ_BUY)
          } catch (x: Throwable) {
            pendingBuy = null
            promise.reject("ERR_HMS_IAP", x.message ?: "تعذّر فتح نافذة الدفع", x)
          }
        } else {
          promise.resolve(mapOf("code" to OrderStatusCode.ORDER_STATE_FAILED))
        }
      }
      .addOnFailureListener { e ->
        if (e is IapApiException) promise.resolve(mapOf("code" to e.status.statusCode))
        else promise.reject("ERR_HMS_IAP", e.message ?: "تعذّر الدفع", e)
      }
  }

  /** ما يملكه الحسابُ ولم يُستهلك بعد — لإكمال شراءٍ انقطع قبل أن يصل خادمَنا. */
  fun owned(context: Context, type: Int, promise: Promise) {
    val req = OwnedPurchasesReq()
    req.priceType = type
    Iap.getIapClient(context).obtainOwnedPurchases(req)
      .addOnSuccessListener { result ->
        val data = result.inAppPurchaseDataList ?: emptyList()
        val signs = result.inAppSignature ?: emptyList()
        promise.resolve(data.mapIndexed { i, d -> mapOf("data" to d, "signature" to (signs.getOrNull(i) ?: "")) })
      }
      .addOnFailureListener { e -> promise.reject("ERR_HMS_IAP", codeOf(e), e) }
  }

  /** صفحةُ إدارة الاشتراكات عند هواوي — الإلغاءُ هناك لا عندنا. */
  fun manage(activity: Activity?, promise: Promise) {
    if (activity == null) {
      promise.resolve(false)
      return
    }
    val req = StartIapActivityReq()
    req.type = StartIapActivityReq.TYPE_SUBSCRIBE_MANAGER_ACTIVITY
    Iap.getIapClient(activity).startIapActivity(req)
      .addOnSuccessListener { result ->
        result?.startActivity(activity)
        promise.resolve(true)
      }
      .addOnFailureListener { promise.resolve(false) }
  }

  fun onResult(activity: Activity, requestCode: Int, data: Intent?) {
    when (requestCode) {
      REQ_BUY -> {
        val promise = pendingBuy ?: return
        pendingBuy = null
        if (data == null) {
          promise.resolve(mapOf("code" to OrderStatusCode.ORDER_STATE_CANCEL))
          return
        }
        try {
          val info = Iap.getIapClient(activity).parsePurchaseResultInfoFromIntent(data)
          promise.resolve(
            mapOf(
              "code" to info.returnCode,
              "data" to (info.inAppPurchaseData ?: ""),
              "signature" to (info.inAppDataSignature ?: ""),
              "message" to (info.errMsg ?: ""),
            ),
          )
        } catch (e: Throwable) {
          promise.reject("ERR_HMS_IAP", e.message ?: "تعذّرت قراءة نتيجة الدفع", e)
        }
      }
      REQ_LOGIN -> {
        val promise = pendingLogin ?: return
        pendingLogin = null
        val code = if (data == null) -1 else IapClientHelper.parseRespCodeFromIntent(data)
        promise.resolve(if (code == OrderStatusCode.ORDER_STATE_SUCCESS) "ok" else "login")
      }
    }
  }

  private fun codeOf(e: Exception): String =
    if (e is IapApiException) "code:${e.status.statusCode}" else (e.message ?: "error")
}
