# يولّد أصوات التنبيهات الثلاثة في assets/sounds (القاعدة ٢٥٣). يُشغَّل من apps/mobile: python3 scripts/notification-sounds.py
import numpy as np, wave, sys
SR = 44100
PEAK = 10 ** (-14 / 20)  # -14 dBFS: كانت -1.4

def note(freq, start, length, total):
    t = np.arange(int(length * SR)) / SR
    # جيبٌ دافئ بتوافقيّةٍ خافتة — لا مثلّثة: المثلّثةُ تحمل توافقيّاتٍ حادّة تُسمع طنيناً.
    tone = np.sin(2 * np.pi * freq * t) + 0.12 * np.sin(2 * np.pi * freq * 2 * t) * np.exp(-t * 18)
    attack = np.clip(t / 0.018, 0, 1)            # دخولٌ ١٨ مللي بلا طقّة
    decay = np.exp(-t * (4.2 / length))          # خفوتٌ أُسّيٌّ كجرسٍ خشبيّ
    out = np.zeros(total)
    i = int(start * SR)
    seg = tone * attack * decay
    out[i:i + len(seg)] += seg[: total - i]
    return out

def make(name, notes, total_s):
    total = int(total_s * SR)
    sig = sum(note(f, s, l, total) for f, s, l in notes)
    fade = np.ones(total); n = int(0.06 * SR); fade[-n:] = np.linspace(1, 0, n)
    sig = sig * fade
    sig = sig / np.max(np.abs(sig)) * PEAK
    with wave.open(f"assets/sounds/{name}", "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((sig * 32767).astype("<i2").tobytes())

# عامّ: نقرةُ ماءٍ واحدة.
make("athr_general.wav", [(784, 0, 0.42)], 0.45)
# محادثات: نغمتان صاعدتان متلاصقتان.
make("athr_dm.wav", [(659, 0, 0.30), (880, 0.09, 0.40)], 0.52)
# آثار: ثلاثُ نغماتٍ هادئة كجرسٍ صغير.
make("athr_athar.wav", [(523, 0, 0.45), (659, 0.08, 0.45), (784, 0.16, 0.55)], 0.75)
