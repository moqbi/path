import { useMemo } from "react";
import { View, Pressable, Share } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
// النواةُ وحدها: الحزمةُ كاملةً تجرّ رسمَ canvas للمتصفّح ولا حاجة له هنا.
import { create } from "qrcode/lib/core/qrcode";
import { SITE_URL, hasSite } from "@athar/shared";
import { Text } from "./type";
import { Sheet } from "./sheet";
import { AthrMark } from "./brand";
import { colors } from "../theme/tokens";
import { ar } from "../lib/format";

/**
 * رمزُ QR مرسومٌ بمسارٍ واحد: مربّعٌ لكلّ وحدةٍ داكنة. وفي وسطه العلامة —
 * تصحيحُ الخطأ «H» يحتمل ضياعَ ثلاثين في المئة، والعلامةُ أقلُّ من عُشره.
 */
export function Qr({ value, size }: { value: string; size: number }) {
  const { d, count } = useMemo(() => {
    const { modules } = create(value, { errorCorrectionLevel: "H" });
    const n = modules.size;
    let path = "";
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (modules.get(x, y)) path += `M${x} ${y}h1v1h-1z`;
      }
    }
    return { d: path, count: n };
  }, [value]);

  const quiet = 2;
  const box = count + quiet * 2;
  const logo = size * 0.22;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`${-quiet} ${-quiet} ${box} ${box}`}>
        <Rect x={-quiet} y={-quiet} width={box} height={box} fill="#fff" />
        <Path d={d} fill={colors.night}/>
      </Svg>
      <View
        style={{
          position: "absolute",
          left: (size - logo) / 2 - 6,
          top: (size - logo) / 2 - 6,
          width: logo + 12,
          height: logo + 12,
          borderRadius: 14,
          backgroundColor: "#fff",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <AthrMark size={logo} />
      </View>
    </View>
  );
}

/**
 * مشاركةُ الملف: رابطٌ أو رمز QR (القاعدة ٨٧). الرمزُ لمن يقف أمامك — يمسحه
 * بكاميرته فيصل إلى ملفّك بلا أن تُملي عليه رقماً — والرابطُ لمن تراسله.
 * وكلاهما برقم العضوية. وبلا نطاقٍ مضبوط (القاعدة ١٠٥) لا رمزَ: رمزٌ لا يفتح
 * شيئاً أسوأ من غيابه، فتُشارَك العضويةُ نصّاً وحدها.
 */
export function ShareProfileSheet({
  name,
  memberNo,
  onClose,
  footer,
}: {
  name: string;
  memberNo: number;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  const url = hasSite() ? `${SITE_URL}/u/${memberNo}` : null;
  const message = url
    ? `ملف ${name} في آثار · عضوية رقم ${ar(memberNo)}\n${url}`
    : `ملف ${name} في آثار · عضوية رقم ${ar(memberNo)}`;

  return (
    <Sheet title="شارك ملفك" onClose={onClose}>
      {url ? (
        <View
          style={{
            alignSelf: "center",
            alignItems: "center",
            backgroundColor: "#fff",
            borderRadius: 24,
            padding: 18,
            marginTop: 4,
            borderWidth: 1,
            borderColor: colors.line,
          }}
        >
          <Qr value={url} size={208} />
          <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "800", marginTop: 10 }}>{name}</Text>
          <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 2 }}>
            عضوية رقم {ar(memberNo)} · امسح الرمز بالكاميرا
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={() => void Share.share({ message })}
        accessibilityRole="button"
        style={{
          marginTop: 16,
          height: 50,
          borderRadius: 25,
          backgroundColor: colors.clay,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: colors.onBrand, fontSize: 15, fontWeight: "800" }}>
          {url ? "شارك الرابط" : "شارك رقم عضويتك"}
        </Text>
      </Pressable>

      {footer}
    </Sheet>
  );
}
