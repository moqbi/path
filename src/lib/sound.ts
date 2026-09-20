/**
 * مؤثّرات صوتية خفيفة — نغمة واحدة قصيرة، لا ملفّات ولا تحميل.
 *
 * الصوت يُركَّب لحظةَ الحاجة عبر WebAudio. لا نُنشئ `AudioContext` إلا
 * عند أوّل لمسة، فالمتصفّحات تمنع الصوت قبل إيماءة المستخدم، وإنشاؤه
 * مبكراً يتركه معلّقاً.
 *
 * وإن كان الجهاز مضبوطاً على «قلّل الحركة» سكتنا: من يطلب هدوء الحركة
 * يطلب هدوء الصوت معه.
 *
 * **والنغمة انزلاقٌ لا نقرتان**: كانت نقرتين منفصلتين بموجةٍ جيبية —
 * تُسمعان «بيب بيب» كمنبّه ساعةٍ رخيصة. صارت نغمةً واحدة تنزلق بين
 * ترددين بموجةٍ مثلّثة: أنعم، وأقصر، وتُقرأ حركةً لا تنبيهاً.
 *
 * **ولا يتداخل صوتان**: صوتٌ جديد يُسكت ما قبله (`hush`) قبل أن يبدأ.
 * وكلُّ صوتٍ يُسجّل عُقَده، فضغطتان متتاليتان على الزرّ نفسه لا
 * تُراكِمان موجتين تُسمعان ضجيجاً — وهذا ما كان يحدث مع السحب
 * للتحديث: الإفلات يُطلق نغمةً والزرّ يُطلق أخرى فوقها.
 */

let ctx: AudioContext | null = null;

type Ctor = typeof AudioContext;

/** ما يُصدر صوتاً الآن — يُسكَت قبل أيّ صوتٍ جديد. */
let live: { osc: OscillatorNode; amp: GainNode }[] = [];

/** آخر لحظة بدأ فيها صوت: ما دونها ضغطتان في وميضٍ واحد. */
let last = 0;
const GAP = 60;

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

/**
 * يُسكت ما يُسمع الآن.
 *
 * والإسكات خفوتٌ في عشرة أجزاء من الألف لا إيقافٌ فوريّ: قطعُ الموجة
 * في منتصفها يُسمع طقّةً أوضح من النغمة نفسها.
 */
function hush(context: AudioContext): void {
  const now = context.currentTime;
  for (const node of live) {
    try {
      node.amp.gain.cancelScheduledValues(now);
      node.amp.gain.setValueAtTime(Math.max(0.0001, node.amp.gain.value), now);
      node.amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.01);
      node.osc.stop(now + 0.03);
    } catch {
      // عُقدةٌ انتهت من نفسها — لا شيء يُسكَت.
    }
  }
  live = [];
}

/** نغمةٌ تنزلق من تردّدٍ إلى تردّد، بحجمٍ خافت لا يُزعج من حول صاحبه. */
function slide(from: number, to: number, seconds: number, gain: number): void {
  const context = audio();
  if (!context) return;

  hush(context);

  const start = context.currentTime;
  const osc = context.createOscillator();
  const amp = context.createGain();

  // المثلّثة أنعم من الجيبية المجرّدة وأقلّ حدّةً من المربّعة.
  osc.type = "triangle";
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(to, start + seconds * 0.8);

  // نهوض سريع ثم خفوت أُسّي: بلا الخفوت تُسمع طقّةٌ في نهاية الموجة.
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + seconds);

  osc.connect(amp).connect(context.destination);
  osc.start(start);
  osc.stop(start + seconds + 0.02);

  live = [{ osc, amp }];
  osc.onended = () => {
    live = live.filter((node) => node.osc !== osc);
  };
}

/** يمنع ضغطتين في وميضٍ واحد من أن تُسمعا صوتين. */
function soon(): boolean {
  const now = Date.now();
  if (now - last < GAP) return true;
  last = now;
  return false;
}

/**
 * التحديث: انزلاقٌ صاعد قصير يقول «ذهب الطلب».
 *
 * ويُسمع من البابين معاً — زرّ التحديث وإفلاتِ السحب — فالفعل واحد
 * وإن اختلفت اليد.
 */
export function playRefresh(): void {
  if (quiet() || soon()) return;
  slide(430, 880, 0.16, 0.05);
}

/** فتح قوس النشر: انزلاقٌ صاعد أنعم وأقصر. */
export function playOpen(): void {
  if (quiet() || soon()) return;
  slide(360, 620, 0.12, 0.045);
}

/** إغلاقه: النغمة نفسها منزلقةً إلى أسفل، فالأذن تعرف أنّ الشيء انطوى. */
export function playClose(): void {
  if (quiet() || soon()) return;
  slide(620, 340, 0.12, 0.04);
}
