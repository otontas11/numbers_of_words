import { preload, useAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import {
  hasAndroidGameSoundPool,
  playAndroidGameSound,
} from '@/hooks/android-game-sound-pool';
import {
  getAudioPlayerPlaybackRun,
  isAudioPlayerIdle,
  isAudioPlayerReady,
  prepareAudioPlayer,
  rearmAudioPlayer,
  replayAudioPlayer,
} from '@/hooks/audio-session';

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
  updateInterval: 100,
} as const;

const ANDROID_PLAYER_OPTIONS = {
  keepAudioSessionActive: true,
  updateInterval: 25,
} as const;

const SELECT_SOURCES = [
  require('../../assets/sounds/select.wav'),
  require('../../assets/sounds/select-2.wav'),
  require('../../assets/sounds/select-3.wav'),
  require('../../assets/sounds/select-4.wav'),
  require('../../assets/sounds/select-5.wav'),
  require('../../assets/sounds/select-6.wav'),
  require('../../assets/sounds/select-7.wav'),
] as const;
const HINT_SOURCE = require('../../assets/sounds/hint.mp3');
const SUCCESS_SOURCE = require('../../assets/sounds/success.wav');
const BONUS_SOURCE = require('../../assets/sounds/bonus.wav');
const DIAMOND_SOURCE = require('../../assets/sounds/dimaond.mp3');
const GAME_TREASURE_SOURCE = require('../../assets/sounds/game-treasure.wav');
const SHUFFLE_SOURCE = require('../../assets/sounds/bubble_x.mp3');
const HINT_START_TIME = 0.056;
const SHUFFLE_START_TIME = 0.049;

// Expo Audio'nun kendi preload önbelleği, tüm oyun ve eğitim efektlerini
// component render edilmeden önce native decoder'a hazırlar.
if (!hasAndroidGameSoundPool) {
  void Promise.all(
    [...SELECT_SOURCES, HINT_SOURCE, SUCCESS_SOURCE, BONUS_SOURCE, DIAMOND_SOURCE,
      GAME_TREASURE_SOURCE, SHUFFLE_SOURCE].map((source) => preload(source)),
  ).catch(() => undefined);
}

const SOUND_VOLUMES: Partial<Record<GameSound, number>> = {
  bonus: 0.55,
  diamond: 0.30,
  levelComplete: 0.35,
  points: 0.42,
};

function chooseVoice(
  players: readonly AudioPlayer[],
  preferredIndex: number,
  startTime = 0,
) {
  const ordered = players.map(
    (_, offset) => players[(preferredIndex + offset) % players.length],
  );
  if (Platform.OS !== 'android') return ordered[0];
  return (
    ordered.find((player) => isAudioPlayerReady(player, startTime)) ??
    ordered.find(isAudioPlayerIdle) ??
    ordered[0]
  );
}

function subscribeAndroidPlayerBank(
  channels: readonly { player: AudioPlayer; startTime: number }[],
) {
  const subscriptions = channels.map(({ player, startTime }) => {
    let loaded = player.isLoaded;
    let observedPlaybackRun = 0;
    let lastRearmedPlaybackRun = 0;
    if (player.isLoaded) void prepareAudioPlayer(player, startTime);

    return player.addListener('playbackStatusUpdate', (status) => {
      const justLoaded = status.isLoaded && !loaded;
      loaded = status.isLoaded;
      if (justLoaded) void prepareAudioPlayer(player, startTime);

      if (status.playing) {
        observedPlaybackRun = getAudioPlayerPlaybackRun(player);
      }
      if (!status.didJustFinish) return;

      const finishedPlaybackRun = Math.max(
        observedPlaybackRun,
        getAudioPlayerPlaybackRun(player),
      );
      if (
        finishedPlaybackRun <= 0 ||
        finishedPlaybackRun <= lastRearmedPlaybackRun
      ) {
        return;
      }

      void rearmAudioPlayer(player, startTime, finishedPlaybackRun).then((rearmed) => {
        if (rearmed) {
          lastRearmedPlaybackRun = Math.max(
            lastRearmedPlaybackRun,
            finishedPlaybackRun,
          );
        }
      });
    });
  });

  return () => subscriptions.forEach((subscription) => subscription.remove());
}

function useIosGameSounds(enabled: boolean) {
  const selectOnePlayer = useAudioPlayer(
    SELECT_SOURCES[0],
    PLAYER_OPTIONS,
  );
  const selectTwoPlayer = useAudioPlayer(
    SELECT_SOURCES[1],
    PLAYER_OPTIONS,
  );
  const selectThreePlayer = useAudioPlayer(
    SELECT_SOURCES[2],
    PLAYER_OPTIONS,
  );
  const selectFourPlayer = useAudioPlayer(
    SELECT_SOURCES[3],
    PLAYER_OPTIONS,
  );
  const selectFivePlayer = useAudioPlayer(
    SELECT_SOURCES[4],
    PLAYER_OPTIONS,
  );
  const selectSixPlayer = useAudioPlayer(
    SELECT_SOURCES[5],
    PLAYER_OPTIONS,
  );
  const selectSevenPlayer = useAudioPlayer(
    SELECT_SOURCES[6],
    PLAYER_OPTIONS,
  );
  // iOS aynı kısa sesi hızlıca seek edip yeniden başlatırken aradaki çağrıyı
  // yutabiliyor. İkinci ses bankası ardışık dokunuşları ayrı native
  // oynatıcılara dağıtarak her düğüm notasının gecikmeden duyulmasını sağlar.
  const selectOneAlternatePlayer = useAudioPlayer(
    SELECT_SOURCES[0],
    PLAYER_OPTIONS,
  );
  const selectTwoAlternatePlayer = useAudioPlayer(
    SELECT_SOURCES[1],
    PLAYER_OPTIONS,
  );
  const selectThreeAlternatePlayer = useAudioPlayer(
    SELECT_SOURCES[2],
    PLAYER_OPTIONS,
  );
  const selectFourAlternatePlayer = useAudioPlayer(
    SELECT_SOURCES[3],
    PLAYER_OPTIONS,
  );
  const selectFiveAlternatePlayer = useAudioPlayer(
    SELECT_SOURCES[4],
    PLAYER_OPTIONS,
  );
  const selectSixAlternatePlayer = useAudioPlayer(
    SELECT_SOURCES[5],
    PLAYER_OPTIONS,
  );
  const selectSevenAlternatePlayer = useAudioPlayer(
    SELECT_SOURCES[6],
    PLAYER_OPTIONS,
  );
  const selectionVoiceRef = useRef(Array.from({ length: 7 }, () => 0));
  const hintPlayer = useAudioPlayer(
    HINT_SOURCE,
    PLAYER_OPTIONS,
  );
  const hintAlternatePlayer = useAudioPlayer(
    HINT_SOURCE,
    PLAYER_OPTIONS,
  );
  const hintThirdPlayer = useAudioPlayer(
    HINT_SOURCE,
    PLAYER_OPTIONS,
  );
  const hintVoiceRef = useRef(0);
  const successPlayer = useAudioPlayer(
    SUCCESS_SOURCE,
    PLAYER_OPTIONS,
  );
  const successAlternatePlayer = useAudioPlayer(
    SUCCESS_SOURCE,
    PLAYER_OPTIONS,
  );
  const successVoiceRef = useRef(0);
  const bonusPlayer = useAudioPlayer(BONUS_SOURCE, PLAYER_OPTIONS);
  const diamondPlayer = useAudioPlayer(
    DIAMOND_SOURCE,
    PLAYER_OPTIONS,
  );
  const levelCompletePlayer = useAudioPlayer(
    GAME_TREASURE_SOURCE,
    PLAYER_OPTIONS,
  );
  const pointsPlayer = useAudioPlayer(
    GAME_TREASURE_SOURCE,
    PLAYER_OPTIONS,
  );
  const shufflePlayer = useAudioPlayer(
    SHUFFLE_SOURCE,
    PLAYER_OPTIONS,
  );
  const shuffleAlternatePlayer = useAudioPlayer(
    SHUFFLE_SOURCE,
    PLAYER_OPTIONS,
  );
  const shuffleThirdPlayer = useAudioPlayer(
    SHUFFLE_SOURCE,
    PLAYER_OPTIONS,
  );
  const shuffleVoiceRef = useRef(0);

  useEffect(() => {
    const channels = [
      { player: selectOnePlayer, startTime: 0 },
      { player: selectTwoPlayer, startTime: 0 },
      { player: selectThreePlayer, startTime: 0 },
      { player: selectFourPlayer, startTime: 0 },
      { player: selectFivePlayer, startTime: 0 },
      { player: selectSixPlayer, startTime: 0 },
      { player: selectSevenPlayer, startTime: 0 },
      { player: selectOneAlternatePlayer, startTime: 0 },
      { player: selectTwoAlternatePlayer, startTime: 0 },
      { player: selectThreeAlternatePlayer, startTime: 0 },
      { player: selectFourAlternatePlayer, startTime: 0 },
      { player: selectFiveAlternatePlayer, startTime: 0 },
      { player: selectSixAlternatePlayer, startTime: 0 },
      { player: selectSevenAlternatePlayer, startTime: 0 },
      { player: hintPlayer, startTime: HINT_START_TIME },
      { player: hintAlternatePlayer, startTime: HINT_START_TIME },
      { player: hintThirdPlayer, startTime: HINT_START_TIME },
      { player: successPlayer, startTime: 0 },
      { player: successAlternatePlayer, startTime: 0 },
      { player: bonusPlayer, startTime: 0 },
      { player: diamondPlayer, startTime: 0 },
      { player: levelCompletePlayer, startTime: 0 },
      { player: pointsPlayer, startTime: 0 },
      { player: shufflePlayer, startTime: SHUFFLE_START_TIME },
      { player: shuffleAlternatePlayer, startTime: SHUFFLE_START_TIME },
      { player: shuffleThirdPlayer, startTime: SHUFFLE_START_TIME },
    ] as const;

    // Yalnızca henüz kullanılmamış kanalları source yüklenir yüklenmez
    // hazırla. replay isteği senkron işaretlendiği için geç gelen load
    // olayı artık ilk sesi durduramaz.
    const subscriptions = channels.map(({ player, startTime }) => {
      let loaded = player.isLoaded;
      let finishHandled = false;
      let observedPlaybackRun = 0;
      let lastRearmedPlaybackRun = 0;
      if (player.isLoaded) void prepareAudioPlayer(player, startTime);
      return player.addListener('playbackStatusUpdate', (status) => {
        const justLoaded = status.isLoaded && !loaded;
        loaded = status.isLoaded;
        if (justLoaded) void prepareAudioPlayer(player, startTime);

        if (Platform.OS !== 'android') {
          if (status.didJustFinish && !finishHandled) {
            finishHandled = true;
            void rearmAudioPlayer(player, startTime);
          } else if (!status.didJustFinish) {
            finishHandled = false;
          }
          return;
        }

        if (status.playing) {
          observedPlaybackRun = getAudioPlayerPlaybackRun(player);
        }
        if (!status.didJustFinish) return;

        // didJustFinish bazı cihazlarda aynı run için tekrarlanır. Run kimliği
        // hem tekrarları idempotent yapar hem geç gelen eski finish'in yeni
        // playback'i başa sarmasını engeller.
        const finishedPlaybackRun = Math.max(
          observedPlaybackRun,
          getAudioPlayerPlaybackRun(player),
        );
        if (
          finishedPlaybackRun <= 0 ||
          finishedPlaybackRun <= lastRearmedPlaybackRun
        ) {
          return;
        }
        void rearmAudioPlayer(player, startTime, finishedPlaybackRun).then((rearmed) => {
          if (rearmed) {
            lastRearmedPlaybackRun = Math.max(
              lastRearmedPlaybackRun,
              finishedPlaybackRun,
            );
          }
        });
      });
    });

    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [
    bonusPlayer,
    diamondPlayer,
    hintAlternatePlayer,
    hintPlayer,
    hintThirdPlayer,
    levelCompletePlayer,
    pointsPlayer,
    selectFiveAlternatePlayer,
    selectFivePlayer,
    selectFourAlternatePlayer,
    selectFourPlayer,
    selectOneAlternatePlayer,
    selectOnePlayer,
    selectSevenAlternatePlayer,
    selectSevenPlayer,
    selectSixAlternatePlayer,
    selectSixPlayer,
    selectThreeAlternatePlayer,
    selectThreePlayer,
    selectTwoAlternatePlayer,
    selectTwoPlayer,
    shuffleAlternatePlayer,
    shufflePlayer,
    shuffleThirdPlayer,
    successAlternatePlayer,
    successPlayer,
  ]);

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
      const selectionVoice =
        selectionIndex >= 0
          ? (selectionVoiceRef.current[selectionIndex] ?? 0) % 2
          : 0;
      if (selectionIndex >= 0) {
        selectionVoiceRef.current[selectionIndex] =
          (selectionVoiceRef.current[selectionIndex] ?? 0) + 1;
      }
      const shuffleVoice = shuffleVoiceRef.current % 3;
      if (sound === 'shuffle') shuffleVoiceRef.current += 1;
      const hintVoice = hintVoiceRef.current % 3;
      if (sound === 'hint') hintVoiceRef.current += 1;
      const successVoice =
        Platform.OS === 'android' ? successVoiceRef.current % 2 : 0;
      if (sound === 'success' && Platform.OS === 'android') {
        successVoiceRef.current += 1;
      }
      const player =
        selectionIndex >= 0
          ? chooseVoice(
              [selectionPlayers[selectionIndex], alternateSelectionPlayers[selectionIndex]],
              selectionVoice,
            )
          : sound === 'hint'
            ? chooseVoice(
                [hintPlayer, hintAlternatePlayer, hintThirdPlayer],
                hintVoice,
                HINT_START_TIME,
              )
            : sound === 'success'
              ? chooseVoice(
                  [successPlayer, successAlternatePlayer],
                  successVoice,
                )
              : sound === 'bonus'
                ? bonusPlayer
                : sound === 'diamond'
                  ? diamondPlayer
                  : sound === 'points'
                    ? pointsPlayer
                    : sound === 'levelComplete'
                      ? levelCompletePlayer
                      : chooseVoice(
                          [shufflePlayer, shuffleAlternatePlayer, shuffleThirdPlayer],
                          shuffleVoice,
                          SHUFFLE_START_TIME,
                        );

      if (!player) return;

      return replayAudioPlayer(
        player,
        SOUND_VOLUMES[sound] ?? 1,
        sound === 'shuffle' ? SHUFFLE_START_TIME : sound === 'hint' ? HINT_START_TIME : 0,
      );
    },
    [
      bonusPlayer,
      diamondPlayer,
      enabled,
      hintAlternatePlayer,
      hintPlayer,
      hintThirdPlayer,
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
      shuffleAlternatePlayer,
      shufflePlayer,
      shuffleThirdPlayer,
      successAlternatePlayer,
      successPlayer,
    ],
  );
}

/**
 * Android ExoPlayer her AudioPlayer için ayrı ve pahalı bir native graph
 * kuruyor. Bu banka, sık kullanılan notaları ayrı tutarken duplicate voice
 * sayısını sınırlı bırakır: 7 select + hint + success + bonus + diamond +
 * ortak treasure/points + 2 shuffle = 14 native player.
 */
function useAndroidGameSounds(enabled: boolean) {
  const selectOnePlayer = useAudioPlayer(SELECT_SOURCES[0], ANDROID_PLAYER_OPTIONS);
  const selectTwoPlayer = useAudioPlayer(SELECT_SOURCES[1], ANDROID_PLAYER_OPTIONS);
  const selectThreePlayer = useAudioPlayer(SELECT_SOURCES[2], ANDROID_PLAYER_OPTIONS);
  const selectFourPlayer = useAudioPlayer(SELECT_SOURCES[3], ANDROID_PLAYER_OPTIONS);
  const selectFivePlayer = useAudioPlayer(SELECT_SOURCES[4], ANDROID_PLAYER_OPTIONS);
  const selectSixPlayer = useAudioPlayer(SELECT_SOURCES[5], ANDROID_PLAYER_OPTIONS);
  const selectSevenPlayer = useAudioPlayer(SELECT_SOURCES[6], ANDROID_PLAYER_OPTIONS);
  const hintPlayer = useAudioPlayer(HINT_SOURCE, ANDROID_PLAYER_OPTIONS);
  const successPlayer = useAudioPlayer(SUCCESS_SOURCE, ANDROID_PLAYER_OPTIONS);
  const bonusPlayer = useAudioPlayer(BONUS_SOURCE, ANDROID_PLAYER_OPTIONS);
  const diamondPlayer = useAudioPlayer(DIAMOND_SOURCE, ANDROID_PLAYER_OPTIONS);
  const treasurePlayer = useAudioPlayer(GAME_TREASURE_SOURCE, ANDROID_PLAYER_OPTIONS);
  const shufflePlayer = useAudioPlayer(SHUFFLE_SOURCE, ANDROID_PLAYER_OPTIONS);
  const shuffleAlternatePlayer = useAudioPlayer(
    SHUFFLE_SOURCE,
    ANDROID_PLAYER_OPTIONS,
  );
  const shuffleVoiceRef = useRef(0);

  useEffect(
    () =>
      subscribeAndroidPlayerBank([
        { player: selectOnePlayer, startTime: 0 },
        { player: selectTwoPlayer, startTime: 0 },
        { player: selectThreePlayer, startTime: 0 },
        { player: selectFourPlayer, startTime: 0 },
        { player: selectFivePlayer, startTime: 0 },
        { player: selectSixPlayer, startTime: 0 },
        { player: selectSevenPlayer, startTime: 0 },
        { player: hintPlayer, startTime: HINT_START_TIME },
        { player: successPlayer, startTime: 0 },
        { player: bonusPlayer, startTime: 0 },
        { player: diamondPlayer, startTime: 0 },
        { player: treasurePlayer, startTime: 0 },
        { player: shufflePlayer, startTime: SHUFFLE_START_TIME },
        { player: shuffleAlternatePlayer, startTime: SHUFFLE_START_TIME },
      ]),
    [
      bonusPlayer,
      diamondPlayer,
      hintPlayer,
      selectFivePlayer,
      selectFourPlayer,
      selectOnePlayer,
      selectSevenPlayer,
      selectSixPlayer,
      selectThreePlayer,
      selectTwoPlayer,
      shuffleAlternatePlayer,
      shufflePlayer,
      successPlayer,
      treasurePlayer,
    ],
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
      const selectionIndex = sound.startsWith('select')
        ? Number.parseInt(sound.slice('select'.length), 10) - 1
        : -1;
      const shuffleVoice = shuffleVoiceRef.current % 2;
      if (sound === 'shuffle') shuffleVoiceRef.current += 1;

      const player =
        selectionIndex >= 0
          ? selectionPlayers[selectionIndex]
          : sound === 'hint'
            ? hintPlayer
            : sound === 'success'
              ? successPlayer
              : sound === 'bonus'
                ? bonusPlayer
                : sound === 'diamond'
                  ? diamondPlayer
                  : sound === 'points' || sound === 'levelComplete'
                    ? treasurePlayer
                    : chooseVoice(
                        [shufflePlayer, shuffleAlternatePlayer],
                        shuffleVoice,
                        SHUFFLE_START_TIME,
                      );

      if (!player) return;
      return replayAudioPlayer(
        player,
        SOUND_VOLUMES[sound] ?? 1,
        sound === 'shuffle' ? SHUFFLE_START_TIME : sound === 'hint' ? HINT_START_TIME : 0,
      );
    },
    [
      bonusPlayer,
      diamondPlayer,
      enabled,
      hintPlayer,
      selectFivePlayer,
      selectFourPlayer,
      selectOnePlayer,
      selectSevenPlayer,
      selectSixPlayer,
      selectThreePlayer,
      selectTwoPlayer,
      shuffleAlternatePlayer,
      shufflePlayer,
      successPlayer,
      treasurePlayer,
    ],
  );
}

function useNativeAndroidGameSounds(enabled: boolean) {
  return useCallback(
    (sound: GameSound, force = false) => {
      if (!enabled && !force) return;
      return playAndroidGameSound(sound, SOUND_VOLUMES[sound] ?? 1);
    },
    [enabled],
  );
}

// Platform seçimi module yüklenirken sabitlenir; böylece iki hook bankası aynı
// render içinde koşullu çağrılmaz ve React hook sırası her zaman deterministiktir.
export const useGameSounds =
  Platform.OS !== 'android'
    ? useIosGameSounds
    : hasAndroidGameSoundPool
      ? useNativeAndroidGameSounds
      : useAndroidGameSounds;
