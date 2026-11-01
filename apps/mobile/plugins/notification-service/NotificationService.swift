import UserNotifications

/// صورةُ التنبيه (القاعدة ٣٨٨): خدمةُ Expo تضع `richContent.image` في `body._richContent.image`،
/// وآبل لا ترسم صورةً بنفسها — هذا الامتدادُ ينزّلها ويُلحقها بالتنبيه قبل أن يظهر، فتُرى حين
/// يُضغط مطوّلاً أو يُسحب. وما لا صورةَ فيه أو تعثّر تنزيلُه يظهر كما وصل.
class NotificationService: UNNotificationServiceExtension {
  var contentHandler: ((UNNotificationContent) -> Void)?
  var bestAttemptContent: UNMutableNotificationContent?

  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
  ) {
    self.contentHandler = contentHandler
    bestAttemptContent = request.content.mutableCopy() as? UNMutableNotificationContent
    guard let content = bestAttemptContent else {
      contentHandler(request.content)
      return
    }
    guard
      let body = request.content.userInfo["body"] as? [String: Any],
      let rich = body["_richContent"] as? [String: Any],
      let address = rich["image"] as? String,
      let url = URL(string: address),
      url.scheme == "https"
    else {
      contentHandler(content)
      return
    }

    let task = URLSession.shared.downloadTask(with: url) { location, response, _ in
      defer { contentHandler(content) }
      guard
        let location = location,
        let http = response as? HTTPURLResponse,
        http.statusCode == 200
      else { return }
      let target = URL(fileURLWithPath: NSTemporaryDirectory())
        .appendingPathComponent(UUID().uuidString + ".jpg")
      do {
        try FileManager.default.moveItem(at: location, to: target)
        let attachment = try UNNotificationAttachment(identifier: "image", url: target, options: nil)
        content.attachments = [attachment]
      } catch {
        // تنبيهٌ بلا صورة خيرٌ من تنبيهٍ لا يصل.
      }
    }
    task.resume()
  }

  override func serviceExtensionTimeWillExpire() {
    if let contentHandler = contentHandler, let content = bestAttemptContent {
      contentHandler(content)
    }
  }
}
