import { prisma } from "@/lib/db";
import { createStickerPack, deleteSticker, deleteStickerPack, moveSticker, updateStickerPack } from "@/app/actions";
import { mediaUrl } from "@/lib/media";
import { ar } from "@/lib/format";
import { Saver } from "./saver";
import { StickerUpload } from "./sticker-upload";

const FIELD =
  "rounded-xl border border-line bg-card px-4 text-[13.5px] text-ink outline-none focus:border-clay";

/**
 * قسمُ الملصقات في اللوحة (القاعدة ٢٩١): مجموعاتٌ تُضاف وتُسمّى وتُرتَّب وتُخفى،
 * وفي كلٍّ ملصقاتُها تُرفع دفعةً وتُقدَّم وتُؤخَّر وتُحذف. ويُرسلها مشتركو آثار+
 * وحدهم في التعليقات والمحادثات، ويراها الجميع.
 */
export async function StickersSection() {
  const packs = await prisma.stickerPack.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { stickers: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, mediaId: true } } },
  });

  return (
    <>
      <h2 className="mb-1 text-[15px] font-bold">الملصقات</h2>
      <p className="mb-3 text-[11.5px] leading-relaxed text-muted">
        مجموعاتٌ تظهر في لوحة الملصقات بجانب زرّ الإرسال في التعليقات والمحادثات، ثمانيةٌ
        في الصفحة واسمُ المجموعة فوقها. يرسلها مشتركو آثار+ وحدهم ويراها الجميع. والمجموعةُ
        المخفيّة أو الفارغة لا تظهر.
      </p>

      <details className="mb-5 rounded-2xl border border-line bg-card p-4">
        <summary className="cursor-pointer text-[13.5px] font-bold">مجموعة جديدة</summary>
        <Saver action={createStickerPack} className="mt-3 flex gap-2.5">
          <input name="name" required maxLength={40} placeholder="اسم المجموعة" className={`grow ${FIELD}`} style={{ height: 46 }} />
          <button
            type="submit"
            className="h-[46px] rounded-xl px-4 text-[13px] font-bold"
            style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
          >
            أضف
          </button>
        </Saver>
      </details>

      {packs.length === 0 ? (
        <p className="rounded-2xl border border-line bg-card p-5 text-center text-[12.5px] text-muted">لا مجموعات بعد.</p>
      ) : null}

      <div className="mb-7 flex flex-col gap-4">
        {packs.map((pack) => (
          <section key={pack.id} className="rounded-2xl border border-line bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-[14px] font-bold">
                {pack.name}{" "}
                <span className="text-[11.5px] font-normal text-muted">
                  {ar(pack.stickers.length)} ملصق{pack.hidden ? " · مخفية" : ""}
                </span>
              </h3>
              <form action={deleteStickerPack.bind(null, pack.id)}>
                <button type="submit" className="text-[12px] font-semibold" style={{ color: "var(--color-live)" }}>
                  احذف المجموعة
                </button>
              </form>
            </div>

            <details className="mb-3">
              <summary className="cursor-pointer text-[12.5px] font-semibold text-ink-2">تعديل المجموعة</summary>
              <Saver action={updateStickerPack.bind(null, pack.id)} className="mt-2 flex flex-col gap-2">
                <label className="text-[11.5px] text-muted">
                  الاسم
                  <input name="name" defaultValue={pack.name} maxLength={40} className={`mt-1 block w-full ${FIELD}`} style={{ height: 42 }} />
                </label>
                <label className="text-[11.5px] text-muted">
                  الترتيب (الأصغر أوّلاً)
                  <input name="sortOrder" type="number" defaultValue={pack.sortOrder} className={`mt-1 block w-full ${FIELD}`} style={{ height: 42 }} />
                </label>
                <label className="flex items-center gap-2 text-[12.5px]">
                  <input type="checkbox" name="hidden" defaultChecked={pack.hidden} /> مخفيّة
                </label>
                <button type="submit" className="h-10 rounded-xl border border-line text-[12.5px] font-semibold">
                  احفظ
                </button>
              </Saver>
            </details>

            <div className="mb-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {pack.stickers.map((sticker, index) => (
                <div key={sticker.id} className="flex flex-col items-center gap-1 rounded-xl border border-line p-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mediaUrl(sticker.mediaId) ?? ""} alt="" className="h-16 w-16 object-contain" />
                  <div className="flex items-center gap-1 text-[11px]">
                    <form action={moveSticker.bind(null, sticker.id, -1)}>
                      <button type="submit" disabled={index === 0} aria-label="قدّمه" className="px-1 disabled:opacity-30">
                        ›
                      </button>
                    </form>
                    <form action={deleteSticker.bind(null, sticker.id)}>
                      <button type="submit" className="px-1 font-semibold" style={{ color: "var(--color-live)" }}>
                        احذف
                      </button>
                    </form>
                    <form action={moveSticker.bind(null, sticker.id, 1)}>
                      <button
                        type="submit"
                        disabled={index === pack.stickers.length - 1}
                        aria-label="أخّره"
                        className="px-1 disabled:opacity-30"
                      >
                        ‹
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>

            <StickerUpload packId={pack.id} />
          </section>
        ))}
      </div>
    </>
  );
}
