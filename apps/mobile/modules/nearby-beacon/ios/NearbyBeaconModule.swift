import ExpoModulesCore
import CoreBluetooth

/**
 * «من حولك» بالبلوتوث منخفض الطاقة (القاعدة ٢٨٢) — والشاشةُ مفتوحة وحدها.
 *
 * الجهازُ يبثّ خدمتنا (`service`) واسماً محلّياً هو رمزٌ قصيرُ العمر يصدره
 * الخادم — لا معرّفَ الحساب — ويمسح الخدمةَ نفسها فيلتقط رموزَ من حوله بقوّة
 * إشارتها. وما التُقط يُقرأ من جافاسكربت (`seen`) ويُرسل إلى الخادم ليُحلّ.
 * ولا شيء في الخلفيّة: آيفون في الخلفيّة لا يبثّ اسماً أصلاً، ولا نطلب
 * صلاحيّاتها. وطلبُ الإذن يخرج بنفسه أوّلَ ما يُنشأ المدير.
 */
final class Beacon: NSObject, CBCentralManagerDelegate, CBPeripheralManagerDelegate {
  private let queue = DispatchQueue(label: "app.athar.beacon")
  private let lock = NSLock()
  private var central: CBCentralManager?
  private var peripheral: CBPeripheralManager?
  private var service: CBUUID?
  private var token = ""
  private var heard: [String: (rssi: Int, at: Date)] = [:]

  func start(uuid: String, token: String) {
    queue.async {
      self.service = CBUUID(string: uuid)
      self.token = token
      if let central = self.central { self.scan(central) } else {
        self.central = CBCentralManager(delegate: self, queue: self.queue)
      }
      if let peripheral = self.peripheral { self.advertise(peripheral) } else {
        self.peripheral = CBPeripheralManager(delegate: self, queue: self.queue)
      }
    }
  }

  func stop() {
    queue.async {
      self.central?.stopScan()
      self.peripheral?.stopAdvertising()
      self.central = nil
      self.peripheral = nil
      self.lock.lock()
      self.heard.removeAll()
      self.lock.unlock()
    }
  }

  /** حالُ البلوتوث نفسه لا إذنُه: مسموحٌ ومطفأٌ من مركز التحكّم لا يبثّ شيئاً. */
  func power() -> String {
    switch central?.state {
    case .poweredOn: return "on"
    case .poweredOff: return "off"
    case .unauthorized: return "denied"
    case .unsupported: return "unsupported"
    default: return "unknown"
    }
  }

  /** ما سُمع في الثواني العشر الأخيرة: رمزٌ وأقوى إشارة. */
  func list() -> [[String: Any]] {
    lock.lock()
    defer { lock.unlock() }
    let now = Date()
    heard = heard.filter { now.timeIntervalSince($0.value.at) < 10 }
    return heard.map { ["token": $0.key, "rssi": $0.value.rssi] }
  }

  private func scan(_ central: CBCentralManager) {
    guard central.state == .poweredOn, let service = service else { return }
    central.scanForPeripherals(
      withServices: [service],
      options: [CBCentralManagerScanOptionAllowDuplicatesKey: true]
    )
  }

  private func advertise(_ peripheral: CBPeripheralManager) {
    guard peripheral.state == .poweredOn, let service = service, !token.isEmpty else { return }
    peripheral.stopAdvertising()
    peripheral.startAdvertising([
      CBAdvertisementDataServiceUUIDsKey: [service],
      CBAdvertisementDataLocalNameKey: "A" + token,
    ])
  }

  func centralManagerDidUpdateState(_ central: CBCentralManager) {
    scan(central)
  }

  func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
    advertise(peripheral)
  }

  func centralManager(
    _ central: CBCentralManager,
    didDiscover peripheral: CBPeripheral,
    advertisementData: [String: Any],
    rssi RSSI: NSNumber
  ) {
    guard let name = advertisementData[CBAdvertisementDataLocalNameKey] as? String,
          name.hasPrefix("A"), name.count == 9 else { return }
    let rssi = RSSI.intValue
    // ١٢٧ عند آبل «لا قراءة» لا إشارةٌ قويّة.
    if rssi == 127 { return }
    let code = String(name.dropFirst())
    lock.lock()
    let before = heard[code]?.rssi ?? Int.min
    heard[code] = (rssi: max(before == Int.min ? rssi : (before + rssi) / 2, -127), at: Date())
    lock.unlock()
  }
}

public class NearbyBeaconModule: Module {
  private let beacon = Beacon()

  public func definition() -> ModuleDefinition {
    Name("NearbyBeacon")

    /** إذنُ البلوتوث: «allowed» أو «denied» أو «undetermined». */
    Function("authorization") { () -> String in
      switch CBManager.authorization {
      case .allowedAlways: return "allowed"
      case .notDetermined: return "undetermined"
      default: return "denied"
      }
    }

    Function("start") { (uuid: String, token: String) in
      self.beacon.start(uuid: uuid, token: token)
    }

    Function("stop") {
      self.beacon.stop()
    }

    Function("power") { () -> String in
      return self.beacon.power()
    }

    Function("seen") { () -> [[String: Any]] in
      return self.beacon.list()
    }

    OnDestroy {
      self.beacon.stop()
    }
  }
}
