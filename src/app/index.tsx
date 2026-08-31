import { BlurTargetView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CountryCompletionModal, PassportModal } from '@/components/game/game-modals';
import { NumberWheel } from '@/components/game/number-wheel';
import { MainMenu, ProfileScreen } from '@/components/home/main-menu';
import { SettingsModal } from '@/components/home/settings-modal';
import { JourneyMap } from '@/components/journey/journey-map';
import { FONTS } from '@/constants/fonts';
import {
  computeResult,
  findSolutionIndices,
  generateLevelData,
  getCombinationKey,
  hasCompletedRequiredTargets,
  OPERATION_DETAILS,
  type LevelData,
  type Target,
} from '@/game/levels';
import { getGameLayout } from '@/game/layout';
import { loadGameProgress, saveGameProgress } from '@/game/progress-storage';
import {
  COUNTRY_BY_ID,
  WORLD_COUNTRIES,
  getCompletedCountryCount,
  getCompletedWorldLevelCount,
  getCountryProgress,
  getLocationProgress,
  getTravelLevelCompletion,
} from '@/game/travel';
import { useBackgroundMusic } from '@/hooks/use-background-music';
import { useGameSounds, type GameSound } from '@/hooks/use-game-sounds';

type FeedbackTone = 'live' | 'success' | 'bonus' | 'info';
type AppScreen = 'home' | 'game' | 'profile' | 'travel';

type Feedback = {
  text: string;
  tone: FeedbackTone;
};

type Timer = ReturnType<typeof setTimeout>;

type MeasuredRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ScreenPoint = {
  x: number;
  y: number;
};

type ResultFlight = {
  id: number;
  value: number;
  targetIndex: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
};

type DestinationTransitionState = {
  completedEmoji: string;
  completedName: string;
  nextEmoji: string;
  nextName: string;
};

const RESULT_FLIGHT_DURATION = 720;
const RESULT_FLIGHT_WIDTH = 52;
const RESULT_FLIGHT_HEIGHT = 52;
const LEVEL_CELEBRATION_DELAY = RESULT_FLIGHT_DURATION + 100;
const BONUS_TARGET_INDEX = -1;
const BONUS_GEM_REWARD = 1;
const NODE_SELECTION_SOUNDS = [
  'select1',
  'select2',
  'select3',
  'select4',
  'select5',
  'select6',
  'select7',
] as const satisfies readonly GameSound[];

const CONFETTI_COLORS = [
  '#F59E0B',
  '#60A5FA',
  '#34D399',
  '#F472B6',
  '#FDE047',
  '#A78BFA',
  '#FB7185',
  '#38BDF8',
] as const;

const GAME_SKY_BACKGROUND = require('../../assets/images/game-sky-background.png');

const CONFETTI = Array.from({ length: 120 }, (_, index) => {
  const spread = ((index * 47) % 101) / 100;
  const distance = 150 + ((index * 73) % 180);
  const angle = Math.PI * (0.25 + spread * 0.5);
  return {
    color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    drift: Math.cos(angle) * distance,
    lift: Math.sin(angle) * distance,
    size: 4 + (index % 5),
    spin: (index % 2 === 0 ? 1 : -1) * (360 + ((index * 61) % 540)),
  };
});

function clearTimer(timer: MutableRefObject<Timer | null>) {
  if (timer.current) {
    clearTimeout(timer.current);
    timer.current = null;
  }
}

function getNodeSelectionSound(selectionCount: number): GameSound {
  const index = Math.max(0, Math.min(NODE_SELECTION_SOUNDS.length - 1, selectionCount - 1));
  return NODE_SELECTION_SOUNDS[index];
}

function measureViewInWindow(view: View | null): Promise<MeasuredRect | null> {
  if (!view) return Promise.resolve(null);

  return new Promise((resolve) => {
    view.measureInWindow((x, y, width, height) => {
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
    });
  });
}

function ResultFlightBadge({
  flight,
  onComplete,
}: {
  flight: ResultFlight;
  onComplete: (flightId: number, targetIndex: number) => void;
}) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: RESULT_FLIGHT_DURATION,
      easing: Easing.bezier(0.175, 0.885, 0.32, 1),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) onComplete(flight.id, flight.targetIndex);
    });
    return () => animation.stop();
  }, [flight.id, flight.targetIndex, onComplete, progress]);

  const middleX = flight.fromX + (flight.toX - flight.fromX) * 0.56;
  const middleY = (flight.fromY + flight.toY) / 2 - 48;
  const translateX = progress.interpolate({
    inputRange: [0, 0.56, 1],
    outputRange: [flight.fromX, middleX, flight.toX],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 0.56, 1],
    outputRange: [flight.fromY, middleY, flight.toY],
  });
  const scale = progress.interpolate({
    inputRange: [0, 0.2, 0.8, 1],
    outputRange: [1, 1.25, 1.02, 0.3],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.82, 1],
    outputRange: [1, 1, 0],
  });
  const rotate = progress.interpolate({
    inputRange: [0, 0.56, 1],
    outputRange: ['-5deg', '2deg', '0deg'],
  });

  return (
    <Animated.View
      style={[
        styles.resultFlight,
        {
          opacity,
          transform: [{ translateX }, { translateY }, { scale }, { rotate }],
        },
      ]}>
      <LinearGradient
        colors={
          flight.targetIndex === BONUS_TARGET_INDEX
            ? ['#FFE98A', '#B56AE8']
            : ['#63D5B1', '#16906B']
        }
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.resultFlightSurface}>
        {flight.targetIndex === BONUS_TARGET_INDEX ? (
          <Text style={styles.resultFlightGem}>💎</Text>
        ) : null}
        <Text style={styles.resultFlightValue}>{flight.value}</Text>
      </LinearGradient>
    </Animated.View>
  );
}

function Celebration({ visible }: { visible: boolean }) {
  const { width, height } = useWindowDimensions();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visible) return;
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 1450,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, visible]);

  if (!visible) return null;

  const opacity = progress.interpolate({
    inputRange: [0, 0.04, 0.82, 1],
    outputRange: [0, 1, 1, 0],
  });

  return (
    <View pointerEvents="none" style={styles.celebrationLayer}>
      {CONFETTI.map((piece, index) => {
        const translateX = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, piece.drift],
        });
        const translateY = progress.interpolate({
          inputRange: [0, 0.38, 1],
          outputRange: [0, -piece.lift, Math.max(height * 0.62, 420)],
        });
        const rotate = progress.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${piece.spin}deg`],
        });
        return (
          <Animated.View
            key={index}
            style={[
              styles.confetti,
              {
                width: piece.size,
                height: piece.size * 1.45,
                borderRadius: index % 3 === 0 ? piece.size : 1,
                backgroundColor: piece.color,
                left: width / 2,
                top: height * 0.4,
                opacity,
                transform: [{ translateX }, { translateY }, { rotate }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

function DestinationTransition({
  transition,
}: {
  transition: DestinationTransitionState | null;
}) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!transition) return;
    progress.setValue(0);
    const animation = Animated.spring(progress, {
      toValue: 1,
      damping: 11,
      stiffness: 180,
      mass: 0.7,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, transition]);

  if (!transition) return null;

  return (
    <View pointerEvents="none" style={styles.destinationTransitionLayer}>
      <Animated.View
        style={[
          styles.destinationTransitionCard,
          {
            opacity: progress,
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [22, 0],
                }),
              },
              {
                scale: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.9, 1],
                }),
              },
            ],
          },
        ]}>
        <Text style={styles.destinationTransitionEyebrow}>DESTİNASYON TAMAMLANDI</Text>
        <Text style={styles.destinationTransitionTitle}>
          ✓ {transition.completedEmoji} {transition.completedName}
        </Text>
        <View style={styles.destinationTransitionDivider} />
        <Text style={styles.destinationTransitionNext}>YENİ DESTİNASYON AÇILDI</Text>
        <Text style={styles.destinationTransitionNextName}>
          {transition.nextEmoji} {transition.nextName} →
        </Text>
      </Animated.View>
    </View>
  );
}

function TargetCard({
  target,
  solved,
  hinted,
  landed,
  large,
  measureRef,
  width,
}: {
  target: Target;
  solved: boolean;
  hinted: boolean;
  landed: boolean;
  large: boolean;
  measureRef: (view: View | null) => void;
  width: `${number}%`;
}) {
  const operation = OPERATION_DETAILS[target.op];
  const [scale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    scale.stopAnimation();
    const animation = landed
      ? Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.08,
            duration: 85,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.98,
            duration: 85,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 110,
            useNativeDriver: true,
          }),
        ])
      : hinted
        ? Animated.sequence([
            Animated.timing(scale, {
              toValue: 1.05,
              duration: 175,
              useNativeDriver: true,
            }),
            Animated.delay(1450),
            Animated.timing(scale, {
              toValue: 1,
              duration: 175,
              useNativeDriver: true,
            }),
          ])
        : Animated.timing(scale, {
            toValue: 1,
            duration: 120,
            useNativeDriver: true,
          });
    animation.start();
    return () => animation.stop();
  }, [hinted, landed, scale]);

  return (
    <View ref={measureRef} collapsable={false} style={{ width }}>
      <Animated.View
        accessibilityLabel={`${target.value} hedefi, ${target.steps} sayı`}
        style={[
          styles.targetCardFrame,
          solved && styles.targetSolvedFrame,
          hinted && styles.targetHintedFrame,
          { transform: [{ scale }] },
        ]}>
        <LinearGradient
          colors={
            solved
              ? ['rgba(218,246,232,0.98)', 'rgba(189,232,213,0.98)']
              : ['#F8FCFB', '#DCECEC']
          }
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={[
            styles.targetCard,
            solved && styles.targetSolved,
            hinted && styles.targetHinted,
          ]}>
          <Text
            style={[
              styles.targetValue,
              large && styles.targetValueLarge,
              solved && styles.targetSolvedText,
            ]}>
            {target.value}
          </Text>
          <View style={styles.targetMeta}>
            <Text style={[styles.targetMetaText, solved && styles.targetSolvedText]}>
              [{operation.symbol}]
            </Text>
            <Text style={[styles.targetDots, solved && styles.targetSolvedText]}>
              {Array.from({ length: target.steps }, () => '●').join(' ')}
            </Text>
          </View>
        </LinearGradient>
        {hinted ? <View pointerEvents="none" style={styles.targetHintRing} /> : null}
      </Animated.View>
    </View>
  );
}

function BonusTargetCard({
  landed,
  measureRef,
  solved,
  target,
}: {
  landed: boolean;
  measureRef: (view: View | null) => void;
  solved: boolean;
  target: Target;
}) {
  const operation = OPERATION_DETAILS[target.op];
  const [scale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    scale.stopAnimation();
    const animation = landed
      ? Animated.sequence([
          Animated.timing(scale, { toValue: 1.1, duration: 90, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.98, duration: 90, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }),
        ])
      : Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [landed, scale]);

  return (
    <LinearGradient
      accessibilityLabel={`İsteğe bağlı bonus hedef ${target.value}, ödül ${BONUS_GEM_REWARD} mücevher`}
      colors={
        solved
          ? ['rgba(219,248,237,0.98)', 'rgba(190,235,218,0.98)']
          : ['rgba(255,247,206,0.98)', 'rgba(236,216,255,0.98)']
      }
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={[styles.bonusTargetRow, solved && styles.bonusTargetRowSolved]}>
      <View style={styles.bonusTargetCopy}>
        <Text style={[styles.bonusTargetTitle, solved && styles.bonusTargetSolvedText]}>
          {solved ? '💎 BONUS ALINDI' : '💎 BONUS HEDEF'}
        </Text>
        <Text style={[styles.bonusTargetSubtitle, solved && styles.bonusTargetSolvedText]}>
          {solved ? `+${BONUS_GEM_REWARD} mücevher kazanıldı` : `İsteğe bağlı • +${BONUS_GEM_REWARD} mücevher`}
        </Text>
      </View>

      <View ref={measureRef} collapsable={false} style={styles.bonusTargetCardMeasure}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <LinearGradient
            colors={solved ? ['#5BC69A', '#238666'] : ['#9F69D1', '#65448B']}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.bonusTargetCard}>
            <Text style={styles.bonusTargetValue}>{solved ? '✓' : target.value}</Text>
            <Text style={styles.bonusTargetMeta}>
              [{operation.symbol}] {Array.from({ length: target.steps }, () => '●').join(' ')}
            </Text>
          </LinearGradient>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

function PulsingGems({ count, compact }: { count: number; compact: boolean }) {
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <Animated.View
      accessibilityLabel={`${count} mücevher`}
      style={[
        styles.bonusButton,
        compact && styles.bonusButtonCompact,
        {
          transform: [
            {
              scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] }),
            },
          ],
        },
      ]}>
      <Text style={styles.bonusStar}>💎</Text>
      <Text style={styles.bonusText}>{count}</Text>
    </Animated.View>
  );
}

function getFeedbackColors(tone: FeedbackTone) {
  if (tone === 'success') {
    return { background: 'rgba(57,149,104,0.96)', border: '#D8F2E7', text: '#FFFFFF' };
  }
  if (tone === 'bonus') {
    return { background: 'rgba(142,103,46,0.96)', border: '#FFE196', text: '#FFF7DC' };
  }
  if (tone === 'info') {
    return { background: 'rgba(52,87,100,0.96)', border: '#C9E8F2', text: '#EAF4F3' };
  }
  return { background: 'rgba(61,127,145,0.97)', border: '#D8EFF1', text: '#FFFFFF' };
}

function JourneyStrip({ level, levelData }: { level: number; levelData: LevelData }) {
  const country = COUNTRY_BY_ID.get(levelData.countryId);
  const operation = OPERATION_DETAILS[levelData.op];
  const countryProgress = country ? getCountryProgress(level, country.id) : 0;

  return (
    <LinearGradient
      colors={['rgba(62,100,114,0.94)', 'rgba(38,63,77,0.93)']}
      end={{ x: 0, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={styles.journeyStrip}>
      <View style={styles.journeyTopRow}>
        <Text numberOfLines={1} style={styles.journeyCountry}>
          ✦ {levelData.flag} {levelData.country}
        </Text>
        <View style={styles.journeyOperationChip}>
          <Text numberOfLines={1} style={styles.journeyOperationText}>
            {operation.name.toLocaleUpperCase('tr-TR')} • {operation.symbol}
          </Text>
        </View>
        <View style={styles.journeyCountChip}>
          <Text style={styles.journeyCountText}>
            {levelData.countryChallenge ? '🏆 ' : ''}
            {countryProgress}/{country?.levelCount ?? 20}
          </Text>
        </View>
      </View>

      <View accessibilityLabel={`${levelData.country} şehir ilerlemesi`} style={styles.citySteps}>
        {country?.locations.map((location, index) => {
          const progress = getLocationProgress(level, country, location);
          const completed = progress >= location.levelCount;
          const active = !levelData.countryChallenge && levelData.locationId === location.id;
          const marker = completed ? '✓' : active ? '●' : '○';
          const fillWidth = `${(progress / location.levelCount) * 100}%` as `${number}%`;

          return (
            <View key={location.id} style={styles.cityStepGroup}>
              <View style={styles.cityStepLine}>
                <Text
                  numberOfLines={2}
                  style={[
                    styles.cityStepText,
                    completed && styles.cityStepCompleted,
                    active && styles.cityStepActive,
                  ]}>
                  {marker} {location.name}
                </Text>
                {index < country.locations.length - 1 ? (
                  <Text aria-hidden style={styles.cityStepArrow}>
                    ›
                  </Text>
                ) : null}
              </View>
              <View style={styles.cityProgressTrack}>
                <LinearGradient
                  colors={['#58A8B9', '#A9E1E3']}
                  end={{ x: 1, y: 0 }}
                  start={{ x: 0, y: 0 }}
                  style={[styles.cityProgressFill, { width: fillWidth }]}
                />
              </View>
            </View>
          );
        })}
      </View>
    </LinearGradient>
  );
}

export default function HomeScreen() {
  const { width, height } = useWindowDimensions();
  const [level, setLevel] = useState(1);
  const [levelData, setLevelData] = useState<LevelData>(() => generateLevelData(1));
  const [solvedTargets, setSolvedTargets] = useState<Set<number>>(() => new Set());
  const [bonusSolved, setBonusSolved] = useState(false);
  const [bonusCount, setBonusCount] = useState(0);
  const [gemCount, setGemCount] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [hintIndices, setHintIndices] = useState<number[]>([]);
  const [hintedTarget, setHintedTarget] = useState<number | null>(null);
  const [passportVisible, setPassportVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [activeScreen, setActiveScreen] = useState<AppScreen>('home');
  const [effectsEnabled, setEffectsEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.5);
  const [dragging, setDragging] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [destinationTransition, setDestinationTransition] =
    useState<DestinationTransitionState | null>(null);
  const [countryCompletionLevel, setCountryCompletionLevel] = useState<number | null>(null);
  const [resultFlights, setResultFlights] = useState<ResultFlight[]>([]);
  const [flyingTargets, setFlyingTargets] = useState<Set<number>>(() => new Set());
  const [bonusFlying, setBonusFlying] = useState(false);
  const [landedTarget, setLandedTarget] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const blurTarget = useRef<View>(null);
  const resultLayerRef = useRef<View>(null);
  const resultSourceRef = useRef<View>(null);
  const targetCardRefs = useRef<(View | null)[]>([]);
  const bonusCardRef = useRef<View>(null);
  const nextFlightId = useRef(1);
  const discoveredBonuses = useRef(new Set<string>());
  const feedbackTimer = useRef<Timer | null>(null);
  const hintTimer = useRef<Timer | null>(null);
  const landingTimer = useRef<Timer | null>(null);
  const levelTimer = useRef<Timer | null>(null);

  const layout = getGameLayout(width, height);
  const { compact, compactHeader, wheelSize } = layout;
  const playSound = useGameSounds(effectsEnabled);
  useBackgroundMusic(hydrated && musicEnabled, musicVolume);
  const targetWidth = (levelData.targets.length === 3 ? '31.6%' : '23.5%') as `${number}%`;
  const operation = OPERATION_DETAILS[levelData.op];
  const feedbackColors = feedback ? getFeedbackColors(feedback.tone) : null;
  const levelJustCompleted = hasCompletedRequiredTargets(solvedTargets.size, levelData);
  const displayedProgressLevel = levelData.level + (levelJustCompleted ? 1 : 0);
  const passportStampCount = getCompletedCountryCount(displayedProgressLevel);
  const completedWorldLevels = getCompletedWorldLevelCount(displayedProgressLevel);
  const score = completedWorldLevels * 100 + solvedTargets.size * 20 + bonusCount * 25;

  useEffect(() => {
    let active = true;

    void loadGameProgress().then((saved) => {
      if (!active) return;

      if (saved) {
        const restoredSolved = new Set(saved.solvedTargets);
        const restoredLevelComplete = hasCompletedRequiredTargets(
          restoredSolved.size,
          saved.levelData,
        );
        const restoredCountryCompletion =
          restoredLevelComplete && getTravelLevelCompletion(saved.level).countryCompleted;
        const restoredLevel =
          restoredLevelComplete && !restoredCountryCompletion ? saved.level + 1 : saved.level;
        const restoredLevelData = restoredLevelComplete && !restoredCountryCompletion
          ? generateLevelData(
              restoredLevel,
              saved.levelData.targets.map((target) => target.value),
            )
          : saved.levelData;

        setLevel(restoredLevel);
        setLevelData(restoredLevelData);
        setSolvedTargets(
          restoredLevelComplete && !restoredCountryCompletion ? new Set() : restoredSolved,
        );
        setBonusSolved(
          restoredLevelComplete && !restoredCountryCompletion ? false : saved.bonusSolved,
        );
        setCountryCompletionLevel(restoredCountryCompletion ? saved.level : null);
        setBonusCount(saved.bonusCount);
        setGemCount(saved.gemCount);
        setEffectsEnabled(saved.effectsEnabled);
        setMusicEnabled(saved.musicEnabled);
        setMusicVolume(saved.musicVolume);
        discoveredBonuses.current = new Set(saved.discoveredBonuses);
      }

      setHydrated(true);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    void saveGameProgress({
      level,
      levelData,
      solvedTargets: [...solvedTargets].sort((left, right) => left - right),
      bonusSolved,
      bonusCount,
      gemCount,
      discoveredBonuses: [...discoveredBonuses.current],
      effectsEnabled,
      musicEnabled,
      musicVolume,
    }).catch(() => undefined);
  }, [
    bonusCount,
    bonusSolved,
    effectsEnabled,
    gemCount,
    hydrated,
    level,
    levelData,
    musicEnabled,
    musicVolume,
    solvedTargets,
  ]);

  useEffect(
    () => () => {
      clearTimer(feedbackTimer);
      clearTimer(hintTimer);
      clearTimer(landingTimer);
      clearTimer(levelTimer);
    },
    [],
  );

  useEffect(() => {
    if (
      activeScreen === 'home' ||
      passportVisible ||
      settingsVisible ||
      countryCompletionLevel !== null
    ) {
      return;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setActiveScreen('home');
      return true;
    });
    return () => subscription.remove();
  }, [activeScreen, countryCompletionLevel, passportVisible, settingsVisible]);

  const triggerEffect = useCallback(
    (kind: GameSound) => {
      playSound(kind);
      if (!effectsEnabled) return;
      // Sayıların yükselen seçim melodisi korunur; düğümden düğüme sürüklerken
      // tekrarlayan titreşim üretilmez.
      if (kind.startsWith('select')) return;
      const effect =
        kind === 'levelComplete'
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          : kind === 'bonus'
            ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            : kind === 'shuffle' || kind === 'success'
              ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              : Haptics.selectionAsync();
      void effect.catch(() => undefined);
    },
    [effectsEnabled, playSound],
  );

  const showTimedFeedback = useCallback((next: Feedback, duration = 1200) => {
    clearTimer(feedbackTimer);
    setFeedback(next);
    feedbackTimer.current = setTimeout(() => {
      setFeedback(null);
      feedbackTimer.current = null;
    }, duration);
  }, []);

  const pulseTarget = useCallback((targetIndex: number) => {
    clearTimer(landingTimer);
    setLandedTarget(targetIndex);
    landingTimer.current = setTimeout(() => {
      setLandedTarget(null);
      landingTimer.current = null;
    }, 320);
  }, []);

  const revealTarget = useCallback(
    (targetIndex: number) => {
      if (targetIndex === BONUS_TARGET_INDEX) {
        setBonusFlying(false);
        pulseTarget(BONUS_TARGET_INDEX);
        return;
      }

      setFlyingTargets((current) => {
        if (!current.has(targetIndex)) return current;
        const next = new Set(current);
        next.delete(targetIndex);
        return next;
      });
      pulseTarget(targetIndex);
    },
    [pulseTarget],
  );

  const handleResultFlightComplete = useCallback(
    (flightId: number, targetIndex: number) => {
      setResultFlights((current) => current.filter((flight) => flight.id !== flightId));
      revealTarget(targetIndex);
    },
    [revealTarget],
  );

  const launchResultFlight = useCallback(
    async (value: number, targetIndex: number, resultOrigin?: ScreenPoint) => {
      const [rootRect, sourceRect, targetRect] = await Promise.all([
        measureViewInWindow(resultLayerRef.current),
        measureViewInWindow(resultSourceRef.current),
        measureViewInWindow(
          targetIndex === BONUS_TARGET_INDEX
            ? bonusCardRef.current
            : (targetCardRefs.current[targetIndex] ?? null),
        ),
      ]);

      if (!rootRect || !sourceRect || !targetRect) {
        revealTarget(targetIndex);
        return;
      }

      const flight: ResultFlight = {
        id: nextFlightId.current,
        value,
        targetIndex,
        fromX: (resultOrigin?.x ?? sourceRect.x + sourceRect.width / 2) - rootRect.x,
        fromY: (resultOrigin?.y ?? sourceRect.y + sourceRect.height * 0.44) - rootRect.y,
        toX: targetRect.x + targetRect.width / 2 - rootRect.x,
        toY: targetRect.y + targetRect.height / 2 - rootRect.y,
      };
      nextFlightId.current += 1;
      setResultFlights((current) => [...current, flight]);
    },
    [revealTarget],
  );

  const startLevel = useCallback((nextLevel: number, previousTargetValues: readonly number[]) => {
    clearTimer(feedbackTimer);
    clearTimer(hintTimer);
    clearTimer(landingTimer);
    setLevel(nextLevel);
    setLevelData(generateLevelData(nextLevel, previousTargetValues));
    setSolvedTargets(new Set());
    setBonusSolved(false);
    setBonusFlying(false);
    setFeedback(null);
    setHintIndices([]);
    setHintedTarget(null);
    setResultFlights([]);
    setFlyingTargets(new Set());
    setLandedTarget(null);
    setCelebrating(false);
    setDestinationTransition(null);
    setCountryCompletionLevel(null);
  }, []);

  const handlePreview = useCallback(
    (indices: number[]) => {
      clearTimer(feedbackTimer);
      if (indices.length < 2) {
        setFeedback(null);
        return;
      }
      const values = indices.map((index) => levelData.numbers[index]);
      const calculation = computeResult(values, levelData.op);
      setFeedback(
        calculation
          ? { text: `${calculation.expression} = ${calculation.result}`, tone: 'live' }
          : { text: 'Başka bir sıra dene', tone: 'info' },
      );
    },
    [levelData],
  );

  const handleComplete = useCallback(
    (indices: number[], resultOrigin?: ScreenPoint) => {
      if (indices.length < 2) {
        setFeedback(null);
        return;
      }

      const values = indices.map((index) => levelData.numbers[index]);
      const calculation = computeResult(values, levelData.op);
      if (!calculation) {
        showTimedFeedback({ text: 'Bu sıra geçerli bir işlem oluşturmuyor', tone: 'info' });
        return;
      }

      const combinationKey = getCombinationKey(values, levelData.op, calculation.result);
      const targetIndex = levelData.targets.findIndex(
        (target, index) =>
          !solvedTargets.has(index) &&
          target.value === calculation.result &&
          target.steps === indices.length,
      );

      if (targetIndex >= 0) {
        clearTimer(hintTimer);
        setHintIndices([]);
        setHintedTarget(null);
        // Hedefi çözen yol da keşfedilmiş bir kombinasyondur; aynı yol daha
        // sonra açık hedef yokken tekrar bonus kazandıramaz.
        discoveredBonuses.current.add(combinationKey);
        const nextSolved = new Set(solvedTargets);
        nextSolved.add(targetIndex);
        setFlyingTargets((current) => new Set(current).add(targetIndex));
        setSolvedTargets(nextSolved);
        triggerEffect('success');
        void launchResultFlight(calculation.result, targetIndex, resultOrigin);

        if (hasCompletedRequiredTargets(nextSolved.size, levelData)) {
          // Mesaj ve seyahat sınırı, paralel UI state'inden değil gerçekten çözülen
          // puzzle'ın kendi level kimliğinden hesaplanır. Böylece örneğin Atina 1/7,
          // gecikmiş bir state güncellemesi yüzünden 7/7 gibi değerlendirilemez.
          const completedPuzzleLevel = levelData.level;
          const travelCompletion = getTravelLevelCompletion(completedPuzzleLevel);
          const completedLocation = travelCompletion.locationCompleted;
          const completedCountry =
            travelCompletion.countryCompleted ||
            (levelData.countryChallenge &&
              levelData.countryLevel === levelData.countryLevelCount);
          const nextDestination = travelCompletion.nextDestination;
          const completionMessage = travelCompletion.worldTourCompleted
            ? '100/100 ülke • WORLD TOUR COMPLETED! Golden Compass ve World Explorer kazanıldı'
            : completedCountry
              ? `${levelData.country} tamamlandı! Pasaport damgası ve ${COUNTRY_BY_ID.get(levelData.countryId)?.rewardLandmark ?? levelData.country} kartı kazanıldı`
              : completedLocation
                ? `${levelData.city} tamamlandı! ${
                    nextDestination.countryChallenge
                      ? `${levelData.country} Challenge açıldı`
                      : `${nextDestination.location.name} açıldı`
                  }`
                : `Puzzle ${levelData.locationLevel}/${levelData.locationLevelCount} tamamlandı • ${levelData.city}`;
          showTimedFeedback(
            { text: `Harika! ${completionMessage} 🎉`, tone: 'success' },
            LEVEL_CELEBRATION_DELAY + 1100,
          );
          clearTimer(levelTimer);
          levelTimer.current = setTimeout(() => {
            setCelebrating(true);
            triggerEffect('levelComplete');

            if (completedLocation) {
              setDestinationTransition({
                completedEmoji: levelData.emoji,
                completedName: levelData.city,
                nextEmoji: nextDestination.location.emoji,
                nextName: nextDestination.countryChallenge
                  ? `${levelData.country} Challenge`
                  : nextDestination.location.name,
              });
            }

            levelTimer.current = setTimeout(() => {
              if (completedCountry) {
                setCountryCompletionLevel(completedPuzzleLevel);
                return;
              }

              startLevel(
                completedPuzzleLevel + 1,
                levelData.targets.map((target) => target.value),
              );
            }, completedLocation ? 1600 : 1000);
          }, LEVEL_CELEBRATION_DELAY);
        } else {
          showTimedFeedback(
            { text: `Hedef bulundu: ${calculation.result} ✓`, tone: 'success' },
            1150,
          );
        }
        return;
      }

      const bonusTarget = levelData.bonusTarget;
      const matchesBonusTarget =
        !bonusSolved &&
        bonusTarget.value === calculation.result &&
        bonusTarget.steps === indices.length;

      if (matchesBonusTarget) {
        const newDiscovery = !discoveredBonuses.current.has(combinationKey);
        discoveredBonuses.current.add(combinationKey);
        if (newDiscovery) setBonusCount((count) => count + 1);
        setBonusSolved(true);
        setGemCount((count) => count + BONUS_GEM_REWARD);
        setBonusFlying(true);
        triggerEffect('bonus');
        void launchResultFlight(
          calculation.result,
          BONUS_TARGET_INDEX,
          resultOrigin,
        );
        showTimedFeedback(
          {
            text: `💎 Bonus hedef çözüldü! +${BONUS_GEM_REWARD} mücevher`,
            tone: 'bonus',
          },
          1550,
        );
        return;
      }

      if (!discoveredBonuses.current.has(combinationKey)) {
        discoveredBonuses.current.add(combinationKey);
        setBonusCount((count) => count + 1);
        triggerEffect('bonus');
        showTimedFeedback(
          {
            text: `⭐ Bonus Keşif! (${calculation.expression} = ${calculation.result})`,
            tone: 'bonus',
          },
          1450,
        );
      } else {
        showTimedFeedback({ text: 'Bu kombinasyonu zaten keşfettin', tone: 'info' });
      }
    },
    [
      bonusSolved,
      launchResultFlight,
      levelData,
      showTimedFeedback,
      solvedTargets,
      startLevel,
      triggerEffect,
    ],
  );

  const handleHint = useCallback(() => {
    const targetIndex = levelData.targets.findIndex((_, index) => !solvedTargets.has(index));
    if (targetIndex < 0) return;
    const solution = findSolutionIndices(levelData.targets[targetIndex], levelData.numbers);
    if (!solution) {
      showTimedFeedback({ text: 'Bu hedef için ipucu hazırlanamadı', tone: 'info' });
      return;
    }

    clearTimer(hintTimer);
    setHintIndices(solution);
    setHintedTarget(targetIndex);
    triggerEffect('hint');
    showTimedFeedback({ text: 'Parlayan sayıları sırayla birleştir', tone: 'bonus' }, 1700);
    hintTimer.current = setTimeout(() => {
      setHintIndices([]);
      setHintedTarget(null);
      hintTimer.current = null;
    }, 1800);
  }, [levelData, showTimedFeedback, solvedTargets, triggerEffect]);

  const handleWheelNodeAdded = useCallback(
    (selectionCount: number) => {
      triggerEffect(getNodeSelectionSound(selectionCount));
    },
    [triggerEffect],
  );

  const handleWheelShuffle = useCallback(() => {
    setHintIndices([]);
    setHintedTarget(null);
    triggerEffect('shuffle');
  }, [triggerEffect]);

  const handleEffectsChange = useCallback(
    (enabled: boolean) => {
      setEffectsEnabled(enabled);
      if (!enabled) return;
      playSound('select1', true);
    },
    [playSound],
  );

  const openGame = useCallback(() => {
    setActiveScreen('game');
    triggerEffect('select1');
  }, [triggerEffect]);

  const continueAfterCountryCompletion = useCallback(() => {
    if (countryCompletionLevel === null) return;

    const completion = getTravelLevelCompletion(countryCompletionLevel);
    const previousTargetValues =
      levelData.level === countryCompletionLevel
        ? levelData.targets.map((target) => target.value)
        : [];
    startLevel(completion.nextDestination.globalLevel, previousTargetValues);
    setActiveScreen('game');
    showTimedFeedback(
      {
        text: completion.worldTourCompleted
          ? '🌍 Master World Tour başladı!'
          : `${completion.nextDestination.country.flag} ${completion.nextDestination.country.country} açıldı • ${completion.nextDestination.location.name}`,
        tone: 'success',
      },
      1800,
    );
  }, [countryCompletionLevel, levelData, showTimedFeedback, startLevel]);

  if (!hydrated) return <View style={styles.screen} />;

  const overlays = (
    <>
      <PassportModal
        blurTarget={blurTarget}
        currentLevel={displayedProgressLevel}
        onClose={() => setPassportVisible(false)}
        visible={passportVisible}
      />
      <SettingsModal
        blurTarget={blurTarget}
        effectsEnabled={effectsEnabled}
        musicEnabled={musicEnabled}
        musicVolume={musicVolume}
        onClose={() => setSettingsVisible(false)}
        onEffectsChange={handleEffectsChange}
        onMusicChange={setMusicEnabled}
        onMusicVolumeChange={setMusicVolume}
        visible={settingsVisible}
      />
      <CountryCompletionModal
        blurTarget={blurTarget}
        completedLevel={countryCompletionLevel}
        onContinue={continueAfterCountryCompletion}
      />
    </>
  );

  if (activeScreen === 'home') {
    return (
      <View style={styles.screen}>
        <BlurTargetView ref={blurTarget} style={styles.screen}>
          <MainMenu
            bonusCount={bonusCount}
            currentLevel={displayedProgressLevel}
            gemCount={gemCount}
            levelData={levelData}
            onOpenProfile={() => setActiveScreen('profile')}
            onOpenSettings={() => setSettingsVisible(true)}
            onOpenTravel={() => setActiveScreen('travel')}
            onPlay={openGame}
            score={score}
          />
        </BlurTargetView>
        {overlays}
      </View>
    );
  }

  if (activeScreen === 'profile') {
    return (
      <View style={styles.screen}>
        <BlurTargetView ref={blurTarget} style={styles.screen}>
          <ProfileScreen
            bonusCount={bonusCount}
            currentLevel={displayedProgressLevel}
            gemCount={gemCount}
            levelData={levelData}
            onBack={() => setActiveScreen('home')}
            onOpenPassport={() => setPassportVisible(true)}
            onPlay={openGame}
            score={score}
          />
        </BlurTargetView>
        {overlays}
      </View>
    );
  }

  if (activeScreen === 'travel') {
    return (
      <View style={styles.screen}>
        <BlurTargetView ref={blurTarget} style={styles.screen}>
          <JourneyMap
            bonusCount={bonusCount}
            gemCount={gemCount}
            level={level}
            levelData={levelData}
            onBack={() => setActiveScreen('home')}
            onContinue={openGame}
            onOpenPassport={() => setPassportVisible(true)}
            onOpenSettings={() => setSettingsVisible(true)}
          />
        </BlurTargetView>
        {overlays}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <BlurTargetView ref={blurTarget} style={styles.screen}>
        <Image
          contentFit="cover"
          source={GAME_SKY_BACKGROUND}
          style={styles.backgroundImage}
        />
        <LinearGradient
          colors={['rgba(12,22,33,0.07)', 'rgba(12,22,33,0.03)', 'rgba(12,22,33,0.10)']}
          locations={[0, 0.5, 1]}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />

        <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
          <View style={[styles.header, compactHeader && styles.headerCompact]}>
            <View style={[styles.headerSide, compactHeader && styles.headerSideCompact]}>
              <Pressable
                accessibilityLabel="Ana sayfaya dön"
                accessibilityRole="button"
                hitSlop={5}
                onPress={() => setActiveScreen('home')}
                style={({ pressed }) => [
                  styles.skyControl,
                  pressed && styles.buttonPressed,
                ]}>
                <Text style={styles.backIcon}>‹</Text>
              </Pressable>

              <PulsingGems compact={compactHeader} count={gemCount} />
            </View>

            <View
              style={[
                styles.headerSide,
                styles.headerRight,
                compactHeader && styles.headerSideCompact,
              ]}>
              <Pressable
                accessibilityLabel="Seyahat pasaportunu aç"
                accessibilityRole="button"
                hitSlop={5}
                onPress={() => setPassportVisible(true)}
                style={({ pressed }) => [styles.skyControl, pressed && styles.buttonPressed]}>
                <Text style={styles.skyControlIcon}>📘</Text>
                <View style={styles.passportCount}>
                  <Text style={styles.passportCountText}>
                    {passportStampCount}/{WORLD_COUNTRIES.length}
                  </Text>
                </View>
              </Pressable>

              <Pressable
                accessibilityLabel="Oyun ayarlarını aç"
                accessibilityRole="button"
                hitSlop={5}
                onPress={() => setSettingsVisible(true)}
                style={({ pressed }) => [styles.skyControl, pressed && styles.buttonPressed]}>
                <Text style={styles.gameSettingsIcon}>⚙</Text>
              </Pressable>
            </View>
          </View>

          <JourneyStrip level={displayedProgressLevel} levelData={levelData} />

          <ScrollView
            automaticallyAdjustContentInsets={false}
            bounces={false}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingHorizontal: layout.contentHorizontalPadding },
            ]}
            contentInsetAdjustmentBehavior="never"
            scrollEnabled={!dragging}
            showsVerticalScrollIndicator={false}
            style={styles.scrollView}>
            <View style={styles.gameContent}>
              <LinearGradient
                colors={['rgba(250,253,252,0.97)', 'rgba(225,238,238,0.96)']}
                end={{ x: 0, y: 1 }}
                start={{ x: 0, y: 0 }}
                style={styles.topSection}>
                <View style={styles.operationRow}>
                  <View style={styles.operationSide}>
                    <Text style={styles.operationLabel}>HEDEFLER</Text>
                    <LinearGradient
                      colors={['rgba(66,107,120,0.96)', 'rgba(52,87,100,0.96)']}
                      end={{ x: 0, y: 1 }}
                      start={{ x: 0, y: 0 }}
                      style={styles.operationBadge}>
                      <Text style={styles.operationText}>{operation.name}</Text>
                      <Text style={styles.operationSymbol}>({operation.symbol})</Text>
                    </LinearGradient>
                  </View>
                  <View style={styles.requiredBadge}>
                    <Text style={styles.requiredLabel}>GEREKEN</Text>
                    <Text style={styles.requiredDots}>
                      {Array.from({ length: levelData.steps }, () => '●').join(' ')}
                    </Text>
                  </View>
                </View>

                <View style={styles.targets}>
                  {levelData.targets.map((target, index) => (
                    <TargetCard
                      key={`${target.value}-${index}`}
                      hinted={hintedTarget === index}
                      landed={landedTarget === index}
                      large={!compact}
                      measureRef={(view) => {
                        targetCardRefs.current[index] = view;
                      }}
                      solved={solvedTargets.has(index) && !flyingTargets.has(index)}
                      target={target}
                      width={targetWidth}
                    />
                  ))}
                </View>

                <BonusTargetCard
                  landed={landedTarget === BONUS_TARGET_INDEX}
                  measureRef={(view) => {
                    bonusCardRef.current = view;
                  }}
                  solved={bonusSolved && !bonusFlying}
                  target={levelData.bonusTarget}
                />
              </LinearGradient>

              <View style={styles.feedbackSlot}>
                {feedback && feedbackColors ? (
                  <View
                    style={[
                      styles.feedbackPill,
                      {
                        backgroundColor: feedbackColors.background,
                        borderColor: feedbackColors.border,
                      },
                    ]}>
                    <Text style={[styles.feedbackText, { color: feedbackColors.text }]}>
                      {feedback.text}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.feedbackPlaceholder}>
                    <Text style={styles.feedbackPlaceholderTitle}>SAYILARI BİRLEŞTİR</Text>
                    <Text style={styles.feedbackPlaceholderText}>
                      Hedeflerden birini oluşturacak yolu keşfet
                    </Text>
                  </View>
                )}
              </View>

              <View
                ref={resultSourceRef}
                collapsable={false}
                style={styles.wheelContainer}>
                <NumberWheel
                  key={`${level}-${wheelSize}`}
                  hintIndices={hintIndices}
                  numbers={levelData.numbers}
                  onComplete={handleComplete}
                  onDraggingChange={setDragging}
                  onHint={handleHint}
                  onNodeAdded={handleWheelNodeAdded}
                  onPreview={handlePreview}
                  onShuffle={handleWheelShuffle}
                  size={wheelSize}
                />
              </View>

              <Text style={styles.instruction}>
                Ana hedefleri çöz; bonus mücevher isteğe bağlı!
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>

        <View
          ref={resultLayerRef}
          collapsable={false}
          pointerEvents="none"
          style={styles.resultFlightLayer}>
          {resultFlights.map((flight) => (
            <ResultFlightBadge
              flight={flight}
              key={flight.id}
              onComplete={handleResultFlightComplete}
            />
          ))}
        </View>
        <Celebration visible={celebrating} />
        <DestinationTransition transition={destinationTransition} />
      </BlurTargetView>
      {overlays}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#73C7EE',
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    width: '100%',
    maxWidth: 512,
    alignSelf: 'center',
    height: 46,
    marginTop: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerCompact: {
    marginTop: 5,
    paddingHorizontal: 10,
    gap: 4,
  },
  headerSide: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerSideCompact: {
    gap: 4,
  },
  headerRight: {
    justifyContent: 'flex-end',
    gap: 8,
  },
  skyControl: {
    position: 'relative',
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(216,239,241,0.95)',
    backgroundColor: 'rgba(41,70,83,0.93)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 5,
  },
  backIcon: {
    marginTop: -3,
    color: '#FFFFFF',
    fontFamily: FONTS.medium,
    fontSize: 40,
    lineHeight: 42,
    fontWeight: '500',
  },
  skyControlIcon: {
    fontSize: 18,
  },
  gameSettingsIcon: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 27,
  },
  passportCount: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 34,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.92)',
    backgroundColor: 'rgba(247,252,251,0.96)',
  },
  passportCountText: {
    color: '#233540',
    fontFamily: FONTS.black,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '900',
  },
  buttonPressed: {
    opacity: 0.76,
    transform: [{ scale: 0.94 }],
  },
  bonusButton: {
    height: 44,
    minWidth: 78,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(201,232,242,0.88)',
    backgroundColor: 'rgba(38,63,77,0.93)',
    shadowColor: '#243F4A',
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  bonusButtonCompact: {
    minWidth: 70,
    paddingHorizontal: 9,
  },
  bonusStar: {
    fontSize: 19,
  },
  bonusText: {
    color: '#FFFFFF',
    fontFamily: FONTS.black,
    fontSize: 16,
    fontWeight: '900',
  },
  journeyStrip: {
    width: '94%',
    maxWidth: 488,
    height: 106,
    alignSelf: 'center',
    marginTop: 4,
    paddingHorizontal: 12,
    paddingTop: 7,
    paddingBottom: 7,
    overflow: 'hidden',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(201,232,242,0.88)',
    shadowColor: '#18313D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 7,
    elevation: 7,
  },
  journeyTopRow: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  journeyCountry: {
    flex: 1,
    color: '#FFE196',
    fontFamily: FONTS.black,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
  },
  journeyOperationChip: {
    maxWidth: 116,
    minHeight: 19,
    justifyContent: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(202,228,231,0.44)',
    backgroundColor: 'rgba(32,52,64,0.62)',
  },
  journeyOperationText: {
    color: '#EAF4F3',
    fontFamily: FONTS.black,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '900',
  },
  journeyCountChip: {
    minHeight: 19,
    justifyContent: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F8E9BA',
    backgroundColor: '#F3DA93',
  },
  journeyCountText: {
    color: '#44342C',
    fontFamily: FONTS.black,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '900',
  },
  citySteps: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: 5,
    gap: 6,
  },
  cityStepGroup: {
    flex: 1,
    minWidth: 0,
  },
  cityStepLine: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cityStepText: {
    flex: 1,
    color: '#D0E1E2',
    fontFamily: FONTS.medium,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  cityStepCompleted: {
    color: '#FFE196',
    fontFamily: FONTS.black,
    fontWeight: '900',
  },
  cityStepActive: {
    color: '#FFFFFF',
    fontFamily: FONTS.black,
    fontWeight: '900',
  },
  cityStepArrow: {
    width: 12,
    color: '#D0E1E2',
    fontFamily: FONTS.bold,
    fontSize: 18,
    lineHeight: 20,
    textAlign: 'center',
  },
  cityProgressTrack: {
    width: '100%',
    height: 7,
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: 'rgba(110,135,144,0.72)',
  },
  cityProgressFill: {
    height: '100%',
    borderRadius: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 4,
  },
  gameContent: {
    width: '100%',
    maxWidth: 512,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topSection: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 7,
    paddingBottom: 10,
    overflow: 'hidden',
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#D5EEF2',
    shadowColor: '#233C48',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 5,
    elevation: 5,
  },
  operationRow: {
    width: '100%',
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
    gap: 8,
  },
  operationSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  operationLabel: {
    color: '#557782',
    fontFamily: FONTS.extraBold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  operationBadge: {
    minHeight: 30,
    paddingHorizontal: 14,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(232,247,247,0.9)',
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  operationText: {
    color: '#FFFFFF',
    fontFamily: FONTS.black,
    fontSize: 12,
    fontWeight: '900',
  },
  operationSymbol: {
    color: '#FFFFFF',
    fontFamily: FONTS.black,
    fontSize: 14,
    fontWeight: '900',
  },
  requiredBadge: {
    minHeight: 30,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0CB8B',
    backgroundColor: 'rgba(255,244,202,0.82)',
  },
  requiredLabel: {
    color: '#687F87',
    fontFamily: FONTS.bold,
    fontSize: 11,
    fontWeight: '800',
  },
  requiredDots: {
    color: '#B98834',
    fontFamily: FONTS.black,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  targets: {
    width: '100%',
    minHeight: 62,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  targetCardFrame: {
    width: '100%',
    position: 'relative',
    minHeight: 62,
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 3,
  },
  targetSolvedFrame: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 9,
  },
  targetHintedFrame: {
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.78,
    shadowRadius: 16,
    elevation: 12,
  },
  targetCard: {
    width: '100%',
    minHeight: 62,
    flex: 1,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#C6DEE2',
    padding: 8,
  },
  targetSolved: {
    borderWidth: 2,
    borderColor: '#10B981',
  },
  targetHinted: {
    borderColor: '#FBBF24',
  },
  targetHintRing: {
    position: 'absolute',
    top: -4,
    right: -4,
    bottom: -4,
    left: -4,
    borderRadius: 20,
    borderWidth: 4,
    borderColor: '#FBBF24',
  },
  targetValue: {
    color: '#233540',
    fontFamily: FONTS.black,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
  },
  targetValueLarge: {
    fontSize: 30,
    lineHeight: 36,
  },
  targetMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 1,
  },
  targetMetaText: {
    color: '#557782',
    fontFamily: FONTS.bold,
    fontSize: 10,
    fontWeight: '800',
  },
  targetDots: {
    color: '#557782',
    fontFamily: FONTS.bold,
    fontSize: 10,
    fontWeight: '900',
  },
  targetSolvedText: {
    color: '#23785B',
  },
  bonusTargetRow: {
    width: '100%',
    minHeight: 52,
    marginTop: 8,
    paddingLeft: 12,
    paddingRight: 7,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#D9B95A',
  },
  bonusTargetRowSolved: {
    borderColor: '#3DA27B',
  },
  bonusTargetCopy: {
    flex: 1,
    minWidth: 0,
  },
  bonusTargetTitle: {
    color: '#6C4D8D',
    fontFamily: FONTS.black,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 0.45,
  },
  bonusTargetSubtitle: {
    marginTop: 1,
    color: '#8B6E2D',
    fontFamily: FONTS.bold,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '800',
  },
  bonusTargetSolvedText: {
    color: '#23785B',
  },
  bonusTargetCardMeasure: {
    width: 94,
    height: 42,
    justifyContent: 'center',
  },
  bonusTargetCard: {
    width: 94,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.92)',
    shadowColor: '#503068',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  bonusTargetValue: {
    color: '#FFFFFF',
    fontFamily: FONTS.black,
    fontSize: 18,
    lineHeight: 21,
    fontWeight: '900',
  },
  bonusTargetMeta: {
    color: 'rgba(255,255,255,0.9)',
    fontFamily: FONTS.bold,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '800',
  },
  feedbackSlot: {
    width: '100%',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  feedbackPill: {
    maxWidth: '94%',
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1.5,
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 9,
    elevation: 8,
  },
  feedbackText: {
    fontFamily: FONTS.black,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  feedbackPlaceholder: {
    width: '70%',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(93,129,138,0.55)',
    backgroundColor: 'rgba(231,239,238,0.36)',
  },
  feedbackPlaceholderTitle: {
    color: '#557782',
    fontFamily: FONTS.black,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  feedbackPlaceholderText: {
    marginTop: 2,
    color: '#687F87',
    fontFamily: FONTS.bold,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  wheelContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
  },
  resultFlightLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 70,
    overflow: 'hidden',
  },
  resultFlight: {
    position: 'absolute',
    left: -RESULT_FLIGHT_WIDTH / 2,
    top: -RESULT_FLIGHT_HEIGHT / 2,
    width: RESULT_FLIGHT_WIDTH,
    height: RESULT_FLIGHT_HEIGHT,
    borderRadius: RESULT_FLIGHT_HEIGHT / 2,
    shadowColor: '#064E3B',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.42,
    shadowRadius: 9,
    elevation: 16,
  },
  resultFlightSurface: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RESULT_FLIGHT_HEIGHT / 2,
    borderWidth: 2,
    borderColor: 'rgba(236,253,245,0.96)',
  },
  resultFlightValue: {
    color: '#FFFFFF',
    fontFamily: FONTS.black,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
    textShadowColor: 'rgba(4,47,46,0.42)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  resultFlightGem: {
    position: 'absolute',
    top: -10,
    right: -8,
    fontSize: 17,
  },
  instruction: {
    color: '#557782',
    fontFamily: FONTS.bold,
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
    fontWeight: '800',
    marginTop: 1,
    marginBottom: 3,
  },
  destinationTransitionLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 80,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  destinationTransitionCard: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FFE49A',
    backgroundColor: 'rgba(36,61,73,0.97)',
    shadowColor: '#0B1F29',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.42,
    shadowRadius: 16,
    elevation: 18,
  },
  destinationTransitionEyebrow: {
    color: '#9FE2EA',
    fontFamily: FONTS.black,
    fontSize: 9,
    letterSpacing: 1.2,
    fontWeight: '900',
  },
  destinationTransitionTitle: {
    marginTop: 6,
    color: '#FFFFFF',
    fontFamily: FONTS.black,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  destinationTransitionDivider: {
    width: 74,
    height: 2,
    marginVertical: 11,
    borderRadius: 999,
    backgroundColor: '#D9AE45',
  },
  destinationTransitionNext: {
    color: '#FFE49A',
    fontFamily: FONTS.black,
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: '900',
  },
  destinationTransitionNextName: {
    marginTop: 5,
    color: '#D8EFF1',
    fontFamily: FONTS.extraBold,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  celebrationLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 60,
    overflow: 'hidden',
  },
  confetti: {
    position: 'absolute',
  },
});
