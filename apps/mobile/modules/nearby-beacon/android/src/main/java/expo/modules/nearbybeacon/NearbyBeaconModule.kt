package expo.modules.nearbybeacon

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothManager
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.ParcelUuid
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID

/**
 * «من حولك» بالبلوتوث على أندرويد (القاعدة ٤٤٥) — نسخةُ وحدة آبل بواجهتها نفسها.
 *
 * أندرويد لا يكتب اسماً محلّياً من اختيارنا (`setIncludeDeviceName` اسمُ الجهاز كلّه)،
 * فالرمزُ يُبثّ «بيانات خدمة» على معرّف خدمتنا في ردّ المسح: `"A" + الرمز`. والمسحُ يقرأ
 * الاثنين — الاسمَ من آيفون، وبيانات الخدمة من أندرويد. والشاشةُ مفتوحة وحدها: لا خدمةَ
 * في الخلفيّة. والإذنُ يطلبه جافاسكربت (`PermissionsAndroid`) قبل `start`.
 */
class Beacon(private val context: Context) {
  private val lock = Any()
  private var service: ParcelUuid? = null
  private var token = ""
  private var scanning = false
  private var advertising = false
  private val heard = HashMap<String, Pair<Int, Long>>()

  private val adapter get() =
    (context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter

  private fun granted(name: String) =
    context.checkSelfPermission(name) == PackageManager.PERMISSION_GRANTED

  fun authorization(): String {
    val ok = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      granted(Manifest.permission.BLUETOOTH_SCAN) && granted(Manifest.permission.BLUETOOTH_ADVERTISE)
    } else {
      granted(Manifest.permission.ACCESS_FINE_LOCATION)
    }
    return if (ok) "allowed" else "denied"
  }

  fun power(): String {
    val a = adapter ?: return "unsupported"
    if (authorization() != "allowed") return "denied"
    return try {
      if (a.isEnabled) "on" else "off"
    } catch (e: SecurityException) {
      "denied"
    }
  }

  private val scanCallback = object : ScanCallback() {
    override fun onScanResult(callbackType: Int, result: ScanResult) = hear(result)
    override fun onBatchScanResults(results: MutableList<ScanResult>) = results.forEach { hear(it) }
  }

  private val advertiseCallback = object : AdvertiseCallback() {}

  private fun hear(result: ScanResult) {
    val record = result.scanRecord ?: return
    val uuid = service ?: return
    val name = record.getServiceData(uuid)?.let { String(it, Charsets.UTF_8) } ?: record.deviceName ?: return
    if (!name.startsWith("A") || name.length != 9) return
    val rssi = result.rssi
    if (rssi == 127) return
    val code = name.substring(1)
    synchronized(lock) {
      val before = heard[code]?.first
      heard[code] = Pair(maxOf(if (before == null) rssi else (before + rssi) / 2, -127), System.currentTimeMillis())
    }
  }

  @SuppressLint("MissingPermission")
  fun start(uuid: String, token: String) {
    service = ParcelUuid(UUID.fromString(uuid))
    this.token = token
    if (authorization() != "allowed") return
    val a = adapter ?: return
    try {
      if (!a.isEnabled) return
      val uuid = service ?: return
      if (!scanning) {
        val scanner = a.bluetoothLeScanner ?: return
        val filter = ScanFilter.Builder().setServiceUuid(uuid).build()
        val settings = ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build()
        scanner.startScan(listOf(filter), settings, scanCallback)
        scanning = true
      }
      advertise()
    } catch (e: SecurityException) {
    } catch (e: IllegalStateException) {
    }
  }

  @SuppressLint("MissingPermission")
  private fun advertise() {
    val a = adapter ?: return
    val uuid = service ?: return
    val advertiser = a.bluetoothLeAdvertiser ?: return
    if (advertising) {
      advertiser.stopAdvertising(advertiseCallback)
      advertising = false
    }
    if (token.isEmpty()) return
    val settings = AdvertiseSettings.Builder()
      .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
      .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
      .setConnectable(false)
      .build()
    val data = AdvertiseData.Builder().addServiceUuid(uuid).setIncludeDeviceName(false).build()
    val reply = AdvertiseData.Builder()
      .addServiceData(uuid, ("A$token").toByteArray(Charsets.UTF_8))
      .setIncludeDeviceName(false)
      .build()
    advertiser.startAdvertising(settings, data, reply, advertiseCallback)
    advertising = true
  }

  @SuppressLint("MissingPermission")
  fun stop() {
    val a = adapter
    try {
      if (scanning) a?.bluetoothLeScanner?.stopScan(scanCallback)
      if (advertising) a?.bluetoothLeAdvertiser?.stopAdvertising(advertiseCallback)
    } catch (e: SecurityException) {
    } catch (e: IllegalStateException) {
    }
    scanning = false
    advertising = false
    synchronized(lock) { heard.clear() }
  }

  /** ما سُمع في الثواني العشر الأخيرة: رمزٌ وأقوى إشارة. */
  fun list(): List<Map<String, Any>> = synchronized(lock) {
    val now = System.currentTimeMillis()
    heard.entries.removeAll { now - it.value.second >= 10_000 }
    heard.map { mapOf("token" to it.key, "rssi" to it.value.first) }
  }
}

class NearbyBeaconModule : Module() {
  private var beacon: Beacon? = null

  private fun get(): Beacon? {
    if (beacon == null) beacon = appContext.reactContext?.let { Beacon(it.applicationContext) }
    return beacon
  }

  override fun definition() = ModuleDefinition {
    Name("NearbyBeacon")

    Function("authorization") { get()?.authorization() ?: "denied" }

    Function("start") { uuid: String, token: String ->
      get()?.start(uuid, token)
      Unit
    }

    Function("stop") {
      get()?.stop()
      Unit
    }

    Function("power") { get()?.power() ?: "unsupported" }

    Function("seen") { get()?.list() ?: emptyList<Map<String, Any>>() }

    OnDestroy { beacon?.stop() }
  }
}
