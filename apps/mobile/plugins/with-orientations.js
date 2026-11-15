const { withInfoPlist } = require("expo/config-plugins");

/**
 * الآيفون رأسيّ، والآيباد بالاتجاهات الأربعة (القاعدة ٤٦٤).
 *
 * `orientation` في `app.json` واحدٌ للجهازين، و`portrait` فيه يكتب الآيبادَ رأسيّاً
 * أيضاً — وآبل تشترط للآيباد الاتجاهاتِ الأربعة ليعمل في Split View وStage Manager،
 * ومن يضع آيباده أفقيّاً على لوحة مفاتيح يرى التطبيقَ مائلاً. فالمفتاحُ الخاصّ بالآيباد
 * (`~ipad`) يُكتب هنا بعد ما كتبه Expo، والآيفونُ يبقى على `portrait`.
 */
module.exports = function withOrientations(config) {
  return withInfoPlist(config, (mod) => {
    mod.modResults.UISupportedInterfaceOrientations = ["UIInterfaceOrientationPortrait"];
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
