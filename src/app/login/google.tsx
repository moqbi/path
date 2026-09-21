"use client";

import { useEffect, useRef } from "react";
import { signInWithProvider } from "@/app/actions";

/**
 * الدخول بقوقل على الويب.
 *
 * تُحمَّل مكتبةُ قوقل عند الحاجة لا مع كل صفحة: ملفٌّ خارجيّ في شاشة
 * الدخول يُحمَّل لمن يدخل بالبريد أيضاً بلا سبب.
 *
 * و`prompt()` تفتح نافذةَ قوقل، وردُّها **رمزُ هويّةٍ موقَّع** يذهب إلى
 * الخادم فيتحقّق منه — لا معرّفٌ يُصدَّق كما جاء.
 */
type Credential = { credential?: string };

type Gsi = {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (answer: Credential) => void;
        ux_mode?: string;
      }) => void;
      prompt: () => void;
    };
  };
};

const SRC = "https://accounts.google.com/gsi/client";

export function useGoogleLogin(onError: (message: string) => void) {
  const ready = useRef(false);

  useEffect(() => {
    // لا يُحمَّل إلا مرّة، ولا يُحمَّل أصلاً بلا معرّف عميل.
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
    if (!clientId || ready.current) return;
    if (document.querySelector(`script[src="${SRC}"]`)) return;

    const script = document.createElement("script");
    script.src = SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const google = (window as unknown as { google?: Gsi }).google;
      if (!google) return;
      google.accounts.id.initialize({
        client_id: clientId,
        callback: async (answer) => {
          if (!answer.credential) return onError("ما وصل رمزٌ من قوقل");
          const result = await signInWithProvider("GOOGLE", answer.credential);
          if (result?.error) onError(result.error);
        },
      });
      ready.current = true;
    };
    document.head.appendChild(script);
  }, [onError]);

  return () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
    if (!clientId) {
      onError("الدخول بقوقل غير مفعّل في هذه النسخة.");
      return;
    }
    const google = (window as unknown as { google?: Gsi }).google;
    if (!google || !ready.current) {
      onError("لحظة — نحمّل قوقل…");
      return;
    }
    google.accounts.id.prompt();
  };
}
