/**
 * امتدادُ خدمة التنبيهات على آبل (القاعدة ٣٨٨) — صورةُ اللحظة أو الرسالة في التنبيه حين يُضغط
 * مطوّلاً أو يُسحب. أندرويد يرسمها بنفسه؛ آبل تحتاج هدفاً في البناء ينزّلها قبل أن يظهر التنبيه.
 *
 * على نهج `expo-share-intent` (`withIosShareExtensionXcodeTarget`) الذي يُبنى به المشروعُ اليوم:
 * ملفّان يُنسخان إلى `ios/AtharNotificationService`، وهدفٌ `app_extension` يُضمَّن في التطبيق،
 * وسطرٌ في `extra.eas…appExtensions` فيُصدر EAS له شهادتَه. **وحدةٌ أصليّة**: لا تصل بتحديث OTA،
 * وتدخل البناءَ القادم (٠٫١٫٤). وبناءٌ بلاها يُظهر التنبيهَ نصّاً كما كان.
 */
const fs = require("fs");
const path = require("path");
const { withDangerousMod, withXcodeProject } = require("expo/config-plugins");

const NAME = "AtharNotificationService";
const FILES = ["NotificationService.swift", "Info.plist"];

function withEasExtension(config) {
  const bundleIdentifier = `${config.ios.bundleIdentifier}.notification-service`;
  config.extra = config.extra ?? {};
  config.extra.eas = config.extra.eas ?? {};
  config.extra.eas.build = config.extra.eas.build ?? {};
  config.extra.eas.build.experimental = config.extra.eas.build.experimental ?? {};
  config.extra.eas.build.experimental.ios = config.extra.eas.build.experimental.ios ?? {};
  const list = (config.extra.eas.build.experimental.ios.appExtensions =
    config.extra.eas.build.experimental.ios.appExtensions ?? []);
  if (!list.some((ext) => ext.targetName === NAME)) list.push({ targetName: NAME, bundleIdentifier, entitlements: {} });
  return config;
}

function withFiles(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const into = path.join(config.modRequest.platformProjectRoot, NAME);
      fs.mkdirSync(into, { recursive: true });
      for (const file of FILES) {
        fs.copyFileSync(path.join(__dirname, "notification-service", file), path.join(into, file));
      }
      return config;
    },
  ]);
}

function teamOf(project) {
  const configs = project.pbxXCBuildConfigurationSection();
  for (const key in configs) {
    const settings = configs[key].buildSettings;
    if (!settings || !settings.PRODUCT_NAME) continue;
    const name = String(settings.PRODUCT_NAME).replace(/"/g, "");
    if (name.includes("Extension") || name.includes("Service")) continue;
    if (settings.DEVELOPMENT_TEAM) return String(settings.DEVELOPMENT_TEAM).replace(/"/g, "");
  }
  return null;
}

function withTarget(config) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    if (project.pbxTargetByName(NAME)) return config;

    const bundleIdentifier = `${config.ios.bundleIdentifier}.notification-service`;
    const group = project.addPbxGroup(FILES, NAME, NAME);
    const groups = project.hash.project.objects.PBXGroup;
    for (const key of Object.keys(groups)) {
      if (typeof groups[key] === "object" && groups[key].name === undefined && groups[key].path === undefined) {
        project.addToPbxGroup(group.uuid, key);
      }
    }
    const objects = project.hash.project.objects;
    objects.PBXTargetDependency = objects.PBXTargetDependency || {};
    objects.PBXContainerItemProxy = objects.PBXContainerItemProxy || {};

    const target = project.addTarget(NAME, "app_extension", NAME);
    project.addBuildPhase(["NotificationService.swift"], "PBXSourcesBuildPhase", "Sources", target.uuid);
    project.addBuildPhase([], "PBXResourcesBuildPhase", "Resources", target.uuid);
    project.addBuildPhase([], "PBXFrameworksBuildPhase", "Frameworks", target.uuid);

    const team = teamOf(project);
    const configurations = project.pbxXCBuildConfigurationSection();
    for (const key in configurations) {
      const settings = configurations[key].buildSettings;
      if (!settings || settings.PRODUCT_NAME !== `"${NAME}"`) continue;
      Object.assign(settings, {
        CLANG_ENABLE_MODULES: "YES",
        INFOPLIST_FILE: `"${NAME}/Info.plist"`,
        CODE_SIGN_STYLE: "Automatic",
        CURRENT_PROJECT_VERSION: `"${config.ios.buildNumber || "1"}"`,
        MARKETING_VERSION: `"${config.version}"`,
        GENERATE_INFOPLIST_FILE: "YES",
        PRODUCT_BUNDLE_IDENTIFIER: `"${bundleIdentifier}"`,
        IPHONEOS_DEPLOYMENT_TARGET: "15.1",
        SWIFT_VERSION: "5.0",
        TARGETED_DEVICE_FAMILY: `"1"`,
        ...(team ? { DEVELOPMENT_TEAM: team } : null),
      });
    }
    if (team) project.addTargetAttribute("DevelopmentTeam", team, project.pbxTargetByName(NAME));
    return config;
  });
}

module.exports = function withNotificationService(config) {
  config = withEasExtension(config);
  config = withFiles(config);
  return withTarget(config);
};
