import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { INTERESTS, interestIndex, type InterestGroup } from "@athar/shared";
import { api } from "./api";

/**
 * قائمةُ الاهتمامات كما ضُبطت في اللوحة (القاعدة ٣٧٥). المكتوبةُ في `@athar/shared`
 * تُرسم ريثما تصل — ومعها يبقى الخادمُ القديم الذي لا يعرف البابَ على حاله.
 */
export function useInterestCatalog() {
  const { data } = useQuery({
    queryKey: ["interest-catalog"],
    queryFn: () => api<{ groups: InterestGroup[] }>("/v1/site/interests"),
    staleTime: 10 * 60_000,
  });
  const groups = data?.groups?.length ? data.groups : INTERESTS;
  const index = useMemo(() => interestIndex(groups), [groups]);
  return { groups, index };
}
