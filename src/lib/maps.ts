/**
 * رابطُ المكان في الخرائط (القاعدة ٢١١): بالإحداثيات حين حُفظت — وهي لا
 * تُحفظ إلا و«إظهار موقعي» مفتوح (`readPlace`) — وإلّا بالاسم والمدينة بحثاً.
 * وبلا اسمٍ لا رابط: المدينةُ وحدها لا تدلّ على مكان.
 */
export function mapsUrl(place: {
  lat?: number | null;
  lng?: number | null;
  placeName?: string | null;
  placeCity?: string | null;
}): string | null {
  if (!place.placeName) return null;
  const query =
    place.lat != null && place.lng != null
      ? `${place.lat},${place.lng}`
      : [place.placeName, place.placeCity].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
