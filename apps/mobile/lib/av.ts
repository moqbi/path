import {
  AudioModule,
  RecordingPresets,
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioRecorder,
  type AudioStatus,
} from "expo-audio";

/**
 * قشرةٌ بشكل `expo-av` فوق `expo-audio` (القاعدة ٣٩٨).
 *
 * `expo-av` لم يُبنَ بعد SDK 54، والصوتُ عندنا في سبعة مواضع كُتبت على شكله:
 * `Sound.createAsync` يُنتظر حتى يُحمَّل، والمواضعُ بالمللي ثانية، وحالةٌ فيها
 * `isLoaded` و`positionMillis` و`didJustFinish`. فبدل أن تُعاد كتابةُ كلّ موضع —
 * وكلٌّ منها جُرّب على جهازٍ بتوقيته — تُترجَم هنا مرّةً: الثواني إلى مللي،
 * والحدثُ إلى النداء، والإعدادُ إلى أسمائه الجديدة.
 */

export type PlaybackStatus =
  | { isLoaded: false }
  | {
      isLoaded: true;
      isPlaying: boolean;
      positionMillis: number;
      durationMillis?: number;
      didJustFinish: boolean;
    };

type Source = number | { uri: string; headers?: Record<string, string> };
type Initial = {
  shouldPlay?: boolean;
  isLooping?: boolean;
  volume?: number;
  positionMillis?: number;
  progressUpdateIntervalMillis?: number;
};

const toStatus = (status: AudioStatus): PlaybackStatus =>
  status.isLoaded
    ? {
        isLoaded: true,
        isPlaying: status.playing,
        positionMillis: Math.round(status.currentTime * 1000),
        durationMillis: status.duration ? Math.round(status.duration * 1000) : undefined,
        didJustFinish: status.didJustFinish,
      }
    : { isLoaded: false };

class Sound {
  private listener: { remove(): void } | null = null;
  private gone = false;

  constructor(private readonly player: AudioPlayer) {}

  async playAsync() {
    if (!this.gone) this.player.play();
  }

  async pauseAsync() {
    if (!this.gone) this.player.pause();
  }

  async stopAsync() {
    if (this.gone) return;
    this.player.pause();
    await this.player.seekTo(0);
  }

  async replayAsync() {
    if (this.gone) return;
    await this.player.seekTo(0);
    this.player.play();
  }

  async setPositionAsync(millis: number) {
    if (!this.gone) await this.player.seekTo(Math.max(0, millis) / 1000);
  }

  async setIsMutedAsync(muted: boolean) {
    if (!this.gone) this.player.muted = muted;
  }

  setOnPlaybackStatusUpdate(listener: ((status: PlaybackStatus) => void) | null) {
    this.listener?.remove();
    this.listener = null;
    if (!listener || this.gone) return;
    this.listener = this.player.addListener("playbackStatusUpdate", (status) => listener(toStatus(status)));
  }

  async unloadAsync() {
    if (this.gone) return;
    this.gone = true;
    this.listener?.remove();
    this.listener = null;
    try {
      this.player.pause();
    } catch {
      // مُحرَّرٌ من قبل.
    }
    this.player.remove();
  }
}

/** ينتظر التحميلَ كما كان `createAsync` — بمهلةٍ: صوتٌ لا يصل لا يحبس ما ينتظره. */
function loaded(player: AudioPlayer, ms = 10_000): Promise<void> {
  if (player.isLoaded) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    const sub = player.addListener("playbackStatusUpdate", (status) => {
      if (status.isLoaded) done();
    });
    function done() {
      clearTimeout(timer);
      sub.remove();
      resolve();
    }
  });
}

async function createAsync(
  source: Source,
  initial: Initial = {},
  onStatus?: (status: PlaybackStatus) => void,
): Promise<{ sound: Sound }> {
  const player = createAudioPlayer(source, { updateInterval: initial.progressUpdateIntervalMillis ?? 500 });
  const sound = new Sound(player);
  if (onStatus) sound.setOnPlaybackStatusUpdate(onStatus);
  if (initial.volume !== undefined) player.volume = initial.volume;
  if (initial.isLooping) player.loop = true;
  await loaded(player);
  if (initial.positionMillis) await player.seekTo(initial.positionMillis / 1000);
  if (initial.shouldPlay) player.play();
  return { sound };
}

class Recording {
  constructor(private readonly recorder: AudioRecorder) {}

  async stopAndUnloadAsync() {
    await this.recorder.stop();
  }

  getURI(): string | null {
    return this.recorder.uri;
  }

  static async createAsync(options: typeof RecordingPresets.HIGH_QUALITY): Promise<{ recording: Recording }> {
    const recorder = new AudioModule.AudioRecorder(options);
    await recorder.prepareToRecordAsync();
    recorder.record();
    return { recording: new Recording(recorder) };
  }
}

type Mode = { playsInSilentModeIOS?: boolean; allowsRecordingIOS?: boolean };

/**
 * الرسالةُ الصوتيّة كلامٌ لا موسيقى (القاعدة ٤٢١): قناةٌ واحدة بـ٦٤ كيلوبت — دقيقتا آثار+
 * نحو ميغا. `HIGH_QUALITY` كان ستيريو بأعلى جودةٍ لآبل فيتجاوز الحدَّ بعد ثلاثين ثانية.
 */
export const VOICE_PRESET: typeof RecordingPresets.HIGH_QUALITY = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 64000,
  ios: { ...RecordingPresets.HIGH_QUALITY.ios, audioQuality: 64 },
};

export const Audio = {
  Sound: { createAsync },
  Recording,
  RecordingOptionsPresets: RecordingPresets,
  requestPermissionsAsync: requestRecordingPermissionsAsync,
  setAudioModeAsync: (mode: Mode) =>
    setAudioModeAsync({
      ...(mode.playsInSilentModeIOS === undefined ? {} : { playsInSilentMode: mode.playsInSilentModeIOS }),
      ...(mode.allowsRecordingIOS === undefined ? {} : { allowsRecording: mode.allowsRecordingIOS }),
    }),
};

// الأنواعُ بأسمائها القديمة: `Audio.Sound` و`Audio.Recording` نوعان كما في `expo-av`.
export declare namespace Audio {
  type Sound = InstanceType<typeof SoundType>;
  type Recording = InstanceType<typeof Recording>;
}
const SoundType = Sound;
