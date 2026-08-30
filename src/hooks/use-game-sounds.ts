import { setAudioModeAsync, useAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useCallback, useEffect } from 'react';

export type GameSound =
  | 'select1'
  | 'select2'
  | 'select3'
  | 'hint'
  | 'success'
  | 'bonus'
  | 'shuffle'
  | 'levelComplete';

const PLAYER_OPTIONS = {
  keepAudioSessionActive: true,
  updateInterval: 1000,
} as const;

function replay(player: AudioPlayer) {
  if (!player.isLoaded) return;
  if (player.currentTime <= 0.001) {
    player.play();
    return;
  }

  // Expo Audio SDK 57'de bitmiş/kullanılmış kısa efekti baştan oynatma akışı.
  void player
    .seekTo(0, 0, 0)
    .then(() => player.play())
    .catch(() => undefined);
}

export function useGameSounds(enabled: boolean) {
  const selectOnePlayer = useAudioPlayer(
    require('../../assets/sounds/select.wav'),
    PLAYER_OPTIONS,
  );
  const selectTwoPlayer = useAudioPlayer(
    require('../../assets/sounds/select-2.wav'),
    PLAYER_OPTIONS,
  );
  const selectThreePlayer = useAudioPlayer(
    require('../../assets/sounds/select-3.wav'),
    PLAYER_OPTIONS,
  );
  const hintPlayer = useAudioPlayer(require('../../assets/sounds/hint.wav'), PLAYER_OPTIONS);
  const successPlayer = useAudioPlayer(
    require('../../assets/sounds/success.wav'),
    PLAYER_OPTIONS,
  );
  const bonusPlayer = useAudioPlayer(require('../../assets/sounds/bonus.wav'), PLAYER_OPTIONS);
  const shufflePlayer = useAudioPlayer(
    require('../../assets/sounds/shuffle.wav'),
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
      // Referans HTML finalde yalnız konfeti gösterir; ikinci bir ses katmanı çalmaz.
      if (sound === 'levelComplete') return;

      const player =
        sound === 'select1'
          ? selectOnePlayer
          : sound === 'select2'
            ? selectTwoPlayer
            : sound === 'select3'
              ? selectThreePlayer
              : sound === 'hint'
                ? hintPlayer
                : sound === 'success'
                  ? successPlayer
                  : sound === 'bonus'
                    ? bonusPlayer
                    : shufflePlayer;

      replay(player);
    },
    [
      bonusPlayer,
      enabled,
      hintPlayer,
      selectOnePlayer,
      selectThreePlayer,
      selectTwoPlayer,
      shufflePlayer,
      successPlayer,
    ],
  );
}
