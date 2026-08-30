import { setAudioModeAsync, useAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useCallback, useEffect } from 'react';

export type GameSound =
  | 'select1'
  | 'select2'
  | 'select3'
  | 'select4'
  | 'select5'
  | 'select6'
  | 'select7'
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

  try {
    if (player.currentTime > 0.001) {
      // Expo Go bazı native sürümlerde seek dönüşünü void olarak köprüleyebilir.
      // Promise.resolve iki davranışta da sesi başa sardıktan sonra güvenle oynatır.
      const seekResult = player.seekTo(0);
      void Promise.resolve(seekResult)
        .then(() => player.play())
        .catch(() => undefined);
      return;
    }
    player.play();
  } catch {
    // Bir efekt hatası oyunun dokunma akışını kesmemelidir.
  }
}

export function useGameSounds(enabled: boolean) {
  const selectOnePlayer = useAudioPlayer(
    require('../../assets/sounds/pop_select.wav'),
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
  const selectFourPlayer = useAudioPlayer(
    require('../../assets/sounds/select-4.wav'),
    PLAYER_OPTIONS,
  );
  const selectFivePlayer = useAudioPlayer(
    require('../../assets/sounds/select-5.wav'),
    PLAYER_OPTIONS,
  );
  const selectSixPlayer = useAudioPlayer(
    require('../../assets/sounds/select-6.wav'),
    PLAYER_OPTIONS,
  );
  const selectSevenPlayer = useAudioPlayer(
    require('../../assets/sounds/select-7.wav'),
    PLAYER_OPTIONS,
  );
  const hintPlayer = useAudioPlayer(
    require('../../assets/sounds/pop_hint.wav'),
    PLAYER_OPTIONS,
  );
  const successPlayer = useAudioPlayer(
    require('../../assets/sounds/success.wav'),
    PLAYER_OPTIONS,
  );
  const bonusPlayer = useAudioPlayer(require('../../assets/sounds/bonus.wav'), PLAYER_OPTIONS);
  const shufflePlayer = useAudioPlayer(
    require('../../assets/sounds/pop_shuffle.wav'),
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

      const selectionPlayers = [
        selectOnePlayer,
        selectTwoPlayer,
        selectThreePlayer,
        selectFourPlayer,
        selectFivePlayer,
        selectSixPlayer,
        selectSevenPlayer,
      ] as const;
      const selectionIndex = sound.startsWith('select')
        ? Number.parseInt(sound.slice('select'.length), 10) - 1
        : -1;
      const player =
        selectionIndex >= 0
          ? selectionPlayers[selectionIndex]
          : sound === 'hint'
            ? hintPlayer
            : sound === 'success'
              ? successPlayer
              : sound === 'bonus'
                ? bonusPlayer
                : shufflePlayer;

      if (!player) return;

      replay(player);
    },
    [
      bonusPlayer,
      enabled,
      hintPlayer,
      selectFivePlayer,
      selectFourPlayer,
      selectOnePlayer,
      selectSevenPlayer,
      selectSixPlayer,
      selectThreePlayer,
      selectTwoPlayer,
      shufflePlayer,
      successPlayer,
    ],
  );
}
