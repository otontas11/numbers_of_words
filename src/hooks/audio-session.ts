import {
  setAudioModeAsync,
  setIsAudioActiveAsync,
  type AudioPlayer,
} from 'expo-audio';
import { useEffect } from 'react';
import { AppState } from 'react-native';

let audioModeConfigured = false;
let audioSessionActive = false;
let activationPromise: Promise<void> | null = null;
const replayQueues = new WeakMap<AudioPlayer, Promise<void>>();

export function ensureAudioSessionActive() {
  if (audioSessionActive) return Promise.resolve();
  if (activationPromise) return activationPromise;

  activationPromise = (async () => {
    if (!audioModeConfigured) {
      await setAudioModeAsync({
        interruptionMode: 'mixWithOthers',
        playsInSilentMode: true,
        shouldPlayInBackground: false,
      });
      audioModeConfigured = true;
    }
    await setIsAudioActiveAsync(true);
    audioSessionActive = true;
  })().finally(() => {
    activationPromise = null;
  });

  return activationPromise;
}

/**
 * Kısa efekt player'ını sıfırdan yeniden başlatır.
 *
 * Her player için komutları tek kuyruğa alır. Özellikle iOS'ta seekTo
 * tamamlanmadan gönderilen play komutu eski konumda (çoğunlukla dosyanın
 * sonunda) çalışıp sessiz kalabiliyor. Bu nedenle ses oturumunu, seek'i ve
 * play'i kesin sırayla yürütür; aynı kanala hızlı çağrılar da yarışmaz.
 */
export function replayAudioPlayer(player: AudioPlayer, volume = 1) {
  const previousReplay = replayQueues.get(player) ?? Promise.resolve();
  const replay = previousReplay
    .catch(() => undefined)
    .then(async () => {
      await ensureAudioSessionActive();

      player.volume = volume;

      // Henüz kullanılmamış hazır bir kanal doğrudan başlatılabilir. Bu yol
      // dokunma ile ses arasındaki gecikmeyi sıfıra yakın tutar.
      if (!player.playing && player.currentTime <= 0.001) {
        player.play();
        return;
      }

      player.pause();
      await player.seekTo(0, 0, 0);
      player.play();
    })
    .catch(() => {
      // Ses altyapısı etkileşimi veya oyun akışını hiçbir zaman kesmemeli.
    });

  replayQueues.set(player, replay);
  void replay.finally(() => {
    if (replayQueues.get(player) === replay) replayQueues.delete(player);
  });
}

export function useAudioSessionLifecycle() {
  useEffect(() => {
    void ensureAudioSessionActive().catch(() => undefined);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void ensureAudioSessionActive().catch(() => undefined);
        return;
      }

      // iOS 'inactive' durumu (bildirim merkezi, izin pencereleri) oturumu
      // kapatmaz; yalnızca gerçek arka plana geçişte serbest bırakılır.
      if (state === 'background') {
        audioSessionActive = false;
        void setIsAudioActiveAsync(false).catch(() => undefined);
      }
    });

    return () => subscription.remove();
  }, []);
}
