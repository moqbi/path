import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import * as QuickActions from "expo-quick-actions";

/**
 * اختصاراتُ الضغط المطوّل على أيقونة التطبيق (القاعدة ٣٧٠): لحظة جديدة، صورة
 * جديدة، أغنية، موقع — كلٌّ يفتح شاشةَ النشر بنوعه كقوس الزائد.
 *
 * على آبل ثابتةٌ في البناء (`iosActions` في `app.json`) فتظهر من أوّل تثبيت
 * قبل أن يُفتح التطبيق، وعلى أندرويد تُكتب هنا. والوحدةُ اختياريّة في الحزمة
 * نفسها: بناءٌ بلاها لا يرى شيئاً ولا يسقط (القاعدة ١٢٤).
 *
 * والضغطةُ تُحفظ حتى يكون صاحبُها داخلاً كالمشاركة (`lib/share-in.ts`): من
 * فتح التطبيقَ المغلق باختصارٍ يصل قبل أن تُقرأ جلستُه، ومن كان خارجاً يدخل
 * أوّلاً ثمّ تُفتح له.
 */
const ANDROID_ITEMS: QuickActions.Action[] = [
  { id: "thought", title: "لحظة جديدة", params: { href: "/compose?kind=THOUGHT" } },
  { id: "photo", title: "صورة جديدة", params: { href: "/compose?kind=PHOTO" } },
  { id: "music", title: "أغنية", params: { href: "/compose?kind=MUSIC" } },
  { id: "place", title: "موقع", params: { href: "/compose?kind=PLACE" } },
];

function hrefOf(action: QuickActions.Action | null | undefined): string | null {
  const href = action?.params?.href;
  // ما يُفتح شاشةُ النشر وحدها: اختصارٌ لا يصير باباً إلى أيّ مسار.
  return typeof href === "string" && href.startsWith("/compose?kind=") ? href : null;
}

export function useQuickActions(signedIn: boolean): void {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(() => hrefOf(QuickActions.initial));

  useEffect(() => {
    if (Platform.OS === "android") void QuickActions.setItems(ANDROID_ITEMS).catch(() => {});
    const sub = QuickActions.addListener((action) => {
      const href = hrefOf(action);
      if (href) setPending(href);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!pending || !signedIn) return;
    setPending(null);
    router.push(pending as never);
  }, [pending, signedIn, router]);
}
