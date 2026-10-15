import { prisma } from "@athar/db";

/** لحظتا وصولٍ بينهما أقلّ من هذا تُعدّان ارتجافاً على حدود مدينة لا سفراً. */
const SETTLE_MS = 30 * 60_000;

/**
 * «وصل إلى الرياض» — مرّةً لكل وصولٍ حقيقيّ لا مع كل فتح.
 *
 * ثلاثُ علل كانت تكتبها مراراً:
 * - **المقارنةُ بـ`city`**: وهي ما يكتبه صاحبُ الحساب بيده أحياناً، فمن كتب
 *   «الرياض» والجهازُ يقرأ «Riyadh» أو «منطقة الرياض» كُتبت له لحظةٌ مع كل
 *   دخول، وعادت مدينتُه إلى ما قرأه الجهاز. فالمقارنةُ بـ`lastCity` — ما
 *   قرأه الجهاز آخرَ مرّة — و`city` لا يُمسّ إن كان صاحبُه كتبه
 *   (`cityLocked`).
 * - **أوّلُ قراءةٍ لحسابٍ جديد ليست وصولاً**: من سجّل للتوّ لم يصل إلى
 *   مدينته، فالقراءةُ الأولى تُحفظ بلا لحظة.
 * - **الحدود**: المحوّلُ يردّ المدينةَ مرّةً والمنطقةَ مرّةً على أطرافها،
 *   فلا تُكتب لحظةٌ إن كانت آخرُ لحظة وصولٍ للمدينة نفسها، أو كُتبت
 *   واحدةٌ قبل نصف ساعة.
 *
 * والتبديلُ شرطيٌّ في القاعدة (`updateMany`): طلبان في اللحظة نفسها لا
 * يكتبان لحظتين.
 */
export async function recordCity(userId: string, where: string | Arrival | null): Promise<boolean> {
  const arrival: Arrival = typeof where === "string" || where === null ? { city: where } : where;

  return prisma.$transaction(async (tx) => {
    const before = await tx.user.findUnique({ where: { id: userId }, select: { lastCity: true } });
    if (!before) return false;

    const label = cityLabel(arrival, before.lastCity);
    if (!label) return false;
    // المدينةُ نفسها وإن تبدّلت كتابتُها (بالدولة أو بلاها) ليست وصولاً.
    const same = before.lastCity !== null && baseOf(before.lastCity) === baseOf(label);
    if (same && (typeof where === "string" || before.lastCity === label)) return false;

    const changed = await tx.user.updateMany({
      where: { id: userId, lastCity: before.lastCity },
      data: { lastCity: label },
    });
    if (changed.count === 0) return false;

    // المدينةُ في الملف تتبع الجهاز ما لم يكتبها صاحبُها بيده.
    await tx.user.updateMany({ where: { id: userId, cityLocked: false }, data: { city: baseOf(label) } });

    if (before.lastCity === null || same) return false;

    // من عبر حدوداً ونزل في مطار: «وصل إلى مطار دبي الدولي، الإمارات».
    const text =
      arrival.airport && crossed(before.lastCity, arrival)
        ? `${arrival.airport}، ${countryOf(arrival) ?? HOME}`
        : label;

    const last = await tx.moment.findFirst({
      where: { authorId: userId, kind: "CITY" },
      orderBy: { createdAt: "desc" },
      select: { text: true, createdAt: true },
    });
    if (last && (last.text === text || Date.now() - last.createdAt.getTime() < SETTLE_MS)) {
      return false;
    }

    await tx.moment.create({ data: { authorId: userId, kind: "CITY", text } });
    return true;
  });
}

/** ما قرأه الجهاز: المدينةُ ودولتُها، والمطارُ إن كان فيه. */
export type Arrival = {
  city: string | null;
  country?: string | null;
  countryCode?: string | null;
  airport?: string | null;
};

/** الدولةُ الأمّ: لا تُكتب بجانب مدنها — «وصل إلى جدة» لا «جدة، السعودية». */
const HOME = "السعودية";
const HOME_CODE = "sa";
const JOIN = "، ";

/** الدولةُ خارج المملكة، وإلّا لا شيء. */
function countryOf(arrival: Arrival): string | null {
  const code = arrival.countryCode?.toLowerCase();
  if (!code || code === HOME_CODE || !arrival.country) return null;
  return arrival.country;
}

/** «دبي، الإمارات» ← «دبي». */
const baseOf = (label: string) => label.split(JOIN)[0];

/** دولةُ ما قرأه الجهاز آخرَ مرّة: ما بعد الفاصلة، وإلّا الدولةُ الأمّ. */
const tailOf = (label: string) => (label.includes(JOIN) ? label.slice(label.lastIndexOf(JOIN) + JOIN.length) : HOME);

/** هل عبر حدوداً منذ آخر قراءة؟ ولا يُعرف إلا حين تُعرف دولتُه الآن. */
function crossed(lastCity: string, arrival: Arrival): boolean {
  if (!arrival.countryCode) return false;
  return tailOf(lastCity) !== (countryOf(arrival) ?? HOME);
}

/**
 * ما يُحفظ في `lastCity` ويُكتب في «وصل إلى …»: المدينةُ، ومعها دولتُها خارج
 * المملكة. ومدينةٌ بلا دولةٍ معروفة (من لحظةٍ اختير مكانُها) تأخذ دولةَ ما قبلها.
 */
function cityLabel(arrival: Arrival, lastCity: string | null): string | null {
  const city = arrival.city?.trim() || arrival.airport?.trim();
  if (!city) return null;
  const country = arrival.countryCode ? countryOf(arrival) : lastCity && tailOf(lastCity) !== HOME ? tailOf(lastCity) : null;
  return country ? `${city}${JOIN}${country}` : city;
}
