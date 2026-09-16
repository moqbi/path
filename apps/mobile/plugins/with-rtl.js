const { withAppDelegate, withMainApplication } = require("expo/config-plugins");

/**
 * اتجاه الواجهة يُضبط في `MainApplication` قبل أن تبدأ أوّل شاشة.
 *
 * `I18nManager` في جافاسكربت يكتب هذه القيم في تفضيلات النظام، لكنّ
 * React Native يقرؤها عند **بدء السطح** (`ReactSurfaceImpl`) وذلك قبل أن
 * يُنفَّذ سطرٌ واحدٌ من جافاسكربت. فأوّل تشغيلٍ بعد التثبيت يخرج بالقيم
 * الافتراضية، وما بعده وحده يخرج صحيحاً — وهذا ما يجعل التطبيق يبدو
 * مكسوراً لمن ثبّته للتوّ ثم يُصلح نفسه بلا سبب ظاهر.
 *
 * فتُكتب هنا، في `onCreate` للتطبيق كلّه:
 * - `forceRTL`: الواجهة عربية قراراً، لا بلغة الجهاز.
 * - `swapLeftAndRightInRTL(false)`: `left`/`right` و`textAlign` تبقى كما
 *   كُتبت. الشجرة كلها مكتوبةٌ على مقاس الويب — حيث `right` يمينٌ حقيقي
 *   فوق جذرٍ `rtl` — والقلب التلقائي قلبٌ ثانٍ يطيّر ما ثُبّت في طرف.
 *
 * وتبقى نداءات جافاسكربت في `app/_layout.tsx`: هي التي تضبط معاينة
 * الويب ونسخة Expo Go، وهذه لأوّل تشغيلٍ على الجهازين.
 *
 * والجهازان كلاهما: `MainApplication.onCreate` لأندرويد، و
 * `AppDelegate.application(_:didFinishLaunchingWithOptions:)` لآبل —
 * وكلاهما يجري قبل أن يبدأ سطح React. وكانت الإضافة تلمس أندرويد وحده،
 * فكل ما أُصلح هناك — زرّ النشر، وبابا العدسات، واتجاه النصوص — كان
 * سيعود على آبل من أوّل يوم.
 */
const IMPORT = "import com.facebook.react.modules.i18nmanager.I18nUtil";

const CALLS = [
  "    // اتجاه الواجهة قبل أوّل سطح — انظر plugins/with-rtl.js",
  "    I18nUtil.instance.allowRTL(this, true)",
  "    I18nUtil.instance.forceRTL(this, true)",
  "    I18nUtil.instance.swapLeftAndRightInRTL(this, false)",
].join("\n");

/** ثلاثة أسطرٍ بلغة Swift: `swapLeftAndRightInRTL:` تصير `swapLeftAndRight(inRTL:)`. */
const SWIFT = [
  "    // اتجاه الواجهة قبل أوّل سطح — انظر plugins/with-rtl.js",
  "    RCTI18nUtil.sharedInstance().allowRTL(true)",
  "    RCTI18nUtil.sharedInstance().forceRTL(true)",
  "    RCTI18nUtil.sharedInstance().swapLeftAndRight(inRTL: false)",
].join("\n");

function withRtlIos(config) {
  return withAppDelegate(config, (mod) => {
    let contents = mod.modResults.contents;

    if (mod.modResults.language !== "swift") {
      throw new Error(`with-rtl: AppDelegate بلغة ${mod.modResults.language} لا Swift`);
    }

    if (contents.includes("swapLeftAndRight")) return mod;

    /*
      المرساة سطرُ إنشاء المندوب، وهو أوّل سطرٍ في دالّة الإقلاع — فما
      يُدسّ قبله يجري قبل `startReactNative` يقيناً. والانكسار هنا يوقف
      `prebuild` بصوتٍ عالٍ، وهو أفضل من نسخةٍ تُبنى بلا اتجاه.
    */
    const anchor = "    let delegate = ReactNativeDelegate()";
    if (!contents.includes(anchor)) {
      throw new Error("with-rtl: لم يُعثر على مرساة الإقلاع في AppDelegate");
    }
    contents = contents.replace(anchor, `${SWIFT}\n\n${anchor}`);

    mod.modResults.contents = contents;
    return mod;
  });
}

function withRtlAndroid(config) {
  return withMainApplication(config, (mod) => {
    let contents = mod.modResults.contents;

    if (mod.modResults.language !== "kt") {
      throw new Error(`with-rtl: MainApplication بلغة ${mod.modResults.language} لا Kotlin`);
    }

    if (contents.includes("swapLeftAndRightInRTL")) return mod;

    if (!contents.includes(IMPORT)) {
      contents = contents.replace(
        /^(package .+\n)/m,
        (line) => `${line}\n${IMPORT}\n`,
      );
    }

    const onCreate = "super.onCreate()";
    if (!contents.includes(onCreate)) {
      throw new Error("with-rtl: لم يُعثر على super.onCreate() في MainApplication");
    }
    contents = contents.replace(onCreate, `${onCreate}\n${CALLS}`);

    mod.modResults.contents = contents;
    return mod;
  });
}

module.exports = function withRtl(config) {
  return withRtlIos(withRtlAndroid(config));
};
