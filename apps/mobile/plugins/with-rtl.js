const { withMainApplication } = require("expo/config-plugins");

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
 * الويب ونسخة Expo Go، وهذه لأوّل تشغيلٍ على أندرويد.
 */
const IMPORT = "import com.facebook.react.modules.i18nmanager.I18nUtil";

const CALLS = [
  "    // اتجاه الواجهة قبل أوّل سطح — انظر plugins/with-rtl.js",
  "    I18nUtil.instance.allowRTL(this, true)",
  "    I18nUtil.instance.forceRTL(this, true)",
  "    I18nUtil.instance.swapLeftAndRightInRTL(this, false)",
].join("\n");

module.exports = function withRtl(config) {
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
};
