import { useAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { ensureAudioSessionActive } from '@/hooks/audio-session';

const MUSIC_SOURCE = require('../../assets/sounds/journey.mp3');

function clampVolume(volume: number) {
  return Math.max(0, Math.min(1, volume));
}

function syncBackgroundPlayer(player: AudioPlayer, enabled: boolean, volume: number) {
  player.loop = true;
  player.volume = clampVolume(volume);
  if (enabled) {
    // Native oyuncu henüz hazırlanıyorsa play isteğini hazır olana kadar korur.
    player.play();
  } else {
    player.pause();
  }
}

export function useBackgroundMusic(enabled: boolean, volume: number) {
  const player = useAudioPlayer(MUSIC_SOURCE, {
    keepAudioSessionActive: true,
    updateInterval: 1000,
  });

  useEffect(() => {
    let cancelled = false;

    const sync = () => {
      if (!enabled) {
        try {
          syncBackgroundPlayer(player, false, volume);
        } catch {
          // Arka plan müziği oyunun etkileşim akışını hiçbir zaman kesmemelidir.
        }
        return;
      }

      void ensureAudioSessionActive()
        .catch(() => undefined)
        .then(() => {
          if (cancelled) return;
          try {
            syncBackgroundPlayer(player, true, volume);
          } catch {
            // Arka plan müziği oyunun etkileşim akışını hiçbir zaman kesmemelidir.
          }
        });
    };

    sync();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [enabled, player, volume]);
}
