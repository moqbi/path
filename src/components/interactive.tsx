"use client";

import { useEffect } from "react";
import { markSeen } from "@/app/actions";


/** يسجّل المشاهدة مرة واحدة عند فتح اللحظة — إيصال القراءة يعتمد عليه. */
export function SeenTracker({ momentId }: { momentId: string }) {
  useEffect(() => {
    void markSeen(momentId);
  }, [momentId]);
  return null;
}
