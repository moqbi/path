const { withInfoPlist } = require("expo/config-plugins");

/**
 * الآيفون رأسيٌّ وأفقيّ، والآيباد بالاتجاهات الأربعة (القاعدتان ٤٦٤ و٤٦٨).
 *
 * `orientation` في `app.json` صار `default` فلا يقصر الجهازين على اتجاه، والمفتاحان
 * يُكتبان هنا صراحةً بعد ما كتبه Expo: الآيفونُ قائماً وأفقيّاً في الاتّجاهين بلا المقلوب
 * (آبل لا تقلب الآيفون ذا الجزيرة)، والآيبادُ بالأربعة — شرطُ Split View وStage Manager.
 * وما لا يتّسع لشاشةٍ أفقيّة — الكاميرا ومحرّرُ القصّة — يطلب أن يُدار الجوّال (`RotateHint`).
 */
module.exports = function withOrientations(config) {
  return withInfoPlist(config, (mod) => {
    mod.modResults.UISupportedInterfaceOrientations = [
      "UIInterfaceOrientationPortrait",
      "UIInterfaceOrientationLandscapeLeft",
      "UIInterfaceOrientationLandscapeRight",
    ];
    mod.modResults["UISupportedInterfaceOrientations~ipad"] = [
      "UIInterfaceOrientationPortrait",
      "UIInterfaceOrientationPortraitUpsideDown",
      "UIInterfaceOrientationLandscapeLeft",
      "UIInterfaceOrientationLandscapeRight",
    ];
    mod.modResults.UIRequiresFullScreen = false;
    return mod;
  });
};
