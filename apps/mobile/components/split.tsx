import { useMemo, type ReactNode } from "react";
import { Platform, View } from "react-native";
import { useBarSpace } from "./glass-bar";
import { AthrMark } from "./brand";
import { Text } from "./type";
import { TabBackdrop } from "./tab-backdrop";
import { colors } from "../theme/tokens";
import { EdgeContext, listWidth, useContentWidth, useEdges, PaneRoute, paneKind, usePaneHost, useWide, WidthContext } from "../lib/pane";
export { useGrid, usePaneWidth } from "../lib/pane";
import MomentPage from "../app/m/[id]";
import Conversation from "../app/dm/[id]";
import ProfileScreen from "../app/u/[id]";

/**
 * القائمةُ واللوحةُ جنباً إلى جنب على الشاشة العريضة (القاعدة ٤٦٤): القائمةُ في طرف
 * البداية — يميناً — وهي الأعرض (القاعدة ٤٦٨)، واللوحةُ تملأ ما بقي حتى الحافّة. وعلى
 * الشاشة الضيّقة القائمةُ وحدها كما كانت.
 *
 * **والشجرةُ واحدةٌ في الحالين** (القاعدة ٤٦٨): كان الضيّقُ يردّ الأبناءَ عراةً والعريضُ
 * يلفّهم في عمود، فيُعاد بناءُ القائمة كلّها مع كلّ دوران — وتُرى مشوّهةً ثوانيَ حتى
 * تُجلب. الآن العمودُ نفسُه يتّسع ويضيق، واللوحةُ أختٌ تُضاف وتُنزع بعده.
 * **وكلُّ لوحةٍ تبتعد عن حافّتها الخارجيّة وحدها** (`EdgeContext`): القائمةُ عن اليمنى
 * واللوحةُ عن اليسرى — حسّاسُ الكاميرا في الآيفون المُدار.
 */
export function Split({
  host,
  empty,
  emptyView,
  children,
}: {
  host: string;
  empty: string;
  /** ما يملأ اللوحةَ قبل أن يُختار شيء — المعرضُ والكتاب في «أنا» (القاعدة ٤٦٨). */
  emptyView?: ReactNode;
  children: ReactNode;
}) {
  const wide = useWide();
  const screen = useContentWidth();
  const edges = useEdges();
  const path = usePaneHost(host, wide);
  /*
    الشريطُ الزجاجيّ في أندرويد يطفو فوق المحتوى بعرض الشاشة (القاعدة ٢٢٨)، فما في اللوحة
    يُترك له مكانُه — وإلّا جلس حقلُ الكتابة في المحادثة تحته. وشريطُ آبل على الآيباد في
    الأعلى ويقيس هامشَه بنفسه، فلا شيء هناك.
  */
  const barSpace = useBarSpace();
  const list = listWidth(screen);
  const listEdges = useMemo(() => ({ left: 0, right: edges.right }), [edges.right]);
  const paneEdges = useMemo(() => ({ left: edges.left, right: 0 }), [edges.left]);
  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: colors.ground }}>
      <WidthContext.Provider value={wide ? list : null}>
        <EdgeContext.Provider value={wide ? listEdges : edges}>
          <View
            style={
              wide
                ? { width: list + edges.right, borderEndWidth: 1, borderEndColor: colors.line }
                : { flex: 1 }
            }
          >
            {children}
          </View>
        </EdgeContext.Provider>
      </WidthContext.Provider>
      {wide ? (
        <WidthContext.Provider value={screen - list}>
          <EdgeContext.Provider value={paneEdges}>
            <View style={{ flex: 1, minWidth: 0, paddingBottom: Platform.OS === "ios" ? 0 : barSpace - 8 }}>
              {/* صورةُ الثيم تحت اللوحة كما هي تحت القائمة (القاعدة ٢٦١). */}
              <TabBackdrop />
              {path ? (
                <PaneRoute key={path} path={path} host={host}>
                  <PaneScreen path={path} />
                </PaneRoute>
              ) : (
                emptyView ?? <Empty text={empty} />
              )}
            </View>
          </EdgeContext.Provider>
        </WidthContext.Provider>
      ) : null}
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

