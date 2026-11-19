import { BookIcon, PencilIcon, CameraIcon, CircleIcon, MicIcon, PrivateIcon, StickerIcon, StoreIcon, VerifiedIcon, WithIcon } from "./icons";
import { TagPill } from "./name-tag";
import { Text } from "./type";
import { SUPPORTER_TAG } from "@athar/shared";
import { colors } from "../theme/tokens";
import { DEV_FEATURES } from "../lib/dev-features";

/** مزايا آثار+ — قائمةٌ واحدة تقرؤها صفحةُ الاشتراك وبطاقتُه في المتجر، فلا تختلفان. */
export const PERKS = [
  /*
    ما يُرى بجانب الاسم أوّلاً: النجمةُ توثيقاً، ووسمُ «داعم» — والرسمُ هو
    الشيءُ نفسه كما يظهر في الخطّ الزمنيّ لا أيقونةٌ عنه.
  */
  {
    title: "شارة التوثيق",
    body: "بجانب اسمك في كل مكان — في اللحظات والتعليقات والأصدقاء",
    icon: <VerifiedIcon size={24} color={colors.clay} />,
  },
  {
    title: "وسم «داعم»",
    body: "يظهر بجانب اسمك ما دام اشتراكك قائماً",
    icon: <TagPill tag={SUPPORTER_TAG} size={10} />,
  },
  {
    // جودةُ اللحظة ونسبتُها (القاعدة ٤٧٤) — بقرار المالك.
    title: "صور وفيديو بجودة عالية",
    body: "لحظاتك تظهر بحجمها الكامل لا مقصوصة مربعاً · فيديو ١٠٨٠",
    icon: <CameraIcon size={18} color={colors.gold} />,
  },
  {
    title: "تفاعل بأي إيموجي",
    body: "الخمسة الأساسية تبقى للجميع · لك كل كيبوردك",
    icon: <Text style={{ fontSize: 17 }}>😊</Text>,
  },
  // الملصقاتُ في نسخة التطوير وحدها حتى تُبنى (القاعدة ٢٩١): لا تُوعَد بما لا يُرى.
  ...(DEV_FEATURES
    ? [
        {
          title: "الملصقات",
          body: "في التعليقات والمحادثات · مجموعاتٌ تتجدّد من آثار",
          icon: <StickerIcon size={18} color={colors.gold} />,
        },
      ]
    : []),
  {
    title: "أرشيف بلا نهاية",
    body: "المجاني يحفظ ٦ أشهر · أنت تحفظ كل شي وتصدّره",
    icon: <BookIcon size={18} color={colors.gold} />,
  },
  {
    // تجهيزُ الكتاب (القاعدة ٣٧٨) — بقرار المالك.
    title: "كتاب سنتك كما تريده",
    body: "ثلاثة أغلفة، وعنوان وإهداء بكلماتك، والأقسام بترتيبك قبل PDF",
    icon: <PencilIcon size={18} color={colors.gold} />,
  },
  {
    // **بقرار المالك**: الأثرُ المشترك من مزايا الاشتراك.
    title: "آثارنا",
    body: "كلُّ لحظةٍ جمعتك بصديقٍ بالإشارة «مع» — في خطٍّ واحد لكما",
    icon: <WithIcon size={18} color={colors.gold} />,
  },
  {
    title: "دوائر منفصلة",
    body: "العائلة، الشلة، الشغل — كل وحدة بخصوصيتها",
    // النجمةُ صارت للتوثيق، فللدوائر رسمُها.
    icon: <CircleIcon size={18} color={colors.gold} />,
  },
  {
    // وضعُ التخفّي (القاعدة ٢٥١).
    title: "وضع التخفي",
    body: "ما يظهر لأحد إنك متصل ولا آخر ظهور لك · من الخصوصية",
    icon: <PrivateIcon size={18} color={colors.gold} />,
  },
  {
    title: "رسالة صوتية دقيقتان",
    body: "٢٠ ثانية للجميع · لك ١٢٠ ثانية في كل محادثة",
    icon: <MicIcon size={18} color={colors.gold} />,
  },
  {
    title: "صورة عرض متحركة",
    body: "GIF أو WebP متحركة · من ١٢٠×١٢٠ إلى ٣٢٠×٣٢٠ · حتى ٣ ميغابايت",
    icon: <CameraIcon size={18} color={colors.gold} />,
  },
  {
    title: "١٠٠٠ نقطة شهرياً في المتجر",
    body: "وخصم ٢٠٪ على كل شي · إطارات حصرية",
    icon: <StoreIcon size={18} color={colors.gold} />,
  },
];
