import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { ScreenHeader } from "@/components/ui";
import { ar, dayLabel, timeOfDay } from "@/lib/format";
import { RemoveMoment } from "./remove";
import { BASE } from "@/lib/base";

export const metadata: Metadata = { title: "لحظات حساب · لوحة التحكم" };

/**
 * لحظات حسابٍ بعينه — بابُ الإشراف.
 *
 * البلاغ يصل على منشور، فلا يكفي أن يقرأ المشرف نصّاً منسوخاً في صفّ
 * البلاغ: يحتاج أن يفتح الحساب ويرى ما حوله ثمّ يحكم. وهذا **خارج
 * `visibleWhere()`** قصداً ومن بابٍ واحد ظاهر (القاعدة ٢٣): توسعةُ شرط
 * الرؤية بحقلٍ في صفّ القارئ تجعل كلّ استعلامٍ في التطبيق يحمل ثقباً.
 *
 * والصلاحية تُقرأ من الصفّ في كل زيارة لا من الجلسة وحدها، وكلُّ حذفٍ
 * يُختم في `ModerationLog`: من مُنح هذا الباب يُعرف ما فعل به.
 */
const KIND: Record<string, string> = {
  PHOTO: "صورة",
  PLACE: "مكان",
  THOUGHT: "خاطرة",
  MUSIC: "أغنية",
  SLEEP: "نام",
  WAKE: "صحا",
  CITY: "انتقل",
  FRIEND_ADDED: "صديق جديد",
  GIFT_SENT: "أهدى",
  GIFT_GOT: "وصلته هدية",
};

export default async function ModeratedProfile({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const viewer = await currentUser();
  if (!viewer) redirect("/login");
  if (!viewer.canModerate) notFound();

  const person = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      memberNo: true,
      name: true,
      email: true,
      city: true,
      bio: true,
      createdAt: true,
      _count: { select: { moments: true } },
    },
  });
  if (!person) notFound();

  const moments = await prisma.moment.findMany({
    where: { authorId: id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      kind: true,
      text: true,
      placeName: true,
      placeCity: true,
      musicTitle: true,
      musicArtist: true,
      mediaId: true,
      audience: true,
      createdAt: true,
      _count: { select: { reactions: true, comments: true } },
    },
  });

  return (
    <div className="screen">
      <ScreenHeader title="لحظات حساب" back="/admin?s=users" />

      <main className="scroll-area px-5 pb-10 pt-4">
        <div className="mb-4 rounded-2xl border border-line bg-card p-4">
          <p dir="auto" className="text-[15px] font-bold">
            {person.name}
          </p>
          <p dir="ltr" className="text-right text-[11.5px] text-faint">
            {person.email}
          </p>
          {/*
            سطران لا سطر: «· ٣ لحظة» بعد اسم مدينةٍ عربية ينقلب ترتيبه
            في الثنائية فيُقرأ الرقمُ ملتصقاً بالنقطة («٣٠»). والفصل
            أوضح من `bdi` حول كل قطعة.
          */}
          <p className="mt-1 text-[12px] text-muted">
            عضو رقم {ar(person.memberNo)}
            {person.city ? ` · ${person.city}` : ""}
          </p>
          <p className="text-[12px] text-muted">{ar(person._count.moments)} لحظة</p>
          {person.bio ? (
            <p dir="auto" className="mt-2 text-[12.5px] leading-relaxed text-ink-2">
              {person.bio}
            </p>
          ) : null}

          {/*
            وهذا بابُ قراءةٍ لا بابُ دخول: لا تفاعلَ هنا ولا تعليق — المشرف
            يقرأ ليحكم لا ليشارك.
          */}
          <p className="mt-3 text-[11px] leading-relaxed text-faint">
            تُقرأ هنا لحظات الحساب كلّها بلا صداقة — صلاحيةُ إشراف، وكلُّ حذفٍ
            يُسجَّل باسمك.
          </p>
        </div>

        {moments.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-muted">لا لحظات في هذا الحساب.</p>
        ) : null}

        <div className="flex flex-col gap-2">
          {moments.map((moment) => (
            <article key={moment.id} className="rounded-2xl border border-line bg-card p-3.5">
              <div className="mb-1.5 flex items-center gap-2">
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{ background: "var(--color-chip)", color: "var(--color-muted)" }}
                >
                  {KIND[moment.kind] ?? moment.kind}
                </span>
                <span className="text-[11px] text-faint">
                  {dayLabel(moment.createdAt)} · {timeOfDay(moment.createdAt)}
                </span>
                {moment.audience !== "CIRCLE" ? (
                  <span className="text-[11px] text-faint">
                    · {moment.audience === "GROUP" ? "تصنيف" : "أشخاص"}
                  </span>
                ) : null}
              </div>

              {moment.text ? (
                <p dir="auto" className="whitespace-pre-wrap text-[13.5px] leading-relaxed">
                  {moment.text}
                </p>
              ) : null}
              {moment.placeName ? (
                <p dir="auto" className="text-[13px]">
                  {moment.placeName}
                  {moment.placeCity ? ` · ${moment.placeCity}` : ""}
                </p>
              ) : null}
              {moment.musicTitle ? (
                <p dir="auto" className="text-[13px]">
                  {moment.musicTitle}
                  {moment.musicArtist ? ` — ${moment.musicArtist}` : ""}
                </p>
              ) : null}

              {/*
                والصورة تُقرأ من `/api/media` بجلسة المشرف: البابُ يفحص
                الصلاحية بنفسه (القاعدة ٢٣ب)، فلا يُفتح بمعرّفٍ وحده.
              */}
              {moment.mediaId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`${BASE}/api/media/${moment.mediaId}`}
                  alt=""
                  className="mt-2 max-h-[280px] w-full rounded-xl object-cover"
                />
              ) : null}

              <div className="mt-2.5 flex items-center justify-between gap-3">
                <span className="text-[11px] text-faint">
                  {ar(moment._count.reactions)} تفاعل · {ar(moment._count.comments)} تعليق
                </span>
                <RemoveMoment momentId={moment.id} />
              </div>
            </article>
          ))}
        </div>

        <Link
          href="/admin?s=reports"
          className="mt-6 block text-center text-[12.5px] font-semibold text-clay-ink"
        >
          إلى البلاغات
        </Link>
      </main>
    </div>
  );
}
