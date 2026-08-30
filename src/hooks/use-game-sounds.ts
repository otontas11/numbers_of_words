import { setAudioModeAsync, useAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useCallback, useEffect } from 'react';

export type GameSound = 'select' | 'success' | 'bonus' | 'shuffle' | 'levelComplete';

const PLAYER_OPTIONS = {
  keepAudioSessionActive: true,
  updateInterval: 1000,
} as const;

function replay(player: AudioPlayer) {
  // Expo Audio's SDK 57 replay flow is seek-to-start followed by play.
  void player
    .seekTo(0)
    .then(() => player.play())
    .catch(() => undefined);
}

export function useGameSounds(enabled: boolean) {
  const selectPlayer = useAudioPlayer(
    require('../../assets/sounds/select.wav'),
    PLAYER_OPTIONS,
  );
  const successPlayer = useAudioPlayer(
    require('../../assets/sounds/success.wav'),
    PLAYER_OPTIONS,
  );
  const bonusPlayer = useAudioPlayer(require('../../assets/sounds/bonus.wav'), PLAYER_OPTIONS);
  const shufflePlayer = useAudioPlayer(
    require('../../assets/sounds/shuffle.wav'),
    PLAYER_OPTIONS,
  );
  const levelCompletePlayer = useAudioPlayer(
    require('../../assets/sounds/level-complete.wav'),
    PLAYER_OPTIONS,
  );

  useEffect(() => {
    void setAudioModeAsync({
      interruptionMode: 'mixWithOthers',
      playsInSilentMode: true,
      shouldPlayInBackground: false,
    }).catch(() => undefined);
  }, []);

  return useCallback(
    (sound: GameSound, force = false) => {
      if (!enabled && !force) return;

      const player =
        sound === 'select'
          ? selectPlayer
          : sound === 'success'
            ? successPlayer
            : sound === 'bonus'
              ? bonusPlayer
              : sound === 'shuffle'
                ? shufflePlayer
                : levelCompletePlayer;

      replay(player);
    },
    [
      bonusPlayer,
      enabled,
      levelCompletePlayer,
      selectPlayer,
      shufflePlayer,
      successPlayer,
    ],
  );
}
