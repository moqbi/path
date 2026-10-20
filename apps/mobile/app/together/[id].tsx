import { useLocalSearchParams } from "expo-router";
import Timeline from "../(tabs)/index";

/**
 * «آثارنا» مع صديقٍ بعينه — شاشةٌ في المكدّس فوق ما فُتحت منه (القاعدة ٣١٤): سحبُ الحافّة
 * اليمنى يُزيحها فيظهر تحتها ملفُّ الصديق أو قائمةُ «آثارنا». والرسمُ رسمُ الخطّ الزمنيّ نفسه.
 */
export default function Together() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Timeline key={id} lens={{ with: id ?? "" }} />;
}
