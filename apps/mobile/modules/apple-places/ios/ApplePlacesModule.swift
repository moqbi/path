import ExpoModulesCore
import MapKit
import CoreLocation

/**
 * الأماكن حول نقطةٍ من خرائط آبل — على الجهاز نفسه، بلا مفتاحٍ ولا خادمٍ
 * وسيط. `nearby` يسأل عن المعالم المسمّاة في دائرةٍ حول النقطة
 * (`MKLocalPointsOfInterestRequest`)، و`search` يبحث بالاسم قربها
 * (`MKLocalSearch`). والصفُّ: معرّفٌ واسمٌ وفئةٌ وبُعدٌ بالأمتار — شكلُ ما
 * يردّه `/v1/places/nearby` نفسه، فالشاشةُ لا تعرف من أين جاء.
 */
public class ApplePlacesModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ApplePlaces")

    AsyncFunction("nearby") { (lat: Double, lng: Double, radius: Double, promise: Promise) in
      let center = CLLocationCoordinate2D(latitude: lat, longitude: lng)
      let request = MKLocalPointsOfInterestRequest(center: center, radius: max(50, min(radius, 3000)))
      DispatchQueue.main.async {
        MKLocalSearch(request: request).start { response, error in
          if let error = error {
            // «لا نتائج» خطأٌ في MapKit لا قائمةٌ فارغة — وهو ليس عطلاً.
            if (error as NSError).code == Int(MKError.placemarkNotFound.rawValue) {
              promise.resolve([])
            } else {
              promise.reject("E_PLACES", error.localizedDescription)
            }
            return
          }
          promise.resolve(ApplePlacesModule.rows(response?.mapItems ?? [], center))
        }
      }
    }

    AsyncFunction("search") { (query: String, lat: Double, lng: Double, promise: Promise) in
      let center = CLLocationCoordinate2D(latitude: lat, longitude: lng)
      let request = MKLocalSearch.Request()
      request.naturalLanguageQuery = query
      request.region = MKCoordinateRegion(center: center, latitudinalMeters: 8000, longitudinalMeters: 8000)
      request.resultTypes = .pointOfInterest
      DispatchQueue.main.async {
        MKLocalSearch(request: request).start { response, error in
          if let error = error {
            if (error as NSError).code == Int(MKError.placemarkNotFound.rawValue) {
              promise.resolve([])
            } else {
              promise.reject("E_PLACES", error.localizedDescription)
            }
            return
          }
          promise.resolve(ApplePlacesModule.rows(response?.mapItems ?? [], center))
        }
      }
    }
  }

  static func rows(_ items: [MKMapItem], _ center: CLLocationCoordinate2D) -> [[String: Any]] {
    let origin = CLLocation(latitude: center.latitude, longitude: center.longitude)
    var seen = Set<String>()
    var out: [[String: Any]] = []
    for item in items {
      guard let name = item.name, !name.isEmpty else { continue }
      let coordinate = item.placemark.coordinate
      let meters = origin.distance(from: CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude))
      // الاسمُ نفسه على بُعدٍ واحد تقريباً صفٌّ واحد — فروعُ السلسلة تبقى.
      let key = "\(name)|\(Int(meters / 25))"
      if seen.contains(key) { continue }
      seen.insert(key)
      out.append([
        "id": "apple:\(String(format: "%.5f,%.5f", coordinate.latitude, coordinate.longitude)):\(name)",
        "name": name,
        // فارغٌ لا `NSNull`: `??` لا يجمع نوعين، وجافاسكربت يقرأ الفراغ «بلا فئة».
        "category": item.pointOfInterestCategory?.rawValue ?? "",
        "meters": Int(meters.rounded()),
      ])
    }
    return out.sorted { ($0["meters"] as? Int ?? 0) < ($1["meters"] as? Int ?? 0) }
  }
}
