import { Linking, Platform } from "react-native";

/**
 * اسمُ المكان يفتح الخرائط (القاعدة ٢١١): خرائط آبل على الآيفون، وما يختاره
 * أندرويد لـ`geo:`. تطبيقُ الخرائط لا المتصفّح المدمج (القاعدة ٦٢): من ضغط
 * المكان يريد طريقاً إليه، والطريقُ في التطبيق. وبالإحداثيات حين حُفظت —
 * ولا تُحفظ إلا و«إظهار موقعي» مفتوح — وإلّا بالاسم والمدينة بحثاً.
 */
export function canOpenMaps(place: { placeName?: string | null }): boolean {
  return Boolean(place.placeName);
}

export async function openMaps(place: {
  lat?: number | null;
  lng?: number | null;
  placeName?: string | null;
  placeCity?: string | null;
}): Promise<void> {
  if (!place.placeName) return;
  const exact = place.lat != null && place.lng != null;
  const name = encodeURIComponent(place.placeName);
  const search = encodeURIComponent([place.placeName, place.placeCity].filter(Boolean).join(" "));

  const url =
    Platform.OS === "ios"
      ? exact
        ? `https://maps.apple.com/?ll=${place.lat},${place.lng}&q=${name}`
        : `https://maps.apple.com/?q=${search}`
      : Platform.OS === "android"
        ? exact
          ? `geo:${place.lat},${place.lng}?q=${place.lat},${place.lng}(${name})`
          : `geo:0,0?q=${search}`
        : `https://www.google.com/maps/search/?api=1&query=${exact ? `${place.lat},${place.lng}` : search}`;

  // بلا تطبيق خرائط على أندرويد يُفتح البحثُ في المتصفّح بدل ألّا يُفتح شيء.
  await Linking.openURL(url).catch(() =>
    Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${exact ? `${place.lat},${place.lng}` : search}`,
    ).catch(() => {}),
  );
}
