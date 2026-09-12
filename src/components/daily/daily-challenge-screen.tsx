import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { PIConfetti } from 'react-native-fast-confetti';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdMobBanner, AD_BANNER_SLOT_HEIGHT } from '@/components/ads/admob-banner';
import { BackIcon, FootprintIcon, GemIcon } from '@/components/common/game-icons';
import {
  NumberWheel,
  NODE_OUTRO_DURATION,
  type WheelSelectionOutcome,
} from '@/components/game/number-wheel';
import {
  BONUS_GEM_FLIGHT_DURATION,
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
  type ResultFlight,
  type ScreenPoint,
} from '@/components/game/result-flight';
import { FONTS } from '@/constants/fonts';
import {
  DAILY_CHALLENGE_ALL_BONUS_REWARD,
  DAILY_CHALLENGE_BASE_REWARD,
  DAILY_CHALLENGE_NO_HINT_REWARD,
  DAILY_CHALLENGE_PUZZLE_COUNT,
  claimDailyChallengeProgress,
  createDailyChallengeProgress,
  dailyAwardKey,
  dailyTreasureAwardKey,
  getDailyBonusGemReward,
  getDailyChallenge,
  getDailyChallengeReward,
  getLocalDateKey,
  isDailyChallengeComplete,
  resolveDailyChallengeSkill,
  skillFromDailyChallengeProgress,
  startDailyChallengeReplay,
  type DailyChallenge,
  type DailyChallengeProgress,
  type DailyPuzzle,
} from '@/game/daily-challenge';
import { createDailyAwardLedger, type DailyAwardKind } from '@/game/daily-award-ledger';
import {
  loadDailyChallengeProgress,
  saveDailyChallengeProgress,
} from '@/game/daily-challenge-storage';
import {
  computeResult,
  findSolutionIndices,
  formatLiveExpression,
  getTargetScore,
  OPERATION_DETAILS,
  type Target,
} from '@/game/levels';
import { DAILY_OPERATION_STRIP_HEIGHT, getGameLayout } from '@/game/layout';
import type { DifficultyModifier } from '@/game/adaptive-difficulty';
import type { GameSound } from '@/hooks/use-game-sounds';
import { localizeOperation, useI18n } from '@/i18n';

const HINT_GEM_COST = 10;
const DAILY_TARGET_INDEX = 0;
const RAIL_HOP_DELAY_MS = 280;
const RAIL_TICK_SETTLE_MS = 90;
const TREASURE_HOLD_MS = 720;
/**
 * Rezerve edilmiş bir ödül, rozet hedefine varmasını bildirmezse bu süreden
 * sonra yine yazılır: uçuşun kendi süresi + küçük bir pay. Hedef ve bonus
 * puanı ★ hapına, bonus kristali üst 💎 hapına, hazine paketi de sandıktan
 * aynı 💎 hapına varınca yazılır.
 */
const AWARD_SETTLE_GRACE_MS = 400;
const CLAIM_GEM_LAUNCH_DELAY_MS = 320;
const TARGET_POINTS_SETTLE_TIMEOUT_MS =
  RESULT_FLIGHT_DURATION + POINTS_FLIGHT_DURATION + AWARD_SETTLE_GRACE_MS;
const BONUS_POINTS_SETTLE_TIMEOUT_MS =
  RESULT_FLIGHT_DURATION +
  BONUS_GEM_LAUNCH_DELAY +
  POINTS_FLIGHT_DURATION +
  AWARD_SETTLE_GRACE_MS;
const BONUS_GEM_SETTLE_TIMEOUT_MS =
  RESULT_FLIGHT_DURATION +
  BONUS_GEM_LAUNCH_DELAY +
  BONUS_GEM_FLIGHT_DURATION +
  AWARD_SETTLE_GRACE_MS;
const CLAIM_GEM_SETTLE_TIMEOUT_MS =
  CLAIM_GEM_LAUNCH_DELAY_MS + BONUS_GEM_FLIGHT_DURATION + AWARD_SETTLE_GRACE_MS;
const STEP_HINT_INTRO_DELAY_MS = 520;
const STEP_DOT_PULSE_MS = 400;
const STEP_DOT_PULSE_SCALE = 1.15;
const CONTENT_MAX_WIDTH = 512;
const GAME_SKY_BACKGROUND = require('../../../assets/images/game-sky-background.png');
const CONFETTI_COLORS = [
  '#F59E0B',
  '#60A5FA',
  '#34D399',
  '#FDE047',
  '#A78BFA',
  '#FB7185',
] as const;

type DailyChallengeScreenProps = {
  active: boolean;
  gemCount: number;
  score: number;
  countryIndex?: number;
  learningScore?: number;
  cityDifficultyModifier?: DifficultyModifier;
  onBack: () => void;
  onSpendGems: (cost: number) => void;
  onReward: (gems: number) => void;
  onScore: (points: number) => void;
  onEffect: (sound: GameSound) => void;
};

type Phase = 'loading' | 'play' | 'treasure' | 'completed';
type Timer = ReturnType<typeof setTimeout>;
type FeedbackTone = 'live' | 'success' | 'bonus' | 'info';
type Feedback = { text: string; tone: FeedbackTone };

const FEEDBACK_COLORS: Record<FeedbackTone, { background: string; border: string; text: string }> = {
  live: { background: 'rgba(225, 249, 247, 0.95)', border: '#87D8D2', text: '#276F73' },
  success: { background: 'rgba(231, 251, 236, 0.97)', border: '#77CEA1', text: '#18714C' },
  bonus: { background: 'rgba(255, 247, 211, 0.98)', border: '#E8BD55', text: '#8B5A16' },
  info: { background: 'rgba(245, 241, 228, 0.98)', border: '#D8C5A4', text: '#745D43' },
};

function selectionSound(selectionCount: number): GameSound {
  const clamped = Math.max(1, Math.min(7, selectionCount));
  return `select${clamped}` as GameSound;
}

function GoalCard({
  complete,
  children,
  extra,
  reward,
}: {
  complete: boolean;
  children: ReactNode;
  extra?: string;
  reward?: number;
}) {
  return (
    <View style={[styles.goalCard, complete && styles.goalCardComplete]}>
      <View style={[styles.goalCheck, complete && styles.goalCheckComplete]}>
        <Text style={styles.goalCheckText}>{complete ? '✓' : '○'}</Text>
      </View>
      <View style={styles.goalCopy}>
        <Text style={[styles.goalText, complete && styles.goalTextComplete]}>{children}</Text>
        {extra ? <Text style={styles.goalExtra}>{extra}</Text> : null}
      </View>
      {reward ? <Text style={styles.goalReward}>+{reward} 💎</Text> : null}
    </View>
  );
}

function PuzzleRail({
  puzzles,
  completedIds,
  currentId,
  pulsingId,
  slotRefs,
  accessibilityLabel,
}: {
  puzzles: readonly DailyPuzzle[];
  completedIds: readonly string[];
  currentId?: string;
  pulsingId?: string | null;
  slotRefs?: { current: Array<View | null> };
  accessibilityLabel: string;
}) {
  const [pulse] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!pulsingId) {
      pulse.setValue(1);
      return;
    }
    pulse.setValue(1);
    const animation = Animated.sequence([
      Animated.timing(pulse, { toValue: 1.22, duration: 90, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.94, duration: 90, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 140, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [pulse, pulsingId]);

  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={styles.rail}>
      {puzzles.map((puzzle, index) => {
        const complete = completedIds.includes(puzzle.id);
        const current = puzzle.id === currentId;
        const pulsing = pulsingId === puzzle.id;
        return (
          <View key={puzzle.id} style={styles.railItem}>
            {index > 0 ? (
              <View style={[styles.railLine, complete && styles.railLineComplete]} />
            ) : null}
            <View
              ref={(view) => {
                if (slotRefs) slotRefs.current[index] = view;
              }}
              collapsable={false}>
              <Animated.View
                style={[
                  styles.railDot,
                  complete && styles.railDotComplete,
                  current && styles.railDotCurrent,
                  puzzle.tier === 'peak' && styles.railDotPeak,
                  pulsing && { transform: [{ scale: pulse }] },
                ]}>
                <Text style={[styles.railDotText, (complete || current) && styles.railDotTextOn]}>
                  {complete ? '✓' : index + 1}
                </Text>
              </Animated.View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function CompactConfetti({ visible }: { visible: boolean }) {
  if (!visible || Platform.OS === 'web') return null;
  return (
    <View pointerEvents="none" style={styles.confettiLayer}>
      <PIConfetti autoplay colors={[...CONFETTI_COLORS]} fadeOutOnEnd flakeStyle="glossy">
        <PIConfetti.Origin blastPosition="center" count={56} initialSpeed={1.15} spread={Math.PI * 2}>
          <PIConfetti.Flake size={7} radius={3} />
          <PIConfetti.Flake width={5} height={9} radius={3} />
        </PIConfetti.Origin>
      </PIConfetti>
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

function createStepDotPulse(scale: Animated.Value) {
  const half = STEP_DOT_PULSE_MS / 2;
  return Animated.sequence([
    Animated.timing(scale, {
      toValue: STEP_DOT_PULSE_SCALE,
      duration: half,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }),
    Animated.timing(scale, {
      toValue: 1,
      duration: half,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }),
  ]);
}

function usePuzzleStepHint(token: string | null) {
  const [stepScale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    stepScale.stopAnimation();
    stepScale.setValue(1);
    if (!token) return;

    const pulse = Animated.sequence([
      Animated.delay(STEP_HINT_INTRO_DELAY_MS),
      createStepDotPulse(stepScale),
      createStepDotPulse(stepScale),
    ]);
    pulse.start();
    return () => {
      pulse.stop();
      stepScale.setValue(1);
    };
  }, [stepScale, token]);

  return stepScale;
}

function DailyStepMeter({
  pulseScale,
  selectionCount,
  solved,
  steps,
  tone,
}: {
  pulseScale?: Animated.Value;
  selectionCount: number;
  solved: boolean;
  steps: number;
  tone: 'target' | 'bonus';
}) {
  const { t } = useI18n();
  const footprintColor =
    tone === 'bonus'
      ? solved
        ? '#E8FFF6'
        : '#F6E3A4'
      : solved
        ? '#23785B'
        : '#A87521';

  return (
    <Animated.View
      accessibilityLabel={t('game.stepCount')}
      accessible
      pointerEvents="none"
      style={[
        styles.stepMeter,
        pulseScale ? { transform: [{ scale: pulseScale }] } : null,
      ]}>
      <FootprintIcon color={footprintColor} filled size={15} />
      {Array.from({ length: steps }, (_, index) => (
        <View
          key={`daily-step-dot-${tone}-${index}`}
          style={[
            styles.stepDot,
            tone === 'bonus' && styles.stepDotBonus,
            solved && styles.stepDotSolved,
            solved && tone === 'bonus' && styles.stepDotBonusSolved,
            index < selectionCount && styles.stepDotFilled,
            index < selectionCount && tone === 'bonus' && styles.stepDotBonusFilled,
            index < selectionCount && solved && styles.stepDotSolvedFilled,
            index < selectionCount && solved && tone === 'bonus' && styles.stepDotBonusSolvedFilled,
          ]}
        />
      ))}
    </Animated.View>
  );
}

function DailyTargetCard({
  landed,
  large,
  measureRef,
  pulseToken,
  selectionCount,
  solved,
  target,
}: {
  landed: boolean;
  large: boolean;
  measureRef?: (view: View | null) => void;
  pulseToken: string | null;
  selectionCount: number;
  solved: boolean;
  target: Target;
}) {
  const { t } = useI18n();
  const operation = OPERATION_DETAILS[target.op];
  const [scale] = useState(() => new Animated.Value(1));
  const stepScale = usePuzzleStepHint(pulseToken);
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
      : Animated.timing(scale, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        });
    animation.start();
    return () => animation.stop();
  }, [landed, scale]);

  return (
    <View ref={measureRef} collapsable={false} style={styles.boardTargetFrame}>
      <Animated.View
        accessibilityLabel={t('game.targetA11y', { value: target.value, steps: target.steps })}
        style={[
          styles.boardTargetPulse,
          solved && styles.boardTargetSolvedFrame,
          { transform: [{ scale }] },
        ]}>
        <LinearGradient
          colors={['#F8FCFB', '#DCECEC']}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.boardTargetCard}>
          {solved ? (
            <Animated.View
              pointerEvents="none"
              style={[styles.boardTargetColorReveal, { transform: [{ scale: colorReveal }] }]}>
              <LinearGradient
                colors={['rgba(218,246,232,0.99)', 'rgba(189,232,213,0.99)']}
                end={{ x: 1, y: 1 }}
                start={{ x: 0, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          ) : null}
          <View style={[styles.boardTargetOpCorner, solved && styles.boardTargetOpCornerSolved]}>
            <Text style={styles.boardTargetOpText}>{operation.symbol}</Text>
          </View>
          <Text
            style={[
              styles.boardTargetValue,
              large && styles.boardTargetValueLarge,
              solved && styles.boardSolvedText,
            ]}>
            {target.value}
          </Text>
          <DailyStepMeter
            pulseScale={stepScale}
            selectionCount={selectionCount}
            solved={solved}
            steps={target.steps}
            tone="target"
          />
          {solved ? <View pointerEvents="none" style={styles.boardTargetSolvedBorder} /> : null}
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

function DailyInfoChip({
  accessibilityLabel,
  label,
  value,
}: {
  accessibilityLabel: string;
  label: string;
  value: string;
}) {
  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={styles.infoChipFrame}>
      <LinearGradient
        colors={['#F8FCFB', '#DCECEC']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.infoChip}>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.72}
          numberOfLines={1}
          style={styles.infoChipLabel}>
          {label}
        </Text>
        <Text
          allowFontScaling={false}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          numberOfLines={1}
          style={styles.infoChipValue}>
          {value}
        </Text>
      </LinearGradient>
    </View>
  );
}

function DailyBonusRow({
  gemLifted = false,
  gemMeasureRef,
  landed,
  measureRef,
  selectionCount,
  solved,
  target,
}: {
  gemLifted?: boolean;
  gemMeasureRef?: { current: View | null };
  landed: boolean;
  measureRef?: { current: View | null };
  selectionCount: number;
  solved: boolean;
  target: Target;
}) {
  const { t } = useI18n();
  const operation = OPERATION_DETAILS[target.op];
  const reward = getDailyBonusGemReward(target.steps);
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
      accessibilityLabel={t('daily.bonusA11y', {
        value: target.value,
        reward,
      })}
      colors={['rgba(255,247,206,0.98)', 'rgba(236,216,255,0.98)']}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={[styles.boardBonusRow, solved && styles.boardBonusRowSolved, styles.boardBonusRowRaised]}>
      {solved ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.boardBonusRowColorReveal, { transform: [{ scaleX: colorReveal }] }]}>
          <LinearGradient
            colors={['rgba(219,248,237,0.99)', 'rgba(190,235,218,0.99)']}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
      <View style={styles.boardBonusAnchor}>
        <Text style={[styles.boardBonusLabel, solved && styles.boardSolvedText]}>BONUS</Text>
        <View style={[styles.boardBonusPill, solved && styles.boardBonusPillSolved]}>
          <GemIcon
            color={solved ? '#66D7FF' : '#BDEFFF'}
            facetColor={solved ? '#FFFFFF' : '#258AAF'}
            outlineColor="#0B5875"
            size={18}
          />
          <Text style={[styles.boardBonusRewardValue, solved && styles.boardBonusRewardSolved]}>
            +{reward}
          </Text>
        </View>
      </View>
      <View ref={measureRef} collapsable={false} style={styles.boardBonusCardMeasure}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <LinearGradient
            colors={solved ? ['#5BC69A', '#238666'] : ['#9F69D1', '#65448B']}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.boardBonusCard}>
            {solved ? (
              <Animated.View
                pointerEvents="none"
                style={[styles.boardTargetColorReveal, { transform: [{ scale: colorReveal }] }]}>
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
              style={[styles.boardBonusGemCorner, gemLifted && styles.boardBonusGemLifted]}>
              <GemIcon
                color={solved ? '#66D7FF' : '#BDEFFF'}
                facetColor={solved ? '#FFFFFF' : '#258AAF'}
                outlineColor="#0B5875"
                size={16}
              />
            </View>
            <View style={[styles.boardBonusOpCorner, solved && styles.boardBonusOpCornerSolved]}>
              <Text style={styles.boardBonusOpText}>{operation.symbol}</Text>
            </View>
            <Text style={styles.boardBonusValue}>{target.value}</Text>
            <DailyStepMeter
              selectionCount={selectionCount}
              solved={solved}
              steps={target.steps}
              tone="bonus"
            />
          </LinearGradient>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

function useHudPop(value: number) {
  const [scale] = useState(() => new Animated.Value(1));
  const previousRef = useRef(value);

  useEffect(() => {
    if (previousRef.current === value) return;
    previousRef.current = value;
    scale.setValue(1);
    const animation = Animated.sequence([
      Animated.timing(scale, { duration: 140, toValue: 1.12, useNativeDriver: true }),
      Animated.timing(scale, { duration: 140, toValue: 1, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [scale, value]);

  return scale;
}

function DailyScorePill({
  compact,
  measureRef,
  score,
}: {
  compact: boolean;
  measureRef?: { current: View | null };
  score: number;
}) {
  const { locale, t } = useI18n();
  const popScale = useHudPop(score);

  return (
    <Animated.View
      ref={measureRef}
      accessibilityLabel={t('home.pointsA11y', { value: score })}
      collapsable={false}
      style={[
        styles.scorePill,
        compact && styles.scorePillCompact,
        { transform: [{ scale: popScale }] },
      ]}>
      <Text style={styles.scoreStar}>★</Text>
      <View style={styles.scoreCopy}>
        <Text style={styles.scoreLabel}>{t('common.score')}</Text>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.62}
          numberOfLines={1}
          style={[styles.scoreText, compact && styles.scoreTextCompact]}>
          {score.toLocaleString(locale)}
        </Text>
      </View>
    </Animated.View>
  );
}

export function DailyChallengeScreen({
  active,
  gemCount,
  score,
  countryIndex,
  learningScore,
  cityDifficultyModifier,
  onBack,
  onEffect,
  onReward,
  onScore,
  onSpendGems,
}: DailyChallengeScreenProps) {
  const { t } = useI18n();
  const { height, width } = useWindowDimensions();
  const layout = getGameLayout(
    width,
    Math.max(520, height - AD_BANNER_SLOT_HEIGHT + DAILY_OPERATION_STRIP_HEIGHT),
  );
  const { compactHeader, contentHorizontalPadding, wheelSize } = layout;
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [progress, setProgress] = useState<DailyChallengeProgress | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [hintIndices, setHintIndices] = useState<number[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectionCount, setSelectionCount] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [flights, setFlights] = useState<ResultFlight[]>([]);
  const [cardGemLifts, setCardGemLifts] = useState<CardGemLift[]>([]);
  const [gemLifting, setGemLifting] = useState(false);
  const [railFilledIds, setRailFilledIds] = useState<string[]>([]);
  const [pulsingRailId, setPulsingRailId] = useState<string | null>(null);
  const [targetFlying, setTargetFlying] = useState(false);
  const [bonusFlying, setBonusFlying] = useState(false);
  const [landedTarget, setLandedTarget] = useState<number | null>(null);
  const [sunPulse] = useState(() => new Animated.Value(0));
  const [wheelOutroToken, setWheelOutroToken] = useState(0);
  const hintActiveRef = useRef(false);
  const claimInFlightRef = useRef(false);
  const sequenceLockRef = useRef(false);
  const progressRef = useRef<DailyChallengeProgress | null>(null);
  const challengeRef = useRef<DailyChallenge | null>(null);
  const skillRef = useRef({ countryIndex, learningScore, cityDifficultyModifier });
  const feedbackTimerRef = useRef<Timer | null>(null);
  const hintTimerRef = useRef<Timer | null>(null);
  const sequenceTimerRef = useRef<Timer | null>(null);
  const railPulseTimerRef = useRef<Timer | null>(null);
  const landingTimerRef = useRef<Timer | null>(null);
  const nextFlightId = useRef(1);
  const flightGenerationRef = useRef(0);
  const claimCeremonyRef = useRef(false);
  const awardLedgerRef = useRef(createDailyAwardLedger());
  const awardTimersRef = useRef(new Map<string, Timer>());
  const claimedArrivalsRef = useRef(new Set<string>());
  const launchedFollowUpRef = useRef(new Set<number>());
  const resultLayerRef = useRef<View | null>(null);
  const wheelSourceRef = useRef<View | null>(null);
  const targetCardRef = useRef<View | null>(null);
  const bonusCardRef = useRef<View | null>(null);
  const bonusGemRef = useRef<View | null>(null);
  const scorePillRef = useRef<View | null>(null);
  const gemPillRef = useRef<View | null>(null);
  const treasureChestRef = useRef<View | null>(null);
  const railSlotRefs = useRef<Array<View | null>>([]);
  const pendingRailRef = useRef<{ value: number; slotIndex: number } | null>(null);
  const onRewardRef = useRef(onReward);
  const onScoreRef = useRef(onScore);
  onRewardRef.current = onReward;
  onScoreRef.current = onScore;

  skillRef.current = { countryIndex, learningScore, cityDifficultyModifier };
  challengeRef.current = challenge;

  const clearFeedbackTimer = useCallback(() => {
    if (!feedbackTimerRef.current) return;
    clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = null;
  }, []);

  const clearHintTimer = useCallback(() => {
    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }
    hintActiveRef.current = false;
  }, []);

  const clearSequenceTimer = useCallback(() => {
    if (!sequenceTimerRef.current) return;
    clearTimeout(sequenceTimerRef.current);
    sequenceTimerRef.current = null;
  }, []);

  const clearLandingTimer = useCallback(() => {
    if (!landingTimerRef.current) return;
    clearTimeout(landingTimerRef.current);
    landingTimerRef.current = null;
  }, []);

  const clearRailPulseTimer = useCallback(() => {
    if (!railPulseTimerRef.current) return;
    clearTimeout(railPulseTimerRef.current);
    railPulseTimerRef.current = null;
  }, []);

  // Ödül, eşleşme doğrulandığı anda tutarıyla ve anahtarıyla REZERVE edilir;
  // sayaca yazılması rozetin hedefine varmasına ertelenir, böylece sayı
  // animasyonun önüne geçmez. Yazma tetikleyicilerinden hangisi önce olursa
  // ödeme onunla yapılır: varış, sert timeout, measure/uçuş kurulamaması,
  // tahta değişimi / replay / geri çıkış / unmount. Hepsi aynı anahtardan
  // geçtiği için ödül ne kaybolur ne iki kez yazılır. Anahtara koşu bileşeni
  // girdiğinden önceki koşudan kalan bir kayıt bu koşunun ödemesini eleyemez.
  const clearAwardTimer = useCallback((awardKey: string) => {
    const timer = awardTimersRef.current.get(awardKey);
    if (!timer) return;
    clearTimeout(timer);
    awardTimersRef.current.delete(awardKey);
  }, []);

  const settleAward = useCallback(
    (awardKey: string | undefined) => {
      if (!awardKey) return;
      clearAwardTimer(awardKey);
      const settled = awardLedgerRef.current.settle(awardKey);
      if (!settled) return;
      if (settled.kind === 'gem') onRewardRef.current(settled.amount);
      else onScoreRef.current(settled.amount);
    },
    [clearAwardTimer],
  );

  /** Pays every reserved award at once; used when a flight can no longer land. */
  const flushAwards = useCallback(() => {
    for (const timer of awardTimersRef.current.values()) clearTimeout(timer);
    awardTimersRef.current.clear();
    const { gems, score } = awardLedgerRef.current.flush();
    if (gems > 0) onRewardRef.current(gems);
    if (score > 0) onScoreRef.current(score);
  }, []);

  const reserveAward = useCallback(
    (kind: DailyAwardKind, awardKey: string, amount: number, timeoutMs: number) => {
      if (!awardLedgerRef.current.reserve(kind, awardKey, amount)) return;
      // Animasyon varışı hiç raporlamazsa ödeme bu sert timeout ile yazılır.
      awardTimersRef.current.set(
        awardKey,
        setTimeout(() => {
          awardTimersRef.current.delete(awardKey);
          settleAward(awardKey);
        }, timeoutMs),
      );
    },
    [settleAward],
  );

  const reserveBonusGems = useCallback(
    (puzzleId: string, gems: number) => {
      const awardKey = dailyAwardKey(progressRef.current?.runSeed ?? 0, 'gem', puzzleId);
      reserveAward('gem', awardKey, gems, BONUS_GEM_SETTLE_TIMEOUT_MS);
      return awardKey;
    },
    [reserveAward],
  );

  const reservePuzzlePoints = useCallback(
    (puzzleId: string, slot: 'target' | 'bonus', points: number) => {
      const awardKey = dailyAwardKey(progressRef.current?.runSeed ?? 0, slot, puzzleId);
      reserveAward(
        'score',
        awardKey,
        points,
        slot === 'bonus' ? BONUS_POINTS_SETTLE_TIMEOUT_MS : TARGET_POINTS_SETTLE_TIMEOUT_MS,
      );
      return awardKey;
    },
    [reserveAward],
  );

  const invalidatePendingFlights = useCallback(() => {
    // Buradan sonra hiçbir uçuş varışını raporlayamaz, o yüzden bekleyen ne
    // varsa hemen yazılır. Tahta değişimi, replay, faz geçişi, geri çıkış ve
    // daily'nin yeniden yüklenmesi bu yoldan geçer.
    flushAwards();
    flightGenerationRef.current += 1;
    claimCeremonyRef.current = false;
    claimedArrivalsRef.current.clear();
    launchedFollowUpRef.current.clear();
    setFlights([]);
    setCardGemLifts([]);
    setGemLifting(false);
    setTargetFlying(false);
    setBonusFlying(false);
    pendingRailRef.current = null;
  }, [flushAwards]);

  const clearPuzzleVisuals = useCallback(() => {
    clearHintTimer();
    setHintIndices([]);
    setPreview(null);
    setSelectionCount(0);
    clearFeedbackTimer();
    setFeedback(null);
    invalidatePendingFlights();
    setLandedTarget(null);
  }, [clearFeedbackTimer, clearHintTimer, invalidatePendingFlights]);

  const showFeedback = useCallback(
    (next: Feedback, duration = 1450) => {
      clearFeedbackTimer();
      setFeedback(next);
      feedbackTimerRef.current = setTimeout(() => {
        feedbackTimerRef.current = null;
        setFeedback(null);
      }, duration);
    },
    [clearFeedbackTimer],
  );

  const persistProgress = useCallback((next: DailyChallengeProgress) => {
    progressRef.current = next;
    setProgress(next);
    void saveDailyChallengeProgress(next).catch(() => undefined);
  }, []);

  useEffect(() => {
    return () => {
      clearFeedbackTimer();
      clearHintTimer();
      clearSequenceTimer();
      clearLandingTimer();
      clearRailPulseTimer();
      // Ekran sökülürken uçuşlar varışı bildiremez; bekleyen ödemeler burada
      // yazılır, yoksa oyuncu kazandığı puanı/kristali kaybederdi.
      flushAwards();
    };
  }, [
    clearFeedbackTimer,
    clearHintTimer,
    clearLandingTimer,
    clearRailPulseTimer,
    clearSequenceTimer,
    flushAwards,
  ]);

  useEffect(() => {
    if (active && phase === 'play') return;
    clearSequenceTimer();
    clearLandingTimer();
    clearRailPulseTimer();
    sequenceLockRef.current = false;
    setLandedTarget(null);
    // Hazine / completed geçişi claim uçuşunu öldürmesin; yalnız çıkış ve
    // yeniden yükleme bekleyen ödemeleri yazar.
    if (!active || phase === 'loading') {
      setCelebrating(false);
      invalidatePendingFlights();
    }
  }, [active, clearLandingTimer, clearRailPulseTimer, clearSequenceTimer, invalidatePendingFlights, phase]);

  useEffect(() => {
    sunPulse.stopAnimation();
    sunPulse.setValue(0);
    if (!active) return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(sunPulse, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(sunPulse, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [active, sunPulse]);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    const dateKey = getLocalDateKey();
    const liveSkill = resolveDailyChallengeSkill(skillRef.current);
    setChallenge(null);
    setProgress(null);
    progressRef.current = null;
    setPhase('loading');
    claimInFlightRef.current = false;
    sequenceLockRef.current = false;
    setCelebrating(false);
    // invalidatePendingFlights bekleyenleri yazdı; defter yeni koşu için boşalır.
    invalidatePendingFlights();
    awardLedgerRef.current.reset();
    setRailFilledIds([]);
    setPulsingRailId(null);
    setLandedTarget(null);

    void loadDailyChallengeProgress(dateKey, liveSkill)
      .catch(() => createDailyChallengeProgress(dateKey, liveSkill))
      .then((loadedProgress) => {
        if (cancelled) return;

        const nextChallenge = getDailyChallenge(
          dateKey,
          skillFromDailyChallengeProgress(loadedProgress),
          loadedProgress.runSeed,
        );
        const nextPuzzleIndex = nextChallenge.puzzles.findIndex(
          (puzzle) => !loadedProgress.completedPuzzleIds.includes(puzzle.id),
        );
        setChallenge(nextChallenge);
        setProgress(loadedProgress);
        progressRef.current = loadedProgress;
        setRailFilledIds([...loadedProgress.completedPuzzleIds]);
        setPuzzleIndex(
          nextPuzzleIndex >= 0
            ? nextPuzzleIndex
            : Math.max(0, nextChallenge.puzzles.length - 1),
        );
        if (loadedProgress.runClaimed && isDailyChallengeComplete(loadedProgress, nextChallenge)) {
          setPhase('completed');
        } else if (isDailyChallengeComplete(loadedProgress, nextChallenge)) {
          setPhase('treasure');
        } else {
          setPhase('play');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [active, invalidatePendingFlights]);

  const currentPuzzle = challenge?.puzzles[puzzleIndex] ?? null;
  const completedPuzzleCount = useMemo(() => {
    if (!challenge || !progress) return 0;
    return challenge.puzzles.filter((puzzle) => progress.completedPuzzleIds.includes(puzzle.id))
      .length;
  }, [challenge, progress]);
  const completedBonusCount = useMemo(() => {
    if (!challenge || !progress) return 0;
    return challenge.puzzles.filter((puzzle) =>
      progress.completedBonusPuzzleIds.includes(puzzle.id),
    ).length;
  }, [challenge, progress]);
  const allBonusesFound =
    Boolean(challenge) && completedBonusCount === (challenge?.puzzles.length ?? 0);
  const allPuzzlesComplete =
    Boolean(challenge && progress && isDailyChallengeComplete(progress, challenge));
  const targetComplete =
    Boolean(currentPuzzle && progress?.completedPuzzleIds.includes(currentPuzzle.id));
  const bonusComplete =
    Boolean(currentPuzzle && progress?.completedBonusPuzzleIds.includes(currentPuzzle.id));
  // Ödül tablosu her koşuda aynıdır; `claimed` onu küçültmez, koşu sayısı da
  // sınırlı değildir. Tutar tek kaynaktan, `getDailyChallengeReward`'tan okunur.
  const rewardTotal = useMemo(
    () => (progress && challenge ? getDailyChallengeReward(progress, challenge).total : 0),
    [challenge, progress],
  );
  const packGemsForDisplay =
    rewardTotal > 0
      ? rewardTotal
      : DAILY_CHALLENGE_BASE_REWARD +
        (allBonusesFound ? DAILY_CHALLENGE_ALL_BONUS_REWARD : 0) +
        (progress?.usedHint ? 0 : DAILY_CHALLENGE_NO_HINT_REWARD);
  const gemPopScale = useHudPop(gemCount);
  const sunStyle = useMemo(
    () => ({
      opacity: sunPulse.interpolate({ inputRange: [0, 1], outputRange: [0.38, 0.72] }),
      transform: [
        {
          scale: sunPulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] }),
        },
      ],
    }),
    [sunPulse],
  );

  const pulseTarget = useCallback(
    (targetIndex: number) => {
      clearLandingTimer();
      setLandedTarget(targetIndex);
      landingTimerRef.current = setTimeout(() => {
        landingTimerRef.current = null;
        setLandedTarget(null);
      }, TARGET_LANDING_MS);
    },
    [clearLandingTimer],
  );

  const fillRailSlot = useCallback(
    (puzzleId: string) => {
      let added = false;
      setRailFilledIds((current) => {
        if (current.includes(puzzleId)) return current;
        added = true;
        return [...current, puzzleId];
      });
      setPulsingRailId(puzzleId);
      clearRailPulseTimer();
      railPulseTimerRef.current = setTimeout(() => {
        railPulseTimerRef.current = null;
        setPulsingRailId(null);
      }, 420);
      if (!added) return;
      onEffect('select1');
    },
    [clearRailPulseTimer, onEffect],
  );

  const pushFlights = useCallback((nextFlights: ResultFlight[]) => {
    if (nextFlights.length === 0) return;
    setFlights((current) => {
      const seenIds = new Set(current.map((item) => item.id));
      const unique = nextFlights.filter((flight) => {
        if (seenIds.has(flight.id)) return false;
        seenIds.add(flight.id);
        return true;
      });
      return unique.length === 0 ? current : [...current, ...unique];
    });
  }, []);

  const allocateFlight = useCallback(
    async ({
      kind,
      value,
      toView,
      origin,
      sourceView,
      delay = 0,
      targetIndex,
      railSlot,
      followUpGemReward,
      followUpPoints,
      awardKey,
      followUpPointsAwardKey,
      followUpGemAwardKey,
    }: {
      kind: ResultFlight['kind'];
      value: number;
      toView: View | null;
      origin?: ScreenPoint;
      sourceView?: View | null;
      delay?: number;
      targetIndex: number;
      railSlot?: number;
      followUpGemReward?: number;
      followUpPoints?: number;
      awardKey?: string;
      followUpPointsAwardKey?: string;
      followUpGemAwardKey?: string;
    }): Promise<ResultFlight | null> => {
      const [rootRect, sourceRect, targetRect] = await Promise.all([
        measureViewInWindow(resultLayerRef.current),
        measureViewInWindow(sourceView ?? wheelSourceRef.current),
        measureViewInWindow(toView),
      ]);
      if (!rootRect || !targetRect) return null;
      const source = sourceRect ?? targetRect;
      const id = nextFlightId.current;
      nextFlightId.current += 1;
      return createResultFlight({
        id,
        kind,
        value,
        delay,
        followUpGemReward,
        followUpPoints,
        awardKey,
        followUpPointsAwardKey,
        followUpGemAwardKey,
        rootRect,
        sourceRect: source,
        targetRect,
        origin,
        targetIndex,
        railSlot,
      });
    },
    [],
  );

  const finishPuzzleAfterRail = useCallback(
    (fromIndex: number) => {
      const currentChallenge = challengeRef.current;
      const currentProgress = progressRef.current;
      if (!currentChallenge || !currentProgress) {
        sequenceLockRef.current = false;
        return;
      }

      const nextPuzzleIndex = currentChallenge.puzzles.findIndex(
        (puzzle) => !currentProgress.completedPuzzleIds.includes(puzzle.id),
      );
      const finale = nextPuzzleIndex < 0;

      const swapBoard = () => {
        clearPuzzleVisuals();
        if (finale) {
          setCelebrating(false);
          setPhase(currentProgress.runClaimed ? 'completed' : 'treasure');
          sequenceLockRef.current = false;
          return;
        }
        setPuzzleIndex(nextPuzzleIndex);
        sequenceLockRef.current = false;
      };

      if (finale) {
        setCelebrating(true);
        clearSequenceTimer();
        sequenceTimerRef.current = setTimeout(() => {
          onEffect('levelComplete');
          sequenceTimerRef.current = setTimeout(() => {
            sequenceTimerRef.current = null;
            swapBoard();
          }, TREASURE_HOLD_MS);
        }, RAIL_TICK_SETTLE_MS);
        return;
      }

      setWheelOutroToken((token) => token + 1);
      clearSequenceTimer();
      sequenceTimerRef.current = setTimeout(() => {
        sequenceTimerRef.current = null;
        swapBoard();
      }, NODE_OUTRO_DURATION);
    },
    [clearPuzzleVisuals, clearSequenceTimer, onEffect],
  );

  const launchRailHop = useCallback(
    async (value: number, slotIndex: number) => {
      const generation = flightGenerationRef.current;
      const flight = await allocateFlight({
        kind: 'result',
        value,
        toView: railSlotRefs.current[slotIndex] ?? null,
        sourceView: targetCardRef.current,
        targetIndex: slotIndex,
        railSlot: slotIndex,
      });
      if (generation !== flightGenerationRef.current) return;
      if (!flight) {
        const puzzle = challengeRef.current?.puzzles[slotIndex];
        if (puzzle) fillRailSlot(puzzle.id);
        finishPuzzleAfterRail(slotIndex);
        return;
      }
      pushFlights([flight]);
    },
    [allocateFlight, fillRailSlot, finishPuzzleAfterRail, pushFlights],
  );

  const launchHudFollowUps = useCallback(
    async (
      followUpPoints?: number,
      followUpGemReward?: number,
      pointsAwardKey?: string,
      gemAwardKey?: string,
      pointsSourceView?: View | null,
    ) => {
      const generation = flightGenerationRef.current;
      if (followUpGemReward) onEffect('diamond');
      const hudDelay = followUpGemReward ? BONUS_GEM_LAUNCH_DELAY : 0;
      const [pointsFlight, gemLift] = await Promise.all([
        followUpPoints
          ? allocateFlight({
              kind: 'points',
              value: followUpPoints,
              toView: scorePillRef.current,
              sourceView: pointsSourceView ?? bonusCardRef.current,
              delay: hudDelay,
              targetIndex: BONUS_TARGET_INDEX,
              awardKey: pointsAwardKey,
            })
          : Promise.resolve(null),
        followUpGemReward
          ? Promise.all([
              measureViewInWindow(resultLayerRef.current),
              measureViewInWindow(bonusGemRef.current ?? bonusCardRef.current),
              measureViewInWindow(gemPillRef.current),
            ]).then(([rootRect, sourceRect, targetRect]) => {
              if (!rootRect || !sourceRect || !targetRect) return null;
              const id = nextFlightId.current;
              nextFlightId.current += 1;
              return createCardGemLift({
                id,
                value: followUpGemReward,
                awardKey: gemAwardKey,
                delay: BONUS_GEM_LAUNCH_DELAY,
                rootRect,
                sourceRect,
                targetRect,
              });
            })
          : Promise.resolve(null),
      ]);
      if (generation !== flightGenerationRef.current) return;
      // Uçuş kurulamadıysa (measure başarısız) ödül varışı bekleyemez: hemen yaz.
      if (pointsFlight) pushFlights([pointsFlight]);
      else settleAward(pointsAwardKey);
      if (followUpPoints) {
        const playScoreTally = () => {
          if (generation !== flightGenerationRef.current) return;
          onEffect('pointsRising');
        };
        const tallyDelay = pointsFlight?.delay ?? 0;
        if (tallyDelay > 0) {
          setTimeout(playScoreTally, tallyDelay);
        } else {
          playScoreTally();
        }
      }
      if (gemLift) {
        setCardGemLifts((current) =>
          current.some((item) => item.id === gemLift.id) ? current : [...current, gemLift],
        );
      } else {
        settleAward(gemAwardKey);
      }
    },
    [allocateFlight, onEffect, pushFlights, settleAward],
  );

  const handleFlightArrive = useCallback(
    (flight: ResultFlight) => {
      const eventKey = resultFlightEventKey(flight);
      if (claimedArrivalsRef.current.has(eventKey)) return;
      claimedArrivalsRef.current.add(eventKey);

      // Rozet hedefine vardı: rezerve edilmiş ödül tam bu anda sayaca yazılır.
      settleAward(flight.awardKey);
      if (flight.kind === 'gem' || flight.kind === 'points') return;
      if (flight.railSlot != null) {
        const puzzle = challengeRef.current?.puzzles[flight.railSlot];
        if (puzzle) fillRailSlot(puzzle.id);
        return;
      }
      if (flight.targetIndex === BONUS_TARGET_INDEX) {
        setBonusFlying(false);
        pulseTarget(BONUS_TARGET_INDEX);
        return;
      }
      setTargetFlying(false);
      pulseTarget(DAILY_TARGET_INDEX);
    },
    [fillRailSlot, pulseTarget, settleAward],
  );

  const handleCardGemArrive = useCallback(
    (lift: CardGemLift) => {
      claimedArrivalsRef.current.add(cardGemLiftEventKey(lift));
      // Kart kristali üstteki toplam 💎 hapına vardı: kristal şimdi artar.
      settleAward(lift.awardKey);
    },
    [settleAward],
  );

  const handleCardGemComplete = useCallback((lift: CardGemLift) => {
    setCardGemLifts((current) => current.filter((item) => item.id !== lift.id));
    setGemLifting(false);
  }, []);

  const handleCardGemLiftStart = useCallback(() => {
    setGemLifting(true);
  }, []);

  const finishClaimCeremony = useCallback(() => {
    if (!claimCeremonyRef.current) return;
    claimCeremonyRef.current = false;
    clearSequenceTimer();
    setPhase('completed');
  }, [clearSequenceTimer]);

  const handleFlightComplete = useCallback(
    (flight: ResultFlight) => {
      setFlights((current) => current.filter((item) => item.id !== flight.id));
      if (flight.kind !== 'result') {
        if (flight.awardKey?.includes(':treasure')) finishClaimCeremony();
        return;
      }

      if (flight.followUpGemReward !== undefined || flight.followUpPoints !== undefined) {
        if (!launchedFollowUpRef.current.has(flight.id)) {
          launchedFollowUpRef.current.add(flight.id);
          void launchHudFollowUps(
            flight.followUpPoints,
            flight.followUpGemReward,
            flight.followUpPointsAwardKey,
            flight.followUpGemAwardKey,
            flight.targetIndex === BONUS_TARGET_INDEX
              ? bonusCardRef.current
              : targetCardRef.current,
          );
        }
      }

      if (flight.railSlot != null) {
        pendingRailRef.current = null;
        finishPuzzleAfterRail(flight.railSlot);
        return;
      }

      if (flight.targetIndex === BONUS_TARGET_INDEX) return;

      const pending = pendingRailRef.current;
      if (!pending) {
        finishPuzzleAfterRail(flight.targetIndex);
        return;
      }
      clearSequenceTimer();
      sequenceTimerRef.current = setTimeout(() => {
        sequenceTimerRef.current = null;
        void launchRailHop(pending.value, pending.slotIndex);
      }, RAIL_HOP_DELAY_MS);
    },
    [clearSequenceTimer, finishClaimCeremony, finishPuzzleAfterRail, launchHudFollowUps, launchRailHop],
  );

  const handlePreview = useCallback(
    (indices: number[]) => {
      if (!currentPuzzle || indices.length === 0) {
        setPreview(null);
        return;
      }
      const values = indices.map((index) => currentPuzzle.numbers[index]);
      setPreview(formatLiveExpression(values, currentPuzzle.op));
    },
    [currentPuzzle],
  );

  const handleComplete = useCallback(
    (indices: number[], resultOrigin?: ScreenPoint): WheelSelectionOutcome => {
      const currentProgress = progressRef.current;
      if (!currentPuzzle || !currentProgress || sequenceLockRef.current || indices.length < 2) {
        setPreview(null);
        return 'invalid';
      }

      const values = indices.map((index) => currentPuzzle.numbers[index]);
      const calculation = computeResult(values, currentPuzzle.op);
      setPreview(null);
      if (!calculation) {
        showFeedback({ text: t('feedback.invalid'), tone: 'info' });
        return 'invalid';
      }

      const puzzleId = currentPuzzle.id;
      const earnedPoints = getTargetScore(values);
      const isTargetMatch =
        calculation.result === currentPuzzle.target.value &&
        indices.length === currentPuzzle.target.steps;
      const isBonusMatch =
        calculation.result === currentPuzzle.bonusTarget.value &&
        indices.length === currentPuzzle.bonusTarget.steps;

      if (isTargetMatch) {
        if (currentProgress.completedPuzzleIds.includes(puzzleId)) {
          showFeedback({ text: t('feedback.alreadyFound'), tone: 'info' }, 1250);
          return 'invalid';
        }
        const next = {
          ...currentProgress,
          completedPuzzleIds: [...currentProgress.completedPuzzleIds, puzzleId],
          runScore: currentProgress.runScore + earnedPoints,
        };
        progressRef.current = next;
        setProgress((prev) => {
          if (!prev || prev.completedPuzzleIds.includes(puzzleId)) {
            return prev ?? next;
          }
          return {
            ...prev,
            completedPuzzleIds: [...prev.completedPuzzleIds, puzzleId],
            runScore: prev.runScore + earnedPoints,
          };
        });
        void saveDailyChallengeProgress(next).catch(() => undefined);
        // Puan şimdi rezerve edilir, ★ rozeti puan hapına varınca yazılır.
        const targetPointsAwardKey = reservePuzzlePoints(puzzleId, 'target', earnedPoints);
        clearHintTimer();
        setHintIndices([]);
        onEffect('success');
        showFeedback(
          { text: t('daily.targetFound', { points: earnedPoints }), tone: 'success' },
          1900,
        );
        sequenceLockRef.current = true;
        setTargetFlying(true);
        pendingRailRef.current = { value: calculation.result, slotIndex: puzzleIndex };
        const generation = flightGenerationRef.current;
        void allocateFlight({
          kind: 'result',
          value: calculation.result,
          toView: targetCardRef.current,
          origin: resultOrigin,
          sourceView: wheelSourceRef.current,
          targetIndex: DAILY_TARGET_INDEX,
          followUpPoints: earnedPoints > 0 ? earnedPoints : undefined,
          followUpPointsAwardKey: targetPointsAwardKey,
        }).then((flight) => {
          if (generation !== flightGenerationRef.current) return;
          if (!flight) {
            // Uçuş hiç kurulamadı: varış beklemeden puanı yaz.
            settleAward(targetPointsAwardKey);
            setTargetFlying(false);
            pulseTarget(DAILY_TARGET_INDEX);
            fillRailSlot(puzzleId);
            finishPuzzleAfterRail(puzzleIndex);
            return;
          }
          pushFlights([flight]);
        });
        return 'success';
      }

      if (isBonusMatch) {
        // `progressRef` senkron güncellendiği için tekrar eşleşmeyi tek başına
        // engeller; uçuş durumuna bakan ek bir kilit ödülü düşürebilirdi.
        if (currentProgress.completedBonusPuzzleIds.includes(puzzleId)) {
          showFeedback({ text: t('feedback.alreadyFound'), tone: 'info' }, 1250);
          return 'invalid';
        }
        const bonusReward = getDailyBonusGemReward(currentPuzzle.bonusTarget.steps);
        // Kart ödülü her koşuda (replay dahil) eşleşme anında rezerve edilir;
        // kristal üstteki toplam hapına, puan da puan hapına varınca yazılır.
        const bonusGemAwardKey = reserveBonusGems(puzzleId, bonusReward);
        const bonusPointsAwardKey = reservePuzzlePoints(puzzleId, 'bonus', earnedPoints);
        const next = {
          ...currentProgress,
          completedBonusPuzzleIds: [...currentProgress.completedBonusPuzzleIds, puzzleId],
          runScore: currentProgress.runScore + earnedPoints,
        };
        progressRef.current = next;
        setProgress((prev) => {
          if (!prev || prev.completedBonusPuzzleIds.includes(puzzleId)) {
            return prev ?? next;
          }
          return {
            ...prev,
            completedBonusPuzzleIds: [...prev.completedBonusPuzzleIds, puzzleId],
            runScore: prev.runScore + earnedPoints,
          };
        });
        void saveDailyChallengeProgress(next).catch(() => undefined);
        onEffect('diamond');
        showFeedback(
          {
            text: t('daily.bonusFound', { reward: bonusReward, points: earnedPoints }),
            tone: 'bonus',
          },
          1850,
        );
        setBonusFlying(true);
        const generation = flightGenerationRef.current;
        void allocateFlight({
          kind: 'result',
          value: calculation.result,
          toView: bonusCardRef.current,
          origin: resultOrigin,
          sourceView: wheelSourceRef.current,
          targetIndex: BONUS_TARGET_INDEX,
          followUpGemReward: bonusReward,
          followUpPoints: earnedPoints > 0 ? earnedPoints : undefined,
          followUpGemAwardKey: bonusGemAwardKey,
          followUpPointsAwardKey: bonusPointsAwardKey,
        }).then((flight) => {
          if (generation !== flightGenerationRef.current) return;
          if (!flight) {
            // Sonuç uçuşu kurulamadı, HUD uçuşları hiç kalkmayacak: hemen yaz.
            settleAward(bonusGemAwardKey);
            settleAward(bonusPointsAwardKey);
            setBonusFlying(false);
            pulseTarget(BONUS_TARGET_INDEX);
            return;
          }
          pushFlights([flight]);
        });
        return 'bonus';
      }

      showFeedback(
        {
          text: t('feedback.tryAnother'),
          tone: 'info',
        },
        1250,
      );
      return 'invalid';
    },
    [
      allocateFlight,
      clearHintTimer,
      currentPuzzle,
      fillRailSlot,
      finishPuzzleAfterRail,
      onEffect,
      pulseTarget,
      puzzleIndex,
      pushFlights,
      reserveBonusGems,
      reservePuzzlePoints,
      settleAward,
      showFeedback,
      t,
    ],
  );

  const handleBack = useCallback(() => {
    clearSequenceTimer();
    sequenceLockRef.current = false;
    setCelebrating(false);
    invalidatePendingFlights();
    setLandedTarget(null);
    onBack();
  }, [clearSequenceTimer, invalidatePendingFlights, onBack]);

  const handleHint = useCallback(() => {
    const currentProgress = progressRef.current;
    if (!currentPuzzle || !currentProgress || targetComplete || hintActiveRef.current) return;
    onEffect('hint');
    if (gemCount < HINT_GEM_COST) {
      showFeedback(
        { text: t('feedback.noHints', { cost: HINT_GEM_COST }), tone: 'info' },
        1800,
      );
      return;
    }

    const solution = findSolutionIndices(currentPuzzle.target, currentPuzzle.numbers);
    if (!solution) {
      showFeedback({ text: t('feedback.hintUnavailable'), tone: 'info' });
      return;
    }

    // İpucusuz ödülü her koşuda yeniden kazanılır, bu yüzden ipucu kullanımı
    // koşu bazında işaretlenir; `claimed` bunu artık atlamaz.
    const next = currentProgress.usedHint
      ? currentProgress
      : { ...currentProgress, usedHint: true };
    persistProgress(next);
    onSpendGems(HINT_GEM_COST);
    hintActiveRef.current = true;
    setHintIndices(solution);
    showFeedback({ text: t('feedback.followGlow'), tone: 'bonus' }, 1750);
    hintTimerRef.current = setTimeout(() => {
      hintTimerRef.current = null;
      hintActiveRef.current = false;
      setHintIndices([]);
    }, 1850);
  }, [
    currentPuzzle,
    gemCount,
    onEffect,
    onSpendGems,
    persistProgress,
    showFeedback,
    t,
    targetComplete,
  ]);

  const handleWheelNodeAdded = useCallback(
    (count: number) => {
      setSelectionCount(count);
      onEffect(selectionSound(count));
    },
    [onEffect],
  );

  const handleWheelNodeRemoved = useCallback(
    (count: number) => {
      setSelectionCount(count);
      onEffect(selectionSound(count));
    },
    [onEffect],
  );

  const handleWheelDraggingChange = useCallback((dragging: boolean) => {
    if (!dragging) {
      setPreview(null);
      setSelectionCount(0);
    }
  }, []);

  const handleShuffle = useCallback(() => {
    clearHintTimer();
    setHintIndices([]);
    setPreview(null);
    setSelectionCount(0);
    onEffect('shuffle');
  }, [clearHintTimer, onEffect]);

  const handleReplay = useCallback(() => {
    // Faz yalnız hazine toplandıktan sonra 'completed' olur; burada `runClaimed`
    // kontrolü yapmıyoruz, yoksa tutarsız bir kayıtta buton sessizce ölür.
    const currentProgress = progressRef.current;
    if (!currentProgress) return;
    const next = startDailyChallengeReplay(currentProgress);
    persistProgress(next);
    // Yeni koşu yeni bir soru seti üretir; `runSeed` tohumun parçasıdır.
    setChallenge(
      getDailyChallenge(next.dateKey, skillFromDailyChallengeProgress(next), next.runSeed),
    );
    setPuzzleIndex(0);
    // clearPuzzleVisuals bekleyen ödemeleri yazar; defter sıfırlanınca yeni
    // koşu tüm ödülleri yeniden kazanılabilir hale gelir.
    clearPuzzleVisuals();
    awardLedgerRef.current.reset();
    claimInFlightRef.current = false;
    claimCeremonyRef.current = false;
    sequenceLockRef.current = false;
    setCelebrating(false);
    setRailFilledIds([]);
    setPulsingRailId(null);
    setPhase('play');
  }, [clearPuzzleVisuals, persistProgress]);

  const handleClaim = useCallback(() => {
    if (
      !challenge ||
      !progress ||
      !allPuzzlesComplete ||
      progress.runClaimed ||
      claimInFlightRef.current
    ) {
      return;
    }
    claimInFlightRef.current = true;
    const packGems = rewardTotal;
    const claimedProgress = claimDailyChallengeProgress(progress, challenge);
    persistProgress(claimedProgress);
    if (packGems <= 0) {
      onEffect('points');
      setPhase('completed');
      return;
    }

    const awardKey = dailyTreasureAwardKey(claimedProgress.runSeed, claimedProgress.dateKey);
    reserveAward('gem', awardKey, packGems, CLAIM_GEM_SETTLE_TIMEOUT_MS);
    claimCeremonyRef.current = true;
    setCelebrating(true);
    onEffect('levelComplete');
    clearSequenceTimer();
    sequenceTimerRef.current = setTimeout(() => {
      sequenceTimerRef.current = null;
      settleAward(awardKey);
      finishClaimCeremony();
    }, CLAIM_GEM_SETTLE_TIMEOUT_MS);

    const generation = flightGenerationRef.current;
    void allocateFlight({
      kind: 'gem',
      value: packGems,
      toView: gemPillRef.current,
      sourceView: treasureChestRef.current,
      targetIndex: BONUS_TARGET_INDEX,
      delay: CLAIM_GEM_LAUNCH_DELAY_MS,
      awardKey,
    }).then((flight) => {
      if (generation !== flightGenerationRef.current) return;
      if (!flight) {
        settleAward(awardKey);
        finishClaimCeremony();
        return;
      }
      pushFlights([flight]);
    });
  }, [
    allocateFlight,
    allPuzzlesComplete,
    challenge,
    clearSequenceTimer,
    finishClaimCeremony,
    onEffect,
    persistProgress,
    progress,
    pushFlights,
    reserveAward,
    rewardTotal,
    settleAward,
  ]);

  if (!active) return null;

  const puzzleTotal = challenge?.puzzles.length ?? DAILY_CHALLENGE_PUZZLE_COUNT;
  const displayedFeedback = feedback ?? (preview ? { text: preview, tone: 'live' as const } : null);
  const operationSymbol = currentPuzzle
    ? OPERATION_DETAILS[currentPuzzle.op].symbol
    : undefined;
  const streakCount = progress?.streak ?? 0;

  return (
    <View style={styles.screen}>
      {phase === 'play' ? (
        <>
          <Image contentFit="cover" source={GAME_SKY_BACKGROUND} style={styles.backgroundImage} />
          <LinearGradient
            colors={['rgba(12,22,33,0.07)', 'rgba(12,22,33,0.03)', 'rgba(12,22,33,0.10)']}
            locations={[0, 0.5, 1]}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : (
        <>
          <LinearGradient
            colors={['#8FB9C4', '#D7EFE8', '#F6E4B4', '#E7C36A']}
            locations={[0, 0.34, 0.72, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={styles.waveOne} />
          <View pointerEvents="none" style={styles.waveTwo} />
          <Animated.View pointerEvents="none" style={[styles.sunGlow, sunStyle]} />
        </>
      )}

      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={[styles.header, compactHeader && styles.headerCompact]}>
          <Pressable
            accessibilityLabel={t('daily.backA11y')}
            accessibilityRole="button"
            hitSlop={5}
            onPress={handleBack}
            style={({ pressed }) => [styles.skyControl, pressed && styles.buttonPressed]}>
            <BackIcon />
          </Pressable>
          <DailyScorePill
            compact={compactHeader}
            measureRef={scorePillRef}
            score={score}
          />
          <View pointerEvents="none" style={styles.headerTitleBlock}>
            <Text numberOfLines={1} style={styles.headerTitle}>
              {t('daily.hudTitle')}
            </Text>
          </View>
          <Animated.View
            ref={gemPillRef}
            accessible
            accessibilityLabel={`${gemCount} 💎`}
            collapsable={false}
            style={[styles.gemPill, { transform: [{ scale: gemPopScale }] }]}>
            <Text style={styles.gemPillText}>💎 {gemCount}</Text>
          </Animated.View>
        </View>

        {phase === 'loading' || !challenge || !progress ? (
          <View style={styles.loadingContent}>
            <View style={styles.loadingSun}>
              <Text style={styles.loadingSunText}>☀</Text>
            </View>
            <Text style={styles.loadingText}>{t('daily.loading')}</Text>
          </View>
        ) : null}

        {phase === 'play' && currentPuzzle && progress ? (
          <View style={styles.playShell}>
            <LinearGradient
              colors={['rgba(36,139,151,0.98)', 'rgba(35,83,111,0.98)']}
              end={{ x: 0, y: 1 }}
              start={{ x: 0, y: 0 }}
              style={styles.challengeStrip}>
              <View style={styles.challengeStripBottom}>
                <Text style={styles.challengePuzzleIndex}>
                  {completedPuzzleCount}/{puzzleTotal}
                </Text>
                <PuzzleRail
                  accessibilityLabel={t('daily.railA11y', {
                    completed: completedPuzzleCount,
                    total: puzzleTotal,
                  })}
                  completedIds={railFilledIds}
                  currentId={currentPuzzle.id}
                  pulsingId={pulsingRailId}
                  puzzles={challenge?.puzzles ?? []}
                  slotRefs={railSlotRefs}
                />
              </View>
            </LinearGradient>

            <View style={[styles.playBoard, { paddingHorizontal: contentHorizontalPadding }]}>
              <LinearGradient
                colors={
                  currentPuzzle.miniChallenge
                    ? ['rgba(255,252,235,0.98)', 'rgba(229,242,235,0.97)']
                    : ['rgba(250,253,252,0.97)', 'rgba(225,238,238,0.96)']
                }
                end={{ x: 0, y: 1 }}
                start={{ x: 0, y: 0 }}
                style={[
                  styles.boardTopSection,
                  currentPuzzle.miniChallenge && styles.boardTopSectionChallenge,
                ]}>
                <View style={styles.boardQuestionRow}>
                  <DailyTargetCard
                    landed={landedTarget === DAILY_TARGET_INDEX}
                    large={!layout.compact}
                    measureRef={(view) => {
                      targetCardRef.current = view;
                    }}
                    pulseToken={currentPuzzle.id}
                    selectionCount={selectionCount}
                    solved={targetComplete && !targetFlying}
                    target={currentPuzzle.target}
                  />
                  <View style={styles.boardQuestionMeta}>
                    <DailyInfoChip
                      accessibilityLabel={localizeOperation(
                        OPERATION_DETAILS[currentPuzzle.op].symbol,
                      )}
                      label={t('daily.hudOpLabel')}
                      value={OPERATION_DETAILS[currentPuzzle.op].symbol}
                    />
                    <DailyInfoChip
                      accessibilityLabel={t('daily.streak', { count: streakCount })}
                      label={t('daily.hudStreakLabel')}
                      value={t('daily.hudStreak', { count: streakCount })}
                    />
                  </View>
                </View>

                <DailyBonusRow
                  gemLifted={gemLifting}
                  gemMeasureRef={bonusGemRef}
                  landed={landedTarget === BONUS_TARGET_INDEX}
                  measureRef={bonusCardRef}
                  selectionCount={selectionCount}
                  solved={bonusComplete && !bonusFlying}
                  target={currentPuzzle.bonusTarget}
                />
              </LinearGradient>

              <View style={styles.feedbackSlot}>
                {displayedFeedback ? (
                  <View
                    style={[
                      styles.boardFeedbackPill,
                      {
                        backgroundColor: FEEDBACK_COLORS[displayedFeedback.tone].background,
                        borderColor: FEEDBACK_COLORS[displayedFeedback.tone].border,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.boardFeedbackText,
                        { color: FEEDBACK_COLORS[displayedFeedback.tone].text },
                      ]}>
                      {displayedFeedback.text}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View ref={wheelSourceRef} collapsable={false} style={styles.wheelContainer}>
                <NumberWheel
                  key={`${challenge?.dateKey ?? 'daily'}-${wheelSize}`}
                  canUseHint={gemCount >= HINT_GEM_COST && !targetComplete}
                  hintCost={HINT_GEM_COST}
                  hintIndices={hintIndices}
                  introToken={currentPuzzle.id}
                  numbers={currentPuzzle.numbers}
                  operationGuideSymbol={operationSymbol}
                  onComplete={handleComplete}
                  onDraggingChange={handleWheelDraggingChange}
                  onHint={handleHint}
                  onNodeAdded={handleWheelNodeAdded}
                  onNodeRemoved={handleWheelNodeRemoved}
                  onPreview={handlePreview}
                  onShuffle={handleShuffle}
                  outroToken={wheelOutroToken}
                  size={wheelSize}
                />
              </View>
            </View>

          </View>
        ) : null}

        {phase === 'treasure' && challenge && progress ? (
          <ScrollView
            contentContainerStyle={styles.treasureScroll}
            showsVerticalScrollIndicator={false}
            style={styles.phaseFill}>
            <View ref={treasureChestRef} collapsable={false} style={styles.treasureChest}>
              <Text style={styles.treasureSparkleLeft}>✦</Text>
              <Text style={styles.treasureEmoji}>🎁</Text>
              <Text style={styles.treasureSparkleRight}>✦</Text>
            </View>
            <Text style={styles.treasureTitle}>{t('daily.treasureTitle')}</Text>
            <Text style={styles.treasureSubtitle}>{t('daily.treasureSubtitle')}</Text>

            <View style={styles.rewardCard}>
              <Text style={styles.rewardBig}>💎 +{packGemsForDisplay}</Text>
              <Text style={styles.rewardLabel}>{t('daily.reward', { gems: packGemsForDisplay })}</Text>
              <View style={styles.rewardDivider} />
              <GoalCard complete={true} reward={DAILY_CHALLENGE_BASE_REWARD}>
                {t('daily.goalSolvePuzzles')}
              </GoalCard>
              <GoalCard
                complete={allBonusesFound}
                extra={t('daily.goalBonusExtra', { gems: DAILY_CHALLENGE_ALL_BONUS_REWARD })}
                reward={DAILY_CHALLENGE_ALL_BONUS_REWARD}>
                {t('daily.goalBonus')}
              </GoalCard>
              <GoalCard complete={!progress.usedHint} reward={DAILY_CHALLENGE_NO_HINT_REWARD}>
                {t('daily.goalNoHints')}
              </GoalCard>
            </View>
            <Text style={styles.bodyStreakText}>{t('daily.streak', { count: progress.streak })}</Text>
            {progress.runClaimed ? null : (
              <Pressable
                accessibilityRole="button"
                onPress={handleClaim}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryPressed]}>
                <LinearGradient
                  colors={['#F9C85C', '#E99A2E', '#C96D20']}
                  end={{ x: 0.72, y: 1 }}
                  start={{ x: 0.15, y: 0 }}
                  style={styles.primaryButtonSurface}>
                  <Text style={styles.primaryButtonText}>{t('daily.claimReward')}</Text>
                </LinearGradient>
              </Pressable>
            )}
          </ScrollView>
        ) : null}

        {phase === 'completed' && progress ? (
          <View style={styles.completedContent}>
            <View style={styles.completedBadge}>
              <Text style={styles.completedBadgeText}>✓</Text>
            </View>
            <Text style={styles.completedTitle}>{t('daily.completedTitle')}</Text>
            <Text style={styles.completedHaul}>
              {t('daily.completedHaul', {
                points: progress.runScore,
                gems: packGemsForDisplay,
              })}
            </Text>
            <Text style={styles.bodyStreakText}>{t('daily.streak', { count: progress.streak })}</Text>
            <Text style={styles.runRewardNote}>{t('daily.replayRewards')}</Text>
            <Pressable
              accessibilityLabel={t('daily.replayA11y')}
              accessibilityRole="button"
              onPress={handleReplay}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryPressed]}>
              <LinearGradient
                colors={['#F9C85C', '#E99A2E', '#C96D20']}
                end={{ x: 0.72, y: 1 }}
                start={{ x: 0.15, y: 0 }}
                style={styles.primaryButtonSurface}>
                <Text style={styles.primaryButtonText}>{t('daily.replay')}</Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              accessibilityLabel={t('daily.backA11y')}
              accessibilityRole="button"
              onPress={handleBack}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <Text style={styles.secondaryButtonText}>{t('daily.returnHome')}</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={styles.gameAdSlot}>
          <AdMobBanner />
        </View>
      </SafeAreaView>

      <CompactConfetti visible={celebrating} />
      <View
        ref={resultLayerRef}
        collapsable={false}
        pointerEvents="none"
        style={styles.resultFlightLayer}>
        {flights.map((flight) => (
          <ResultFlightBadge
            flight={flight}
            key={flight.id}
            onArrive={handleFlightArrive}
            onComplete={handleFlightComplete}
          />
        ))}
        {cardGemLifts.map((lift) => (
          <CardGemLiftFlight
            key={lift.id}
            lift={lift}
            onArrive={handleCardGemArrive}
            onComplete={handleCardGemComplete}
            onLiftStart={handleCardGemLiftStart}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    backgroundColor: '#C9DED6',
  },
  safeArea: {
    flex: 1,
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  phaseFill: {
    flex: 1,
  },
  gameAdSlot: {
    height: AD_BANNER_SLOT_HEIGHT,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(2,6,23,0.22)',
  },
  header: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    height: 46,
    marginTop: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerCompact: {
    marginTop: 5,
    paddingHorizontal: 10,
  },
  waveOne: {
    position: 'absolute',
    width: '142%',
    height: 210,
    left: '-20%',
    top: '29%',
    borderRadius: 190,
    backgroundColor: 'rgba(255,255,255,0.18)',
    transform: [{ rotate: '-8deg' }],
  },
  waveTwo: {
    position: 'absolute',
    width: '156%',
    height: 260,
    left: '-29%',
    bottom: '-8%',
    borderRadius: 240,
    backgroundColor: 'rgba(255,236,186,0.42)',
    transform: [{ rotate: '7deg' }],
  },
  sunGlow: {
    position: 'absolute',
    width: 205,
    height: 205,
    borderRadius: 102.5,
    top: -92,
    right: -48,
    backgroundColor: '#FFE6A2',
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
  headerTitleBlock: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  headerTitle: {
    color: '#7A4E12',
    fontFamily: FONTS.black,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  scorePill: {
    height: 39,
    minWidth: 72,
    maxWidth: 104,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,231,157,0.94)',
    backgroundColor: 'rgba(94,68,31,0.93)',
  },
  scorePillCompact: {
    minWidth: 64,
    maxWidth: 86,
    paddingHorizontal: 6,
  },
  scoreStar: {
    color: '#FFE58C',
    fontSize: 16,
  },
  scoreCopy: {
    minWidth: 0,
    flexShrink: 1,
    alignItems: 'center',
  },
  scoreLabel: {
    color: '#FFE9A9',
    fontFamily: FONTS.bold,
    fontSize: 7,
    lineHeight: 8,
    letterSpacing: 0.6,
  },
  scoreText: {
    color: '#FFFFFF',
    fontFamily: FONTS.black,
    fontSize: 13,
    lineHeight: 16,
  },
  scoreTextCompact: {
    fontSize: 12,
  },
  gemPill: {
    minWidth: 67,
    height: 35,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17.5,
    borderWidth: 1,
    borderColor: 'rgba(40,110,121,0.2)',
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  gemPillText: {
    color: '#276875',
    fontFamily: FONTS.extraBold,
    fontSize: 13,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.96 }],
  },
  loadingContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 72,
  },
  loadingSun: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,224,137,0.75)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.72)',
  },
  loadingSunText: {
    fontSize: 42,
  },
  loadingText: {
    marginTop: 18,
    color: '#3E747B',
    fontFamily: FONTS.bold,
    fontSize: 16,
    textAlign: 'center',
  },
  briefingScroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 30,
  },
  briefingScrollCompact: {
    paddingTop: 2,
    paddingBottom: 18,
  },
  briefingContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 44,
  },
  briefingContentCompact: {
    paddingBottom: 28,
  },
  briefingStreak: {
    marginTop: 14,
    marginBottom: 8,
    color: '#357378',
    fontFamily: FONTS.bold,
    fontSize: 16,
    textAlign: 'center',
  },
  poster: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(201,154,58,0.45)',
    backgroundColor: 'rgba(20,48,56,0.78)',
    shadowColor: '#1C3C44',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },
  dateText: {
    color: '#E8C36A',
    fontFamily: FONTS.bold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'capitalize',
    textAlign: 'center',
  },
  heroMedallion: {
    width: 86,
    height: 86,
    marginTop: 10,
    marginBottom: 8,
    borderRadius: 43,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF2BD',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.8)',
    shadowColor: '#C48A32',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.19,
    shadowRadius: 10,
    elevation: 5,
  },
  heroSun: {
    fontSize: 42,
  },
  heroSparkle: {
    position: 'absolute',
    right: 2,
    top: 6,
    color: '#E59B2E',
    fontFamily: FONTS.black,
    fontSize: 18,
  },
  briefingTitle: {
    color: '#295E67',
    fontFamily: FONTS.black,
    fontSize: 22,
    letterSpacing: 0.7,
    textAlign: 'center',
  },
  briefingSubtitle: {
    maxWidth: 335,
    marginTop: 8,
    color: '#D7E7E4',
    fontFamily: FONTS.semibold,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  streakPill: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,214,120,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(232,195,106,0.45)',
  },
  posterStreakText: {
    color: '#F4D48A',
    fontFamily: FONTS.bold,
    fontSize: 13,
    textAlign: 'center',
  },
  bodyStreakText: {
    marginTop: 14,
    color: '#357378',
    fontFamily: FONTS.bold,
    fontSize: 13,
    textAlign: 'center',
  },
  runRewardNote: {
    maxWidth: 330,
    marginTop: 8,
    color: '#5C7A6E',
    fontFamily: FONTS.semibold,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  trainingBadge: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(66,170,155,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(126,214,196,0.45)',
  },
  trainingBadgeText: {
    color: '#B8EFE4',
    fontFamily: FONTS.extraBold,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  posterRail: {
    width: '100%',
    marginTop: 14,
  },
  rail: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  railItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  railLine: {
    width: 6,
    height: 2,
    marginHorizontal: 1,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  railLineComplete: {
    backgroundColor: '#E8C36A',
  },
  railDot: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  railDotComplete: {
    borderColor: '#E8C36A',
    backgroundColor: '#D7A441',
  },
  railDotCurrent: {
    borderColor: '#7EE0D4',
    backgroundColor: '#2F8F88',
  },
  railDotPeak: {
    borderColor: '#F3C45A',
  },
  railDotText: {
    color: '#E7F4F1',
    fontFamily: FONTS.black,
    fontSize: 11,
  },
  railDotTextOn: {
    color: '#FFFFFF',
  },
  tierLegend: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tierLegendText: {
    color: '#C9DED8',
    fontFamily: FONTS.bold,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  tierLegendDot: {
    marginHorizontal: 6,
    color: '#E8C36A',
  },
  goalsEyebrow: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    marginTop: 16,
    marginBottom: 8,
    color: '#5A4A28',
    fontFamily: FONTS.black,
    fontSize: 11,
    letterSpacing: 1.1,
  },
  goalCard: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    minHeight: 52,
    marginBottom: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(120,97,46,0.16)',
    backgroundColor: 'rgba(255,252,241,0.88)',
  },
  goalCardComplete: {
    borderColor: 'rgba(74,168,144,0.35)',
    backgroundColor: 'rgba(232,253,240,0.92)',
  },
  goalCheck: {
    width: 23,
    height: 23,
    marginRight: 9,
    borderRadius: 11.5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#99BDB7',
    backgroundColor: '#F9FFFD',
  },
  goalCheckComplete: {
    borderColor: '#4AA890',
    backgroundColor: '#53B394',
  },
  goalCheckText: {
    color: '#FFFFFF',
    fontFamily: FONTS.black,
    fontSize: 14,
    lineHeight: 17,
  },
  goalCopy: {
    flex: 1,
  },
  goalText: {
    color: '#587477',
    fontFamily: FONTS.bold,
    fontSize: 13,
  },
  goalTextComplete: {
    color: '#387B6D',
  },
  goalExtra: {
    marginTop: 2,
    color: '#B2751A',
    fontFamily: FONTS.extraBold,
    fontSize: 11,
  },
  goalReward: {
    marginLeft: 8,
    color: '#B2751A',
    fontFamily: FONTS.extraBold,
    fontSize: 12,
  },
  primaryButton: {
    width: '100%',
    maxWidth: 355,
    marginTop: 12,
    overflow: 'hidden',
    borderRadius: 17,
    shadowColor: '#A45C22',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 5,
  },
  primaryPressed: {
    opacity: 0.87,
    transform: [{ translateY: 2 }],
  },
  primaryButtonSurface: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.62)',
    borderRadius: 17,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontFamily: FONTS.black,
    fontSize: 14,
    letterSpacing: 0.75,
  },
  playShell: {
    flex: 1,
  },
  challengeStrip: {
    width: '94%',
    maxWidth: 488,
    alignSelf: 'center',
    marginTop: 4,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 6,
    overflow: 'hidden',
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#FFE7A3',
  },
  challengeStripTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  challengeEyebrow: {
    flexShrink: 1,
    color: '#E8C36A',
    fontFamily: FONTS.black,
    fontSize: 10,
    letterSpacing: 1.1,
  },
  challengeMetaChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  challengeTierChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(232,195,106,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(232,195,106,0.45)',
  },
  challengeTierText: {
    color: '#F4D48A',
    fontFamily: FONTS.black,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  challengeTrainChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(126,224,212,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(126,224,212,0.35)',
  },
  challengeTrainText: {
    color: '#B8EFE4',
    fontFamily: FONTS.bold,
    fontSize: 9,
  },
  challengeStripBottom: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  challengePuzzleIndex: {
    color: '#F4FBFA',
    fontFamily: FONTS.black,
    fontSize: 12,
  },
  challengeStreak: {
    color: '#F4D48A',
    fontFamily: FONTS.bold,
    fontSize: 10,
  },
  playBoard: {
    flex: 1,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
    paddingBottom: 2,
  },
  boardTopSection: {
    width: '100%',
    zIndex: 2,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 16,
    paddingBottom: 8,
    overflow: 'visible',
    flexShrink: 0,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#D5EEF2',
  },
  boardTopSectionChallenge: {
    borderColor: '#E2BA5C',
  },
  boardQuestionRow: {
    width: '100%',
    minHeight: 62,
    overflow: 'visible',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  boardQuestionMeta: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  infoChipFrame: {
    flex: 1,
    minWidth: 0,
    minHeight: 62,
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 3,
  },
  infoChip: {
    flex: 1,
    minHeight: 62,
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#C6DEE2',
  },
  infoChipLabel: {
    color: '#557782',
    fontFamily: FONTS.extraBold,
    fontSize: 9,
    letterSpacing: 0.7,
    lineHeight: 11,
    marginBottom: 2,
  },
  infoChipValue: {
    color: '#233540',
    fontFamily: FONTS.black,
    fontSize: 22,
    lineHeight: 26,
  },
  boardTargetFrame: {
    position: 'relative',
    width: '40%',
    minHeight: 62,
    overflow: 'visible',
    borderRadius: 16,
  },
  boardTargetPulse: {
    width: '100%',
    flex: 1,
    minHeight: 62,
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 3,
  },
  boardTargetSolvedFrame: {
    shadowColor: '#10B981',
    shadowOpacity: 0.35,
    shadowRadius: 14,
  },
  boardTargetCard: {
    flex: 1,
    minHeight: 62,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#C6DEE2',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  stepMeter: {
    zIndex: 1,
    minHeight: 16,
    marginTop: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  stepDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1.2,
    borderColor: '#B98834',
    backgroundColor: 'rgba(255,255,255,0.54)',
  },
  stepDotFilled: {
    borderColor: '#A87521',
    backgroundColor: '#D9A83E',
  },
  stepDotSolved: {
    borderColor: '#23785B',
  },
  stepDotSolvedFilled: {
    borderColor: '#23785B',
    backgroundColor: '#3DA27B',
  },
  stepDotBonus: {
    borderColor: 'rgba(255,255,255,0.78)',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  stepDotBonusFilled: {
    borderColor: '#F6E3A4',
    backgroundColor: '#F4D37B',
  },
  stepDotBonusSolved: {
    borderColor: '#E8FFF6',
  },
  stepDotBonusSolvedFilled: {
    borderColor: '#E8FFF6',
    backgroundColor: '#8EE0BF',
  },
  boardTargetColorReveal: {
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
  boardTargetOpCorner: {
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
  boardTargetOpCornerSolved: {
    borderColor: 'rgba(35,120,91,0.42)',
    backgroundColor: 'rgba(232,250,239,0.94)',
  },
  boardTargetOpText: {
    color: '#416B78',
    fontFamily: FONTS.black,
    fontSize: 15,
    lineHeight: 17,
  },
  boardTargetValue: {
    zIndex: 1,
    color: '#233540',
    fontFamily: FONTS.black,
    fontSize: 24,
    lineHeight: 29,
  },
  boardTargetValueLarge: {
    fontSize: 30,
    lineHeight: 36,
  },
  boardSolvedText: {
    color: '#23785B',
  },
  boardTargetSolvedBorder: {
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
  boardBonusRow: {
    width: '100%',
    minHeight: 62,
    marginTop: 8,
    paddingLeft: 12,
    paddingRight: 7,
    paddingVertical: 6,
    overflow: 'visible',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#D9B95A',
    backgroundColor: 'rgba(255,247,206,0.98)',
  },
  boardBonusRowRaised: {
    zIndex: 6,
    elevation: 8,
  },
  boardBonusRowSolved: {
    borderColor: '#3DA27B',
  },
  boardBonusRowColorReveal: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '200%',
  },
  boardBonusAnchor: {
    zIndex: 1,
    flex: 1,
    flexShrink: 0,
    minWidth: 72,
    alignItems: 'flex-start',
  },
  boardBonusLabel: {
    color: '#5A2F78',
    fontFamily: FONTS.black,
    fontSize: 13,
    letterSpacing: 0.8,
    lineHeight: 15,
    marginBottom: 2,
  },
  boardBonusPill: {
    height: 24,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(117,80,151,0.44)',
    backgroundColor: 'rgba(141,93,180,0.14)',
  },
  boardBonusPillSolved: {
    borderColor: 'rgba(28,119,91,0.42)',
    backgroundColor: 'rgba(255,255,255,0.52)',
  },
  boardBonusRewardValue: {
    color: '#176F8C',
    fontFamily: FONTS.black,
    fontSize: 14,
    lineHeight: 16,
  },
  boardBonusRewardSolved: {
    color: '#176D58',
  },
  boardBonusCardMeasure: {
    zIndex: 2,
    width: 94,
    height: 62,
    justifyContent: 'center',
  },
  boardBonusCard: {
    width: 94,
    height: 62,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.92)',
    paddingTop: 4,
    paddingBottom: 5,
  },
  boardBonusGemCorner: {
    position: 'absolute',
    zIndex: 3,
    top: 4,
    left: 5,
    width: 19,
    height: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boardBonusGemLifted: {
    opacity: 0.22,
  },
  boardBonusOpCorner: {
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
  boardBonusOpCornerSolved: {
    borderColor: 'rgba(255,255,255,0.8)',
    backgroundColor: 'rgba(28,119,91,0.55)',
  },
  boardBonusOpText: {
    color: '#FFFFFF',
    fontFamily: FONTS.black,
    fontSize: 14,
    lineHeight: 16,
  },
  boardBonusValue: {
    zIndex: 1,
    color: '#FFFFFF',
    fontFamily: FONTS.black,
    fontSize: 22,
    lineHeight: 26,
  },
  feedbackSlot: {
    width: '100%',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  boardFeedbackPill: {
    maxWidth: '94%',
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1.5,
  },
  boardFeedbackText: {
    fontFamily: FONTS.black,
    fontSize: 14,
    textAlign: 'center',
  },
  wheelContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultFlightLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 72,
    overflow: 'hidden',
  },
  confettiLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 70,
  },
  treasureScroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 27,
    paddingBottom: 28,
  },
  treasureChest: {
    width: 120,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
  },
  treasureEmoji: {
    fontSize: 67,
  },
  treasureSparkleLeft: {
    position: 'absolute',
    left: 3,
    top: 18,
    color: '#D99125',
    fontFamily: FONTS.black,
    fontSize: 23,
  },
  treasureSparkleRight: {
    position: 'absolute',
    right: 1,
    bottom: 11,
    color: '#D99125',
    fontFamily: FONTS.black,
    fontSize: 19,
  },
  treasureTitle: {
    marginTop: 3,
    color: '#295E67',
    fontFamily: FONTS.black,
    fontSize: 23,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  treasureSubtitle: {
    maxWidth: 330,
    marginTop: 8,
    color: '#53777A',
    fontFamily: FONTS.semibold,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  rewardCard: {
    width: '100%',
    maxWidth: 390,
    marginTop: 23,
    paddingHorizontal: 16,
    paddingVertical: 17,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: '#E8C66E',
    backgroundColor: 'rgba(255,253,242,0.86)',
    shadowColor: '#A97C31',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  rewardBig: {
    color: '#B47719',
    fontFamily: FONTS.black,
    fontSize: 30,
    textAlign: 'center',
  },
  rewardLabel: {
    marginTop: 2,
    color: '#8E7548',
    fontFamily: FONTS.bold,
    fontSize: 12,
    textAlign: 'center',
  },
  rewardDivider: {
    height: 1,
    marginTop: 13,
    marginBottom: 8,
    backgroundColor: 'rgba(154,119,54,0.16)',
  },
  completedContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 44,
  },
  completedBadge: {
    width: 98,
    height: 98,
    borderRadius: 49,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: 'rgba(255,255,255,0.8)',
    backgroundColor: '#5AB28F',
    shadowColor: '#367B69',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  completedBadgeText: {
    color: '#FFFFFF',
    fontFamily: FONTS.black,
    fontSize: 51,
    lineHeight: 58,
  },
  completedTitle: {
    maxWidth: 350,
    marginTop: 23,
    color: '#295E67',
    fontFamily: FONTS.black,
    fontSize: 21,
    lineHeight: 27,
    textAlign: 'center',
  },
  completedHaul: {
    marginTop: 10,
    color: '#B47719',
    fontFamily: FONTS.black,
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center',
  },
  completedSummary: {
    marginTop: 9,
    color: '#587A7D',
    fontFamily: FONTS.semibold,
    fontSize: 14,
    textAlign: 'center',
  },
  alreadyCard: {
    maxWidth: 360,
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(52,126,123,0.17)',
    backgroundColor: 'rgba(255,255,255,0.65)',
  },
  alreadyText: {
    color: '#527679',
    fontFamily: FONTS.semibold,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  secondaryButton: {
    minWidth: 218,
    minHeight: 47,
    marginTop: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#3C948E',
    backgroundColor: 'rgba(255,255,255,0.64)',
  },
  secondaryButtonText: {
    color: '#287873',
    fontFamily: FONTS.black,
    fontSize: 13,
    letterSpacing: 0.45,
  },
});
