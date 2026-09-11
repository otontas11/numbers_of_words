import { useAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { ensureAudioSessionActive } from '@/hooks/audio-session';

const MUSIC_SOURCE = require('../../assets/sounds/journey.mp3');
const MUSIC_FADE_MS = 320;
const MUSIC_FADE_TICK_MS = 32;
const MUSIC_DUCK_MULTIPLIER = 0.4;
const VOLUME_SNAP = 0.008;

function clampVolume(volume: number) {
  return Math.max(0, Math.min(1, volume));
}

function readPlayerVolume(player: AudioPlayer) {
  try {
    return clampVolume(player.volume);
  } catch {
    return 0;
  }
}

function writePlayerVolume(player: AudioPlayer, volume: number) {
  try {
    player.volume = clampVolume(volume);
  } catch {
    // Arka plan müziği oyunun etkileşim akışını hiçbir zaman kesmemelidir.
  }
}

function pausePlayer(player: AudioPlayer) {
  try {
    player.pause();
  } catch {
    // Arka plan müziği oyunun etkileşim akışını hiçbir zaman kesmemelidir.
  }
}

function playPlayer(player: AudioPlayer) {
  try {
    player.loop = true;
    player.play();
  } catch {
    // Native oyuncu henüz hazırlanıyorsa play isteğini hazır olana kadar korur.
  }
}

export function useBackgroundMusic(
  enabled: boolean,
  volume: number,
  ducked = false,
) {
  const player = useAudioPlayer(MUSIC_SOURCE, {
    keepAudioSessionActive: true,
    updateInterval: 1000,
  });
  const fadeGeneration = useRef(0);
  const fadeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const audibleRef = useRef(false);
  const desiredRef = useRef({ ducked, enabled, volume });
  desiredRef.current = { ducked, enabled, volume };

  useEffect(() => {
    const stopFade = () => {
      if (fadeTimer.current === null) return;
      clearInterval(fadeTimer.current);
      fadeTimer.current = null;
    };

    const fadeTo = (target: number, onComplete?: () => void) => {
      const generation = fadeGeneration.current + 1;
      fadeGeneration.current = generation;
      stopFade();

      const destination = clampVolume(target);
      const startVolume = readPlayerVolume(player);
      if (Math.abs(startVolume - destination) <= VOLUME_SNAP) {
        writePlayerVolume(player, destination);
        onComplete?.();
        return;
      }

      const startedAt = Date.now();
      fadeTimer.current = setInterval(() => {
        if (generation !== fadeGeneration.current) return;
        const progress = Math.min(1, (Date.now() - startedAt) / MUSIC_FADE_MS);
        writePlayerVolume(
          player,
          startVolume + (destination - startVolume) * progress,
        );
        if (progress < 1) return;
        stopFade();
        writePlayerVolume(player, destination);
        onComplete?.();
      }, MUSIC_FADE_TICK_MS);
    };

    const shouldPlayFor = (appState: AppStateStatus) =>
      desiredRef.current.enabled && appState === 'active';

    const targetVolumeFor = (appState: AppStateStatus) => {
      if (!shouldPlayFor(appState)) return 0;
      const { ducked: isDucked, volume: userVolume } = desiredRef.current;
      return clampVolume(userVolume * (isDucked ? MUSIC_DUCK_MULTIPLIER : 1));
    };

    const sync = (appState: AppStateStatus) => {
      if (!shouldPlayFor(appState)) {
        fadeTo(0, () => {
          if (shouldPlayFor(AppState.currentState)) return;
          audibleRef.current = false;
          pausePlayer(player);
        });
        return;
      }

      void ensureAudioSessionActive()
        .catch(() => undefined)
        .then(() => {
          if (!shouldPlayFor(AppState.currentState)) return;
          const targetVolume = targetVolumeFor(AppState.currentState);
          if (audibleRef.current) {
            playPlayer(player);
            fadeTo(targetVolume);
            return;
          }
          writePlayerVolume(player, 0);
          playPlayer(player);
          audibleRef.current = true;
          fadeTo(targetVolume);
        });
    };

    sync(AppState.currentState);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' || state === 'background') {
        sync(state);
      }
    });

    return () => {
      fadeGeneration.current += 1;
      subscription.remove();
      stopFade();
    };
  }, [ducked, enabled, player, volume]);
}
