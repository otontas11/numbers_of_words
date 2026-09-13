import { useAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { ensureAudioSessionActive } from '@/hooks/audio-session';

const MUSIC_SOURCE = require('../../assets/sounds/bgm-loop.mp3');
const MUSIC_FADE_MS = 320;
const MUSIC_FADE_TICK_MS = 32;
const MUSIC_DUCK_MULTIPLIER = 0.4;
const MUSIC_BED_GAIN = 0.64;
const VOLUME_SNAP = 0.008;
const LOOP_CROSSFADE_MS = 1600;
const LOOP_CROSSFADE_MIN_MS = 240;
const LOOP_POLL_MS = 80;
const POSITION_SNAP_S = 0.004;
const MIN_LOOP_DURATION_S = 8;
const PLAYER_OPTIONS = {
  keepAudioSessionActive: true,
  updateInterval: LOOP_POLL_MS,
} as const;

function clampVolume(volume: number) {
  return Math.max(0, Math.min(1, volume));
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
    player.loop = false;
    player.play();
  } catch {
    // Native oyuncu henüz hazırlanıyorsa play isteğini hazır olana kadar korur.
  }
}

function readDuration(player: AudioPlayer) {
  try {
    const duration = player.duration;
    return Number.isFinite(duration) && duration > 0 ? duration : 0;
  } catch {
    return 0;
  }
}

function readCurrentTime(player: AudioPlayer) {
  try {
    const currentTime = player.currentTime;
    return Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0;
  } catch {
    return 0;
  }
}

async function armPlayerAtStart(player: AudioPlayer) {
  try {
    player.loop = false;
    player.pause();
    if (Math.abs(readCurrentTime(player)) > POSITION_SNAP_S) {
      await player.seekTo(0, 0, 0);
    }
    writePlayerVolume(player, 0);
  } catch {
    // Seek başarısız olsa bile play denenecek.
  }
}

function equalPowerGains(progress: number) {
  const t = clampVolume(progress);
  const halfPi = Math.PI * 0.5;
  return {
    incoming: Math.sin(t * halfPi),
    outgoing: Math.cos(t * halfPi),
  };
}

export function useBackgroundMusic(
  enabled: boolean,
  volume: number,
  ducked = false,
) {
  const playerA = useAudioPlayer(MUSIC_SOURCE, PLAYER_OPTIONS);
  const playerB = useAudioPlayer(MUSIC_SOURCE, PLAYER_OPTIONS);
  const fadeGeneration = useRef(0);
  const fadeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const crossfadeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const audibleRef = useRef(false);
  const bedVolumeRef = useRef(0);
  const loopGainRef = useRef<[number, number]>([1, 0]);
  const activeIndexRef = useRef(0);
  const incomingIndexRef = useRef(1);
  const crossfadingRef = useRef(false);
  const playersRef = useRef<[AudioPlayer, AudioPlayer]>([playerA, playerB]);
  playersRef.current = [playerA, playerB];
  const desiredRef = useRef({ ducked, enabled, volume });
  desiredRef.current = { ducked, enabled, volume };

  const applyMix = useRef(() => {
    const bed = bedVolumeRef.current;
    const [gainA, gainB] = loopGainRef.current;
    writePlayerVolume(playersRef.current[0], bed * gainA);
    writePlayerVolume(playersRef.current[1], bed * gainB);
  }).current;

  useEffect(() => {
    const stopCrossfade = () => {
      if (crossfadeTimer.current === null) return;
      clearInterval(crossfadeTimer.current);
      crossfadeTimer.current = null;
    };

    const finishCrossfade = (from: number, to: number) => {
      stopCrossfade();
      loopGainRef.current = to === 1 ? [0, 1] : [1, 0];
      activeIndexRef.current = to;
      crossfadingRef.current = false;
      applyMix();
      pausePlayer(playersRef.current[from]);
      void armPlayerAtStart(playersRef.current[from]);
    };

    const startLoopCrossfade = (durationMs: number) => {
      if (crossfadingRef.current || !audibleRef.current) return;
      const from = activeIndexRef.current;
      const to = from === 0 ? 1 : 0;
      const incoming = playersRef.current[to];
      const fadeMs = Math.max(
        LOOP_CROSSFADE_MIN_MS,
        Math.min(LOOP_CROSSFADE_MS, durationMs),
      );
      crossfadingRef.current = true;
      incomingIndexRef.current = to;
      let alreadyArmed = false;
      try {
        alreadyArmed =
          !incoming.playing &&
          Math.abs(readCurrentTime(incoming)) <= POSITION_SNAP_S;
      } catch {
        alreadyArmed = false;
      }
      if (alreadyArmed) {
        playPlayer(incoming);
      } else {
        void armPlayerAtStart(incoming).then(() => {
          if (!audibleRef.current || !crossfadingRef.current) return;
          playPlayer(incoming);
        });
      }

      const startedAt = Date.now();
      stopCrossfade();
      crossfadeTimer.current = setInterval(() => {
        const progress = Math.min(1, (Date.now() - startedAt) / fadeMs);
        const { incoming: incomingGain, outgoing: outgoingGain } =
          equalPowerGains(progress);
        loopGainRef.current =
          from === 0
            ? [outgoingGain, incomingGain]
            : [incomingGain, outgoingGain];
        applyMix();
        if (progress < 1) return;
        finishCrossfade(from, to);
      }, MUSIC_FADE_TICK_MS);
    };

    const maybeStartCrossfade = (player: AudioPlayer, didJustFinish = false) => {
      if (!audibleRef.current || crossfadingRef.current) return;
      if (didJustFinish) {
        startLoopCrossfade(LOOP_CROSSFADE_MIN_MS);
        return;
      }
      const duration = readDuration(player);
      if (duration < MIN_LOOP_DURATION_S) return;
      const remainingMs = (duration - readCurrentTime(player)) * 1000;
      if (remainingMs > LOOP_CROSSFADE_MS || remainingMs < -250) return;
      startLoopCrossfade(Math.max(LOOP_CROSSFADE_MIN_MS, remainingMs));
    };

    const subscriptions = [playerA, playerB].map((player, index) =>
      player.addListener('playbackStatusUpdate', (status) => {
        if (index !== activeIndexRef.current) return;
        maybeStartCrossfade(player, Boolean(status.didJustFinish));
      }),
    );

    const poll = setInterval(() => {
      maybeStartCrossfade(playersRef.current[activeIndexRef.current]);
    }, LOOP_POLL_MS);

    void armPlayerAtStart(playerB);

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
      clearInterval(poll);
      stopCrossfade();
      crossfadingRef.current = false;
    };
  }, [applyMix, playerA, playerB]);

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
      const startVolume = bedVolumeRef.current;
      if (Math.abs(startVolume - destination) <= VOLUME_SNAP) {
        bedVolumeRef.current = destination;
        applyMix();
        onComplete?.();
        return;
      }

      const startedAt = Date.now();
      fadeTimer.current = setInterval(() => {
        if (generation !== fadeGeneration.current) return;
        const progress = Math.min(1, (Date.now() - startedAt) / MUSIC_FADE_MS);
        bedVolumeRef.current =
          startVolume + (destination - startVolume) * progress;
        applyMix();
        if (progress < 1) return;
        stopFade();
        bedVolumeRef.current = destination;
        applyMix();
        onComplete?.();
      }, MUSIC_FADE_TICK_MS);
    };

    const shouldPlayFor = (appState: AppStateStatus) =>
      desiredRef.current.enabled && appState === 'active';

    const targetVolumeFor = (appState: AppStateStatus) => {
      if (!shouldPlayFor(appState)) return 0;
      const { ducked: isDucked, volume: userVolume } = desiredRef.current;
      return clampVolume(
        userVolume * MUSIC_BED_GAIN * (isDucked ? MUSIC_DUCK_MULTIPLIER : 1),
      );
    };

    const playAudiblePlayers = () => {
      const gains = loopGainRef.current;
      playersRef.current.forEach((player, index) => {
        const isIncoming =
          crossfadingRef.current && index === incomingIndexRef.current;
        if (gains[index] > VOLUME_SNAP || isIncoming) {
          playPlayer(player);
        }
      });
    };

    const pauseAllPlayers = () => {
      playersRef.current.forEach(pausePlayer);
    };

    const sync = (appState: AppStateStatus) => {
      if (!shouldPlayFor(appState)) {
        fadeTo(0, () => {
          if (shouldPlayFor(AppState.currentState)) return;
          audibleRef.current = false;
          pauseAllPlayers();
        });
        return;
      }

      void ensureAudioSessionActive()
        .catch(() => undefined)
        .then(() => {
          if (!shouldPlayFor(AppState.currentState)) return;
          const targetVolume = targetVolumeFor(AppState.currentState);
          if (audibleRef.current) {
            playAudiblePlayers();
            fadeTo(targetVolume);
            return;
          }
          bedVolumeRef.current = 0;
          applyMix();
          playAudiblePlayers();
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
  }, [applyMix, ducked, enabled, playerA, playerB, volume]);
}
