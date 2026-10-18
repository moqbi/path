import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

/**
 * مجموعاتُ الملصقات كما يردّها `/v1/stickers` (القاعدة ٢٩١). `priceCoins` صفرٌ لما مع
 * آثار+، وما فوقه يُشترى ويُملَك (القاعدة ٢٩٤) — وخادمٌ قديم بلا الحقلين يُقرأ «مع آثار+».
 */
export type StickerPack = {
  id: string;
  name: string;
  priceCoins?: number;
  owned?: boolean;
  stickers: { id: string; mediaId: string }[];
};

export const useStickers = (enabled: boolean) =>
  useQuery({
    queryKey: ["stickers"],
    queryFn: () => api<{ packs: StickerPack[] }>("/v1/stickers"),
    enabled,
    // المجموعاتُ تتغيّر من اللوحة نادراً — لا تُسأل مع كلّ فتح.
    staleTime: 10 * 60_000,
  });
