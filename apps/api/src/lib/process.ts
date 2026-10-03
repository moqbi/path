import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";

const run = promisify(execFile);

/**
 * معالجة ما رُفع على الخادم.
 *
 * الغرض الأول خصوصية لا جودة: صورة الجوّال تحمل في بياناتها الوصفية
 * إحداثيات التقاطها. ومستخدمٌ أطفأ «إظهار موقعي» ثم نشر صورةً كان
 * موقعُه يخرج معها رغم ذلك — فالبيانات الوصفية تُنزع هنا نزعاً، لا
 * يُعتمد على أن يفعل ذلك العميل.
 *
 * والغرض الثاني أن المقاس يُقرأ من البكسلات لا من كلام العميل: رقمٌ في
 * الطلب يُكتب بما شاء كاتبه.
 */

/** أقصى ضلعٍ للصورة المخزَّنة. ما فوقه يُصغَّر: لا شاشة تعرض أكثر. */
const MAX_SIDE = 1600;

export type Processed = {
  bytes: Uint8Array;
  mime: string;
  width: number;
  height: number;
};

/**
 * صورةٌ ثابتة: تُقرأ وتُنزع بياناتها وتُعاد كتابتها.
 *
 * `rotate()` بلا وسيط تطبّق دوران EXIF ثم تُسقطه — وإلا ظهرت الصورة
 * مقلوبةً بعد نزع البيانات. و`withMetadata` لا تُستدعى: الافتراض في
 * sharp ألّا تُكتب البيانات الوصفية، وهو المطلوب.
 */
export async function processImage(input: Uint8Array, mime: string): Promise<Processed> {
  const image = sharp(Buffer.from(input), { failOn: "error" }).rotate();
  const meta = await image.metadata();
  if (!meta.width || !meta.height) throw new Error("تعذّرت قراءة الصورة");

  const big = Math.max(meta.width, meta.height) > MAX_SIDE;
  const pipeline = big ? image.resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside" }) : image;

  // PNG يبقى PNG (الشفافية)، وما عداه يُكتب WebP: أصغر بنفس الوضوح.
  const out =
    mime === "image/png"
      ? await pipeline.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true })
      : await pipeline.webp({ quality: 82 }).toBuffer({ resolveWithObject: true });

  return {
    bytes: new Uint8Array(out.data),
    mime: mime === "image/png" ? "image/png" : "image/webp",
    width: out.info.width,
    height: out.info.height,
  };
}

/**
 * مقاس الصورة المتحركة بلا إعادة ترميز.
 *
 * المتحركة تُترك كما هي: إعادة كتابتها تكسر حلقتها أو تضاعف حجمها،
 * والمطلوب منها المقاس وحده — وهو يُقرأ من رأس الملف.
 */
export async function measure(input: Uint8Array): Promise<{ width: number; height: number }> {
  const meta = await sharp(Buffer.from(input), { animated: true }).metadata();
  if (!meta.width || !meta.height) throw new Error("تعذّرت قراءة الصورة");
  // ارتفاع المتحركة في sharp مجموع إطاراتها: الإطار الواحد هو المقاس.
  const height = meta.pages && meta.pages > 1 ? Math.round(meta.height / meta.pages) : meta.height;
  return { width: meta.width, height };
}

/** مدّة المقطع وأبعاده — من الملف لا من كلام العميل. */
export type Clip = { seconds: number; width: number; height: number };

/**
 * يقرأ المقطع بـffprobe.
 *
 * المدّة تُفحص على الخادم لأن الحدّ منتَج لا تجميل: عشرون ثانية للقصّة،
 * وعشرون للرسالة الصوتية ومئةٌ وعشرون لمشتركي آثار+. ورقمٌ يُرسله العميل
 * ليس حدّاً.
 */
export class NoProbe extends Error {
  constructor() {
    super("ffprobe غير مثبّت على هذا الخادم");
  }
}

export async function probeClip(input: Uint8Array, extension: string): Promise<Clip> {
  const folder = await mkdtemp(join(tmpdir(), "athr-"));
  const path = join(folder, `clip.${extension}`);
  try {
    await writeFile(path, input);
    const { stdout } = await run("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration:stream=width,height",
      "-of", "json",
      path,
    ]);
    const data = JSON.parse(stdout) as {
      format?: { duration?: string };
      streams?: { width?: number; height?: number }[];
    };
    const visual = data.streams?.find((stream) => stream.width && stream.height);
    return {
      seconds: Math.ceil(Number(data.format?.duration ?? 0)),
      width: visual?.width ?? 0,
      height: visual?.height ?? 0,
    };
  } catch (problem) {
    /*
      ffprobe مفقودٌ يختلف عن ملفٍّ لا يُقرأ: الأوّل عطلُ بيئةٍ يُرفع
      إلى من ينشرها، والثاني ملفٌّ يُردّ. وخلطُهما كان يقول لصاحب
      التسجيل «تعذّرت قراءة المقطع» وتسجيلُه سليم.
    */
    if ((problem as { code?: string }).code === "ENOENT") throw new NoProbe();
    throw problem;
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

/** ffmpeg مفقودٌ على الخادم — عطلُ بيئةٍ يُقال باسمه لا «ملفٌّ فاسد». */
export class NoFfmpeg extends Error {
  constructor() {
    super("ffmpeg غير مثبّت على هذا الخادم");
  }
}

/** المقطعُ بلا مسارِ صوت — فيديو صامتٌ لا يُسحب منه شيء. */
export class Silent extends Error {
  constructor() {
    super("المقطع بلا صوت");
  }
}

export type Sound = { bytes: Uint8Array; seconds: number; peaks: number[] };

/** عددُ أعمدة الموجة التي يرسمها شريطُ القصّ. */
const PEAKS = 120;

async function ffmpeg(args: string[]) {
  try {
    return await run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], {
      maxBuffer: 64 * 1024 * 1024,
      encoding: "buffer",
    });
  } catch (problem) {
    if ((problem as { code?: string }).code === "ENOENT") throw new NoFfmpeg();
    const said = String((problem as { stderr?: Buffer }).stderr ?? "");
    if (/does not contain any stream|matches no streams|Output file is empty/i.test(said)) throw new Silent();
    throw problem;
  }
}

/**
 * موجةُ الصوت: أعلى ارتفاعٍ في كلّ عمود، من ٠ إلى ١.
 *
 * يُفكّ إلى عيّناتٍ أحاديّة بأربعة آلاف في الثانية: أقلُّ من ذلك يقصّ الصوتَ نفسه
 * — مُعيدُ العيّنات يرشّح ما فوق نصفها، ومئتان في الثانية تُخرج موجةً مسطّحة
 * لأغنيةٍ كاملة. وعشرُ دقائق منها أقلُّ من خمسة ميغا في الذاكرة لحظةً.
 */
async function peaksOf(path: string): Promise<{ peaks: number[]; seconds: number }> {
  const RATE = 4000;
  const { stdout } = await ffmpeg(["-i", path, "-vn", "-ac", "1", "-ar", String(RATE), "-f", "s16le", "-"]);
  const raw = stdout as unknown as Buffer;
  const count = Math.floor(raw.length / 2);
  const seconds = count / RATE;
  const per = Math.max(1, Math.floor(count / PEAKS));
  const peaks: number[] = [];
  for (let start = 0; start < count && peaks.length < PEAKS; start += per) {
    let top = 0;
    for (let i = start; i < Math.min(count, start + per); i++) top = Math.max(top, Math.abs(raw.readInt16LE(i * 2)));
    peaks.push(top / 32768);
  }
  // يُطبَّع إلى أعلاه: صوتٌ هادئ يُرسم بموجةٍ تُرى لا بخطٍّ مسطّح.
  const loudest = Math.max(0.05, ...peaks);
  return { peaks: peaks.map((value) => Math.round((value / loudest) * 100) / 100), seconds };
}

/**
 * يسحب الصوتَ من مقطعٍ أو ملفّ صوت ويرمي الصورة (القاعدة ٢٣٨).
 *
 * AAC في M4A بـ١٢٨ ألفاً: يُشغَّل على آبل وأندرويد والمتصفّح بلا تحويل، وعشرُ
 * دقائق منه دون عشرة ميغا. و`faststart` يضع الفهرس أوّلاً فيبدأ التشغيل قبل
 * أن يكتمل التنزيل.
 */
export async function extractAudio(input: Uint8Array, extension: string, maxSeconds: number): Promise<Sound> {
  const folder = await mkdtemp(join(tmpdir(), "athr-"));
  const source = join(folder, `in.${extension}`);
  const out = join(folder, "out.m4a");
  try {
    await writeFile(source, input);
    await ffmpeg([
      "-i", source,
      "-vn", "-map", "0:a:0",
      "-t", String(maxSeconds),
      "-c:a", "aac", "-b:a", "128k", "-ac", "2",
      "-movflags", "+faststart",
      out,
    ]);
    const bytes = new Uint8Array(await readFile(out));
    if (bytes.length === 0) throw new Silent();
    const wave = await peaksOf(out);
    return { bytes, seconds: Math.round(wave.seconds * 10) / 10, peaks: wave.peaks };
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

/**
 * يقصّ ما اختاره صاحبُ القصّة ويُبقيه وحده.
 *
 * يُعاد ترميزه ولا يُنسخ (`-c copy`): النسخُ يقصّ على أقرب إطارٍ مفتاحيّ فيبدأ
 * قبل ما اختير بثانية. وخفوتٌ قصيرٌ في الطرفين: صوتٌ يُقطع في منتصف نغمةٍ يُسمع
 * طقّةً (القاعدة ٣٦).
 */
export async function trimAudio(input: Uint8Array, start: number, length: number): Promise<{ bytes: Uint8Array; seconds: number }> {
  const folder = await mkdtemp(join(tmpdir(), "athr-"));
  const source = join(folder, "in.m4a");
  const out = join(folder, "out.m4a");
  const fade = Math.min(0.3, length / 4);
  try {
    await writeFile(source, input);
    await ffmpeg([
      "-ss", start.toFixed(2),
      "-i", source,
      "-t", length.toFixed(2),
      "-af", `afade=t=in:d=${fade},afade=t=out:st=${Math.max(0, length - fade).toFixed(2)}:d=${fade}`,
      "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart",
      out,
    ]);
    const bytes = new Uint8Array(await readFile(out));
    if (bytes.length === 0) throw new Silent();
    return { bytes, seconds: Math.max(1, Math.round(length)) };
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}
