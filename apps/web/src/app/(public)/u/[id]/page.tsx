import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AthrMark, AthrWordmark } from "@/components/brand";
import { NameTag, frameZoom } from "@/components/ui";
import { ar, membership } from "@/lib/format";
import { siteText, storeUrl } from "@/lib/site";
import { OpenInApp } from "./open-in-app";

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
      id: true,
      memberNo: true,
      name: true,
      bio: true,
      city: true,
      isPlus: true,
      createdAt: true,
      avatarMediaId: true,
      coverMediaId: true,
      coverX: true,
      coverY: true,
      coverZoom: true,
      tag: { select: { name: true, bg: true, fg: true } },
      frame: { select: { spec: true, mediaId: true, frameHole: true } },
      charm: { select: { spec: true, mediaId: true } },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const person = await findPerson(id);
  if (!person) return { title: "غير موجود · آثار مومنتس" };

  const title = `${person.name} · آثار مومنتس`;
  const description = `عضو رقم ${ar(person.memberNo)} في آثار مومنتس. أضِفه لترى لحظاته.`;
  /*
    روابط نسبية لا مطلقة: النطاق يُقرأ من البيئة في `metadataBase`
    بالتخطيط الجذر، فيكمّله Next عند الرسم. ولا نطاقَ مكتوبٌ في الكود.
  */
  const image = person.avatarMediaId
    ? `/api/public/avatar/${person.memberNo}`
    : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      url: `/u/${person.memberNo}`,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: { card: image ? "summary" : "summary", title, description, images: image ? [image] : undefined },
    // لا اكتشاف عام: الصفحة تُفتح برابطها ولا تدخل نتائج البحث.
    robots: { index: false, follow: false },
  };
}

/**
 * **بهيئة ملفّ الصديق في التطبيق** (القاعدة ٢٠): غلافٌ بعرض الشاشة
 * وموضعِه كما ضبطه صاحبه، ثمّ الصورةُ على حافّته، ثمّ الاسمُ ووسمُه، ثمّ
 * البيانات — وتحتها «افتح في التطبيق». كانت بطاقةً وسط الصفحة بتخطيطٍ
 * آخر، فتُقرأ موقعاً غير التطبيق الذي دُعي إليه قارئُها.
 *
 * و«الإحصاءات» هنا ما يعرّف بلا أن يكشف: رقمُ العضوية، ومدّةُ البقاء،
 * والمدينة. **لا عددُ لحظاتٍ ولا أصدقاء** (القاعدة ٨٧ب): عددُ الدائرة يقول
 * عن صاحبها ما لم يأذن بقوله لغريبٍ فتح رابطاً.
 */
export default async function SharedProfile({ params }: Props) {
  const { id } = await params;
  const [person, text, agent] = await Promise.all([
    findPerson(id),
    siteText(),
    headers().then((all) => all.get("user-agent") ?? ""),
  ]);

  // «غير موجود» لا «ممنوع»: الثانية تؤكّد للسائل أنّ الرقم صحيح.
  if (!person) notFound();

  const cover = person.coverMediaId ? `/api/public/cover/${person.memberNo}` : null;
  const avatar = person.avatarMediaId ? `/api/public/avatar/${person.memberNo}` : null;
  /*
    الإطارُ والتميمة كما تُرسم في التطبيق: الإطارُ فوق الوجه بمقلوب فراغه
    (القاعدة ٨٠ب)، والتميمةُ يسارَ الصورة وأغلبُها خارجها وفوق الإطار
    (القاعدة ٥٩). وكانت الصفحة ترسم الوجه وحده، فيبدو الملفُّ عارياً لمن
    فتحه في المتصفّح.
  */
  const AVATAR = 96;
  const frame = person.frame?.mediaId ? `/api/public/frame/${person.memberNo}` : null;
  const frameScale = person.frame?.mediaId ? frameZoom(person.frame) : 1;
  const facePad = frame && frameScale <= 1.02 ? AVATAR * 0.07 : 0;
  const charm = person.charm?.mediaId ? `/api/public/charm/${person.memberNo}` : null;
  const badge = Math.round(AVATAR * 0.5);

  const ios = storeUrl(text["store.ios"]);
  const android = storeUrl(text["store.android"]);
  // متجرُ جهاز القارئ: من فتح الرابط من أندرويد لا يُرسَل إلى App Store.
  const mine = /android/i.test(agent) ? android ?? ios : ios ?? android;

  const zoom = Math.min(300, Math.max(100, person.coverZoom)) / 100;
  const stats = [
    { label: "رقم العضوية", value: ar(person.memberNo) },
    { label: "معنا منذ", value: membership(person.createdAt) },
    ...(person.city ? [{ label: "المدينة", value: person.city }] : []),
  ];

  return (
    <article className="mx-auto max-w-[520px] pb-10">
      {/* الغلاف بموضعه وقُربه — المعادلةُ نفسها في التطبيق (`coverFrame`). */}
      <div className="relative h-[176px] overflow-hidden sm:rounded-b-2xl">
        {cover ? (
          <span
            aria-hidden
            className="absolute inset-0 block"
            style={{
              backgroundImage: `url(${cover})`,
              backgroundSize: "cover",
              backgroundPosition: `${person.coverX}% ${person.coverY}%`,
              transform: zoom === 1 ? undefined : `scale(${zoom})`,
              transformOrigin: `${person.coverX}% ${person.coverY}%`,
            }}
          />
        ) : (
          <span
            aria-hidden
            className="absolute inset-0 block"
            style={{ backgroundImage: "linear-gradient(135deg,#0e1a24,#2b3f4f)" }}
          />
        )}
      </div>

      <div className="relative -mt-12 flex flex-col items-center px-5 text-center">
        <span className="relative block" style={{ width: AVATAR, height: AVATAR, padding: facePad }}>
          <span
            className="flex h-full w-full items-center justify-center overflow-hidden rounded-full text-[30px] font-bold"
            style={{
              border: frame ? undefined : "4px solid var(--color-paper)",
              backgroundImage: avatar ? `url(${avatar})` : "linear-gradient(135deg,#f6b93b,#ff7a5a)",
              backgroundSize: "cover",
              backgroundPosition: "center",
              color: "#14212b",
            }}
          >
            {avatar ? "" : person.name.slice(0, 1)}
          </span>
          {frame ? (
            <span
              aria-hidden
              className="pointer-events-none absolute block"
              style={{
                inset: `${((1 - frameScale) / 2) * 100}%`,
                backgroundImage: `url(${frame})`,
                backgroundSize: "contain",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            />
          ) : null}
          {charm ? (
            <span
              aria-hidden
              className="pointer-events-none absolute block"
              style={{
                width: badge,
                height: badge,
                left: -badge * 0.3,
                top: AVATAR - badge * 0.8,
                zIndex: 2,
                backgroundImage: `url(${charm})`,
                backgroundSize: "contain",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                filter: "drop-shadow(0 2px 4px rgba(14,26,36,.28))",
              }}
            />
          ) : null}
        </span>

        {/* النجمةُ ووسمُ «داعم» من `NameTag` نفسه — لا رسمٌ ثانٍ لهما هنا. */}
        <h1 className="mt-3 flex items-center justify-center gap-2 text-[21px] font-bold">
          <span dir="auto">{person.name}</span>
          <NameTag isPlus={person.isPlus} tag={person.tag} size={11} />
        </h1>

        {person.bio ? (
          <p dir="auto" className="mt-2 max-w-[420px] text-[13.5px] leading-relaxed text-ink-2">
            {person.bio}
          </p>
        ) : null}

        <dl className="mt-5 grid w-full gap-2" style={{ gridTemplateColumns: `repeat(${stats.length}, 1fr)` }}>
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-line bg-card px-2 py-3">
              <dd className="text-[15px] font-bold leading-tight">{stat.value}</dd>
              <dt className="mt-1 text-[10.5px] text-muted">{stat.label}</dt>
            </div>
          ))}
        </dl>

        <div className="mt-5 w-full">
          <OpenInApp userId={person.id} store={mine} />
        </div>

        {/*
          الدعوة: من لم يُنزّل التطبيق. ومكانُ اللحظات سطرٌ يقول لماذا لا تُرى
          — كما في ملفّ من ليس صديقاً داخل التطبيق.
        */}
        <div className="mt-6 w-full rounded-2xl border border-line bg-card p-6">
          <span className="mx-auto mb-3 flex w-fit items-center gap-2">
            <AthrMark size={34} />
            <AthrWordmark size={15} />
          </span>

          <p className="text-[14px] font-semibold">
            أضِف <span dir="auto">{person.name}</span> لترى لحظاته
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
            آثار مومنتس شبكةٌ بدائرةٍ محدودة — مئةٌ وخمسون شخصاً لا أكثر، ولا استكشاف عام.
          </p>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <StoreButton store="App Store" href={ios} />
            <StoreButton store="Google Play" href={android} />
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * زرُّ المتجر: رابطُه من اللوحة (`store.ios` و`store.android`)، وبلا رابطٍ
 * يقول «قريباً» ولا يفتح شيئاً — زرٌّ إلى صفحةٍ لا وجود لها أسوأ من زرٍّ
 * يقول إنّه لم يُفتح بعد.
 */
function StoreButton({ store, href }: { store: string; href: string | null }) {
  if (href) {
    return (
      <a
        href={href}
        className="flex grow items-center justify-center gap-2 rounded-xl px-4 py-3 text-[12.5px] font-bold"
        style={{ background: "var(--color-chrome)", color: "var(--color-chrome-ink)" }}
      >
        {store}
      </a>
    );
  }
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
