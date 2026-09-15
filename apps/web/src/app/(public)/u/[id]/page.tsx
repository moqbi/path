import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@athar/shared";
import { AthrMark } from "@/components/brand";
import { SparkIcon } from "@/components/icons";
import { ar, membership } from "@/lib/format";

/**
 * صفحة المشاركة — بطاقة شخصٍ لمن لم ينزّل التطبيق بعد.
 *
 * الرابط يُشارَك برقم العضوية لا بمعرّف الحساب (القاعدة ٨٧): الرقم قصيرٌ
 * يُقرأ ويُقال، والمعرّف سلسلةٌ لا تُحفظ. ولا اكتشاف عام في آثار
 * (القاعدة ٢) — فهذه الصفحة ليست دليلاً يُتصفَّح: لا قائمة، ولا بحث،
 * ولا رابط من صفحةٍ إلى أخرى. من يصل إليها وصل برابطٍ أعطاه صاحبه.
 *
 * وما فيها أقلّ ما يعرّف: صورةٌ واسمٌ ونبذةٌ ورقمُ عضوية ومدّةُ بقاء.
 * لا لحظات، ولا أصدقاء، ولا عددُهم — عددُ الدائرة يقول عن صاحبها ما لم
 * يأذن بقوله، ولا يخدم غريباً في شيء.
 */
type Props = { params: Promise<{ id: string }> };

async function findPerson(raw: string) {
  const number = Number(raw);
  if (!Number.isInteger(number) || number < 1) return null;

  return prisma.user.findUnique({
    where: { memberNo: number },
    select: {
      memberNo: true,
      name: true,
      bio: true,
      city: true,
      isPlus: true,
      createdAt: true,
      avatarMediaId: true,
      coverMediaId: true,
      tag: { select: { name: true, bg: true, fg: true } },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const person = await findPerson(id);
  if (!person) return { title: "غير موجود · آثار" };

  const title = `${person.name} · آثار`;
  const description = `عضو رقم ${ar(person.memberNo)} في آثار. أضِفه لترى لحظاته.`;
  const image = person.avatarMediaId
    ? `${SITE_URL}/api/public/avatar/${person.memberNo}`
    : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      url: `${SITE_URL}/u/${person.memberNo}`,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: { card: image ? "summary" : "summary", title, description, images: image ? [image] : undefined },
    // لا اكتشاف عام: الصفحة تُفتح برابطها ولا تدخل نتائج البحث.
    robots: { index: false, follow: false },
  };
}

export default async function SharedProfile({ params }: Props) {
  const { id } = await params;
  const person = await findPerson(id);

  // «غير موجود» لا «ممنوع»: الثانية تؤكّد للسائل أنّ الرقم صحيح.
  if (!person) notFound();

  const cover = person.coverMediaId ? `/api/public/cover/${person.memberNo}` : null;
  const avatar = person.avatarMediaId ? `/api/public/avatar/${person.memberNo}` : null;

  return (
    <article className="mx-auto max-w-[520px]">
      <div
        className="relative mb-0 h-[150px] overflow-hidden rounded-2xl"
        style={{
          background: cover
            ? `center / cover no-repeat url(${cover})`
            : "linear-gradient(135deg,#0e1a24,#2b3f4f)",
        }}
      >
        {/* الغلاف يذوب في أرضيته (القاعدة ٥٣) — لا حدٌّ حادّ تحته. */}
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-16"
          style={{ background: "linear-gradient(to top, var(--color-paper), transparent)" }}
        />
      </div>

      {/*
        `relative` هنا لازمة لا زينة: الغلاف فوقه `relative` كذلك،
        والعنصر الموضوع يُرسم فوق أخيه الساكن مهما كان ترتيبهما — فكانت
        الصورة تُقصّ نصفها تحت الغلاف.
      */}
      <div className="relative -mt-12 flex flex-col items-center px-5 text-center">
        <span
          className="flex h-[92px] w-[92px] items-center justify-center overflow-hidden rounded-full border-4 text-[30px] font-bold"
          style={{
            borderColor: "var(--color-paper)",
            background: avatar
              ? `center / cover no-repeat url(${avatar})`
              : "linear-gradient(135deg,#f6b93b,#ff7a5a)",
            color: "#14212b",
          }}
        >
          {avatar ? "" : person.name.slice(0, 1)}
        </span>

        <h1 className="mt-3 flex items-center gap-2 text-[21px] font-bold">
          <span dir="auto">{person.name}</span>
          {/* آثار+ نجمة `SparkIcon` نفسها في كل مكان (القاعدة ٧٦). */}
          {person.isPlus ? (
            <span className="text-gold" aria-label="مشترك في آثار+">
              <SparkIcon size={16} />
            </span>
          ) : null}
          {person.tag ? (
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{ background: person.tag.bg, color: person.tag.fg }}
            >
              {person.tag.name}
            </span>
          ) : null}
        </h1>

        <p className="mt-1 text-[12.5px] text-muted">
          عضو رقم {ar(person.memberNo)}
          {person.city ? ` · ${person.city}` : ""}
        </p>
        <p className="text-[12.5px] text-muted">معنا {membership(person.createdAt)}</p>

        {person.bio ? (
          <p className="mt-4 max-w-[420px] text-[13.5px] leading-relaxed text-ink-2">{person.bio}</p>
        ) : null}

        {/*
          الدعوة: هذه الصفحة لمن لم ينزّل التطبيق، فالفعل واحدٌ ظاهر —
          وما يُرى منها لا يُغني عن التطبيق، فاللحظات لا تُعرض هنا.
        */}
        <div className="mt-8 w-full rounded-2xl border border-line bg-card p-6">
          <span className="mx-auto mb-3 flex w-fit items-center gap-2">
            <AthrMark size={34} />
            <span className="latin text-[15px] font-bold">ATHAR</span>
          </span>

          <p className="text-[14px] font-semibold">
            أضِف <span dir="auto">{person.name}</span> لترى لحظاته
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
            آثار شبكةٌ بدائرةٍ محدودة — مئةٌ وخمسون شخصاً لا أكثر، ولا استكشاف عام.
          </p>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <StoreButton store="App Store" />
            <StoreButton store="Google Play" />
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * زرّ المتجر «قريباً» بلا رابط: زرٌّ يفتح صفحةً لا وجود لها أسوأ من زرٍّ
 * يقول إنّه لم يُفتح بعد — وهو ما تقوله صفحة الهبوط نفسها.
 */
function StoreButton({ store }: { store: string }) {
  return (
    <span
      className="flex grow items-center justify-center gap-2 rounded-xl border border-line px-4 py-3 text-[12.5px] font-semibold text-muted"
      aria-disabled="true"
    >
      {store}
      <span className="text-[11px] text-faint">قريباً</span>
    </span>
  );
}
