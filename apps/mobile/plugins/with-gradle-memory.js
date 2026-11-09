const { withGradleProperties } = require("expo/config-plugins");

/**
 * ذاكرةُ Gradle على عامل EAS (القاعدة ٤٤١).
 *
 * أوّلُ بناءٍ لأندرويد مات فيه خادمُ Gradle بلا خطأٍ يُقرأ («daemon disappeared»)
 * وسط تجميع الوحدات: Gradle وخادمُ Kotlin وعمّالٌ متوازون معاً تجاوزوا ذاكرة
 * العامل فقتلهم النظام. فيُحدّ Gradle بأربعة، ويُجمَّع Kotlin داخله لا في خادمٍ
 * ثانٍ، ويُقلَّل التوازي — أبطأُ قليلاً ولا يُقتل.
 */
const PROPS = {
  "org.gradle.jvmargs": "-Xmx4g -XX:MaxMetaspaceSize=1g -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8",
  "org.gradle.workers.max": "2",
  "org.gradle.parallel": "false",
  "kotlin.compiler.execution.strategy": "in-process",
};

module.exports = function withGradleMemory(config) {
  return withGradleProperties(config, (cfg) => {
    for (const [key, value] of Object.entries(PROPS)) {
      const at = cfg.modResults.findIndex((p) => p.type === "property" && p.key === key);
      const item = { type: "property", key, value };
      if (at >= 0) cfg.modResults[at] = item;
      else cfg.modResults.push(item);
    }
    return cfg;
  });
};
