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
 * pause → seekTo → play komutları JS tarafında bekleme (await) olmadan
 * sıraya alınır. Eskiden aradaki asenkron boşluk, seekTo takıldığında ya
 * da hızlı tekrar basışlarda token yarışı oluştuğunda play() adımını
 * atlayarak seslerin hiç çalmamasına ya da yutulmasına yol açıyordu.
 * Native taraf komutları aynı sırada uygular; son komut üçlüsü kazanır
 * ve ses asla kaybolmaz.
 */
export function replayAudioPlayer(player: AudioPlayer, volume = 1) {
  // Oturum aktifse bu çağrı anında çözülür; değilse native aktivasyon
  // arka planda sürerken ses geciktirilmeden çalmaya başlar.
  void ensureAudioSessionActive().catch(() => undefined);

  try {
    player.volume = volume;
  } catch {
    // Player henüz hazırlanıyor olabilir.
  }

  try {
    player.pause();
  } catch {
    // Hazırlanmakta olan native player pause kabul etmeyebilir.
  }

  try {
    void player.seekTo(0).catch(() => undefined);
  } catch {
    // Yükleme sürüyorsa play() native tarafta playWhenReady durumunu kurar.
  }

  try {
    player.play();
  } catch {
    // Ses hatası uygulamanın etkileşim akışını kesmemelidir.
  }
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
