import { prisma } from "@athar/db";
import { cleanBookPrefs, DEFAULT_BOOK_PREFS, type BookPrefs } from "@athar/shared";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { guard } from "../lib/moderation";
import { dayKey, riyadhDay } from "../lib/riyadh-day";
import { circleLines, circleYear, echoOf, echoText, leadOf } from "../lib/book-story";
import { blockedWith, circleIds } from "./visibility";

/**
 * «أرشيفي» و«سنتك في كتاب» (القاعدة ٢٤٤) — لصاحبها وحده: لا معرّفَ حسابٍ في
 * أيّ مسار، فلا يُسأل عن أرشيف غيره أصلاً.
 *
 * **الأرشيفُ ما كتبه صاحبُه بيده** ومعه أسفارُه — لا أسطرُ النظام («انضم»،
 * «أصبح صديق فلان»، «غيّر صورته»، المنحُ والهدايا): تلك أخبارٌ عنه لا لحظاتُه.
 * و**آثار+ «أرشيفٌ بلا نهاية»** (وعدُ قائمة المزايا): غيرُ المشترك يرى آخر
 * ستّة أشهر، والأقدمُ باقٍ في القاعدة يعود بالاشتراك — لا يُحذف شيء.
 */
const KINDS = ["PHOTO", "PLACE", "THOUGHT", "MUSIC", "SLEEP", "WAKE", "CITY"] as const;
export const FREE_ARCHIVE_DAYS = 183;

const select = {
  id: true,
  kind: true,
  text: true,
  placeName: true,
  placeCity: true,
  musicTitle: true,
  musicArtist: true,
  musicThumb: true,
  mediaId: true,
  photoX: true,
  photoY: true,
  createdAt: true,
} as const;

async function since(userId: string): Promise<Date | null> {
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { isPlus: true } });
  if (!me) throw notFound("الحساب غير موجود");
  return me.isPlus ? null : new Date(Date.now() - FREE_ARCHIVE_DAYS * 86_400_000);
}

/**
 * ما تحمله لوحةُ المعرض فوق سطر الأرشيف (القاعدة ٣٤٩): الصورُ بعد الأولى بمواضعها لتُرسم
 * مكدّسةً، وصدى اللحظة — عددُ التفاعلات والتعليقات وأحدثُ من تفاعل بوجهه ونوع تفاعله.
 */
const HALL = {
  ...select,
  photos: { select: { mediaId: true, x: true, y: true }, orderBy: { position: "asc" } },
  reactions: {
    select: { kind: true, emoji: true, userId: true, user: { select: { name: true, avatarMediaId: true } } },
    orderBy: { createdAt: "desc" },
    take: 12,
  },
  _count: { select: { reactions: true, comments: true } },
} as const;

/** صفحةٌ من الأرشيف، الأحدثُ أوّلاً، بمؤشّرٍ كالخطّ الزمنيّ. */
export async function archive(userId: string, options: { cursor?: string; limit: number }) {
  const from = await since(userId);
  const [found, blocked] = await Promise.all([prisma.moment.findMany({
    where: {
      authorId: userId,
      kind: { in: [...KINDS] },
      ...(from ? { createdAt: { gte: from } } : {}),
    },
    select: HALL,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: options.limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  }), blockedWith(userId)]);
  // المحجوبُ لا يُعدّ ولا يُرى وجهُه (القاعدة ٢٥٩)، والحقولُ مسطّحةٌ فيقرؤها الجوّالُ القديم كما كانت.
  const hidden_ = new Set(blocked);
  const rows = found.map(({ photos, reactions, _count, ...rest }) => {
    const faces = reactions.filter((one) => !hidden_.has(one.userId));
    return {
      ...rest,
      morePhotos: photos.map((photo) => photo.mediaId),
      morePhotoPos: photos.map((photo) => ({ x: photo.x, y: photo.y })),
      echo: {
        reactions: Math.max(0, _count.reactions - (reactions.length - faces.length)),
        comments: _count.comments,
        faces: faces.map((one) => ({ kind: one.kind, emoji: one.emoji, name: one.user.name, avatarMediaId: one.user.avatarMediaId })),
      },
    };
  });
  const more = rows.length > options.limit;
  const items = more ? rows.slice(0, options.limit) : rows;

  // كم يخبّئ الحدُّ — ليُقال «و١٢ لحظة أقدم مع آثار+» لا أن تختفي بصمت.
  const hidden = from
    ? await prisma.moment.count({
        where: { authorId: userId, kind: { in: [...KINDS] }, createdAt: { lt: from } },
      })
    : 0;

  // ثوبُ القاعة الملبوس (القاعدة ٣٤٨) — مع الصفحة الأولى وحدها، ومنتهي المدّة لا يُلبَس.
  const hall = options.cursor
    ? undefined
    : await prisma.user
        .findUnique({
          where: { id: userId },
          select: {
            hall: {
              select: {
                hallSkin: true,
                hallWallMediaId: true,
                hallFloorMediaId: true,
                hallFrameMediaId: true,
                purchases: { where: { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, select: { id: true } },
              },
            },
          },
        })
        .then((row) => (row?.hall?.purchases.length ? row.hall : null));

  return {
    moments: items,
    nextCursor: more ? items.at(-1)?.id : undefined,
    limited: Boolean(from),
    hidden,
    ...(hall !== undefined
      ? {
          hallSkin: hall?.hallSkin ?? null,
          // صورُ الثوب (القاعدة ٣٥٠): نقشا الجدار والأرضيّة وإطارُ الصورة.
          hallImages: hall
            ? { wall: hall.hallWallMediaId, floor: hall.hallFloorMediaId, frame: hall.hallFrameMediaId }
            : null,
        }
      : {}),
  };
}

/** السنواتُ التي فيها لحظات — شرائحُ «سنتك في كتاب». */
export async function years(userId: string) {
  const free = (await since(userId)) !== null;
  // اليومُ والسنةُ بتوقيت الرياض (+٣ بلا توقيتٍ صيفيّ). وغيرُ المشترك يرى السنةَ التي في
  // آخر ستّة أشهرٍ منها لحظات — كحدّ الكتاب نفسه، فلا تظهر سنةٌ يُفتح كتابُها فارغاً.
  const now = new Date();
  const rows = await prisma.$queryRaw<{ year: number; n: bigint }[]>`
    SELECT EXTRACT(YEAR FROM "createdAt" + interval '3 hours')::int AS year, COUNT(*) AS n
    FROM "Moment"
    WHERE "authorId" = ${userId}
      AND "kind"::text IN ('PHOTO', 'PLACE', 'THOUGHT', 'MUSIC', 'SLEEP', 'WAKE', 'CITY')
      AND (NOT ${free} OR "createdAt" >= LEAST(
        date_trunc('year', "createdAt" + interval '3 hours') + interval '1 year' - interval '3 hours',
        ${now}::timestamp
      ) - make_interval(days => ${FREE_ARCHIVE_DAYS}))
    GROUP BY 1 ORDER BY 1 DESC
  `;
  return { years: rows.map((row) => ({ year: row.year, moments: Number(row.n) })) };
}

/**
 * «سنتك في كتاب»: لحظاتُ السنة من أوّلها، **صفحةٌ لكلّ يوم** (القاعدة ٢٥٦)، ومعها ما يُكتب في
 * مقدّمته — كم لحظة، وكم صورة، والمدن، وأكثرُ مكانٍ عاد إليه، وأغانيه.
 * والسنةُ سنةُ الرياض (القاعدة ٢٣٥).
 */
export async function book(userId: string, year: number) {
  if (!Number.isInteger(year) || year < 2024 || year > 2100) throw badRequest("سنة غير صالحة");
  const free = (await since(userId)) !== null;
  const start = new Date(Date.UTC(year, 0, 1, -3));
  const end = new Date(Date.UTC(year + 1, 0, 1, -3));
  // غيرُ المشترك: آخرُ ستّة أشهرٍ **من السنة نفسها** لا من اليوم — كتابُ سنةٍ مضت يبقى
  // من يوليو إلى ديسمبر ولا يتقلّص كلّما مرّ الوقت. والسنةُ الجارية حتى اليوم.
  const tail = new Date(Math.min(end.getTime(), Date.now()) - FREE_ARCHIVE_DAYS * 86_400_000);
  const lower = free && tail > start ? tail : start;

  const [me, found, circleList, blockedList, stored] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, memberNo: true, avatarMediaId: true, gender: true },
    }),
    prisma.moment.findMany({
      where: { authorId: userId, kind: { in: [...KINDS] }, createdAt: { gte: lower, lt: end } },
      select: {
        ...select,
        audience: true,
        audienceGroup: { select: { name: true } },
        viewers: { select: { user: { select: { name: true } } } },
        tags: { select: { user: { select: { name: true } } } },
        reactions: {
          where: { userId: { not: userId } },
          select: { userId: true, kind: true, emoji: true, createdAt: true, user: { select: { name: true } } },
        },
        comments: {
          where: { userId: { not: userId } },
          select: { userId: true, body: true, user: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 1000,
    }),
    circleIds(userId),
    blockedWith(userId),
    prisma.bookPrefs.findUnique({ where: { userId_year: { userId, year } } }),
  ]);
  if (!me) throw notFound("الحساب غير موجود");
  const circle = new Set(circleList);
  const blocked = new Set(blockedList);

  /*
    اللحظةُ الخاصّة تقول في الكتاب لمن كانت (القاعدة ٢٥٦): «شاركتها مع فلان
    وفلان»، أو «لتصنيف العائلة»، أو «للكل ما عدا العمل». والكتابُ لصاحبه وحده،
    فأسماءُ مختاريه وتصنيفاتُه له أن يقرأها. و«مع» الإشارةُ كما كُتبت.
  */
  /*
    والراوي (القاعدة ٢٥٩): لكلّ لحظةٍ جملةٌ تقول ما فعله صاحبُها وما جرى حولها —
    من تفاعل وبماذا، وتعليقٌ يُقتبس — بدل أن تُنسخ كما نُشرت. والأسماءُ من دائرته
    اليوم بلا محجوب: صديقٌ أُزيل يُعدّ ولا يُسمّى.
  */
  const raw = new Map(
    found.map((moment) => [
      moment.id,
      {
        reactions: moment.reactions.map(({ user, ...reaction }) => ({ ...reaction, name: user.name })),
        comments: moment.comments.map(({ user, ...comment }) => ({ ...comment, name: user.name })),
      },
    ]),
  );
  const rows = found.map(({ audience, audienceGroup, viewers, tags, reactions: _r, comments: _c, ...moment }) => {
    const entry = raw.get(moment.id)!;
    const echo = echoOf(entry.reactions, entry.comments, circle, blocked);
    const withNames = tags.map((tag) => tag.user.name);
    return {
      ...moment,
      with: withNames,
      echo,
      /** ما فعله صاحبُها بلسان الراوي: «كنت تسمع…»، «رحت إلى… وكان معك…». */
      story: leadOf({ ...moment, with: withNames }, me.gender),
      /** ما جرى حولها: من تفاعل وبماذا، وما كُتب له — والاقتباسُ في `echo.quote`. */
      echoText: echo ? echoText(echo, me.gender) : null,
      private:
        audience === "CIRCLE"
          ? null
          : {
              audience,
              group: audienceGroup?.name ?? null,
              people: audience === "PICKED" ? viewers.map((viewer) => viewer.user.name) : [],
            },
    };
  });

  // صفحةٌ لكلّ يوم بتوقيت الرياض، ولحظاتُه مرقّمةً فيه بترتيبها.
  const days: { day: string; moments: typeof rows }[] = [];
  for (const row of rows) {
    const key = dayKey(riyadhDay(row.createdAt));
    const last = days.at(-1);
    if (last && last.day === key) last.moments.push(row);
    else days.push({ day: key, moments: [row] });
  }

  const count = (kind: string) => rows.filter((row) => row.kind === kind).length;
  const tally = (values: (string | null)[]) => {
    const map = new Map<string, number>();
    for (const value of values) if (value) map.set(value, (map.get(value) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  };
  const places = tally(rows.filter((row) => row.kind === "PLACE").map((row) => row.placeName));
  const cities = tally(rows.map((row) => row.placeCity ?? (row.kind === "CITY" ? row.text : null)));
  const songs = tally(rows.filter((row) => row.kind === "MUSIC").map((row) => row.musicTitle));
  const circleStats = circleYear(
    rows.map((row) => ({
      id: row.id,
      day: dayKey(riyadhDay(row.createdAt)),
      line: headline(row),
      with: row.with,
      echo: row.echo,
    })),
    raw,
    circle,
    blocked,
  );

  return {
    year,
    name: me.name,
    memberNo: me.memberNo,
    avatarMediaId: me.avatarMediaId,
    partial: lower > start,
    /*
      تجهيزُ الكتاب (القاعدة ٣٧٨): يُقرأ والاشتراكُ قائم، وإلّا الهيئةُ الأصليّة — وما
      اختاره باقٍ في القاعدة يعود بعودته. والجوّالُ القديم لا يقرأ الحقلين فيبقى كما كان.
    */
    custom: !free,
    prefs: !free && stored ? cleanBookPrefs(stored) : DEFAULT_BOOK_PREFS,
    stats: {
      moments: rows.length,
      photos: count("PHOTO"),
      places: count("PLACE"),
      songs: count("MUSIC"),
      thoughts: count("THOUGHT"),
      cities: cities.slice(0, 6).map(([name]) => name),
      topPlace: places[0] ? { name: places[0][0], visits: places[0][1] } : null,
      topSong: songs[0]?.[0] ?? null,
      circle: circleStats,
      /** أسطرُ المقدّمة عن الدائرة جاهزةً — الأوجهُ الثلاثة تقرؤها ولا تكتبها. */
      circleLines: circleLines(circleStats, me.gender),
    },
    days,
    // النسخُ قبل صفحات الأيّام تقرأ القائمةَ مسطّحة.
    moments: rows,
  };
}

/** يحفظ تجهيزَ كتاب سنةٍ — لمشتركي آثار+ وحدهم، والخادمُ يفحص لا الشاشة (القاعدة ٣٧٨). */
export async function saveBookPrefs(userId: string, year: number, raw: unknown): Promise<BookPrefs> {
  if (!Number.isInteger(year) || year < 2024 || year > 2100) throw badRequest("سنة غير صالحة");
  if ((await since(userId)) !== null) throw forbidden("تجهيز الكتاب مع آثار+");
  const prefs = cleanBookPrefs(raw);
  await guard(prefs.title);
  await guard(prefs.dedication);
  const data = { cover: prefs.cover, title: prefs.title, dedication: prefs.dedication, sections: prefs.sections };
  await prisma.bookPrefs.upsert({
    where: { userId_year: { userId, year } },
    create: { userId, year, ...data },
    update: data,
  });
  return prefs;
}

/** عنوانُ اللحظة في سطرٍ واحد — لـ«أكثرُ لحظةٍ حرّكت دائرتك». */
function headline(moment: {
  kind: string;
  text: string | null;
  placeName: string | null;
  placeCity: string | null;
  musicTitle: string | null;
}): string {
  const short = (value: string) => (value.length > 60 ? `${value.slice(0, 59)}…` : value);
  switch (moment.kind) {
    case "PLACE":
      return moment.placeName ?? "مكان";
    case "MUSIC":
      return moment.musicTitle ?? "أغنية";
    case "CITY":
      return `وصلت إلى ${moment.text ?? moment.placeCity ?? ""}`.trim();
    case "SLEEP":
      return "نمت";
    case "WAKE":
      return "صحيت";
    case "PHOTO":
      return moment.text ? short(moment.text) : "صورة";
    default:
      return moment.text ? short(moment.text) : "خاطرة";
  }
}

/**
 * «خريطتي» (القاعدة ٣٦٨): لحظاتُ صاحبها التي حُفظت معها نقطةٌ — لا يُرى فيها أحدٌ غيرُه،
 * فلا جمهورَ يُفحص. والنقطةُ لا تُحفظ إلا و«إظهار موقعي» مفتوح (القاعدة ٢١١)، فما قبلها
 * اسمُ مكانٍ بلا موضع: يُعدّ في الأرقام ولا يُرسم على الخريطة — والشاشةُ تقول كم.
 * وبحدّ الأرشيف نفسه (`since`): آثار+ «أرشيفٌ بلا نهاية».
 */
const MAP_KINDS = ["PHOTO", "PLACE", "THOUGHT", "MUSIC", "CITY"] as const;

type MapStats = {
  places: number;
  cities: number;
  countries: number;
  top: { name: string; count: number } | null;
  unplaced: number;
};

export async function map(userId: string) {
  const from = await since(userId);
  const rows = await prisma.moment.findMany({
    where: {
      authorId: userId,
      kind: { in: [...MAP_KINDS] },
      memoryOf: null,
      ...(from ? { createdAt: { gte: from } } : {}),
    },
    select: {
      id: true,
      kind: true,
      text: true,
      placeName: true,
      placeCity: true,
      lat: true,
      lng: true,
      mediaId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 4000,
  });

  const yearOf = (at: Date) => riyadhDay(at).y;
  const points = rows
    .filter((row) => row.kind !== "CITY" && row.lat != null && row.lng != null)
    .map((row) => ({
      id: row.id,
      kind: row.kind,
      text: row.text,
      placeName: row.placeName,
      placeCity: row.placeCity,
      lat: row.lat as number,
      lng: row.lng as number,
      mediaId: row.mediaId,
      at: row.createdAt.toISOString(),
      year: yearOf(row.createdAt),
    }));

  // الأرقامُ لكلّ سنةٍ وللكلّ — من كلّ لحظةٍ فيها مكانٌ أو مدينة، بنقطةٍ أو بلا نقطة.
  const statsOf = (year: number | null): MapStats => {
    const mine = year == null ? rows : rows.filter((row) => yearOf(row.createdAt) === year);
    const places = new Map<string, number>();
    const cities = new Set<string>();
    const countries = new Set<string>();
    let unplaced = 0;
    for (const row of mine) {
      if (row.kind === "CITY") {
        const [city, country] = (row.text ?? "").split("،").map((part) => part.trim());
        if (city) cities.add(city);
        countries.add(country || "السعودية");
        continue;
      }
      if (row.placeName) places.set(row.placeName, (places.get(row.placeName) ?? 0) + 1);
      if (row.placeCity) cities.add(row.placeCity);
      if (row.placeName && (row.lat == null || row.lng == null)) unplaced += 1;
    }
    if (cities.size && !countries.size) countries.add("السعودية");
    const best = [...places].sort((a, b) => b[1] - a[1])[0];
    return {
      places: places.size,
      cities: cities.size,
      countries: countries.size,
      top: best && best[1] > 1 ? { name: best[0], count: best[1] } : null,
      unplaced,
    };
  };

  const years = [...new Set(rows.map((row) => yearOf(row.createdAt)))].sort((a, b) => b - a);
  const stats: Record<string, MapStats> = { all: statsOf(null) };
  for (const year of years) stats[String(year)] = statsOf(year);

  return { points, years, stats, limited: from != null };
}
