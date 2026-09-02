import { BlurTargetView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { PIConfetti } from 'react-native-fast-confetti';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  InteractionManager,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ChallengeIntroModal,
  CountryCompletionModal,
} from '@/components/game/game-modals';
import { PassportCollection } from '@/components/collection/passport-collection';
import { SoundPressable as Pressable } from '@/components/common/sound-pressable';
import { NumberWheel, type WheelSelectionOutcome } from '@/components/game/number-wheel';
import { MainMenu, ProfileScreen } from '@/components/home/main-menu';
import { SettingsModal } from '@/components/home/settings-modal';
import { JourneyMap } from '@/components/journey/journey-map';
import { countryContentImageUrl } from '@/constants/content-images';
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
  TOTAL_COUNTRIES,
  getCompletedWorldLevelCount,
  getCountryProgress,
  getLocationProgress,
  getTravelLevelCompletion,
  isPassportEarned,
} from '@/game/travel';
import { useBackgroundMusic } from '@/hooks/use-background-music';
import { useContentImageVersion } from '@/hooks/use-content-image-cache';
import { useGameSounds, type GameSound } from '@/hooks/use-game-sounds';

const PersistentMainMenu = memo(MainMenu);
const PersistentProfileScreen = memo(ProfileScreen);
const PersistentPassportCollection = memo(PassportCollection);
const PersistentJourneyMap = memo(JourneyMap);

type FeedbackTone = 'live' | 'success' | 'bonus' | 'info';
type AppScreen = 'home' | 'game' | 'profile' | 'travel' | 'collection';

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
  kind: 'result' | 'gem';
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
const RESULT_FLIGHT_ARRIVAL_PROGRESS = 0.9;
const TARGET_COLOR_REVEAL_DURATION = 300;
const RESULT_FLIGHT_WIDTH = 52;
const RESULT_FLIGHT_HEIGHT = 52;
const LEVEL_CELEBRATION_DELAY = RESULT_FLIGHT_DURATION + 100;
const BONUS_TARGET_INDEX = -1;
const BONUS_DISCOVERY_GEM_REWARD = 1;
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
  onArrive,
  onComplete,
}: {
  flight: ResultFlight;
  onArrive: (flight: ResultFlight) => void;
  onComplete: (flightId: number) => void;
}) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let arrived = false;
    const markArrived = () => {
      if (arrived) return;
      arrived = true;
      onArrive(flight);
    };

    progress.setValue(0);
    const progressListener = progress.addListener(({ value }) => {
      if (value >= RESULT_FLIGHT_ARRIVAL_PROGRESS) markArrived();
    });
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: RESULT_FLIGHT_DURATION,
      easing: Easing.bezier(0.175, 0.885, 0.32, 1),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (!finished) return;
      markArrived();
      onComplete(flight.id);
    });
    return () => {
      progress.removeListener(progressListener);
      animation.stop();
    };
  }, [flight, onArrive, onComplete, progress]);

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
        {flight.kind === 'gem' || flight.targetIndex === BONUS_TARGET_INDEX ? (
          <Text style={styles.resultFlightGem}>💎</Text>
        ) : null}
        {flight.kind === 'gem' ? null : (
          <Text style={styles.resultFlightValue}>{flight.value}</Text>
        )}
      </LinearGradient>
    </Animated.View>
  );
}

function Celebration({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <View
      pointerEvents="none"
      style={styles.celebrationLayer}
      testID="level-complete-confetti">
      <PIConfetti
        autoplay
        colors={[...CONFETTI_COLORS]}
        fadeOutOnEnd
        flakeStyle="glossy">
        <PIConfetti.Origin
          blastPosition="center"
          count={180}
          initialSpeed={1.8}
          spread={Math.PI * 2}>
          <PIConfetti.Flake size={10} radius={4} />
          <PIConfetti.Flake width={7} height={13} radius={3} />
        </PIConfetti.Origin>
      </PIConfetti>
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

function useTargetColorReveal(solved: boolean, landed: boolean) {
  const [reveal] = useState(() => new Animated.Value(solved ? 1 : 0));

  useEffect(() => {
    reveal.stopAnimation();
    let animation: Animated.CompositeAnimation | null = null;

    if (!solved) {
      reveal.setValue(0);
    } else if (!landed) {
      reveal.setValue(1);
    } else {
      reveal.setValue(0);
      animation = Animated.timing(reveal, {
        toValue: 1,
        duration: TARGET_COLOR_REVEAL_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      animation.start();
    }

    return () => animation?.stop();
  }, [landed, reveal, solved]);

  return reveal;
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
  const colorReveal = useTargetColorReveal(solved, landed);

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
          colors={['#F8FCFB', '#DCECEC']}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={[
            styles.targetCard,
            solved && styles.targetSolved,
            hinted && styles.targetHinted,
          ]}>
          {solved ? (
            <Animated.View
              pointerEvents="none"
              style={[styles.targetColorReveal, { transform: [{ scale: colorReveal }] }]}>
              <LinearGradient
                colors={['rgba(218,246,232,0.99)', 'rgba(189,232,213,0.99)']}
                end={{ x: 1, y: 1 }}
                start={{ x: 0, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          ) : null}
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
  const reward = target.value * target.steps;
  const [scale] = useState(() => new Animated.Value(1));
  const colorReveal = useTargetColorReveal(solved, landed);

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
      accessibilityLabel={`İsteğe bağlı bonus hedef ${target.value}, ödül ${reward} mücevher`}
      colors={['rgba(255,247,206,0.98)', 'rgba(236,216,255,0.98)']}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={[styles.bonusTargetRow, solved && styles.bonusTargetRowSolved]}>
      {solved ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.bonusRowColorReveal, { transform: [{ scaleX: colorReveal }] }]}>
          <LinearGradient
            colors={['rgba(219,248,237,0.99)', 'rgba(190,235,218,0.99)']}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
      <View style={styles.bonusTargetCopy}>
        <Text style={[styles.bonusTargetTitle, solved && styles.bonusTargetSolvedText]}>
          SAYILARI BİRLEŞTİR
        </Text>
        <Text style={[styles.bonusTargetSubtitle, solved && styles.bonusTargetSolvedText]}>
          {solved
            ? `💎 +${reward} mücevher kazanıldı`
            : `Sağdaki bonus sayısını oluştur • +${reward} mücevher`}
        </Text>
      </View>

      <View ref={measureRef} collapsable={false} style={styles.bonusTargetCardMeasure}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <LinearGradient
            colors={['#9F69D1', '#65448B']}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.bonusTargetCard}>
            {solved ? (
              <Animated.View
                pointerEvents="none"
                style={[styles.targetColorReveal, { transform: [{ scale: colorReveal }] }]}>
                <LinearGradient
                  colors={['#5BC69A', '#238666']}
                  end={{ x: 1, y: 1 }}
                  start={{ x: 0, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            ) : null}
            <Text style={styles.bonusTargetValue}>{target.value}</Text>
            <Text style={styles.bonusTargetMeta}>
              [{operation.symbol}] {Array.from({ length: target.steps }, () => '●').join(' ')}
            </Text>
          </LinearGradient>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

function useAnimatedCounter(value: number) {
  const [displayValue, setDisplayValue] = useState(value);
  const [gain, setGain] = useState(0);
  const displayedValueRef = useRef(value);
  const [animatedValue] = useState(() => new Animated.Value(value));
  const [gainScale] = useState(() => new Animated.Value(1));
  const [gainOpacity] = useState(() => new Animated.Value(0));
  const [gainTranslateY] = useState(() => new Animated.Value(0));
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      displayedValueRef.current = value;
      animatedValue.setValue(value);
      return;
    }

    const startValue = displayedValueRef.current;
    if (startValue === value) return;

    animatedValue.stopAnimation();
    animatedValue.setValue(startValue);
    const listenerId = animatedValue.addListener(({ value: nextValue }) => {
      const nextDisplayValue = Math.round(nextValue);
      displayedValueRef.current = nextDisplayValue;
      setDisplayValue(nextDisplayValue);
    });

    gainScale.stopAnimation();
    gainScale.setValue(1);
    gainOpacity.stopAnimation();
    gainTranslateY.stopAnimation();
    gainOpacity.setValue(1);
    gainTranslateY.setValue(0);
    setGain(Math.max(0, value - startValue));
    const countAnimation = Animated.timing(animatedValue, {
      duration: 900,
      toValue: value,
      useNativeDriver: false,
    });
    const bounceAnimation = Animated.sequence([
      Animated.timing(gainScale, { duration: 140, toValue: 1.12, useNativeDriver: true }),
      Animated.timing(gainScale, { duration: 140, toValue: 1, useNativeDriver: true }),
    ]);
    const gainAnimation = Animated.parallel([
      Animated.timing(gainTranslateY, { duration: 1500, toValue: -8, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(1200),
        Animated.timing(gainOpacity, { duration: 280, toValue: 0, useNativeDriver: true }),
      ]),
    ]);

    countAnimation.start();
    bounceAnimation.start();
    gainAnimation.start();

    return () => {
      countAnimation.stop();
      bounceAnimation.stop();
      gainAnimation.stop();
      animatedValue.removeListener(listenerId);
    };
  }, [animatedValue, gainOpacity, gainScale, gainTranslateY, value]);

  return { displayValue, gain, gainOpacity, gainScale, gainTranslateY };
}

function PulsingGems({
  active,
  count,
  compact,
  measureRef,
}: {
  active: boolean;
  count: number;
  compact: boolean;
  measureRef?: MutableRefObject<View | null>;
}) {
  const [pulse] = useState(() => new Animated.Value(0));
  const { displayValue, gain, gainOpacity, gainScale, gainTranslateY } = useAnimatedCounter(count);

  useEffect(() => {
    if (!active) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [active, pulse]);

  return (
    <Animated.View
      ref={measureRef}
      accessibilityLabel={`${displayValue} mücevher`}
      style={[
        styles.bonusButton,
        compact && styles.bonusButtonCompact,
        {
          transform: [
            {
              scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] }),
            },
            { scale: gainScale },
          ],
        },
      ]}>
      <Text style={styles.bonusStar}>💎</Text>
      <Text adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={1} style={styles.bonusText}>
        {displayValue.toLocaleString('tr-TR')}
      </Text>
      {gain > 0 ? (
        <Animated.Text
          pointerEvents="none"
          style={[
            styles.counterGain,
            { opacity: gainOpacity, transform: [{ translateY: gainTranslateY }] },
          ]}>
          +{gain.toLocaleString('tr-TR')}
        </Animated.Text>
      ) : null}
    </Animated.View>
  );
}

function ScorePill({ compact, score }: { compact: boolean; score: number }) {
  const { displayValue, gain, gainOpacity, gainScale, gainTranslateY } = useAnimatedCounter(score);

  return (
    <Animated.View
      accessibilityLabel={`${displayValue} puan`}
      style={[
        styles.scoreButton,
        compact && styles.scoreButtonCompact,
        { transform: [{ scale: gainScale }] },
      ]}>
      <Text style={styles.scoreStar}>★</Text>
      <View style={styles.scoreCopy}>
        <Text style={styles.scoreLabel}>PUAN</Text>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.62}
          numberOfLines={1}
          style={[styles.scoreText, compact && styles.scoreTextCompact]}>
          {displayValue.toLocaleString('tr-TR')}
        </Text>
      </View>
      {gain > 0 ? (
        <Animated.Text
          pointerEvents="none"
          style={[
            styles.counterGain,
            { opacity: gainOpacity, transform: [{ translateY: gainTranslateY }] },
          ]}>
          +{gain.toLocaleString('tr-TR')}
        </Animated.Text>
      ) : null}
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

function JourneyStrip({
  active,
  level,
  levelData,
}: {
  active: boolean;
  level: number;
  levelData: LevelData;
}) {
  const country = COUNTRY_BY_ID.get(levelData.countryId);
  const operation = OPERATION_DETAILS[levelData.op];
  const countryProgress = country ? getCountryProgress(level, country.id) : 0;
  const challengeProgress = Math.max(0, Math.min(1, countryProgress - 19));
  const [challengePulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    challengePulse.stopAnimation();
    if (!active || !levelData.countryChallenge) {
      challengePulse.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(challengePulse, {
          toValue: 1,
          duration: 720,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(challengePulse, {
          toValue: 0,
          duration: 720,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [active, challengePulse, levelData.countryChallenge]);

  return (
    <LinearGradient
      colors={
        levelData.countryChallenge
          ? ['rgba(116,78,24,0.97)', 'rgba(47,57,69,0.97)']
          : ['rgba(62,100,114,0.94)', 'rgba(38,63,77,0.93)']
      }
      end={{ x: 0, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={[styles.journeyStrip, levelData.countryChallenge && styles.journeyStripChallenge]}>
      <View style={styles.journeyTopRow}>
        <View style={styles.journeyCountryGroup}>
          <Text numberOfLines={1} style={styles.journeyCountry}>
            ✦ {levelData.flag} {levelData.country}
          </Text>
          {levelData.countryChallenge ? (
            <Animated.Text
              numberOfLines={1}
              style={[
                styles.journeyChallengeLabel,
                {
                  opacity: challengePulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.7, 1],
                  }),
                  transform: [
                    {
                      scale: challengePulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.06],
                      }),
                    },
                  ],
                },
              ]}>
              CHALLENGE
            </Animated.Text>
          ) : null}
        </View>
        <View style={styles.journeyOperationChip}>
          <Text numberOfLines={1} style={styles.journeyOperationText}>
            {operation.name.toLocaleUpperCase('tr-TR')} • {operation.symbol}
          </Text>
        </View>
        <View style={styles.journeyCountChip}>
          <Text style={styles.journeyCountText}>
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
            <View
              key={location.id}
              style={[styles.cityStepGroup, { flex: location.levelCount }]}>
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
        <View
          accessibilityLabel={`Challenge ilerlemesi ${challengeProgress}/1`}
          style={[styles.cityStepGroup, styles.challengeStepGroup]}>
          <View style={[styles.cityStepLine, styles.challengeStepLine]}>
            <Text
              style={[
                styles.challengeStepIcon,
                levelData.countryChallenge && styles.challengeStepActive,
              ]}>
              🏆
            </Text>
          </View>
          <View style={[styles.cityProgressTrack, styles.challengeProgressTrack]}>
            <LinearGradient
              colors={['#D9A62E', '#FFE196']}
              end={{ x: 1, y: 0 }}
              start={{ x: 0, y: 0 }}
              style={[
                styles.cityProgressFill,
                { width: challengeProgress === 1 ? '100%' : '0%' },
              ]}
            />
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

export default function HomeScreen() {
  const { width, height } = useWindowDimensions();
  const contentImageVersion = useContentImageVersion();
  const [level, setLevel] = useState(1);
  const [levelData, setLevelData] = useState<LevelData>(() => generateLevelData(1));
  const contentLevelData = useMemo(() => {
    if (!contentImageVersion) return levelData;
    return {
      ...levelData,
      background: countryContentImageUrl(levelData.routeId, levelData.countryId),
    };
  }, [contentImageVersion, levelData]);
  const [solvedTargets, setSolvedTargets] = useState<Set<number>>(() => new Set());
  const [bonusSolved, setBonusSolved] = useState(false);
  const [bonusCount, setBonusCount] = useState(0);
  const [gemCount, setGemCount] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [hintIndices, setHintIndices] = useState<number[]>([]);
  const [hintedTarget, setHintedTarget] = useState<number | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [activeScreen, setActiveScreen] = useState<AppScreen>('home');
  const [mountedShellScreens, setMountedShellScreens] = useState<Set<AppScreen>>(
    () => new Set(['home']),
  );
  const [effectsEnabled, setEffectsEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.5);
  const [dragging, setDragging] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [destinationTransition, setDestinationTransition] =
    useState<DestinationTransitionState | null>(null);
  const [countryCompletionLevel, setCountryCompletionLevel] = useState<number | null>(null);
  const [challengeIntroVisible, setChallengeIntroVisible] = useState(false);
  const [resultFlights, setResultFlights] = useState<ResultFlight[]>([]);
  const [flyingTargets, setFlyingTargets] = useState<Set<number>>(() => new Set());
  const [bonusFlying, setBonusFlying] = useState(false);
  const [landedTarget, setLandedTarget] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const blurTarget = useRef<View>(null);
  const navigateToScreen = useCallback((screen: AppScreen) => {
    setMountedShellScreens((current) => {
      if (current.has(screen)) return current;
      const next = new Set(current);
      next.add(screen);
      return next;
    });
    setActiveScreen(screen);
  }, []);
  const navigateHome = useCallback(() => navigateToScreen('home'), [navigateToScreen]);
  const navigateProfile = useCallback(() => navigateToScreen('profile'), [navigateToScreen]);
  const navigateCollection = useCallback(
    () => navigateToScreen('collection'),
    [navigateToScreen],
  );
  const navigateTravel = useCallback(() => navigateToScreen('travel'), [navigateToScreen]);
  const openSettings = useCallback(() => setSettingsVisible(true), []);
  const resultLayerRef = useRef<View>(null);
  const resultSourceRef = useRef<View>(null);
  const targetCardRefs = useRef<(View | null)[]>([]);
  const bonusCardRef = useRef<View>(null);
  const gemTargetRef = useRef<View>(null);
  const levelScorePending = useRef(0);
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
        const legacyDisplayedLevel = saved.levelData.level + (restoredLevelComplete ? 1 : 0);
        const legacyScore =
          getCompletedWorldLevelCount(legacyDisplayedLevel) * 100 +
          restoredSolved.size * 20;

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
        setScore(saved.score ?? legacyScore);
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
      score,
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
    score,
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
    if (!hydrated || mountedShellScreens.has('game')) return;
    const task = InteractionManager.runAfterInteractions(() => {
      setMountedShellScreens((current) => {
        if (current.has('game')) return current;
        const next = new Set(current);
        next.add('game');
        return next;
      });
    });
    return () => task.cancel();
  }, [hydrated, mountedShellScreens]);

  useEffect(() => {
    if (
      activeScreen === 'home' ||
      activeScreen === 'travel' ||
      settingsVisible ||
      challengeIntroVisible ||
      countryCompletionLevel !== null
    ) {
      return;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      navigateToScreen('home');
      return true;
    });
    return () => subscription.remove();
  }, [
    activeScreen,
    challengeIntroVisible,
    countryCompletionLevel,
    navigateToScreen,
    settingsVisible,
  ]);

  const triggerEffect = useCallback(
    (kind: GameSound) => {
      playSound(kind);
      if (!effectsEnabled) return;
      if (kind.startsWith('select')) {
        // Birleştirme sırasında ses olabilir, ancak düğüm düğüme
        // titreşim verilmez; haptic yalnızca sonuç/aksiyon geri bildirimidir.
        return;
      }
      if (kind === 'points') return;
      const effect =
        kind === 'levelComplete'
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          : kind === 'bonus'
            ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            : kind === 'diamond'
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

  const handleResultFlightArrive = useCallback(
    (flight: ResultFlight) => {
      if (flight.kind === 'gem') {
        setGemCount((count) => count + flight.value);
        return;
      }
      revealTarget(flight.targetIndex);
    },
    [revealTarget],
  );

  const handleResultFlightComplete = useCallback((flightId: number) => {
    setResultFlights((current) => current.filter((flight) => flight.id !== flightId));
  }, []);

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
        kind: 'result',
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

  const launchGemFlight = useCallback(async (reward: number) => {
    const [rootRect, sourceRect, targetRect] = await Promise.all([
      measureViewInWindow(resultLayerRef.current),
      measureViewInWindow(bonusCardRef.current),
      measureViewInWindow(gemTargetRef.current),
    ]);

    if (!rootRect || !sourceRect || !targetRect) {
      setGemCount((count) => count + reward);
      return;
    }

    const flight: ResultFlight = {
      id: nextFlightId.current,
      kind: 'gem',
      value: reward,
      targetIndex: BONUS_TARGET_INDEX,
      fromX: sourceRect.x + sourceRect.width / 2 - rootRect.x,
      fromY: sourceRect.y + sourceRect.height / 2 - rootRect.y,
      toX: targetRect.x + targetRect.width / 2 - rootRect.x,
      toY: targetRect.y + targetRect.height / 2 - rootRect.y,
    };
    nextFlightId.current += 1;
    setResultFlights((current) => [...current, flight]);
  }, []);

  const startLevel = useCallback((nextLevel: number, previousTargetValues: readonly number[]) => {
    clearTimer(feedbackTimer);
    clearTimer(hintTimer);
    clearTimer(landingTimer);
    const nextLevelData = generateLevelData(nextLevel, previousTargetValues);
    setLevel(nextLevel);
    setLevelData(nextLevelData);
    setChallengeIntroVisible(nextLevelData.countryChallenge);
    levelScorePending.current = 0;
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
    (indices: number[], resultOrigin?: ScreenPoint): WheelSelectionOutcome => {
      if (indices.length < 2) {
        setFeedback(null);
        return 'invalid';
      }

      const values = indices.map((index) => levelData.numbers[index]);
      const calculation = computeResult(values, levelData.op);
      if (!calculation) {
        showTimedFeedback({ text: 'Bu sıra geçerli bir işlem oluşturmuyor', tone: 'info' });
        return 'invalid';
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
        levelScorePending.current +=
          values.reduce((total, value) => total + value, 0) * indices.length;
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
          const completedCountryRecord = COUNTRY_BY_ID.get(levelData.countryId);
          const passportReward =
            completedCountryRecord &&
            isPassportEarned(completedPuzzleLevel, completedCountryRecord.passportId)
              ? 'yeni rota mührü'
              : 'pasaport damgası';
          const completionMessage = travelCompletion.worldTourCompleted
            ? `${TOTAL_COUNTRIES}/${TOTAL_COUNTRIES} ülke • WORLD TOUR COMPLETED! Golden Compass ve World Explorer kazanıldı`
            : completedCountry
              ? `${levelData.country} tamamlandı! ${passportReward} ve ${completedCountryRecord?.rewardLandmark ?? levelData.country} kartı kazanıldı`
              : completedLocation
                ? `${levelData.city} tamamlandı! ${
                    nextDestination.countryChallenge
                      ? `${levelData.country} Challenge açıldı`
                      : `${nextDestination.location.name} açıldı`
                  }`
                : `Puzzle ${levelData.locationLevel}/${levelData.locationLevelCount} tamamlandı • ${levelData.city}`;
          showTimedFeedback(
            {
              text: `Bölüm tamamlandı • +${
                levelScorePending.current
              } puan • Harika! ${completionMessage} 🎉`,
              tone: 'success',
            },
            LEVEL_CELEBRATION_DELAY + 1100,
          );
          clearTimer(levelTimer);
          levelTimer.current = setTimeout(() => {
            const completionScore = levelScorePending.current;
            levelScorePending.current = 0;
            if (completionScore > 0) {
              setScore((currentScore) => currentScore + completionScore);
              triggerEffect('points');
            }
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
            {
              text: `Hedef bulundu: ${calculation.result} ✓ • +${calculation.result} puan`,
              tone: 'success',
            },
            1150,
          );
        }
        return 'success';
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
        const bonusGemReward = bonusTarget.value * bonusTarget.steps;
        setBonusFlying(true);
        triggerEffect('diamond');
        void launchResultFlight(
          calculation.result,
          BONUS_TARGET_INDEX,
          resultOrigin,
        );
        void launchGemFlight(bonusGemReward);
        showTimedFeedback(
          {
            text: `💎 Bonus hedef çözüldü! +${bonusGemReward} mücevher`,
            tone: 'bonus',
          },
          1550,
        );
        return 'bonus';
      }

      if (!discoveredBonuses.current.has(combinationKey)) {
        discoveredBonuses.current.add(combinationKey);
        setBonusCount((count) => count + 1);
        setGemCount((count) => count + BONUS_DISCOVERY_GEM_REWARD);
        triggerEffect('bonus');
        showTimedFeedback(
          {
            text: `⭐ Bonus Keşif! +${BONUS_DISCOVERY_GEM_REWARD} mücevher • ${calculation.expression} = ${calculation.result}`,
            tone: 'bonus',
          },
          1450,
        );
        return 'bonus';
      } else {
        showTimedFeedback({ text: 'Bu kombinasyonu zaten keşfettin', tone: 'info' });
        return 'invalid';
      }
    },
    [
      bonusSolved,
      launchGemFlight,
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
    navigateToScreen('game');
    triggerEffect('select1');
  }, [navigateToScreen, triggerEffect]);

  const continueAfterCountryCompletion = useCallback(() => {
    if (countryCompletionLevel === null) return;

    const completion = getTravelLevelCompletion(countryCompletionLevel);
    const previousTargetValues =
      levelData.level === countryCompletionLevel
        ? levelData.targets.map((target) => target.value)
        : [];
    startLevel(completion.nextDestination.globalLevel, previousTargetValues);
    navigateToScreen('game');
    showTimedFeedback(
      {
        text: completion.worldTourCompleted
          ? '🌍 Master World Tour başladı!'
          : `${completion.nextDestination.country.flag} ${completion.nextDestination.country.country} açıldı • ${completion.nextDestination.location.name}`,
        tone: 'success',
      },
      1800,
    );
  }, [countryCompletionLevel, levelData, navigateToScreen, showTimedFeedback, startLevel]);

  if (!hydrated) return <View style={styles.screen} />;

  const overlays = (
    <>
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
      <ChallengeIntroModal
        blurTarget={blurTarget}
        country={levelData.country}
        flag={levelData.flag}
        onClose={() => setChallengeIntroVisible(false)}
        visible={challengeIntroVisible}
        worldTourFinal={levelData.worldTourFinal}
      />
    </>
  );

  const persistentScreens = (
    <View
      accessibilityElementsHidden={activeScreen === 'game'}
      importantForAccessibility={activeScreen === 'game' ? 'no-hide-descendants' : 'auto'}
      key="persistent-screens"
      pointerEvents={activeScreen === 'game' ? 'none' : 'auto'}
      style={[styles.screen, activeScreen === 'game' && styles.hiddenScreen]}>
      <BlurTargetView ref={activeScreen === 'game' ? undefined : blurTarget} style={styles.screen}>
          {activeScreen === 'home' || mountedShellScreens.has('home') ? (
            <View
              accessibilityElementsHidden={activeScreen !== 'home'}
              importantForAccessibility={activeScreen === 'home' ? 'auto' : 'no-hide-descendants'}
              pointerEvents={activeScreen === 'home' ? 'auto' : 'none'}
              style={[styles.screen, activeScreen !== 'home' && styles.hiddenScreen]}>
              <PersistentMainMenu
                active={activeScreen === 'home'}
                currentLevel={displayedProgressLevel}
                gemCount={gemCount}
                levelData={contentLevelData}
                onOpenCollection={navigateCollection}
                onOpenProfile={navigateProfile}
                onOpenSettings={openSettings}
                onOpenTravel={navigateTravel}
                onPlay={openGame}
                score={score}
              />
            </View>
          ) : null}

          {activeScreen === 'profile' || mountedShellScreens.has('profile') ? (
            <View
              accessibilityElementsHidden={activeScreen !== 'profile'}
              importantForAccessibility={activeScreen === 'profile' ? 'auto' : 'no-hide-descendants'}
              pointerEvents={activeScreen === 'profile' ? 'auto' : 'none'}
              style={[styles.screen, activeScreen !== 'profile' && styles.hiddenScreen]}>
              <PersistentProfileScreen
                bonusCount={bonusCount}
                currentLevel={displayedProgressLevel}
                gemCount={gemCount}
                levelData={contentLevelData}
                onOpenPassport={navigateCollection}
                onPlay={openGame}
                score={score}
              />
            </View>
          ) : null}

          {activeScreen === 'collection' || mountedShellScreens.has('collection') ? (
            <View
              accessibilityElementsHidden={activeScreen !== 'collection'}
              importantForAccessibility={activeScreen === 'collection' ? 'auto' : 'no-hide-descendants'}
              pointerEvents={activeScreen === 'collection' ? 'auto' : 'none'}
              style={[styles.screen, activeScreen !== 'collection' && styles.hiddenScreen]}>
              <PersistentPassportCollection
                currentLevel={displayedProgressLevel}
                onHome={navigateHome}
                onMap={navigateTravel}
                onTasks={navigateProfile}
              />
            </View>
          ) : null}

          {activeScreen === 'travel' || mountedShellScreens.has('travel') ? (
            <View
              accessibilityElementsHidden={activeScreen !== 'travel'}
              importantForAccessibility={activeScreen === 'travel' ? 'auto' : 'no-hide-descendants'}
              pointerEvents={activeScreen === 'travel' ? 'auto' : 'none'}
              style={[styles.screen, activeScreen !== 'travel' && styles.hiddenScreen]}>
              <PersistentJourneyMap
                active={activeScreen === 'travel'}
                level={level}
                levelData={contentLevelData}
                onBack={navigateHome}
                onContinue={openGame}
                onOpenPassport={navigateCollection}
                onOpenTasks={navigateProfile}
              />
            </View>
          ) : null}
      </BlurTargetView>
    </View>
  );

  return (
    <View style={styles.screen}>
      {persistentScreens}
      {activeScreen === 'game' || mountedShellScreens.has('game') ? (
      <BlurTargetView
        accessibilityElementsHidden={activeScreen !== 'game'}
        importantForAccessibility={activeScreen === 'game' ? 'auto' : 'no-hide-descendants'}
        pointerEvents={activeScreen === 'game' ? 'auto' : 'none'}
        ref={activeScreen === 'game' ? blurTarget : undefined}
        style={[styles.gameScreenLayer, activeScreen !== 'game' && styles.gameScreenHidden]}>
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
                onPress={navigateHome}
                style={({ pressed }) => [
                  styles.skyControl,
                  pressed && styles.buttonPressed,
                ]}>
                <Text style={styles.backIcon}>‹</Text>
              </Pressable>

              <ScorePill compact={compactHeader} score={score} />
            </View>

            <View
              style={[
                styles.headerSide,
                styles.headerRight,
                compactHeader && styles.headerSideCompact,
              ]}>
              <PulsingGems
                active={activeScreen === 'game'}
                compact={compactHeader}
                count={gemCount}
                measureRef={gemTargetRef}
              />

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

          <JourneyStrip
            active={activeScreen === 'game'}
            level={displayedProgressLevel}
            levelData={contentLevelData}
          />

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
                    <Text style={styles.operationLabel}>İŞLEM TÜRÜ</Text>
                    <LinearGradient
                      colors={['rgba(66,107,120,0.96)', 'rgba(52,87,100,0.96)']}
                      end={{ x: 0, y: 1 }}
                      start={{ x: 0, y: 0 }}
                      style={styles.operationBadge}>
                      <Text style={styles.operationSymbol}>{operation.symbol}</Text>
                    </LinearGradient>
                  </View>
                  <View style={styles.requiredBadge}>
                    <Text style={styles.requiredLabel}>ADIM SAYISI</Text>
                    <Text style={styles.requiredDots}>{levelData.steps}</Text>
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
                  null
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
              onArrive={handleResultFlightArrive}
              onComplete={handleResultFlightComplete}
            />
          ))}
        </View>
        <Celebration visible={celebrating} />
        <DestinationTransition transition={destinationTransition} />
      </BlurTargetView>
      ) : null}
      {overlays}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#73C7EE',
  },
  hiddenScreen: {
    display: 'none',
  },
  gameScreenLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#73C7EE',
  },
  gameScreenHidden: {
    display: 'none',
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
  gameSettingsIcon: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 27,
  },
  buttonPressed: {
    opacity: 0.76,
    transform: [{ scale: 0.94 }],
  },
  scoreButton: {
    height: 44,
    minWidth: 78,
    maxWidth: 106,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(255,231,157,0.94)',
    backgroundColor: 'rgba(94,68,31,0.93)',
    shadowColor: '#4B3518',
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  scoreButtonCompact: {
    minWidth: 70,
    maxWidth: 78,
    gap: 3,
    paddingHorizontal: 7,
  },
  scoreStar: {
    color: '#FFE58C',
    fontSize: 18,
  },
  scoreCopy: {
    minWidth: 0,
    flexShrink: 1,
  },
  scoreLabel: {
    color: '#FFE9A9',
    fontFamily: FONTS.bold,
    fontSize: 6.5,
    lineHeight: 7,
    letterSpacing: 0.7,
    fontWeight: '700',
  },
  scoreText: {
    color: '#FFFFFF',
    fontFamily: FONTS.black,
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '900',
  },
  scoreTextCompact: {
    fontSize: 13,
  },
  counterGain: {
    position: 'absolute',
    top: -14,
    right: 4,
    color: '#FFF1A8',
    fontFamily: FONTS.extraBold,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    textShadowColor: 'rgba(52,30,10,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
    maxWidth: 78,
    paddingHorizontal: 9,
  },
  bonusStar: {
    fontSize: 19,
  },
  bonusText: {
    minWidth: 0,
    flexShrink: 1,
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
  journeyStripChallenge: {
    borderWidth: 2,
    borderColor: '#FFE196',
    shadowColor: '#D9A62E',
    shadowOpacity: 0.38,
  },
  journeyTopRow: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  journeyCountryGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  journeyCountry: {
    flexShrink: 1,
    color: '#FFE196',
    fontFamily: FONTS.black,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
  },
  journeyChallengeLabel: {
    flexShrink: 0,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE196',
    color: '#FFE196',
    backgroundColor: 'rgba(35,45,57,0.78)',
    fontFamily: FONTS.black,
    fontSize: 7,
    lineHeight: 10,
    letterSpacing: 0.5,
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
    gap: 3,
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
  challengeStepGroup: {
    flex: 1,
    minWidth: 17,
  },
  challengeStepLine: {
    justifyContent: 'center',
  },
  challengeStepIcon: {
    opacity: 0.5,
    fontSize: 12,
    textAlign: 'center',
  },
  challengeStepActive: {
    opacity: 1,
  },
  challengeProgressTrack: {
    backgroundColor: 'rgba(126,96,42,0.72)',
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
  targetColorReveal: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 180,
    height: 180,
    marginLeft: -90,
    marginTop: -90,
    overflow: 'hidden',
    borderRadius: 90,
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
    zIndex: 1,
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
    zIndex: 1,
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
    overflow: 'hidden',
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
  bonusRowColorReveal: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '200%',
  },
  bonusTargetCopy: {
    zIndex: 1,
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
    zIndex: 1,
    width: 94,
    height: 42,
    justifyContent: 'center',
  },
  bonusTargetCard: {
    width: 94,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
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
    zIndex: 1,
    color: '#FFFFFF',
    fontFamily: FONTS.black,
    fontSize: 18,
    lineHeight: 21,
    fontWeight: '900',
  },
  bonusTargetMeta: {
    zIndex: 1,
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
});
