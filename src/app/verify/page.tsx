import Link from "next/link";
import { prisma } from "@/lib/db";
import { consume } from "@/lib/email-tokens";
import { CheckIcon, CloseIcon } from "@/components/icons";

export const metadata = { title: "تأكيد البريد · آثار مومنتس" };

/**
 * تأكيدُ البريد: الرابط يُفتح فيُختم العنوان.
 *
 * ويُستهلك هنا عند الفتح — بخلاف رابط الضبط: لا نموذجَ بعده ولا شيءَ
 * يُكتب، والفعلُ هو الفتحُ نفسه.
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const read = await consume(token ?? "", "VERIFY");

  if (!("error" in read)) {
    await prisma.user.update({
      where: { id: read.userId },
      data: { emailVerifiedAt: new Date() },
    });
  }

  const ok = !("error" in read);

  return (
    <div className="screen">
      <main className="scroll-area flex flex-col justify-center px-6 py-10">
        <div className="mx-auto w-full max-w-sm rounded-2xl border border-line bg-card p-6 text-center">
          <span
            className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
            style={{
              background: ok ? "var(--color-clay-soft)" : "var(--color-chip)",
              color: ok ? "var(--color-clay)" : "var(--color-live)",
            }}
          >
            {ok ? <CheckIcon size={22} /> : <CloseIcon size={20} />}
          </span>

          <h1 className="mb-2 text-[18px] font-bold">{ok ? "تأكّد بريدك" : "لم يتمّ التأكيد"}</h1>
          <p className="text-[13px] leading-relaxed text-muted">
            {ok
              ? "صار عنوانك مؤكّداً — نستطيع أن نصل إليك إن نسيتَ كلمة مرورك."
              : "error" in read
                ? read.error
                : ""}
          </p>

          <Link
            href="/"
            className="brand-gradient mt-5 flex items-center justify-center rounded-xl text-[14px] font-bold"
            style={{ height: 48, color: "var(--color-on-brand)" }}
          >
            افتح آثار
          </Link>
        </div>
      </main>
    </div>
  );
}
