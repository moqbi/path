/**
 * مؤثّرات صوتية خفيفة — نغمة واحدة قصيرة، لا ملفّات ولا تحميل.
 *
 * الصوت يُركَّب لحظةَ الحاجة عبر WebAudio: موجة جيبية تخفت في أقلّ من
 * عُشر ثانية. لا نُنشئ `AudioContext` إلا عند أوّل لمسة، فالمتصفّحات
 * تمنع الصوت قبل إيماءة المستخدم، وإنشاؤه مبكراً يتركه معلّقاً.
 *
 * وإن كان الجهاز مضبوطاً على «قلّل الحركة» سكتنا: من يطلب هدوء الحركة
 * يطلب هدوء الصوت معه.
 */

let ctx: AudioContext | null = null;

type Ctor = typeof AudioContext;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx: Ctor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
  if (!Ctx) return null;
  if (!ctx) {
    try {
      ctx = new Ctx();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function quiet(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** نغمة واحدة: تردّد، ومدّة، وحجم خافت لا يُزعج من حوله. */
function tone(hz: number, seconds: number, gain: number, at = 0): void {
  const context = audio();
  if (!context) return;

  const start = context.currentTime + at;
  const osc = context.createOscillator();
  const amp = context.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(hz, start);

  // نهوض سريع ثم خفوت أُسّي: بلا الخفوت تسمع طقّةً في نهاية الموجة.
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + seconds);

  osc.connect(amp).connect(context.destination);
  osc.start(start);
  osc.stop(start + seconds + 0.02);
}

/** إفلات السحب للتحديث: نقرة صاعدة تقول «ذهب الطلب». */
export function playRefresh(): void {
  if (quiet()) return;
  tone(660, 0.09, 0.05);
  tone(990, 0.1, 0.035, 0.06);
}

/** فتح قائمة النشر: نقرة صاعدة خفيفة مع تطاير الأيقونات. */
export function playOpen(): void {
  if (quiet()) return;
  tone(520, 0.07, 0.045);
  tone(780, 0.08, 0.03, 0.05);
}

/** إغلاقها: نفس النقرة معكوسة، فالأذن تعرف أنّ الشيء انطوى. */
export function playClose(): void {
  if (quiet()) return;
  tone(700, 0.06, 0.04);
  tone(460, 0.09, 0.03, 0.045);
}
