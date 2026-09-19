import { BlurTargetView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { PIConfetti } from 'react-native-fast-confetti';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import {
  Animated,
  AppState,
  BackHandler,
  Easing,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { logDailyStart, logTutorialComplete } from '@/analytics/app-analytics';
import { FreshGameTutorialModal } from '@/components/game/fresh-game-tutorial-modal';
import { CountryCompletionModal } from '@/components/game/game-modals';
import { DailyChallengeScreen } from '@/components/daily/daily-challenge-screen';
import { PassportCollection } from '@/components/collection/passport-collection';
import { AdMobBanner, AD_BANNER_SLOT_HEIGHT } from '@/components/ads/admob-banner';
import { HINT_AD_GEM_REWARD } from '@/components/ads/admob-ids';
import { useInterstitialTransition } from '@/components/ads/use-interstitial-transition';
import { useRewardedHintAd } from '@/components/ads/use-rewarded-hint';
import { BackIcon, FootprintIcon, GemIcon, SettingsIcon } from '@/components/common/game-icons';
import { SoundPressable as Pressable } from '@/components/common/sound-pressable';
import {
  NumberWheel,
  NODE_OUTRO_DURATION,
  type WheelSelectionOutcome,
} from '@/components/game/number-wheel';
import {
  BONUS_GEM_LAUNCH_DELAY,
  BONUS_TARGET_INDEX,
  CardGemLiftFlight,
  POINTS_FLIGHT_DURATION,
  RESULT_FLIGHT_DURATION,
  ResultFlightBadge,
  TARGET_COLOR_REVEAL_DURATION,
  TARGET_LANDING_MS,
  cardGemLiftEventKey,
  createCardGemLift,
  createResultFlight,
  measureViewInWindow,
  resultFlightEventKey,
  type CardGemLift,
  type MeasuredRect,
  type ResultFlight,
  type ScreenPoint,
} from '@/components/game/result-flight';
import { MainMenu, ProfileScreen } from '@/components/home/main-menu';
import { SettingsModal } from '@/components/home/settings-modal';
import { StartupSplash } from '@/components/startup-splash';
import { JourneyMap } from '@/components/journey/journey-map';
import { countryContentImageUrl } from '@/constants/content-images';
import { FONTS } from '@/constants/fonts';
import {
  ACTIVITY_IDLE_TIMEOUT_MS,
  INITIAL_LEARNING_LEVEL,
  INITIAL_LEARNING_SCORE,
  appendPerformance,
  applyConsecutiveStruggleRelief,
  isAdaptiveDifficultyEnabled,
  ratePuzzlePerformance,
  difficultyModifierFromLearningScore,
  updateLearningLevel,
  updateLearningScore,
  type DifficultyModifier,
  type PuzzlePerformance,
} from '@/game/adaptive-difficulty';
import {
  computeResult,
  findSolutionIndices,
  formatLiveExpression,
  getBonusGemReward,
  generateLevelData,
  getCombinationKey,
  getTargetScore,
  hasCompletedRequiredTargets,
  OPERATION_DETAILS,
  type LevelData,
  type Target,
} from '@/game/levels';
import { getGameLayout } from '@/game/layout';
import {
  DEFAULT_MUSIC_VOLUME,
  loadGameProgress,
  saveGameProgress,
} from '@/game/progress-storage';
import {
  getDailyChallenge,
  getLocalDateKey,
  isDailyChallengeComplete,
  skillFromDailyChallengeProgress,
} from '@/game/daily-challenge';
import { loadDailyChallengeProgress } from '@/game/daily-challenge-storage';
import {
  COUNTRY_LEVEL_COUNT,
  COUNTRY_BY_ID,
  TOTAL_COUNTRIES,
  getCompletedWorldLevelCount,
  getCountryProgress,
  getLocationProgress,
  getTravelLevelCompletion,
  isPassportEarned,
  resolveTravelLevel,
} from '@/game/travel';
import { useBackgroundMusic } from '@/hooks/use-background-music';
import {
  useContentImageBootstrap,
  useContentImageVersion,
} from '@/hooks/use-content-image-cache';
import { useGameSounds, type GameSound } from '@/hooks/use-game-sounds';
import { localizeCountry, localizeOperation, useI18n } from '@/i18n';

const PersistentMainMenu = memo(MainMenu);
const PersistentProfileScreen = memo(ProfileScreen);
const PersistentPassportCollection = memo(PassportCollection);
const PersistentJourneyMap = memo(JourneyMap);
const PersistentDailyChallenge = memo(DailyChallengeScreen);

const INITIAL_GEM_COUNT = 30;
const HINT_GEM_COST = 10;
const ROUTE_GEM_REWARD = 10;

type FeedbackTone = 'live' | 'success' | 'bonus' | 'info';
type AppScreen = 'home' | 'game' | 'profile' | 'travel' | 'collection' | 'daily';

type Feedback = {
  text: string;
  tone: FeedbackTone;
};

type Timer = ReturnType<typeof setTimeout>;

type ScoreAward = {
  targetIndex: number;
  value: number;
};

type PuzzleActivity = PuzzlePerformance & {
  lastInteractionAt: number | null;
};
const TUTORIAL_STORAGE_KEY = '@numbers-of-wonders/tutorial-completed';
const OPERATION_GUIDE_STORAGE_KEY = '@numbers-of-wonders/operation-guide-v1';

type OperationGuideState = {
  shownLocationIds: string[];
};

const EMPTY_OPERATION_GUIDE_STATE: OperationGuideState = {
  shownLocationIds: [],
};

function operationGuideLocationKey(levelData: Pick<LevelData, 'locationId'>) {
  return levelData.locationId;
}

function parseOperationGuideState(value: string): OperationGuideState {
  try {
    const parsed = JSON.parse(value) as Partial<OperationGuideState> & {
      firstCountryLocations?: unknown;
    };
    const fromNew = Array.isArray(parsed.shownLocationIds)
      ? parsed.shownLocationIds.filter((id): id is string => typeof id === 'string')
      : [];
    const fromLegacy = Array.isArray(parsed.firstCountryLocations)
      ? parsed.firstCountryLocations.filter((id): id is string => typeof id === 'string')
      : [];
    return { shownLocationIds: [...new Set([...fromNew, ...fromLegacy])] };
  } catch {
    return { shownLocationIds: [] };
  }
}

function shouldShowOperationGuide(levelData: LevelData, state: OperationGuideState) {
  // Her destinasyon/şehir (ve Challenge) girişinin ilk puzzle'ında bir kez.
  if (levelData.locationLevel !== 1) return false;
  return !state.shownLocationIds.includes(operationGuideLocationKey(levelData));
}

function rememberShownOperationGuide(
  levelData: LevelData,
  state: OperationGuideState,
): OperationGuideState {
  const key = operationGuideLocationKey(levelData);
  if (state.shownLocationIds.includes(key)) return state;
  return { shownLocationIds: [...state.shownLocationIds, key] };
}

type DestinationTransitionState = {
  completedEmoji: string;
  completedName: string;
  countryChallenge: boolean;
  nextEmoji: string;
  nextName: string;
};

const POINTS_FLIGHT_STAGGER = 120;
const LEVEL_CELEBRATION_DELAY = RESULT_FLIGHT_DURATION + 100;
const SCORE_FLIGHT_START_DELAY = 320;
const SHORT_CELEBRATION_DELAY = 280;
const DESTINATION_CARD_DURATION = 1150;
const CHALLENGE_CARD_DURATION = 2100;
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

function Celebration({
  compact = false,
  visible,
}: {
  compact?: boolean;
  visible: boolean;
}) {
  if (!visible || Platform.OS === 'web') return null;

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
          count={compact ? 56 : 180}
          initialSpeed={compact ? 1.15 : 1.8}
          spread={Math.PI * 2}>
          <PIConfetti.Flake size={compact ? 7 : 10} radius={compact ? 3 : 4} />
          <PIConfetti.Flake width={compact ? 5 : 7} height={compact ? 9 : 13} radius={3} />
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
  const { t } = useI18n();
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
          transition.countryChallenge && styles.destinationTransitionChallengeCard,
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
        <Text style={styles.destinationTransitionEyebrow}>{t('game.destinationComplete')}</Text>
        <Text style={styles.destinationTransitionTitle}>
          ✓ {transition.completedEmoji} {transition.completedName}
        </Text>
        <View style={styles.destinationTransitionDivider} />
        {transition.countryChallenge ? (
          <View style={styles.destinationTransitionChallengeContent}>
            <Text style={styles.destinationTransitionChallengeTrophy}>🏆</Text>
            <Text style={styles.destinationTransitionChallengeLabel}>
              {t('modal.countryChallenge')}
            </Text>
            <Text style={styles.destinationTransitionChallengeCountry}>
              {transition.nextEmoji} {transition.nextName}
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.destinationTransitionNext}>{t('game.newDestination')}</Text>
            <Text style={styles.destinationTransitionNextName}>
              {transition.nextEmoji} {transition.nextName} →
            </Text>
          </>
        )}
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
  const { t } = useI18n();
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
        accessibilityLabel={t('game.targetA11y', { value: target.value, steps: target.steps })}
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
          <View style={[styles.targetOperationCorner, solved && styles.targetOperationCornerSolved]}>
            <Text style={styles.targetOperationCornerText}>{operation.symbol}</Text>
          </View>
          <Text
            style={[
              styles.targetValue,
              large && styles.targetValueLarge,
              solved && styles.targetSolvedText,
            ]}>
            {target.value}
          </Text>
          <View style={styles.targetMeta}>
            <Text style={[styles.targetDots, solved && styles.targetSolvedText]}>
              {Array.from({ length: target.steps }, () => '●').join(' ')}
            </Text>
          </View>
          {solved ? <View pointerEvents="none" style={styles.targetSolvedBorder} /> : null}
        </LinearGradient>
        {hinted ? <View pointerEvents="none" style={styles.targetHintRing} /> : null}
      </Animated.View>
    </View>
  );
}

function BonusTargetCard({
  countryChallenge,
  gemLifted = false,
  gemMeasureRef,
  landed,
  measureRef,
  selectionCount,
  solved,
  target,
}: {
  countryChallenge: boolean;
  gemLifted?: boolean;
  gemMeasureRef?: (view: View | null) => void;
  landed: boolean;
  measureRef: (view: View | null) => void;
  selectionCount: number;
  solved: boolean;
  target: Target;
}) {
  const { t } = useI18n();
  const operation = OPERATION_DETAILS[target.op];
  const reward = getBonusGemReward(target.steps, countryChallenge);
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
      accessibilityLabel={t('game.bonusA11y', { value: target.value, reward })}
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
      <View style={styles.bonusStepBadge}>
        <FootprintIcon color="#A87521" filled size={16} />
        <Text style={styles.bonusStepLabel}>{t('game.stepCount')}</Text>
        <View style={styles.bonusStepDots}>
          {Array.from({ length: target.steps }, (_, index) => (
            <View
              key={`bonus-step-${index}`}
              style={[
                styles.bonusStepDot,
                index < selectionCount && styles.bonusStepDotFilled,
              ]}
            />
          ))}
        </View>
      </View>
      <View style={styles.bonusRewardAnchor}>
        <Text style={[styles.bonusRewardLabel, solved && styles.bonusTargetSolvedText]}>
          BONUS
        </Text>
        <View style={[styles.bonusRewardPill, solved && styles.bonusRewardPillSolved]}>
          <GemIcon
            color={solved ? '#66D7FF' : '#BDEFFF'}
            facetColor={solved ? '#FFFFFF' : '#258AAF'}
            outlineColor="#0B5875"
            size={15}
          />
          <Text style={[styles.bonusRewardValue, solved && styles.bonusRewardValueSolved]}>
            +{reward}
          </Text>
        </View>
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
            <View
              collapsable={false}
              pointerEvents="none"
              ref={gemMeasureRef}
              style={[styles.bonusGemCorner, gemLifted && styles.bonusGemLifted]}>
              <GemIcon
                color={solved ? '#66D7FF' : '#BDEFFF'}
                facetColor={solved ? '#FFFFFF' : '#258AAF'}
                outlineColor="#0B5875"
                size={14}
              />
            </View>
            <View style={styles.bonusOperationCorner}>
              <Text style={styles.bonusOperationCornerText}>{operation.symbol}</Text>
            </View>
            <Text style={styles.bonusTargetValue}>{target.value}</Text>
            <View style={styles.bonusTargetMeta}>
              <Text style={styles.bonusTargetSteps}>
                {Array.from({ length: target.steps }, () => '●').join(' ')}
              </Text>
            </View>
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
  const { locale, t } = useI18n();
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
      accessibilityLabel={t('home.gemsA11y', { value: displayValue })}
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
        {displayValue.toLocaleString(locale)}
      </Text>
      {gain > 0 ? (
        <Animated.Text
          pointerEvents="none"
          style={[
            styles.counterGain,
            { opacity: gainOpacity, transform: [{ translateY: gainTranslateY }] },
          ]}>
          +{gain.toLocaleString(locale)}
        </Animated.Text>
      ) : null}
    </Animated.View>
  );
}

function ScorePill({
  compact,
  measureRef,
  score,
}: {
  compact: boolean;
  measureRef?: MutableRefObject<View | null>;
  score: number;
}) {
  const { locale, t } = useI18n();
  const { displayValue, gain, gainOpacity, gainScale, gainTranslateY } = useAnimatedCounter(score);

  return (
    <Animated.View
      ref={measureRef}
      accessibilityLabel={t('home.pointsA11y', { value: displayValue })}
      style={[
        styles.scoreButton,
        compact && styles.scoreButtonCompact,
        { transform: [{ scale: gainScale }] },
      ]}>
      <Text style={styles.scoreStar}>★</Text>
      <View style={styles.scoreCopy}>
        <Text style={styles.scoreLabel}>{t('common.score')}</Text>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.62}
          numberOfLines={1}
          style={[styles.scoreText, compact && styles.scoreTextCompact]}>
          {displayValue.toLocaleString(locale)}
        </Text>
      </View>
      {gain > 0 ? (
        <Animated.Text
          pointerEvents="none"
          style={[
            styles.counterGain,
            { opacity: gainOpacity, transform: [{ translateY: gainTranslateY }] },
          ]}>
          +{gain.toLocaleString(locale)}
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
  const { language, t } = useI18n();
  const country = COUNTRY_BY_ID.get(levelData.countryId);
  const countryName = country ? localizeCountry(country, language) : levelData.country;
  const operation = OPERATION_DETAILS[levelData.op];
  const countryProgress = country ? getCountryProgress(level, country.id) : 0;
  const countryLevelCount = country?.levelCount ?? COUNTRY_LEVEL_COUNT;
  const challengeProgress = Math.max(0, Math.min(1, countryProgress - (COUNTRY_LEVEL_COUNT - 3)));
  const [challengePulse] = useState(() => new Animated.Value(0));
  const [operationHint] = useState(() => new Animated.Value(0));
  // Kullanıcının kayıtlı yolculuğu ilk seviyeden başlamayabilir; eğitim
  // bilgisi bu yüzden mutlak seviye numarasına bağlı olmadan gösterilir.
  const showOperationHint = active && !levelData.countryChallenge;

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

  useEffect(() => {
    operationHint.stopAnimation();
    operationHint.setValue(0);
    if (!showOperationHint) return;
    const animation = Animated.sequence([
      Animated.timing(operationHint, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(2100),
      Animated.timing(operationHint, {
        toValue: 0,
        duration: 260,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [operationHint, showOperationHint, levelData.op]);

  return (
    <LinearGradient
      colors={
        levelData.countryChallenge
          ? ['rgba(36,139,151,0.98)', 'rgba(35,83,111,0.98)']
          : ['rgba(62,100,114,0.94)', 'rgba(38,63,77,0.93)']
      }
      end={{ x: 0, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={[styles.journeyStrip, levelData.countryChallenge && styles.journeyStripChallenge]}>
      <View
        style={[
          styles.journeyTopRow,
          levelData.countryChallenge && styles.journeyTopRowChallenge,
        ]}>
        <View style={styles.journeyCountryGroup}>
          {levelData.countryChallenge ? (
            <Animated.View
              accessibilityLabel={`${t('modal.countryChallenge')}, ${countryName}`}
              style={[
                styles.journeyChallengeBadge,
                {
                  opacity: challengePulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.94, 1],
                  }),
                  transform: [
                    {
                      scale: challengePulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.035],
                      }),
                    },
                  ],
                },
              ]}>
              <Text style={styles.journeyChallengeTrophy}>🏆</Text>
              <View style={styles.journeyChallengeCopy}>
                <Text numberOfLines={1} style={styles.journeyChallengeTitle}>
                  {t('modal.countryChallenge')}
                </Text>
                <Text numberOfLines={1} style={styles.journeyChallengeCountry}>
                  {levelData.flag} {countryName}
                </Text>
              </View>
            </Animated.View>
          ) : (
            <Text numberOfLines={1} style={styles.journeyCountry}>
              ✦ {levelData.flag} {countryName}
            </Text>
          )}
        </View>
        {showOperationHint ? (
          <Animated.View
            style={[
              styles.journeyOperationChip,
              {
                opacity: operationHint,
                transform: [{
                  translateX: operationHint.interpolate({ inputRange: [0, 1], outputRange: [56, 0] }),
                }],
              },
            ]}>
            <Text numberOfLines={1} style={styles.journeyOperationText}>
              {localizeOperation(operation.symbol).toLocaleUpperCase()} • {operation.symbol}
            </Text>
          </Animated.View>
        ) : null}
        <View
          accessible
          accessibilityLabel={`${countryProgress} / ${countryLevelCount}`}
          style={styles.journeyCountChip}>
          <Text style={styles.journeyCountCurrent}>{countryProgress}</Text>
          <Text style={styles.journeyCountDivider}>/</Text>
          <Text style={styles.journeyCountTotal}>{countryLevelCount}</Text>
        </View>
      </View>

      <View accessibilityLabel={t('game.cityProgress', { country: countryName })} style={styles.citySteps}>
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
          accessibilityLabel={t('game.challengeProgress', { progress: challengeProgress })}
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
  const { language, t } = useI18n();
  const { width, height } = useWindowDimensions();
  const contentBootstrap = useContentImageBootstrap();
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
  const [gemCount, setGemCount] = useState(INITIAL_GEM_COUNT);
  const [rewardedRouteIds, setRewardedRouteIds] = useState<Set<string>>(() => new Set());
  const [performanceHistory, setPerformanceHistory] = useState<PuzzlePerformance[]>([]);
  const [learningScore, setLearningScore] = useState(INITIAL_LEARNING_SCORE);
  const [learningLevel, setLearningLevel] = useState(INITIAL_LEARNING_LEVEL);
  const [cityDifficultyModifier, setCityDifficultyModifier] =
    useState<DifficultyModifier>(0);
  const [cityDifficultyLocationId, setCityDifficultyLocationId] = useState(
    () => levelData.locationId,
  );
  const [consecutiveStruggles, setConsecutiveStruggles] = useState(0);
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
  const [musicVolume, setMusicVolume] = useState(DEFAULT_MUSIC_VOLUME);
  const [celebrating, setCelebrating] = useState(false);
  const [celebrationFull, setCelebrationFull] = useState(true);
  const [routeRewardToast, setRouteRewardToast] = useState<string | null>(null);
  const [dailySummary, setDailySummary] = useState<{
    claimed: boolean;
    completed: boolean;
    streak: number;
  } | null>(null);
  const [destinationTransition, setDestinationTransition] =
    useState<DestinationTransitionState | null>(null);
  const [countryCompletionLevel, setCountryCompletionLevel] = useState<number | null>(null);
  const [wheelOutroToken, setWheelOutroToken] = useState(0);
  const [wheelIntroToken, setWheelIntroToken] = useState<number | undefined>();
  const [resultFlights, setResultFlights] = useState<ResultFlight[]>([]);
  const [cardGemLift, setCardGemLift] = useState<CardGemLift | null>(null);
  const [gemLifting, setGemLifting] = useState(false);
  const [flyingTargets, setFlyingTargets] = useState<Set<number>>(() => new Set());
  const [bonusFlying, setBonusFlying] = useState(false);
  const [selectionCount, setSelectionCount] = useState(0);
  const [landedTarget, setLandedTarget] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [tutorialVisible, setTutorialVisible] = useState(false);
  const [operationGuideVisible, setOperationGuideVisible] = useState(false);
  const [operationGuideSymbol, setOperationGuideSymbol] = useState<string | undefined>();
  const [splashDismissed, setSplashDismissed] = useState(false);
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
  const navigateDaily = useCallback(() => navigateToScreen('daily'), [navigateToScreen]);
  const openSettings = useCallback(() => setSettingsVisible(true), []);
  const resultLayerRef = useRef<View>(null);
  const resultSourceRef = useRef<View>(null);
  const targetCardRefs = useRef<(View | null)[]>([]);
  const bonusCardRef = useRef<View>(null);
  const bonusGemRef = useRef<View | null>(null);
  const gemTargetRef = useRef<View>(null);
  const scoreTargetRef = useRef<View>(null);
  const levelScorePending = useRef(0);
  const targetScoreAwardsRef = useRef(new Map<number, number>());
  const performanceHistoryRef = useRef<PuzzlePerformance[]>([]);
  const learningScoreRef = useRef(INITIAL_LEARNING_SCORE);
  const learningLevelRef = useRef(INITIAL_LEARNING_LEVEL);
  const cityDifficultyModifierRef = useRef<DifficultyModifier>(0);
  const cityDifficultyLocationIdRef = useRef(levelData.locationId);
  const consecutiveStrugglesRef = useRef(0);
  const gameplayVisibleRef = useRef(false);
  const puzzleActivityRef = useRef<PuzzleActivity>({
    activeMs: 0,
    hintsUsed: 0,
    wrongAttempts: 0,
    lastInteractionAt: null,
  });
  const nextFlightId = useRef(1);
  const claimedFlightEventsRef = useRef(new Set<string>());
  const scheduledFollowUpIdsRef = useRef(new Set<number>());
  const gemFlightActiveRef = useRef(false);
  const discoveredBonuses = useRef(new Set<string>());
  const feedbackTimer = useRef<Timer | null>(null);
  const hintTimer = useRef<Timer | null>(null);
  const hintActiveRef = useRef(false);
  const operationGuideStateRef = useRef<OperationGuideState>(EMPTY_OPERATION_GUIDE_STATE);
  const bonusGemTimer = useRef<Timer | null>(null);
  const landingTimer = useRef<Timer | null>(null);
  const levelTimer = useRef<Timer | null>(null);

  const layout = getGameLayout(width, height);
  const { compact, compactHeader, wheelSize } = layout;
  const playSound = useGameSounds(effectsEnabled);
  const musicDucked =
    celebrating ||
    (activeScreen === 'game' && countryCompletionLevel !== null) ||
    destinationTransition !== null;
  useBackgroundMusic(hydrated && musicEnabled, musicVolume, musicDucked);
  const grantHintAdGems = useCallback(() => {
    setGemCount((count) => count + HINT_AD_GEM_REWARD);
  }, []);
  const { requestRewardedHintAd, offerHintAd, hintAdReward } = useRewardedHintAd({
    gemCount,
    hintCost: HINT_GEM_COST,
    onEarned: grantHintAdGems,
  });
  const { presentTransitionAd } = useInterstitialTransition(levelData.countryIndex);
  const targetWidth = (levelData.targets.length === 3 ? '31.6%' : '23.5%') as `${number}%`;
  const feedbackColors = feedback ? getFeedbackColors(feedback.tone) : null;
  const levelJustCompleted = hasCompletedRequiredTargets(solvedTargets.size, levelData);
  const displayedProgressLevel = levelData.level + (levelJustCompleted ? 1 : 0);
  const gameplayVisible =
    activeScreen === 'game' &&
    !settingsVisible &&
    countryCompletionLevel === null &&
    destinationTransition === null &&
    !celebrating;

  const pausePuzzleActivity = useCallback(() => {
    const activity = puzzleActivityRef.current;
    if (activity.lastInteractionAt === null) return;
    activity.activeMs += Math.min(
      Date.now() - activity.lastInteractionAt,
      ACTIVITY_IDLE_TIMEOUT_MS,
    );
    activity.lastInteractionAt = null;
  }, []);

  const resumePuzzleActivity = useCallback(() => {
    if (!gameplayVisibleRef.current || AppState.currentState !== 'active') return;
    puzzleActivityRef.current.lastInteractionAt = Date.now();
  }, []);

  const markPuzzleActivity = useCallback(() => {
    if (!gameplayVisibleRef.current || AppState.currentState !== 'active') return;
    const activity = puzzleActivityRef.current;
    const now = Date.now();
    if (activity.lastInteractionAt !== null) {
      activity.activeMs += Math.min(
        now - activity.lastInteractionAt,
        ACTIVITY_IDLE_TIMEOUT_MS,
      );
    }
    activity.lastInteractionAt = now;
  }, []);

  const resetPuzzleActivity = useCallback(() => {
    puzzleActivityRef.current = {
      activeMs: 0,
      hintsUsed: 0,
      wrongAttempts: 0,
      lastInteractionAt:
        gameplayVisibleRef.current && AppState.currentState === 'active'
          ? Date.now()
          : null,
    };
  }, []);

  const recordCompletedPuzzlePerformance = useCallback(() => {
    markPuzzleActivity();
    const activity = puzzleActivityRef.current;
    const performance: PuzzlePerformance = {
      activeMs: activity.activeMs,
      hintsUsed: activity.hintsUsed,
      wrongAttempts: activity.wrongAttempts,
    };
    const nextHistory = appendPerformance(performanceHistoryRef.current, performance);
    const nextLearningScore = updateLearningScore(learningScoreRef.current, performance);
    const struggling = ratePuzzlePerformance(performance) === 'struggling';
    const nextConsecutiveStruggles = struggling
      ? Math.min(2, consecutiveStrugglesRef.current + 1)
      : 0;

    performanceHistoryRef.current = nextHistory;
    learningScoreRef.current = nextLearningScore;
    consecutiveStrugglesRef.current = nextConsecutiveStruggles;
    setPerformanceHistory(nextHistory);
    setLearningScore(nextLearningScore);
    setConsecutiveStruggles(nextConsecutiveStruggles);
    pausePuzzleActivity();
  }, [markPuzzleActivity, pausePuzzleActivity]);

  useEffect(() => {
    gameplayVisibleRef.current = gameplayVisible;
    if (gameplayVisible && AppState.currentState === 'active') {
      resumePuzzleActivity();
    } else {
      pausePuzzleActivity();
    }
  }, [gameplayVisible, level, pausePuzzleActivity, resumePuzzleActivity]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && gameplayVisibleRef.current) {
        resumePuzzleActivity();
      } else {
        pausePuzzleActivity();
      }
    });
    return () => subscription.remove();
  }, [pausePuzzleActivity, resumePuzzleActivity]);

  useEffect(() => {
    let active = true;

    void loadGameProgress().then(async (saved) => {
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
              saved.cityDifficultyModifier,
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
        setRewardedRouteIds(new Set(saved.rewardedRouteIds));
        setPerformanceHistory(saved.performanceHistory);
        performanceHistoryRef.current = saved.performanceHistory;
        setLearningScore(saved.learningScore);
        learningScoreRef.current = saved.learningScore;
        setLearningLevel(saved.learningLevel);
        learningLevelRef.current = saved.learningLevel;
        setCityDifficultyModifier(saved.cityDifficultyModifier);
        cityDifficultyModifierRef.current = saved.cityDifficultyModifier;
        setCityDifficultyLocationId(saved.cityDifficultyLocationId);
        cityDifficultyLocationIdRef.current = saved.cityDifficultyLocationId;
        setConsecutiveStruggles(saved.consecutiveStruggles);
        consecutiveStrugglesRef.current = saved.consecutiveStruggles;
        setScore(saved.score ?? legacyScore);
        setEffectsEnabled(saved.effectsEnabled);
        setMusicEnabled(saved.musicEnabled);
        setMusicVolume(saved.musicVolume);
        discoveredBonuses.current = new Set(saved.discoveredBonuses);
      }

      const [tutorialValue, operationGuideValue] = await Promise.all([
        AsyncStorage.getItem(TUTORIAL_STORAGE_KEY),
        AsyncStorage.getItem(OPERATION_GUIDE_STORAGE_KEY),
      ]);
      if (!active) return;
      setHydrated(true);
      if (tutorialValue !== 'done') setTutorialVisible(true);
      if (operationGuideValue) {
        operationGuideStateRef.current = parseOperationGuideState(operationGuideValue);
      }
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
      rewardedRouteIds: [...rewardedRouteIds],
      performanceHistory,
      learningScore,
      learningLevel,
      cityDifficultyModifier,
      cityDifficultyLocationId,
      consecutiveStruggles,
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
    rewardedRouteIds,
    performanceHistory,
    learningScore,
    learningLevel,
    cityDifficultyModifier,
    cityDifficultyLocationId,
    consecutiveStruggles,
  ]);

  useEffect(() => {
    if (!hydrated) return;
    if (tutorialVisible) {
      setOperationGuideVisible(false);
      return;
    }
    if (activeScreen !== 'game') return;
    if (levelData.locationLevel !== 1) {
      setOperationGuideVisible(false);
      return;
    }
    if (!shouldShowOperationGuide(levelData, operationGuideStateRef.current)) return;

    const next = rememberShownOperationGuide(levelData, operationGuideStateRef.current);
    operationGuideStateRef.current = next;
    setOperationGuideSymbol(OPERATION_DETAILS[levelData.op].symbol);
    setOperationGuideVisible(true);
    void AsyncStorage.setItem(OPERATION_GUIDE_STORAGE_KEY, JSON.stringify(next)).catch(
      () => undefined,
    );
  }, [activeScreen, hydrated, levelData, tutorialVisible]);

  useEffect(() => {
    if (activeScreen !== 'daily') return;
    logDailyStart();
  }, [activeScreen]);

  useEffect(
    () => () => {
      clearTimer(feedbackTimer);
      clearTimer(hintTimer);
      clearTimer(bonusGemTimer);
      clearTimer(landingTimer);
      clearTimer(levelTimer);
    },
    [],
  );

  useEffect(() => {
    if (!hydrated || mountedShellScreens.has('game')) return;
    // InteractionManager is deprecated in newer React Native releases. A
    // deferred macrotask keeps the shell mount off the current render without
    // relying on the deprecated interaction queue.
    const task = setTimeout(() => {
      setMountedShellScreens((current) => {
        if (current.has('game')) return current;
        const next = new Set(current);
        next.add('game');
        return next;
      });
    }, 0);
    return () => clearTimeout(task);
  }, [hydrated, mountedShellScreens]);

  useEffect(() => {
    if (
      activeScreen === 'home' ||
      activeScreen === 'travel' ||
      settingsVisible ||
      (activeScreen === 'game' && countryCompletionLevel !== null)
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
    countryCompletionLevel,
    navigateToScreen,
    settingsVisible,
  ]);

  const triggerEffect = useCallback(
    (kind: GameSound, force = false) => {
      const playback = playSound(kind, force);
      if (!effectsEnabled) return playback;
      if (kind.startsWith('select')) {
        // Birleştirme sırasında ses olabilir, ancak düğüm düğüme
        // titreşim verilmez; haptic yalnızca sonuç/aksiyon geri bildirimidir.
        return playback;
      }
      if (kind === 'points' || kind === 'pointsRising') return playback;
      const playHaptic = () => {
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
      };

      // Haptic'i sabit bir süre geciktirmek yerine player gerçekten play
      // komutunu aldığı anda başlat. Böylece cold load ve seek süreleri
      // cihazdan cihaza değişse de shuffle sesiyle titreşim ayrışmaz.
      if (playback) {
        void playback.then(playHaptic);
      } else {
        playHaptic();
      }
      return playback;
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
    }, TARGET_LANDING_MS);
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

  const launchGemFlight = useCallback(async (reward: number) => {
    if (gemFlightActiveRef.current) return;
    gemFlightActiveRef.current = true;
    const [rootRect, sourceRect, targetRect] = await Promise.all([
      measureViewInWindow(resultLayerRef.current),
      measureViewInWindow(bonusGemRef.current ?? bonusCardRef.current),
      measureViewInWindow(gemTargetRef.current),
    ]);

    if (!rootRect || !sourceRect || !targetRect) {
      gemFlightActiveRef.current = false;
      setGemCount((count) => count + reward);
      return;
    }

    const lift = createCardGemLift({
      id: nextFlightId.current,
      value: reward,
      rootRect,
      sourceRect,
      targetRect,
    });
    nextFlightId.current += 1;
    setCardGemLift((current) => current ?? lift);
  }, []);

  const scheduleBonusGemFlight = useCallback(
    (reward: number, delay = BONUS_GEM_LAUNCH_DELAY) => {
      clearTimer(bonusGemTimer);
      bonusGemTimer.current = setTimeout(() => {
        bonusGemTimer.current = null;
        triggerEffect('diamond');
        void launchGemFlight(reward);
      }, delay);
    },
    [launchGemFlight, triggerEffect],
  );

  const launchScoreFlights = useCallback(
    async (awards: readonly ScoreAward[]) => {
      const total = awards.reduce((sum, award) => sum + award.value, 0);
      if (total <= 0) return 0;

      const sourceViews = awards.map(
        ({ targetIndex }) => targetCardRefs.current[targetIndex] ?? null,
      );
      const [rootRect, targetRect, ...sourceRects] = await Promise.all([
        measureViewInWindow(resultLayerRef.current),
        measureViewInWindow(scoreTargetRef.current),
        ...sourceViews.map((view) => measureViewInWindow(view)),
      ]);
      const fallbackSource = sourceRects.find(
        (rect): rect is MeasuredRect => rect !== null,
      );

      if (!rootRect || !targetRect || !fallbackSource) {
        setScore((currentScore) => currentScore + total);
        triggerEffect('pointsRising');
        return 0;
      }

      const flights = awards.map((award, index): ResultFlight => {
        const sourceRect = sourceRects[index] ?? fallbackSource;
        const flight = createResultFlight({
          id: nextFlightId.current,
          kind: 'points',
          value: award.value,
          delay: index * POINTS_FLIGHT_STAGGER,
          rootRect,
          sourceRect,
          targetRect,
          targetIndex: award.targetIndex,
        });
        nextFlightId.current += 1;
        return flight;
      });

      triggerEffect('pointsRising');
      setResultFlights((current) => [...current, ...flights]);
      return POINTS_FLIGHT_DURATION + (flights.length - 1) * POINTS_FLIGHT_STAGGER;
    },
    [triggerEffect],
  );

  const handleResultFlightArrive = useCallback(
    (flight: ResultFlight) => {
      const eventKey = resultFlightEventKey(flight);
      if (claimedFlightEventsRef.current.has(eventKey)) return;
      claimedFlightEventsRef.current.add(eventKey);

      if (flight.kind === 'gem') {
        setGemCount((count) => count + flight.value);
        return;
      }
      if (flight.kind === 'points') {
        setScore((currentScore) => currentScore + flight.value);
        return;
      }
      revealTarget(flight.targetIndex);
    },
    [revealTarget],
  );

  const handleResultFlightComplete = useCallback(
    (flight: ResultFlight) => {
      setResultFlights((current) => current.filter((item) => item.id !== flight.id));
      if (flight.kind === 'gem') {
        gemFlightActiveRef.current = false;
      }
      if (flight.followUpGemReward === undefined) return;
      if (scheduledFollowUpIdsRef.current.has(flight.id)) return;
      scheduledFollowUpIdsRef.current.add(flight.id);
      scheduleBonusGemFlight(flight.followUpGemReward);
    },
    [scheduleBonusGemFlight],
  );

  const handleCardGemArrive = useCallback((lift: CardGemLift) => {
    const eventKey = cardGemLiftEventKey(lift);
    if (claimedFlightEventsRef.current.has(eventKey)) return;
    claimedFlightEventsRef.current.add(eventKey);
    setGemCount((count) => count + lift.value);
  }, []);

  const handleCardGemComplete = useCallback((lift: CardGemLift) => {
    setCardGemLift((current) => (current?.id === lift.id ? null : current));
    gemFlightActiveRef.current = false;
    setGemLifting(false);
  }, []);

  const handleCardGemLiftStart = useCallback(() => {
    setGemLifting(true);
  }, []);

  const launchResultFlight = useCallback(
    async (
      value: number,
      targetIndex: number,
      resultOrigin?: ScreenPoint,
      followUpGemReward?: number,
    ) => {
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
        if (followUpGemReward !== undefined) scheduleBonusGemFlight(followUpGemReward);
        return;
      }

      const flight = createResultFlight({
        id: nextFlightId.current,
        kind: 'result',
        value,
        followUpGemReward,
        rootRect,
        sourceRect,
        targetRect,
        origin: resultOrigin,
        targetIndex,
      });
      nextFlightId.current += 1;
      setResultFlights((current) => [...current, flight]);
    },
    [revealTarget, scheduleBonusGemFlight],
  );

  const startLevel = useCallback((nextLevel: number, previousTargetValues: readonly number[]) => {
    clearTimer(feedbackTimer);
    clearTimer(hintTimer);
    hintActiveRef.current = false;
    clearTimer(bonusGemTimer);
    clearTimer(landingTimer);
    claimedFlightEventsRef.current.clear();
    scheduledFollowUpIdsRef.current.clear();
    gemFlightActiveRef.current = false;
    setCardGemLift(null);
    setGemLifting(false);
    const nextDestination = resolveTravelLevel(nextLevel);
    const globalCountryIndex = Math.floor((nextLevel - 1) / COUNTRY_LEVEL_COUNT);
    let nextDifficultyModifier = cityDifficultyModifierRef.current;
    let nextDifficultyLocationId = cityDifficultyLocationIdRef.current;

    if (!isAdaptiveDifficultyEnabled(globalCountryIndex)) {
      nextDifficultyModifier = 0;
      consecutiveStrugglesRef.current = 0;
      if (!nextDestination.countryChallenge) {
        nextDifficultyLocationId = nextDestination.location.id;
      }
    } else if (
      !nextDestination.countryChallenge &&
      nextDestination.location.id !== cityDifficultyLocationIdRef.current
    ) {
      nextDifficultyModifier = difficultyModifierFromLearningScore(learningScoreRef.current);
      nextDifficultyLocationId = nextDestination.location.id;
      consecutiveStrugglesRef.current = 0;
      const previousCountryIndex = Math.floor((nextLevel - 2) / COUNTRY_LEVEL_COUNT);
      if (isAdaptiveDifficultyEnabled(previousCountryIndex)) {
        const nextLearningLevel = updateLearningLevel(
          learningLevelRef.current,
          nextDifficultyModifier,
          learningScoreRef.current,
        );
        learningLevelRef.current = nextLearningLevel;
        setLearningLevel(nextLearningLevel);
      }
    } else if (!nextDestination.countryChallenge) {
      const relief = applyConsecutiveStruggleRelief(
        nextDifficultyModifier,
        consecutiveStrugglesRef.current,
      );
      nextDifficultyModifier = relief.modifier;
      consecutiveStrugglesRef.current = relief.consecutiveStruggles;
    }

    cityDifficultyModifierRef.current = nextDifficultyModifier;
    cityDifficultyLocationIdRef.current = nextDifficultyLocationId;
    setCityDifficultyModifier(nextDifficultyModifier);
    setCityDifficultyLocationId(nextDifficultyLocationId);
    setConsecutiveStruggles(consecutiveStrugglesRef.current);

    const nextLevelData = generateLevelData(
      nextLevel,
      previousTargetValues,
      nextDifficultyModifier,
    );
    setLevel(nextLevel);
    setLevelData(nextLevelData);
    setWheelIntroToken(nextLevel);
    levelScorePending.current = 0;
    targetScoreAwardsRef.current.clear();
    setSelectionCount(0);
    setSolvedTargets(new Set());
    setBonusSolved(false);
    setBonusFlying(false);
    setFeedback(null);
    setHintIndices([]);
    setHintedTarget(null);
    setResultFlights([]);
    setCardGemLift(null);
    setGemLifting(false);
    setFlyingTargets(new Set());
    setLandedTarget(null);
    setCelebrating(false);
    setCelebrationFull(true);
    setDestinationTransition(null);
    setCountryCompletionLevel(null);
    resetPuzzleActivity();
  }, [resetPuzzleActivity]);

  const startLevelAfterWheelOutro = useCallback(
    (nextLevel: number, previousTargetValues: readonly number[]) => {
      // Konfeti ve destinasyon kartı çarkı örter. Token'ı kartın/kutlamanın
      // arkasında sessizce tüketme: overlay kapanır, sonra 220 ms outro görünür,
      // ardından startLevel intro'yu (460 ms) çark açıkken başlatır.
      // Ülke modalı burada kapanmaz; outro modal altında park edebilir, intro
      // modal kapanıp oyun görününce oynar.
      const beginOutro = () => {
        setCelebrating(false);
        setDestinationTransition(null);
        setWheelOutroToken((token) => token + 1);
        clearTimer(levelTimer);
        levelTimer.current = setTimeout(() => {
          startLevel(nextLevel, previousTargetValues);
        }, NODE_OUTRO_DURATION);
      };

      const nextDestination = resolveTravelLevel(nextLevel);
      const from = {
        countryIndex: levelData.countryIndex,
        locationId: levelData.locationId,
      };
      const to = {
        countryIndex: nextDestination.countryIndex,
        locationId: nextDestination.location.id,
      };

      setCelebrating(false);
      setDestinationTransition(null);
      void presentTransitionAd(from, to).finally(beginOutro);
    },
    [levelData.countryIndex, levelData.locationId, presentTransitionAd, startLevel],
  );

  const handlePreview = useCallback(
    (indices: number[]) => {
      if (indices.length === 0) {
        setFeedback((current) => (current?.tone === 'live' ? null : current));
        return;
      }
      clearTimer(feedbackTimer);
      const values = indices.map((index) => levelData.numbers[index]);
      setFeedback({ text: formatLiveExpression(values, levelData.op), tone: 'live' });
    },
    [levelData],
  );

  const handleComplete = useCallback(
    (indices: number[], resultOrigin?: ScreenPoint): WheelSelectionOutcome => {
      markPuzzleActivity();
      if (indices.length < 2) {
        setFeedback(null);
        return 'invalid';
      }

      const values = indices.map((index) => levelData.numbers[index]);
      const calculation = computeResult(values, levelData.op);
      if (!calculation) {
        puzzleActivityRef.current.wrongAttempts += 1;
        showTimedFeedback({ text: t('feedback.invalid'), tone: 'info' });
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
        hintActiveRef.current = false;
        setHintIndices([]);
        setHintedTarget(null);
        // Hedefi çözen yol da keşfedilmiş bir kombinasyondur; aynı yol daha
        // sonra açık hedef yokken tekrar bonus kazandıramaz.
        discoveredBonuses.current.add(combinationKey);
        const nextSolved = new Set(solvedTargets);
        nextSolved.add(targetIndex);
        setFlyingTargets((current) => new Set(current).add(targetIndex));
        setSolvedTargets(nextSolved);
        const earnedPoints = getTargetScore(values);
        levelScorePending.current += earnedPoints;
        targetScoreAwardsRef.current.set(targetIndex, earnedPoints);
        triggerEffect('success');
        void launchResultFlight(calculation.result, targetIndex, resultOrigin);

        if (hasCompletedRequiredTargets(nextSolved.size, levelData)) {
          recordCompletedPuzzlePerformance();
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
              ? t('feedback.newRouteStamp')
              : t('feedback.passportStamp');
          const completedCountryName = completedCountryRecord
            ? localizeCountry(completedCountryRecord)
            : levelData.country;
          const completionMessage = travelCompletion.worldTourCompleted
            ? t('feedback.worldComplete', { done: TOTAL_COUNTRIES, total: TOTAL_COUNTRIES })
            : completedCountry
              ? t('feedback.countryComplete', { country: completedCountryName, passport: passportReward, landmark: completedCountryRecord?.rewardLandmark ?? completedCountryName })
              : completedLocation
                ? t('feedback.locationComplete', { city: levelData.city, next:
                    nextDestination.countryChallenge
                      ? t('feedback.challengeUnlocked', { country: completedCountryName })
                      : t('feedback.destinationUnlocked', { destination: nextDestination.location.name })
                  })
                : t('feedback.puzzleComplete', { current: levelData.locationLevel, total: levelData.locationLevelCount, city: levelData.city });
          const fullCeremony = completedLocation || completedCountry;
          showTimedFeedback(
            {
              text: t('feedback.levelComplete', { points: levelScorePending.current, message: completionMessage }),
              tone: 'success',
            },
            fullCeremony
              ? LEVEL_CELEBRATION_DELAY +
                SCORE_FLIGHT_START_DELAY +
                POINTS_FLIGHT_DURATION +
                Math.max(0, nextSolved.size - 1) * POINTS_FLIGHT_STAGGER +
                250
              : SHORT_CELEBRATION_DELAY + POINTS_FLIGHT_DURATION + 80,
          );
          clearTimer(levelTimer);
          levelTimer.current = setTimeout(() => {
            const completionScore = levelScorePending.current;
            const scoreAwards = Array.from(
              targetScoreAwardsRef.current,
              ([awardTargetIndex, value]) => ({ targetIndex: awardTargetIndex, value }),
            ).sort((left, right) => left.targetIndex - right.targetIndex);
            const recordedScore = scoreAwards.reduce((sum, award) => sum + award.value, 0);
            if (completionScore <= 0) {
              scoreAwards.splice(0, scoreAwards.length);
            } else if (recordedScore !== completionScore) {
              const finalAward = scoreAwards.find((award) => award.targetIndex === targetIndex);
              const otherAwardsScore = finalAward
                ? recordedScore - finalAward.value
                : recordedScore;
              if (finalAward && completionScore > otherAwardsScore) {
                finalAward.value = completionScore - otherAwardsScore;
              } else {
                scoreAwards.splice(0, scoreAwards.length, {
                  targetIndex,
                  value: completionScore,
                });
              }
            }
            levelScorePending.current = 0;
            targetScoreAwardsRef.current.clear();
            setCelebrationFull(fullCeremony);
            setCelebrating(true);
            if (fullCeremony) {
              triggerEffect('levelComplete');
            }

            const beginScoreFlights = () => {
              void launchScoreFlights(scoreAwards.filter((award) => award.value > 0)).then(
                (scoreFlightDuration) => {
                  const settleDelay = scoreFlightDuration > 0
                    ? scoreFlightDuration + (fullCeremony ? 140 : 80)
                    : 0;
                  const finishCompletion = () => {
                    if (completedCountry) {
                      setCountryCompletionLevel(completedPuzzleLevel);
                      return;
                    }

                    startLevelAfterWheelOutro(
                      completedPuzzleLevel + 1,
                      levelData.targets.map((target) => target.value),
                    );
                  };

                  if (completedLocation) {
                    levelTimer.current = setTimeout(() => {
                      setDestinationTransition({
                        completedEmoji: levelData.emoji,
                        completedName: levelData.city,
                        countryChallenge: nextDestination.countryChallenge,
                        nextEmoji: nextDestination.countryChallenge
                          ? levelData.flag
                          : nextDestination.location.emoji,
                        nextName: nextDestination.countryChallenge
                          ? completedCountryName
                          : nextDestination.location.name,
                      });
                      levelTimer.current = setTimeout(
                        finishCompletion,
                        nextDestination.countryChallenge
                          ? CHALLENGE_CARD_DURATION
                          : DESTINATION_CARD_DURATION,
                      );
                    }, settleDelay);
                    return;
                  }

                  levelTimer.current = setTimeout(
                    finishCompletion,
                    fullCeremony ? Math.max(1000, settleDelay) : Math.max(280, settleDelay),
                  );
                },
              );
            };

            if (fullCeremony) {
              levelTimer.current = setTimeout(beginScoreFlights, SCORE_FLIGHT_START_DELAY);
              return;
            }
            beginScoreFlights();
          }, fullCeremony ? LEVEL_CELEBRATION_DELAY : SHORT_CELEBRATION_DELAY);
        } else {
          showTimedFeedback(
            {
              text: t('feedback.targetFound', { result: calculation.result, points: earnedPoints }),
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
        const bonusGemReward = getBonusGemReward(
          bonusTarget.steps,
          levelData.countryChallenge,
        );
        setBonusFlying(true);
        triggerEffect('diamond');
        void launchResultFlight(
          calculation.result,
          BONUS_TARGET_INDEX,
          resultOrigin,
          bonusGemReward,
        );
        showTimedFeedback(
          {
            text: t('feedback.bonusSolved', { reward: bonusGemReward }),
            tone: 'bonus',
          },
          2250,
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
            text: t('feedback.bonusDiscovery', { reward: BONUS_DISCOVERY_GEM_REWARD, expression: calculation.expression, result: calculation.result }),
            tone: 'bonus',
          },
          1450,
        );
        return 'bonus';
      } else {
        puzzleActivityRef.current.wrongAttempts += 1;
        showTimedFeedback({ text: t('feedback.alreadyFound'), tone: 'info' });
        return 'invalid';
      }
    },
    [
      bonusSolved,
      launchScoreFlights,
      launchResultFlight,
      levelData,
      markPuzzleActivity,
      recordCompletedPuzzlePerformance,
      showTimedFeedback,
      solvedTargets,
      startLevelAfterWheelOutro,
      t,
      triggerEffect,
    ],
  );

  const handleHint = useCallback(() => {
    markPuzzleActivity();
    triggerEffect('hint');
    if (hintActiveRef.current) return;
    if (gemCount < HINT_GEM_COST) {
      if (offerHintAd) {
        void requestRewardedHintAd().then((result) => {
          if (result === 'unavailable') {
            showTimedFeedback({ text: t('feedback.hintAdPreparing'), tone: 'info' }, 1800);
          }
        });
        return;
      }
      showTimedFeedback(
        { text: t('feedback.noHints', { cost: HINT_GEM_COST }), tone: 'info' },
        1800,
      );
      return;
    }
    const targetIndex = levelData.targets.findIndex((_, index) => !solvedTargets.has(index));
    if (targetIndex < 0) return;
    const solution = findSolutionIndices(levelData.targets[targetIndex], levelData.numbers);
    if (!solution) {
      showTimedFeedback({ text: t('feedback.hintUnavailable'), tone: 'info' });
      return;
    }

    clearTimer(hintTimer);
    hintActiveRef.current = true;
    setGemCount((count) => count - HINT_GEM_COST);
    puzzleActivityRef.current.hintsUsed += 1;
    setHintIndices(solution);
    setHintedTarget(targetIndex);
    showTimedFeedback({ text: t('feedback.followGlow'), tone: 'bonus' }, 1700);
    hintTimer.current = setTimeout(() => {
      setHintIndices([]);
      setHintedTarget(null);
      hintActiveRef.current = false;
      hintTimer.current = null;
    }, 1800);
  }, [
    gemCount,
    levelData,
    markPuzzleActivity,
    offerHintAd,
    requestRewardedHintAd,
    showTimedFeedback,
    solvedTargets,
    t,
    triggerEffect,
  ]);

  const dismissOperationGuide = useCallback(() => {
    if (!operationGuideVisible) return;
    setOperationGuideVisible(false);
  }, [operationGuideVisible]);

  const handleWheelNodeAdded = useCallback(
    (selectionCount: number) => {
      dismissOperationGuide();
      setSelectionCount(selectionCount);
      markPuzzleActivity();
      triggerEffect(getNodeSelectionSound(selectionCount));
    },
    [dismissOperationGuide, markPuzzleActivity, triggerEffect],
  );

  const handleWheelNodeRemoved = useCallback(
    (selectionCount: number) => {
      setSelectionCount(selectionCount);
      markPuzzleActivity();
      triggerEffect(getNodeSelectionSound(selectionCount));
    },
    [markPuzzleActivity, triggerEffect],
  );

  const handleWheelDraggingChange = useCallback((dragging: boolean) => {
    if (!dragging) setSelectionCount(0);
  }, []);

  const handleWheelShuffle = useCallback(() => {
    markPuzzleActivity();
    setSelectionCount(0);
    setHintIndices([]);
    setHintedTarget(null);
    triggerEffect('shuffle');
  }, [markPuzzleActivity, triggerEffect]);

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

  const settleCountryCompletion = useCallback(
    (nextScreen: Extract<AppScreen, 'game' | 'travel'>) => {
      if (countryCompletionLevel === null) return;

      const completion = getTravelLevelCompletion(countryCompletionLevel);
      const previousTargetValues =
        levelData.level === countryCompletionLevel
          ? levelData.targets.map((target) => target.value)
          : [];
      const unlockedRouteId = completion.nextDestination.route.id;
      const earnedRouteReward =
        !completion.worldTourCompleted &&
        unlockedRouteId !== levelData.routeId &&
        !rewardedRouteIds.has(unlockedRouteId);

      if (earnedRouteReward) {
        setGemCount((count) => count + ROUTE_GEM_REWARD);
        setRewardedRouteIds((current) => new Set(current).add(unlockedRouteId));
        triggerEffect('diamond');
        setRouteRewardToast(t('feedback.routeGemToast', { count: ROUTE_GEM_REWARD }));
        setTimeout(() => setRouteRewardToast(null), 2200);
      }

      startLevelAfterWheelOutro(completion.nextDestination.globalLevel, previousTargetValues);
      navigateToScreen(nextScreen);
      showTimedFeedback(
        {
          text: completion.worldTourCompleted
            ? t('feedback.masterStarted')
            : t('feedback.countryUnlocked', {
                flag: completion.nextDestination.country.flag,
                country: localizeCountry(completion.nextDestination.country),
                destination: completion.nextDestination.location.name,
                reward: earnedRouteReward
                  ? t('feedback.routeGemReward', { count: ROUTE_GEM_REWARD })
                  : '',
              }),
          tone: 'success',
        },
        1800,
      );
    },
    [
      countryCompletionLevel,
      levelData,
      navigateToScreen,
      rewardedRouteIds,
      showTimedFeedback,
      startLevelAfterWheelOutro,
      t,
      triggerEffect,
    ],
  );

  const continueAfterCountryCompletion = useCallback(() => {
    settleCountryCompletion('game');
  }, [settleCountryCompletion]);

  const viewMapAfterCountryCompletion = useCallback(() => {
    if (countryCompletionLevel === null) return;
    navigateTravel();
  }, [countryCompletionLevel, navigateTravel]);

  const handleTutorialEffect = useCallback((sound: GameSound) => {
    // Eğitim shuffle'ı yalnız görsel + ses ile anlatılır; modal içindeki
    // yönlendirme için ayrıca haptic geri bildirim gerekli değildir.
    if (sound === 'shuffle') return playSound(sound, true);
    return triggerEffect(sound, true);
  }, [playSound, triggerEffect]);
  const handleTutorialDone = useCallback(() => {
    setTutorialVisible(false);
    void AsyncStorage.setItem(TUTORIAL_STORAGE_KEY, 'done');
    logTutorialComplete();
  }, []);

  const refreshDailySummary = useCallback(async () => {
    const dateKey = getLocalDateKey();
    const progress = await loadDailyChallengeProgress(dateKey, {
      countryIndex: levelData.countryIndex,
      learningScore,
      cityDifficultyModifier,
    });
    const challenge = getDailyChallenge(
      dateKey,
      skillFromDailyChallengeProgress(progress),
      progress.runSeed,
    );
    setDailySummary({
      claimed: progress.claimed,
      completed: isDailyChallengeComplete(progress, challenge) || progress.claimed,
      streak: progress.streak,
    });
  }, [cityDifficultyModifier, learningScore, levelData.countryIndex]);

  const handleDailyEffect = useCallback(
    (sound: GameSound) => {
      void triggerEffect(sound);
    },
    [triggerEffect],
  );

  const handleDailyReward = useCallback(
    (gems: number) => {
      setGemCount((count) => count + gems);
      void refreshDailySummary();
    },
    [refreshDailySummary],
  );

  const handleDailyScore = useCallback((points: number) => {
    setScore((current) => current + points);
  }, []);

  const handleDailySpendGems = useCallback((cost: number) => {
    setGemCount((count) => Math.max(0, count - cost));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void refreshDailySummary();
  }, [activeScreen, hydrated, refreshDailySummary]);

  if (!hydrated || !contentBootstrap.ready || !splashDismissed) {
    return <StartupSplash
      exiting={hydrated && contentBootstrap.ready}
      onExitComplete={() => setSplashDismissed(true)}
      progress={contentBootstrap.progress}
    />;
  }

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
        completedLevel={activeScreen === 'game' ? countryCompletionLevel : null}
        onClose={navigateHome}
        onContinue={continueAfterCountryCompletion}
        onViewMap={viewMapAfterCountryCompletion}
      />
      <FreshGameTutorialModal
        visible={tutorialVisible && activeScreen === 'game'}
        onDone={handleTutorialDone}
        onEffect={handleTutorialEffect}
      />
    </>
  );

  const persistentScreens = (
    <View
      accessibilityElementsHidden={activeScreen === 'game'}
      importantForAccessibility={activeScreen === 'game' ? 'no-hide-descendants' : 'auto'}
      key={`persistent-screens-${language}`}
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
                dailySummary={dailySummary}
                gemCount={gemCount}
                learningLevel={learningLevel}
                levelData={contentLevelData}
                onOpenCollection={navigateCollection}
                onOpenDaily={navigateDaily}
                onOpenProfile={navigateProfile}
                onOpenSettings={openSettings}
                onOpenTravel={navigateTravel}
                onPlay={openGame}
                score={score}
              />
            </View>
          ) : null}

          {activeScreen === 'daily' || mountedShellScreens.has('daily') ? (
            <View
              accessibilityElementsHidden={activeScreen !== 'daily'}
              importantForAccessibility={activeScreen === 'daily' ? 'auto' : 'no-hide-descendants'}
              pointerEvents={activeScreen === 'daily' ? 'auto' : 'none'}
              style={[styles.screen, activeScreen !== 'daily' && styles.hiddenScreen]}>
              <PersistentDailyChallenge
                active={activeScreen === 'daily'}
                cityDifficultyModifier={cityDifficultyModifier}
                countryIndex={levelData.countryIndex}
                gemCount={gemCount}
                learningScore={learningScore}
                onBack={navigateHome}
                onEffect={handleDailyEffect}
                onReward={handleDailyReward}
                onScore={handleDailyScore}
                onSpendGems={handleDailySpendGems}
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
                onHome={navigateHome}
                onMap={navigateTravel}
                onOpenPassport={navigateCollection}
                performanceHistory={performanceHistory}
                learningScore={learningScore}
                learningLevel={learningLevel}
                cityDifficultyModifier={cityDifficultyModifier}
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
                level={displayedProgressLevel}
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
      <View style={styles.screen}>
        {persistentScreens}
        {activeScreen === 'game' || mountedShellScreens.has('game') ? (
        <BlurTargetView
          key={`game-screen-${language}`}
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
                accessibilityLabel={t('game.homeA11y')}
                accessibilityRole="button"
                hitSlop={5}
                onPress={navigateHome}
                style={({ pressed }) => [
                  styles.skyControl,
                  pressed && styles.buttonPressed,
                ]}>
                <BackIcon />
              </Pressable>

              <ScorePill
                compact={compactHeader}
                measureRef={scoreTargetRef}
                score={score}
              />
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
                accessibilityLabel={t('settings.openA11y')}
                accessibilityRole="button"
                hitSlop={5}
                onPress={() => setSettingsVisible(true)}
                style={({ pressed }) => [styles.skyControl, pressed && styles.buttonPressed]}>
                <SettingsIcon />
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
            // Oyun tahtası, kontroller ve reklam aynı sabit ekran kompozisyonu
            // olarak kalmalı; reklam slotu açıldığında orta alan kaymamalı.
            nestedScrollEnabled={false}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            style={styles.scrollView}>
            <View style={styles.gameContent}>
              <LinearGradient
                colors={
                  levelData.countryChallenge
                    ? ['rgba(255,252,235,0.98)', 'rgba(229,242,235,0.97)']
                    : ['rgba(250,253,252,0.97)', 'rgba(225,238,238,0.96)']
                }
                end={{ x: 0, y: 1 }}
                start={{ x: 0, y: 0 }}
                style={[
                  styles.topSection,
                  levelData.countryChallenge && styles.topSectionChallenge,
                ]}>
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
                  countryChallenge={levelData.countryChallenge}
                  gemLifted={gemLifting}
                  gemMeasureRef={(view) => {
                    bonusGemRef.current = view;
                  }}
                  landed={landedTarget === BONUS_TARGET_INDEX}
                  measureRef={(view) => {
                    bonusCardRef.current = view;
                  }}
                  selectionCount={selectionCount}
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
                  key={`tour-${wheelSize}`}
                  canUseHint={gemCount >= HINT_GEM_COST}
                  hintCost={HINT_GEM_COST}
                  hintAdReward={hintAdReward}
                  offerHintAd={offerHintAd}
                  hintIndices={hintIndices}
                  introToken={wheelIntroToken}
                  motionEnabled={gameplayVisible}
                  numbers={levelData.numbers}
                  operationGuideSymbol={operationGuideVisible ? operationGuideSymbol : undefined}
                  onComplete={handleComplete}
                  onDraggingChange={handleWheelDraggingChange}
                  onHint={handleHint}
                  onNodeAdded={handleWheelNodeAdded}
                  onNodeRemoved={handleWheelNodeRemoved}
                  onPreview={handlePreview}
                  onShuffle={handleWheelShuffle}
                  outroToken={wheelOutroToken}
                  size={wheelSize}
                />
              </View>

            </View>
          </ScrollView>
          <View style={styles.gameAdSlot}>
            <AdMobBanner />
          </View>
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
          {cardGemLift ? (
            <CardGemLiftFlight
              key={cardGemLift.id}
              lift={cardGemLift}
              onArrive={handleCardGemArrive}
              onComplete={handleCardGemComplete}
              onLiftStart={handleCardGemLiftStart}
            />
          ) : null}
        </View>
        <Celebration compact={!celebrationFull} visible={celebrating} />
        {routeRewardToast ? (
          <View pointerEvents="none" style={styles.routeRewardToast}>
            <Text style={styles.routeRewardToastText}>{routeRewardToast}</Text>
          </View>
        ) : null}
        <DestinationTransition transition={destinationTransition} />
        </BlurTargetView>
        ) : null}
      </View>
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
  gameAdSlot: {
    // Reserve the banner height even when no ad is returned. This keeps the
    // wheel controls in a stable position when an ad appears later.
    height: AD_BANNER_SLOT_HEIGHT,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
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
    alignItems: 'center',
  },
  scoreLabel: {
    color: '#FFE9A9',
    fontFamily: FONTS.bold,
    fontSize: 6.5,
    lineHeight: 7,
    letterSpacing: 0.7,
    fontWeight: '700',
    textAlign: 'center',
  },
  scoreText: {
    color: '#FFFFFF',
    fontFamily: FONTS.black,
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  scoreTextCompact: {
    fontSize: 13,
  },
  counterGain: {
    position: 'absolute',
    top: -14,
    right: 0,
    left: 0,
    color: '#FFF1A8',
    fontFamily: FONTS.extraBold,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    textAlign: 'center',
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
    textAlign: 'center',
  },
  journeyStrip: {
    width: '94%',
    maxWidth: 488,
    height: 94,
    alignSelf: 'center',
    marginTop: 4,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 6,
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
    borderColor: '#FFE7A3',
    shadowColor: '#D9A62E',
    shadowOpacity: 0.34,
  },
  journeyTopRow: {
    minHeight: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  journeyTopRowChallenge: {
    minHeight: 34,
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
  journeyChallengeBadge: {
    minWidth: 0,
    flexShrink: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FFE7A3',
    backgroundColor: 'rgba(255,247,214,0.97)',
    shadowColor: '#704A08',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  journeyChallengeTrophy: {
    fontSize: 17,
    lineHeight: 21,
  },
  journeyChallengeCopy: {
    minWidth: 0,
    flexShrink: 1,
  },
  journeyChallengeTitle: {
    color: '#76500C',
    fontFamily: FONTS.black,
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 0.65,
    fontWeight: '900',
  },
  journeyChallengeCountry: {
    color: '#315464',
    fontFamily: FONTS.extraBold,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
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
    minWidth: 55,
    minHeight: 25,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#F8E9BA',
    backgroundColor: '#F3DA93',
  },
  journeyCountCurrent: {
    color: '#283F48',
    fontFamily: FONTS.black,
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '900',
  },
  journeyCountDivider: {
    marginHorizontal: 2,
    color: '#6D5B42',
    fontFamily: FONTS.extraBold,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
  },
  journeyCountTotal: {
    color: '#44342C',
    fontFamily: FONTS.black,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
  },
  citySteps: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: 3,
    gap: 3,
  },
  cityStepGroup: {
    flex: 1,
    minWidth: 0,
  },
  cityStepLine: {
    height: 36,
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
    height: 6,
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
  topSectionChallenge: {
    borderColor: '#E2BA5C',
    shadowColor: '#9B741D',
    shadowOpacity: 0.22,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 1,
  },
  requiredDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.2,
    borderColor: '#B98834',
    backgroundColor: 'rgba(255,255,255,0.54)',
  },
  requiredDotFilled: {
    backgroundColor: '#D9A83E',
    borderColor: '#A87521',
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
  targetSolvedBorder: {
    position: 'absolute',
    zIndex: 2,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 16,
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
  targetOperationCorner: {
    position: 'absolute',
    zIndex: 3,
    top: 5,
    right: 6,
    width: 21,
    height: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(85,119,130,0.38)',
    backgroundColor: 'rgba(222,239,240,0.94)',
  },
  targetOperationCornerSolved: {
    borderColor: 'rgba(35,120,91,0.42)',
    backgroundColor: 'rgba(232,250,239,0.94)',
  },
  targetOperationCornerText: {
    color: '#416B78',
    fontFamily: FONTS.black,
    fontSize: 15,
    lineHeight: 17,
    fontWeight: '900',
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
    fontSize: 11,
    fontWeight: '800',
  },
  targetDots: {
    color: '#557782',
    fontFamily: FONTS.bold,
    fontSize: 11,
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
  bonusStepBadge: {
    zIndex: 1,
    minHeight: 34,
    paddingHorizontal: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(201,145,43,0.55)',
    backgroundColor: 'rgba(255,249,219,0.68)',
  },
  bonusStepLabel: {
    color: '#876D3E',
    fontFamily: FONTS.bold,
    fontSize: 9,
    fontWeight: '800',
  },
  bonusStepDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  bonusStepDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#B98834',
    backgroundColor: 'rgba(255,255,255,0.54)',
  },
  bonusStepDotFilled: {
    borderColor: '#A87521',
    backgroundColor: '#D9A83E',
  },
  bonusRewardAnchor: {
    zIndex: 1,
    alignItems: 'center',
    marginLeft: 'auto',
  },
  bonusRewardLabel: {
    color: '#76518D',
    fontFamily: FONTS.extraBold,
    fontSize: 8,
    letterSpacing: 0.8,
    lineHeight: 10,
    marginBottom: 1,
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
  bonusRewardPill: {
    alignSelf: 'center',
    height: 20,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(117,80,151,0.44)',
    backgroundColor: 'rgba(141,93,180,0.14)',
  },
  bonusRewardPillSolved: {
    borderColor: 'rgba(28,119,91,0.42)',
    backgroundColor: 'rgba(255,255,255,0.52)',
  },
  bonusRewardValue: {
    color: '#176F8C',
    fontFamily: FONTS.black,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '900',
  },
  bonusRewardValueSolved: {
    color: '#176D58',
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
    position: 'relative',
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
  bonusGemCorner: {
    position: 'absolute',
    zIndex: 3,
    top: 3,
    left: 4,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bonusGemLifted: {
    opacity: 0.22,
  },
  bonusOperationCorner: {
    position: 'absolute',
    zIndex: 3,
    top: 4,
    right: 5,
    width: 19,
    height: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    backgroundColor: 'rgba(80,49,108,0.62)',
  },
  bonusOperationCornerText: {
    color: '#FFFFFF',
    fontFamily: FONTS.black,
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '900',
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
    marginTop: -1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  bonusTargetOperation: {
    color: 'rgba(255,255,255,0.9)',
    fontFamily: FONTS.black,
    fontSize: 12,
    lineHeight: 13,
    fontWeight: '900',
  },
  bonusTargetSteps: {
    color: 'rgba(255,255,255,0.9)',
    fontFamily: FONTS.bold,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 0.25,
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
    borderColor: '#E2B65C',
    backgroundColor: 'rgba(255,253,249,0.97)',
    shadowColor: '#456E80',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 13,
    elevation: 10,
  },
  destinationTransitionChallengeCard: {
    paddingVertical: 20,
    borderColor: '#E2B65C',
    backgroundColor: 'rgba(255,249,234,0.98)',
    shadowColor: '#8B713D',
    shadowOpacity: 0.24,
  },
  destinationTransitionEyebrow: {
    color: '#2F849B',
    fontFamily: FONTS.black,
    fontSize: 9,
    letterSpacing: 1.2,
    fontWeight: '900',
  },
  destinationTransitionTitle: {
    marginTop: 6,
    color: '#234C78',
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
    color: '#B97825',
    fontFamily: FONTS.black,
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: '900',
  },
  destinationTransitionNextName: {
    marginTop: 5,
    color: '#2F6575',
    fontFamily: FONTS.extraBold,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  destinationTransitionChallengeContent: {
    alignItems: 'center',
  },
  destinationTransitionChallengeTrophy: {
    fontSize: 34,
    lineHeight: 41,
  },
  destinationTransitionChallengeLabel: {
    marginTop: 3,
    color: '#B97825',
    fontFamily: FONTS.black,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  destinationTransitionChallengeCountry: {
    marginTop: 5,
    color: '#234C78',
    fontFamily: FONTS.extraBold,
    fontSize: 15,
    lineHeight: 19,
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
  routeRewardToast: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 118,
    zIndex: 70,
    maxWidth: '86%',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#F4D37B',
    backgroundColor: 'rgba(36,55,68,0.92)',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  routeRewardToastText: {
    color: '#FFF6D6',
    fontFamily: FONTS.extraBold,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
});
