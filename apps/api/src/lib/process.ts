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
export async function processImage(
  input: Uint8Array,
  mime: string,
  /** صورةُ اللحظة تُضغط أكثر (القاعدة ٣٤٣): خمسٌ في لحظةٍ واحدة تُجلب في كلّ تمرير. */
  options: { side?: number; quality?: number } = {},
): Promise<Processed> {
  const side = options.side ?? MAX_SIDE;
  const image = sharp(Buffer.from(input), { failOn: "error" }).rotate();
  const meta = await image.metadata();
  if (!meta.width || !meta.height) throw new Error("تعذّرت قراءة الصورة");

  const big = Math.max(meta.width, meta.height) > side;
  const pipeline = big ? image.resize({ width: side, height: side, fit: "inside" }) : image;

  /*
    كلُّ صورةٍ ثابتة تُكتب WebP — **بقرار المالك**، والـPNG معها: كان يبقى PNG لشفافيّته
    فيُحفظ بلا ضغطٍ يُذكر (رسمُ تشارمٍ بميغاين). وWebP يحمل الشفافيّة كاملةً
    (`alphaQuality` عالية فلا تتشرّس الحوافّ) بنحو عُشر الحجم.
  */
  const out = await pipeline
    .webp(mime === "image/png" ? { quality: 86, alphaQuality: 95 } : { quality: options.quality ?? 82, effort: 5 })
    .toBuffer({ resolveWithObject: true });

  return {
    bytes: new Uint8Array(out.data),
    mime: "image/webp",
    width: out.info.width,
    height: out.info.height,
  };
}

/**
 * صورةُ العرض مربّعٌ ٣٢٠×٣٢٠ (القاعدة ٢٤٨) — **بقرار المالك**: كانت تُحفظ
 * بمقاسها حتى ١٦٠٠، فمن ضغط صورةَ صديقه رآها بملء الشاشة كما صُوِّرت. تُقصّ من
 * وسطها على ما فيه وجهٌ أو تفصيل (`attention`)، وتُكتب WebP — وPNG يبقى PNG
 * لشفافيّته. وأكبرُ ما تُعرض فيه الصورةُ في التطبيق دون ذلك.
 */
export async function squareAvatar(input: Uint8Array, mime: string, side: number): Promise<Processed> {
  const pipeline = sharp(Buffer.from(input), { failOn: "error" })
    .rotate()
    .resize({ width: side, height: side, fit: "cover", position: "attention" });
  const out =
    mime === "image/png"
      ? await pipeline.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true })
      : await pipeline.webp({ quality: 86 }).toBuffer({ resolveWithObject: true });
  return {
    bytes: new Uint8Array(out.data),
    mime: mime === "image/png" ? "image/png" : "image/webp",
    width: out.info.width,
    height: out.info.height,
  };
}

/**
 * صورةُ اللحظة مربّعٌ مقصوصٌ بموضعها (القاعدة ٣٦٤) — **بقرار المالك**: كانت تُحفظ
 * كاملةً ويُقصّ إطارُها عند العرض، فمن فتحها رأى الصورةَ كلَّها لا ما ضبطه.
 * الضلعُ أقصرُ ضلعَي الصورة، والموضعُ نسبةُ ما يزيد منها كـ`object-position`،
 * ثمّ ١٠٨٠ على الأكثر — ٣٢٠ تُمطّ ثلاثاً في البطاقة فتُقرأ مغبّشة.
 */
export const MOMENT_SQUARE = 1080;

export async function squareCrop(input: Uint8Array, x: number, y: number): Promise<Processed> {
  const image = sharp(Buffer.from(input), { failOn: "error" }).rotate();
  const meta = await image.metadata();
  if (!meta.width || !meta.height) throw new Error("تعذّرت قراءة الصورة");
  // الدورانُ يبدّل الضلعين: الاتجاهاتُ ٥–٨ صورةٌ قائمةٌ مكتوبةٌ عرضاً.
  const turned = (meta.orientation ?? 1) >= 5;
  const width = turned ? meta.height : meta.width;
  const height = turned ? meta.width : meta.height;
  const side = Math.min(width, height);
  const left = Math.round(((width - side) * Math.min(100, Math.max(0, x))) / 100);
  const top = Math.round(((height - side) * Math.min(100, Math.max(0, y))) / 100);
  const out = await image
    .extract({ left, top, width: side, height: side })
    .resize({ width: Math.min(side, MOMENT_SQUARE), height: Math.min(side, MOMENT_SQUARE) })
    .webp({ quality: 80, effort: 5 })
    .toBuffer({ resolveWithObject: true });
  return { bytes: new Uint8Array(out.data), mime: "image/webp", width: out.info.width, height: out.info.height };
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
    // السببُ في السجلّ (القاعدة ٤٠٢): «تعذّرت قراءة المقطع» وحدها لا تقول أيّ شيءٍ وصل —
    // الحجمُ وأوّلُ البايتات وما قاله ffprobe نفسه.
    const head = Buffer.from(input.subarray(0, 16)).toString("hex");
    const said = String((problem as { stderr?: string }).stderr ?? (problem as Error).message ?? "").slice(0, 400);
    console.error(`[media] ffprobe رفض المقطع (.${extension}، ${input.length} بايت، ${head}): ${said}`);
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

/** فلترُ المقطع كما يرسمه الجوّال: مصفوفةُ ألوان ٤×٥ (الإزاحةُ ٠–١) وإعتامُ الأطراف ٠–١. */
export type VideoLook = { matrix: number[]; vignette?: number };

/** جدولُ ألوانٍ ثلاثيّ بصيغة `.cube` من مصفوفة Skia — الأحمرُ أسرعُ المحاور. */
export function cubeOf(matrix: number[], size = 33): string {
  const m = matrix;
  const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const lines = [`LUT_3D_SIZE ${size}`];
  for (let bi = 0; bi < size; bi++) {
    for (let gi = 0; gi < size; gi++) {
      for (let ri = 0; ri < size; ri++) {
        const r = ri / (size - 1);
        const g = gi / (size - 1);
        const b = bi / (size - 1);
        const ch = (row: number) => clamp(m[row * 5] * r + m[row * 5 + 1] * g + m[row * 5 + 2] * b + m[row * 5 + 3] + m[row * 5 + 4]);
        lines.push(`${ch(0).toFixed(5)} ${ch(1).toFixed(5)} ${ch(2).toFixed(5)}`);
      }
    }
  }
  return lines.join("\n") + "\n";
}

/**
 * إعتامُ الأطراف كما يرسمه Skia: تدرّجٌ دائريٌّ من الشفاف عند نصف القطر إلى أسودَ بشفافيّة `amount`
 * عند نصف القُطر — على لوحةٍ بنسبة الشاشة، ويُمدّ إلى مقاس المقطع.
 */
async function vignettePng(amount: number): Promise<Buffer> {
  const width = 360;
  const height = 780;
  const radius = Math.hypot(width, height) / 2;
  const raw = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const d = Math.hypot(x + 0.5 - width / 2, y + 0.5 - height / 2) / radius;
      const t = d <= 0.5 ? 0 : Math.min(1, (d - 0.5) / 0.5);
      raw[(y * width + x) * 4 + 3] = Math.round(255 * amount * t);
    }
  }
  return sharp(raw, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

/**
 * مقطعُ القصّة يُقصّ ويُضغط على الخادم (القاعدة ٢٤٩) — **بقرار المالك**: كان
 * يُردّ «الملف كبير» أو «أطول من ٣٠ ثانية» فلا يُنشر. الآن يُؤخذ منه
 * `length` ثانيةً من `start` الذي اختاره صاحبُه، ويُكتب H.264 بضلعٍ قصيرٍ ٧٢٠
 * وAAC — يُشغَّل على كلّ جهاز، وثلاثون ثانيةً منه دون تسعة ميغا. ويُعاد
 * ترميزُه لا يُنسخ: النسخُ يقصّ على أقرب إطارٍ مفتاحيّ فيبدأ قبل ما اختير.
 * والمقطعُ الصامت يمرّ (`0:a?`)، و`faststart` يبدأ التشغيلَ قبل التنزيل.
 */
export async function compressStoryVideo(
  input: Uint8Array,
  extension: string,
  start: number,
  length: number,
  look: VideoLook | null = null,
): Promise<{ bytes: Uint8Array; seconds: number; width: number; height: number }> {
  const folder = await mkdtemp(join(tmpdir(), "athr-"));
  const source = join(folder, `in.${extension}`);
  const out = join(folder, "out.mp4");
  try {
    await writeFile(source, input);
    const scale = "scale='if(gt(iw,ih),-2,min(720,iw))':'if(gt(iw,ih),min(720,ih),-2)',fps=30";
    /*
      الفلترُ يُطبع في المقطع (القاعدة ٤٠٧): مصفوفةُ الألوان نفسُها التي يرسمها Skia في المعاينة
      تصير جدولَ ألوانٍ ثلاثيّاً (`lut3d`) — خطّيٌّ بقصٍّ في طرفيه فيُطابقها بلا تقريبٍ يُرى —
      وإعتامُ الأطراف صورةٌ شفّافةٌ تُركَّب فوقه بمقاسه.
    */
    let graph: string[] = ["-vf", scale];
    const inputs: string[] = [];
    if (look) {
      const lut = join(folder, "look.cube");
      await writeFile(lut, cubeOf(look.matrix));
      let chain = `[0:v]${scale},lut3d=file=${lut}`;
      if (look.vignette && look.vignette > 0) {
        const vig = join(folder, "vig.png");
        await writeFile(vig, await vignettePng(look.vignette));
        inputs.push("-loop", "1", "-i", vig);
        chain += `[base];[1:v][base]scale2ref[vg][main];[main][vg]overlay=shortest=1:format=auto,format=yuv420p[v]`;
      } else {
        chain += "[v]";
      }
      graph = ["-filter_complex", chain];
    }
    await ffmpeg([
      "-ss", Math.max(0, start).toFixed(2),
      "-i", source,
      ...inputs,
      "-t", length.toFixed(2),
      "-map", look ? "[v]" : "0:v:0", "-map", "0:a?",
      ...graph,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "27",
      "-maxrate", "2200k", "-bufsize", "4400k", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "96k", "-ac", "2",
      "-movflags", "+faststart",
      out,
    ]);
    const bytes = new Uint8Array(await readFile(out));
    if (bytes.length === 0) throw new Error("مقطعٌ فارغ");
    const clip = await probeClip(bytes, "mp4");
    return { bytes, seconds: clip.seconds, width: clip.width, height: clip.height };
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

/**
 * صندوقُ `chnl` بنسخته الأولى يُطمس (القاعدة ٤٠٣): آبل ٢٦ صار يكتبه في كلّ M4A يسجّله
 * (`AVAudioRecorder`)، وffmpeg 6 لا يعرف نسختَه فيردّ الملفَّ كلَّه «error reading header» — فكانت
 * الرسالةُ الصوتيّة تُسمع في المعاينة ويردّها الخادم. والصندوقُ وصفٌ لترتيب القنوات لا يحتاجه
 * مشغّل؛ فيُبدَّل اسمُه إلى `free` بحجمه نفسه — صندوقٌ فارغ يتجاوزه كلُّ قارئ — ولا يُمسّ غيرُه.
 *
 * يُبحث داخل `moov` وحده، وبحجمٍ معقول لا يتجاوز حدوده: بايتاتُ الصوت نفسُها قد تحمل الحروف
 * الأربعة صدفةً. ويردّ `null` حين لا شيء يُبدَّل.
 */
export function scrubChnl(bytes: Uint8Array): Uint8Array | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const fourcc = (at: number) => String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
  // الصناديقُ العليا: نصل إلى `moov` بأحجامها.
  let moovStart = -1;
  let moovEnd = -1;
  for (let at = 0; at + 8 <= bytes.length; ) {
    let size = view.getUint32(at);
    if (size === 1 && at + 16 <= bytes.length) size = Number(view.getBigUint64(at + 8));
    else if (size === 0) size = bytes.length - at;
    if (size < 8) break;
    if (fourcc(at + 4) === "moov") {
      moovStart = at;
      moovEnd = Math.min(bytes.length, at + size);
      break;
    }
    at += size;
  }
  if (moovStart < 0) return null;

  let out: Uint8Array | null = null;
  for (let at = moovStart + 8; at + 8 <= moovEnd; at++) {
    if (bytes[at] !== 0x63 || fourcc(at) !== "chnl") continue; // "c"
    const box = at - 4;
    const size = view.getUint32(box);
    if (size < 12 || box + size > moovEnd) continue;
    out = out ?? Uint8Array.from(bytes);
    out.set([0x66, 0x72, 0x65, 0x65], at); // "free"
    at += size - 5;
  }
  return out;
}
