import { useAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useEffect } from 'react';

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
    try {
      syncBackgroundPlayer(player, enabled, volume);
    } catch {
      // Arka plan müziği oyunun etkileşim akışını hiçbir zaman kesmemelidir.
    }
  }, [enabled, player, volume]);
}
