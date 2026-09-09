import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ScreenHeader, TabBar } from "@/components/ui";
import { InfoIcon, SparkIcon } from "@/components/icons";
import { StoreGrid } from "./grid";
import { riyals } from "@/lib/format";

export default async function StorePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const [items, purchases] = await Promise.all([
    prisma.storeItem.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.purchase.findMany({ where: { userId: user.id }, select: { itemId: true } }),
  ]);

  const owned = new Set(purchases.map((p) => p.itemId));
  const daysHere = Math.floor((Date.now() - user.createdAt.getTime()) / 86_400_000);

  return (
    <div className="screen">
      <ScreenHeader
        title="المتجر"
        display
        action={
          <span
            className="flex items-center gap-2 rounded-full border px-3.5 py-2"
            style={{ background: "var(--color-gold-soft)", borderColor: "var(--color-gold-line)" }}
          >
            <SparkIcon size={14} className="text-gold" />
            <span className="text-[12.5px] font-semibold text-gold">
              رصيدك {riyals(user.storeCredit)}
            </span>
          </span>
        }
      />

      <main className="scroll-area px-5 pt-4">
        <StoreGrid
          items={items.map((item) => ({
            id: item.id,
            kind: item.kind,
            name: item.name,
            priceHalalas: item.priceHalalas,
            spec: item.spec,
            plusOnly: item.plusOnly,
            earnedAfterDays: item.earnedAfterDays,
          }))}
          owned={[...owned]}
          isPlus={user.isPlus}
          credit={user.storeCredit}
          daysHere={daysHere}
          equippedFrame={null}
        />

        {!user.isPlus ? (
          <div
            className="mb-5 flex items-center gap-3 rounded-2xl border p-4"
            style={{ background: "var(--color-gold-soft)", borderColor: "var(--color-gold-line)" }}
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "#f0e4c8", color: "var(--color-gold)" }}
            >
              <SparkIcon size={19} />
            </span>
            <p className="grow text-[12px] leading-relaxed text-ink-2">
              مشتركو <span className="font-semibold text-gold">أثر+</span> يحصلون على ٣٠ ر.س
              شهرياً وخصم ٢٠٪
            </p>
          </div>
        ) : null}

        <p className="flex items-center justify-center gap-2 pb-6 text-center text-[11px] leading-relaxed text-faint">
          <InfoIcon size={13} />
          لا صناديق عشوائية · كل صنف بسعره الواضح
        </p>
      </main>

      <TabBar active="/store" />
    </div>
  );
}
