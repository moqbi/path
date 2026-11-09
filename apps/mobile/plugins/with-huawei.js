const fs = require("fs");
const path = require("path");
const { withProjectBuildGradle, withDangerousMod } = require("expo/config-plugins");

/**
 * خدماتُ هواوي في بناء هواوي وحده (القاعدة ٤٤٦).
 *
 * مستودعُ هواوي يُضاف إلى `allprojects`: حزمُ `com.huawei.hms` يحلّها مشروعُ التطبيق لا الوحدة،
 * فمستودعٌ في `build.gradle` الوحدة وحدها لا يكفي. وملفُّ `agconnect-services.json` يُنسخ إلى
 * أصول التطبيق ومجلّده — منه يقرأ HMS Core إعدادَ المشروع. وفي غير ملفّ `huawei` لا شيء.
 */
const HUAWEI = process.env.EAS_BUILD_PROFILE === "huawei" || process.env.ATHAR_HMS === "1";
const REPO = "maven { url 'https://developer.huawei.com/repo/' }";
/*
  الملفُّ فيه سرُّ المشروع، فلا يُحفظ في المستودع: يُرفع إلى EAS «ملفّاً سرّيّاً» باسم
  `AGCONNECT_SERVICES` (والمتغيّرُ في البناء مسارُه)، أو يُوضع محلّياً بجانب هذا الملفّ.
  وبلاه يمضي البناء: معرّفُ التطبيق في بيان الوحدة (`com.huawei.hms.client.appid`).
*/
const SOURCE =
  process.env.AGCONNECT_SERVICES || path.join(__dirname, "..", "modules", "huawei-hms", "agconnect-services.json");

module.exports = function withHuawei(config) {
  if (!HUAWEI) return config;

  config = withProjectBuildGradle(config, (cfg) => {
    let text = cfg.modResults.contents;
    if (!text.includes("developer.huawei.com/repo")) {
      text = text.replace(/allprojects\s*\{\s*repositories\s*\{/, (match) => `${match}\n    ${REPO}`);
      text = text.replace(/buildscript\s*\{\s*repositories\s*\{/, (match) => `${match}\n    ${REPO}`);
    }
    cfg.modResults.contents = text;
    return cfg;
  });

  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      if (!fs.existsSync(SOURCE)) {
        console.warn("[with-huawei] لا agconnect-services.json — يمضي البناءُ بمعرّف التطبيق في البيان");
        return cfg;
      }
      const app = path.join(cfg.modRequest.platformProjectRoot, "app");
      const assets = path.join(app, "src", "main", "assets");
      fs.mkdirSync(assets, { recursive: true });
      fs.copyFileSync(SOURCE, path.join(app, "agconnect-services.json"));
      fs.copyFileSync(SOURCE, path.join(assets, "agconnect-services.json"));
      return cfg;
    },
  ]);
};
