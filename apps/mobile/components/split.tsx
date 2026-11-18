import type { ReactNode } from "react";
import { Platform, View } from "react-native";
import { useBarSpace } from "./glass-bar";
import { AthrMark } from "./brand";
import { Text } from "./type";
import { TabBackdrop } from "./tab-backdrop";
import { colors } from "../theme/tokens";
import { listWidth, useContentWidth, PaneRoute, paneKind, usePaneHost, useWide, WidthContext } from "../lib/pane";
export { useGrid, usePaneWidth } from "../lib/pane";
import MomentPage from "../app/m/[id]";
import Conversation from "../app/dm/[id]";
import ProfileScreen from "../app/u/[id]";

/**
 * القائمةُ واللوحةُ جنباً إلى جنب على الشاشة العريضة (القاعدة ٤٦٤): القائمةُ في طرف
 * البداية — يميناً — بعرضٍ ثابت، واللوحةُ تملأ ما بقي حتى الحافّة. لا توسيطَ ولا
 * أرضيّةَ حولهما. وعلى الشاشة الضيّقة القائمةُ وحدها كما كانت.
 */
export function Split({ host, empty, children }: { host: string; empty: string; children: ReactNode }) {
  const wide = useWide();
  const screen = useContentWidth();
  const path = usePaneHost(host, wide);
  /*
    الشريطُ الزجاجيّ في أندرويد يطفو فوق المحتوى بعرض الشاشة (القاعدة ٢٢٨)، فما في اللوحة
    يُترك له مكانُه — وإلّا جلس حقلُ الكتابة في المحادثة تحته. وشريطُ آبل على الآيباد في
    الأعلى ويقيس هامشَه بنفسه، فلا شيء هناك.
  */
  const barSpace = useBarSpace();
  if (!wide) return <>{children}</>;
  const list = listWidth(screen);
  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: colors.ground }}>
      <WidthContext.Provider value={list}>
        <View style={{ width: list, borderEndWidth: 1, borderEndColor: colors.line }}>{children}</View>
      </WidthContext.Provider>
      <WidthContext.Provider value={screen - list}>
        <View style={{ flex: 1, minWidth: 0, paddingBottom: Platform.OS === "ios" ? 0 : barSpace - 8 }}>
          {/* صورةُ الثيم تحت اللوحة كما هي تحت القائمة (القاعدة ٢٦١). */}
          <TabBackdrop />
          {path ? (
            <PaneRoute key={path} path={path} host={host}>
              <PaneScreen path={path} />
            </PaneRoute>
          ) : (
            <Empty text={empty} />
          )}
        </View>
      </WidthContext.Provider>
    </View>
  );
}

function PaneScreen({ path }: { path: string }) {
  const kind = paneKind(path);
  if (kind === "m") return <MomentPage />;
  if (kind === "dm") return <Conversation />;
  if (kind === "u") return <ProfileScreen />;
  return null;
}

/** اللوحةُ قبل أن يُختار شيء: العلامةُ وسطرٌ يقول ما يُفتح هنا. */
function Empty({ text }: { text: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 32 }}>
      <View style={{ opacity: 0.35 }}>
        <AthrMark size={72} />
      </View>
      <Text style={{ color: colors.groundInk, fontSize: 15, textAlign: "center" }}>{text}</Text>
    </View>
  );
}

