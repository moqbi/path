import ExpoModulesCore
import UIKit

/**
 * أين يجلس شريطُ التبويبات (القاعدة ٤٩٤): على شاشة iPhone Duo الخارجيّة ينقل iOS 27.1
 * شريطَ `UITabBarController` إلى «الشريط العموديّ» في جانب الشاشة، ومفتوحاً يعيده إلى
 * الأسفل. والتطبيقُ يرسم بنفسه زرَّ النشر وحشوةَ القوائم، فيسأل هنا عمّا فعله النظام.
 *
 * **لا يُسمّى رمزٌ من SDK 27.1 في الكود**: البناءُ يمرّ بأيّ SDK، والجوابُ يُقاس من
 * الهوامش — ما يتركه الشريطُ في هامش أمان الشاشة الظاهرة زيادةً على هامش النافذة.
 * أفقيّاً يزيد الأسفلُ، وعموديّاً يزيد أحدُ الجانبين. و`verticalBarEdge` يُقرأ إن وُجد
 * للتأكيد وحده.
 */
public class VerticalBarModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VerticalBar")

    AsyncFunction("state") { () -> [String: Any] in
      VerticalBarModule.read()
    }.runOnQueue(.main)
  }

  static func read() -> [String: Any] {
    let none: [String: Any] = ["vertical": false, "left": 0, "right": 0, "edge": 0]
    let windows = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
    guard let window = windows.first(where: { $0.isKeyWindow }) ?? windows.first,
          let root = window.rootViewController,
          let tabs = find(root) else { return none }

    guard let page = tabs.selectedViewController?.view ?? tabs.view else { return none }
    let inner = page.safeAreaInsets
    let outer = window.safeAreaInsets
    let left = max(0, inner.left - outer.left)
    let right = max(0, inner.right - outer.right)
    let bottom = max(0, inner.bottom - outer.bottom)

    var edge = 0
    let traits = tabs.traitCollection
    if traits.responds(to: NSSelectorFromString("verticalBarEdge")),
       let value = traits.value(forKey: "verticalBarEdge") as? NSNumber {
      edge = value.intValue
    }

    // جانبٌ يزيد وأسفلُ لا يزيد: الشريطُ في الجانب.
    let vertical = (left > 20 || right > 20) && bottom < 20
    return ["vertical": vertical, "left": Double(left), "right": Double(right), "edge": edge]
  }

  /** أوّلُ `UITabBarController` في الشجرة الظاهرة — `NativeTabs` يضعه تحت المكدّس. */
  static func find(_ controller: UIViewController) -> UITabBarController? {
    if let tabs = controller as? UITabBarController { return tabs }
    if let presented = controller.presentedViewController, presented.isBeingDismissed == false,
       let tabs = find(presented) { return tabs }
    for child in controller.children {
      if let tabs = find(child) { return tabs }
    }
    return nil
  }
}
