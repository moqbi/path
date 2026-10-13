import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { keys, type Person } from "./queries";

/** بطاقةُ من يُضاف (القاعدة ٢٨٠): صورةٌ واسمٌ ورقمُ عضوية، وعلاقتُه بك. */
export type FoundPerson = Person & {
  memberNo: number;
  handle: string | null;
  isOpen: boolean;
  relation: "friend" | "sent" | "incoming" | "none";
};

/**
 * زرُّ «أضف» واحدٌ لكلّ بطاقة: البحثُ ومن حولك وأعضاءُ المجموعة. والطلبُ
 * المقابل يُقبل بالطلب نفسه في الخادم — من أضاف من أضافه صارا صديقين.
 */
export function useAddFriend() {
  const client = useQueryClient();
  const [done, setDone] = useState<Record<string, FoundPerson["relation"]>>({});
  const [error, setError] = useState<string | null>(null);
  const add = useMutation({
    mutationFn: (id: string) => api<{ status?: string }>(`/v1/circle/${id}/request`, { method: "POST" }),
    onSuccess: (row, id) => {
      setError(null);
      setDone((was) => ({ ...was, [id]: row?.status === "PENDING" ? "sent" : "friend" }));
      void client.invalidateQueries({ queryKey: keys.circle });
    },
    onError: (err: Error) => setError(err.message),
  });
  return { add, done, error };
}
