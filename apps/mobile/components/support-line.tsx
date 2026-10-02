import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SITE_URL, hasSite } from "@athar/shared";
import { Text } from "./type";
import { api } from "../lib/api";
import { colors } from "../theme/tokens";

type Account = { id: string; memberNo: number; name: string } | null;

/**
 * خاتمةُ نماذج التواصل (القاعدة ٢٢١): سطرٌ يحيل إلى حساب الدعم والأخبار.
 * الرابطُ يُكتب كما يُشارَك (`/u/<رقم العضوية>`) ليُعرف ويُنسخ، والضغطةُ
 * تفتح ملفَّه **داخل التطبيق** لا في المتصفّح — ومنه يُضاف ويُراسَل.
 * والحسابُ من لوحة الموقع لا من الكود، وبلا حسابٍ لا سطر.
 */
export function SupportLine() {
  const router = useRouter();
  const support = useQuery({
    queryKey: ["site", "support"],
    queryFn: () => api<{ account: Account }>("/v1/site/support"),
    staleTime: 10 * 60_000,
  });
  const account = support.data?.account;
  if (!account) return null;

  const link = hasSite() ? `${SITE_URL.replace(/\/+$/, "")}/u/${account.memberNo}` : account.name;

  return (
    <Text style={{ color: colors.muted, fontSize: 12.5, lineHeight: 22, marginTop: 14, textAlign: "right" }}>
      لمتابعة آخر الأخبار والتواصل مع الدعم داخل التطبيق{" "}
      <Text
        accessibilityRole="link"
        onPress={() => router.push(`/u/${account.id}` as never)}
        style={{ color: colors.clayInk, fontWeight: "700", writingDirection: "ltr" }}
      >
        {link}
      </Text>
    </Text>
  );
}

