import { NativeModules, Platform } from 'react-native';

type AndroidGameSoundPoolModule = {
  play: (sound: string, volume: number) => Promise<boolean> | boolean | void;
  preload?: () => Promise<boolean> | boolean | void;
};

function resolveAndroidGameSoundPool(): AndroidGameSoundPoolModule | null {
  if (Platform.OS !== 'android') return null;

  const candidate = NativeModules.AndroidGameSoundPool as
    | Partial<AndroidGameSoundPoolModule>
    | undefined;
  return typeof candidate?.play === 'function'
    ? (candidate as AndroidGameSoundPoolModule)
    : null;
}

// Native module listesi bir process boyunca değişmez. Bu değeri module-scope'ta
// sabitlemek, React render'ları arasında ses hook'unun değişmesini engeller.
const androidGameSoundPool = resolveAndroidGameSoundPool();

export const hasAndroidGameSoundPool = androidGameSoundPool !== null;

if (androidGameSoundPool?.preload) {
  try {
    void Promise.resolve(androidGameSoundPool.preload()).catch(() => undefined);
  } catch {
    // Uygulama akışı native ses hazırlığındaki bir hatadan etkilenmemeli.
  }
}

export function playAndroidGameSound(sound: string, volume: number) {
  if (!androidGameSoundPool) return undefined;

  try {
    const playback = androidGameSoundPool.play(sound, volume);
    return Promise.resolve(playback).then(
      () => undefined,
      () => undefined,
    );
  } catch {
    // Native ses hatası dokunma/oyun akışını hiçbir zaman kesmemeli.
    return Promise.resolve();
  }
}
