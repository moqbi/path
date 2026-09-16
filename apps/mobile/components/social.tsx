import { View, Pressable, Linking } from "react-native";
import Svg, { Path, Rect, Circle } from "react-native-svg";
import { useQuery } from "@tanstack/react-query";
import { Text } from "./type";
import { api } from "../lib/api";
import { colors } from "../theme/tokens";

/**
 * «تابعنا» — نفس روابط ذيل الموقع، من نفس الصفوف.
 *
 * الرسوم هنا لا في القاعدة: صفُّ الرابط يحمل اسم المنصّة والعنوان وهما
 * ما يتغيّر، والرسم ثابتٌ لكلّ منصّة. وSVG محفوظٌ في حقلِ نصٍّ يعني
 * حقلاً يُلصق فيه أيّ شيء ويُرسم في شاشة الناس.
 *
 * ونسخةٌ ثانية من رسوم `apps/web/src/components/social.tsx` بالضرورة:
 * الويب `<svg>` والجوّال `react-native-svg` — نفس المسارات بصيغتين.
 */
type Link = { id: string; platform: string; url: string };

function Glyph({ platform, color }: { platform: string; color: string }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24" } as const;

  if (platform === "x") {
    return (
      <Svg {...common}>
        <Path fill={color} d="M17.5 3h3l-6.6 7.5L21.8 21h-6l-4.7-6.1L5.6 21H2.5l7-8L2.3 3h6.2l4.2 5.6ZM16.4 19.2h1.7L7.7 4.7H5.9Z" />
      </Svg>
    );
  }
  if (platform === "instagram") {
    return (
      <Svg {...common}>
        <Rect x="3" y="3" width="18" height="18" rx="5.2" fill="none" stroke={color} strokeWidth={1.8} />
        <Circle cx="12" cy="12" r="4" fill="none" stroke={color} strokeWidth={1.8} />
        <Circle cx="17.2" cy="6.8" r="1.2" fill={color} />
      </Svg>
    );
  }
  if (platform === "snapchat") {
    return (
      <Svg {...common}>
        <Path fill={color} d="M12 2.6c2.7 0 4.5 2 4.5 4.6 0 .7-.1 1.5-.1 2 .3.2.8.3 1.3.1.6-.2 1 .5.6.9-.4.4-1.3.7-1.8.9-.3.1-.4.3-.3.6.5 1.5 2 2.8 3.3 3.1.5.1.5.7 0 .9-.7.3-1.7.4-2 .6-.2.1-.1.5-.3.8-.1.2-.4.3-.8.2-.5-.1-1.1-.2-1.8 0-.6.1-1.1.6-1.8 1-.5.3-1.1.5-1.8.5s-1.3-.2-1.8-.5c-.7-.4-1.2-.9-1.8-1-.7-.2-1.3-.1-1.8 0-.4.1-.7 0-.8-.2-.2-.3-.1-.7-.3-.8-.3-.2-1.3-.3-2-.6-.5-.2-.5-.8 0-.9 1.3-.3 2.8-1.6 3.3-3.1.1-.3 0-.5-.3-.6-.5-.2-1.4-.5-1.8-.9-.4-.4 0-1.1.6-.9.5.2 1 .1 1.3-.1 0-.5-.1-1.3-.1-2 0-2.6 1.8-4.6 4.5-4.6Z" />
      </Svg>
    );
  }
  if (platform === "tiktok") {
    return (
      <Svg {...common}>
        <Path fill={color} d="M16.5 3c.3 2.2 1.6 3.6 3.8 3.8v2.7c-1.3.1-2.5-.3-3.8-1v5.9c0 4.5-4.9 6.9-8.3 4.5-2.9-2-2.9-6.4.2-8.2 1-.6 2.2-.8 3.4-.6v2.8c-1.6-.4-2.9.5-2.9 2 0 1.6 1.7 2.5 3 1.8.8-.4 1.1-1.2 1.1-2.2V3Z" />
      </Svg>
    );
  }
  if (platform === "youtube") {
    return (
      <Svg {...common}>
        <Rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="none" stroke={color} strokeWidth={1.8} />
        <Path fill={color} d="M10.4 9.4 15 12l-4.6 2.6Z" />
      </Svg>
    );
  }
  if (platform === "whatsapp") {
    return (
      <Svg {...common}>
        <Path fill={color} d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3Zm4.8 12.4c-.2.6-1.2 1.1-1.7 1.1-.4 0-1 .1-3-.8-2.5-1.1-4-3.7-4.2-3.9-.1-.2-.9-1.3-.9-2.4 0-1.2.6-1.7.8-2 .2-.2.5-.3.6-.3h.5c.2 0 .4 0 .6.4l.8 1.9c0 .2 0 .3-.1.5l-.3.4c-.1.1-.3.3-.1.5.1.3.6 1.1 1.4 1.7 1 .9 1.8 1.1 2 1.2.2.1.4.1.5-.1l.7-.8c.2-.2.3-.2.5-.1l1.8.9c.2.1.4.2.4.3s0 .6-.3 1.1Z" />
      </Svg>
    );
  }
  if (platform === "telegram") {
    return (
      <Svg {...common}>
        <Path fill={color} d="M21.5 4.3 2.9 11.4c-.9.4-.9.9-.2 1.1l4.8 1.5 1.8 5.5c.2.6.4.8.8.8.4 0 .6-.2 1-.5l2.3-2.2 4.7 3.5c.9.5 1.5.2 1.7-.8l3.1-14.5c.3-1.2-.4-1.8-1.4-1.5Zm-3.9 3.4-8.4 7.6-.3 3.6-1.6-5 10-6.6c.4-.3.7-.1.3.4Z" />
      </Svg>
    );
  }
  if (platform === "linkedin") {
    return (
      <Svg {...common}>
        <Rect x="3" y="3" width="18" height="18" rx="3.4" fill="none" stroke={color} strokeWidth={1.8} />
        <Path d="M7.4 10v7M7.4 6.9v.1M11 17v-3.6c0-1.9 2.6-2.1 2.6 0V17M11 10v2" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    );
  }

  // ما لا نعرف منصّته: حلقةُ رابطٍ عامّة — فلا يُمنع المشرف من إضافته.
  return (
    <Svg {...common}>
      <Path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.3-2.3a4 4 0 0 0-5.7-5.7l-1.3 1.3" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M13.5 10.5a4 4 0 0 0-5.7 0l-2.3 2.3a4 4 0 0 0 5.7 5.7l1.3-1.3" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

/**
 * بلا روابطَ لا يُرسم شيء: عنوانٌ فوق فراغٍ أسوأ من لا عنوان، والمشرف
 * قد لا يكون أضاف حساباته بعد. والفشلُ يُبتلع كذلك — شاشةُ الخصوصية
 * تعمل وإن لم يُجب الخادم عن زينة.
 */
export function FollowRow({ title = "تابعنا" }: { title?: string }) {
  const { data } = useQuery({
    queryKey: ["site", "social"],
    queryFn: () => api<{ links: Link[] }>("/v1/site/social"),
    staleTime: 10 * 60_000,
    retry: 0,
  });

  const links = data?.links ?? [];
  if (links.length === 0) return null;

  return (
    <View style={{ alignItems: "center", paddingTop: 22, paddingBottom: 8 }}>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700", marginBottom: 10 }}>
        {title}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10 }}>
        {links.map((link) => (
          <Pressable
            key={link.id}
            accessibilityRole="link"
            accessibilityLabel={link.platform}
            onPress={() => void Linking.openURL(link.url)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: colors.line,
              backgroundColor: colors.card,
            }}
          >
            <Glyph platform={link.platform} color={colors.ink2} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
