import { useAudioPlayer } from 'expo-audio';
import { useCallback, useRef } from 'react';

import { replayAudioPlayer } from '@/hooks/audio-session';

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
  | 'diamond'
  | 'points'
  | 'shuffle'
  | 'levelComplete';

const PLAYER_OPTIONS = {
  keepAudioSessionActive: true,
  updateInterval: 1000,
} as const;

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
  // iOS aynı kısa sesi hızlıca seek edip yeniden başlatırken aradaki çağrıyı
  // yutabiliyor. İkinci ses bankası ardışık dokunuşları ayrı native
  // oynatıcılara dağıtarak her düğüm notasının gecikmeden duyulmasını sağlar.
  const selectOneAlternatePlayer = useAudioPlayer(
    require('../../assets/sounds/select.wav'),
    PLAYER_OPTIONS,
  );
  const selectTwoAlternatePlayer = useAudioPlayer(
    require('../../assets/sounds/select-2.wav'),
    PLAYER_OPTIONS,
  );
  const selectThreeAlternatePlayer = useAudioPlayer(
    require('../../assets/sounds/select-3.wav'),
    PLAYER_OPTIONS,
  );
  const selectFourAlternatePlayer = useAudioPlayer(
    require('../../assets/sounds/select-4.wav'),
    PLAYER_OPTIONS,
  );
  const selectFiveAlternatePlayer = useAudioPlayer(
    require('../../assets/sounds/select-5.wav'),
    PLAYER_OPTIONS,
  );
  const selectSixAlternatePlayer = useAudioPlayer(
    require('../../assets/sounds/select-6.wav'),
    PLAYER_OPTIONS,
  );
  const selectSevenAlternatePlayer = useAudioPlayer(
    require('../../assets/sounds/select-7.wav'),
    PLAYER_OPTIONS,
  );
  const selectionVoiceRef = useRef(0);
  const hintPlayer = useAudioPlayer(
    require('../../assets/sounds/pop_hint.wav'),
    PLAYER_OPTIONS,
  );
  const successPlayer = useAudioPlayer(
    require('../../assets/sounds/success.wav'),
    PLAYER_OPTIONS,
  );
  const bonusPlayer = useAudioPlayer(require('../../assets/sounds/bonus.wav'), PLAYER_OPTIONS);
  const diamondPlayer = useAudioPlayer(
    require('../../assets/sounds/dimaond.mp3'),
    PLAYER_OPTIONS,
  );
  const levelCompletePlayer = useAudioPlayer(
    require('../../assets/sounds/level-complete.wav'),
    PLAYER_OPTIONS,
  );
  const pointsPlayer = useAudioPlayer(
    require('../../assets/sounds/point.mp3'),
    PLAYER_OPTIONS,
  );
  const shufflePlayer = useAudioPlayer(
    require('../../assets/sounds/pop_shuffle.wav'),
    PLAYER_OPTIONS,
  );

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
      const alternateSelectionPlayers = [
        selectOneAlternatePlayer,
        selectTwoAlternatePlayer,
        selectThreeAlternatePlayer,
        selectFourAlternatePlayer,
        selectFiveAlternatePlayer,
        selectSixAlternatePlayer,
        selectSevenAlternatePlayer,
      ] as const;
      const selectionIndex = sound.startsWith('select')
        ? Number.parseInt(sound.slice('select'.length), 10) - 1
        : -1;
      const useAlternateSelectionVoice = selectionVoiceRef.current % 2 === 1;
      if (selectionIndex >= 0) selectionVoiceRef.current += 1;
      const player =
        selectionIndex >= 0
          ? (useAlternateSelectionVoice ? alternateSelectionPlayers : selectionPlayers)[
              selectionIndex
            ]
          : sound === 'hint'
            ? hintPlayer
            : sound === 'success'
              ? successPlayer
              : sound === 'bonus'
                ? bonusPlayer
                : sound === 'diamond'
                  ? diamondPlayer
                  : sound === 'points'
                    ? pointsPlayer
                    : sound === 'levelComplete'
                      ? levelCompletePlayer
                      : shufflePlayer;

      if (!player) return;

      // Bölüm sonu konfetiyle birlikte kısa ve hafif bir kutlama sesi çal.
      replayAudioPlayer(
        player,
        sound === 'levelComplete' ? 0.35 : sound === 'points' ? 0.65 : 1,
      );
    },
    [
      bonusPlayer,
      diamondPlayer,
      enabled,
      hintPlayer,
      levelCompletePlayer,
      pointsPlayer,
      selectFivePlayer,
      selectFiveAlternatePlayer,
      selectFourPlayer,
      selectFourAlternatePlayer,
      selectOnePlayer,
      selectOneAlternatePlayer,
      selectSevenPlayer,
      selectSevenAlternatePlayer,
      selectSixPlayer,
      selectSixAlternatePlayer,
      selectThreePlayer,
      selectThreeAlternatePlayer,
      selectTwoPlayer,
      selectTwoAlternatePlayer,
      shufflePlayer,
      successPlayer,
    ],
  );
}
