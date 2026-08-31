import {
  setAudioModeAsync,
  setIsAudioActiveAsync,
  useAudioPlayer,
  type AudioPlayer,
} from 'expo-audio';
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

function replay(player: AudioPlayer, volume = 1) {
  try {
    // `AudioPlayer.isLoaded` Android'de yalnız STATE_READY için true döner.
    // Kısa bir efekt bittiğinde ExoPlayer STATE_ENDED durumuna geçer; eski
    // erken dönüş bu yüzden aynı sesi sonraki seçimlerde tamamen susturuyordu.
    // `play()` yükleme sürerken playWhenReady davranışı gösterdiğinden burada
    // hazır olmayan ilk dokunuşu da düşürmemeliyiz.
    player.volume = volume;
    if (player.currentTime > 0.001) {
      const seekResult = player.seekTo(0);
      void Promise.resolve(seekResult)
        .then(() => player.play())
        .catch(() => {
          // Seek köprüsü hata verse bile bir sonraki native play denemesini yap.
          try {
            player.play();
          } catch {
            // Bir efekt hatası oyunun dokunma akışını kesmemelidir.
          }
        });
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
  const levelCompletePlayer = useAudioPlayer(
    require('../../assets/sounds/level-complete.wav'),
    PLAYER_OPTIONS,
  );
  const shufflePlayer = useAudioPlayer(
    require('../../assets/sounds/pop_shuffle.wav'),
    PLAYER_OPTIONS,
  );

  useEffect(() => {
    void (async () => {
      await setAudioModeAsync({
        interruptionMode: 'mixWithOthers',
        playsInSilentMode: true,
        shouldPlayInBackground: false,
      });
      // Fast Refresh veya native lifecycle sonrasında kapanmış olabilecek ses
      // oturumunu oyun tekrar öne geldiğinde kesin olarak etkinleştir.
      await setIsAudioActiveAsync(true);
    })().catch(() => undefined);
  }, []);

  return useCallback(
    (sound: GameSound, force = false) => {
      if (!enabled && !force) return;

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
                : sound === 'levelComplete'
                  ? levelCompletePlayer
                  : shufflePlayer;

      if (!player) return;

      // Bölüm sonu konfetiyle birlikte kısa ve hafif bir kutlama sesi çal.
      replay(player, sound === 'levelComplete' ? 0.35 : 1);
    },
    [
      bonusPlayer,
      enabled,
      hintPlayer,
      levelCompletePlayer,
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
