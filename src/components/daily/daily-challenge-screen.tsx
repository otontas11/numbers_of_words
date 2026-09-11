import { LinearGradient } from 'expo-linear-gradient';
import {
  Animated,
  Easing,
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

import {
  NumberWheel,
  type WheelSelectionOutcome,
} from '@/components/game/number-wheel';
import { FONTS } from '@/constants/fonts';
import {
  DAILY_CHALLENGE_ALL_BONUS_REWARD,
  DAILY_CHALLENGE_BASE_REWARD,
  DAILY_CHALLENGE_NO_HINT_REWARD,
  claimDailyChallengeProgress,
  createDailyChallengeProgress,
  getDailyChallenge,
  getLocalDateKey,
  isDailyChallengeComplete,
  type DailyChallenge,
  type DailyChallengeProgress,
} from '@/game/daily-challenge';
import {
  loadDailyChallengeProgress,
  saveDailyChallengeProgress,
} from '@/game/daily-challenge-storage';
import {
  computeResult,
  findSolutionIndices,
  OPERATION_DETAILS,
} from '@/game/levels';
import type { GameSound } from '@/hooks/use-game-sounds';
import { useI18n } from '@/i18n';

const HINT_GEM_COST = 10;
const PUZZLE_COUNT = 3;

type DailyChallengeScreenProps = {
  active: boolean;
  gemCount: number;
  onBack: () => void;
  onSpendGems: (cost: number) => void;
  onReward: (gems: number) => void;
  onEffect: (sound: GameSound) => void;
};

type Phase = 'loading' | 'briefing' | 'play' | 'treasure' | 'completed';
type FeedbackTone = 'live' | 'success' | 'bonus' | 'info';
type Feedback = { text: string; tone: FeedbackTone };
type Timer = ReturnType<typeof setTimeout>;

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

function GoalRow({
  complete,
  children,
  reward,
}: {
  complete: boolean;
  children: ReactNode;
  reward?: number;
}) {
  return (
    <View style={[styles.goalRow, complete && styles.goalRowComplete]}>
      <View style={[styles.goalCheck, complete && styles.goalCheckComplete]}>
        <Text style={styles.goalCheckText}>{complete ? '✓' : '○'}</Text>
      </View>
      <Text style={[styles.goalText, complete && styles.goalTextComplete]}>{children}</Text>
      {reward ? <Text style={styles.goalReward}>+{reward} 💎</Text> : null}
    </View>
  );
}

export function DailyChallengeScreen({
  active,
  gemCount,
  onBack,
  onEffect,
  onReward,
  onSpendGems,
}: DailyChallengeScreenProps) {
  const { t } = useI18n();
  const { height, width } = useWindowDimensions();
  const compact = height < 735;
  const wheelSize = Math.min(width - 34, compact ? 296 : 346);
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [progress, setProgress] = useState<DailyChallengeProgress | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [hintIndices, setHintIndices] = useState<number[]>([]);
  const [selectionCount, setSelectionCount] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [sunPulse] = useState(() => new Animated.Value(0));
  const hintActiveRef = useRef(false);
  const claimInFlightRef = useRef(false);
  const progressRef = useRef<DailyChallengeProgress | null>(null);
  const feedbackTimerRef = useRef<Timer | null>(null);
  const hintTimerRef = useRef<Timer | null>(null);
  const levelCompleteTimerRef = useRef<Timer | null>(null);

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

  const clearLevelCompleteTimer = useCallback(() => {
    if (!levelCompleteTimerRef.current) return;
    clearTimeout(levelCompleteTimerRef.current);
    levelCompleteTimerRef.current = null;
  }, []);

  const clearPuzzleVisuals = useCallback(() => {
    clearHintTimer();
    clearLevelCompleteTimer();
    setHintIndices([]);
    setSelectionCount(0);
    setPreview(null);
    clearFeedbackTimer();
    setFeedback(null);
  }, [clearFeedbackTimer, clearHintTimer, clearLevelCompleteTimer]);

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
      clearLevelCompleteTimer();
    };
  }, [clearFeedbackTimer, clearHintTimer, clearLevelCompleteTimer]);

  useEffect(() => {
    if (active && phase === 'play') return;
    clearLevelCompleteTimer();
  }, [active, clearLevelCompleteTimer, phase]);

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
    const nextChallenge = getDailyChallenge();
    setChallenge(nextChallenge);
    setProgress(null);
    progressRef.current = null;
    setPhase('loading');
    claimInFlightRef.current = false;

    void loadDailyChallengeProgress(dateKey)
      .catch(() => createDailyChallengeProgress(dateKey))
      .then((loadedProgress) => {
        if (cancelled) return;

        const nextPuzzleIndex = nextChallenge.puzzles.findIndex(
          (puzzle) => !loadedProgress.completedPuzzleIds.includes(puzzle.id),
        );
        setProgress(loadedProgress);
        progressRef.current = loadedProgress;
        setPuzzleIndex(
          nextPuzzleIndex >= 0
            ? nextPuzzleIndex
            : Math.max(0, nextChallenge.puzzles.length - 1),
        );
        if (loadedProgress.claimed) {
          setPhase('completed');
        } else if (isDailyChallengeComplete(loadedProgress, nextChallenge)) {
          setPhase('treasure');
        } else {
          setPhase('briefing');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [active, clearPuzzleVisuals]);

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
  const noHintsUsed = !progress?.usedHint;
  const rewardTotal =
    DAILY_CHALLENGE_BASE_REWARD +
    (allBonusesFound ? DAILY_CHALLENGE_ALL_BONUS_REWARD : 0) +
    (noHintsUsed ? DAILY_CHALLENGE_NO_HINT_REWARD : 0);
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

  const handlePreview = useCallback(
    (indices: number[]) => {
      if (!currentPuzzle || indices.length < 2) {
        setPreview(null);
        return;
      }
      const calculation = computeResult(
        indices.map((index) => currentPuzzle.numbers[index]),
        currentPuzzle.op,
      );
      setPreview(
        calculation
          ? `${calculation.expression} = ${calculation.result}`
          : t('feedback.tryAnother'),
      );
    },
    [currentPuzzle, t],
  );

  const handleComplete = useCallback(
    (indices: number[]): WheelSelectionOutcome => {
      const currentProgress = progressRef.current;
      if (!currentPuzzle || !currentProgress || currentProgress.claimed || indices.length < 2) {
        setPreview(null);
        return 'invalid';
      }

      const calculation = computeResult(
        indices.map((index) => currentPuzzle.numbers[index]),
        currentPuzzle.op,
      );
      setPreview(null);
      if (!calculation) {
        showFeedback({ text: t('feedback.invalid'), tone: 'info' });
        return 'invalid';
      }

      const puzzleId = currentPuzzle.id;
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
        };
        progressRef.current = next;
        setProgress((prev) => {
          if (!prev || prev.claimed || prev.completedPuzzleIds.includes(puzzleId)) {
            return prev ?? next;
          }
          return {
            ...prev,
            completedPuzzleIds: [...prev.completedPuzzleIds, puzzleId],
          };
        });
        void saveDailyChallengeProgress(next).catch(() => undefined);
        clearHintTimer();
        setHintIndices([]);
        onEffect('success');
        showFeedback({ text: t('daily.targetFound'), tone: 'success' }, 1900);
        clearLevelCompleteTimer();
        levelCompleteTimerRef.current = setTimeout(() => {
          levelCompleteTimerRef.current = null;
          onEffect('levelComplete');
        }, 420);
        return 'success';
      }

      if (isBonusMatch) {
        if (currentProgress.completedBonusPuzzleIds.includes(puzzleId)) {
          showFeedback({ text: t('feedback.alreadyFound'), tone: 'info' }, 1250);
          return 'invalid';
        }
        const next = {
          ...currentProgress,
          completedBonusPuzzleIds: [...currentProgress.completedBonusPuzzleIds, puzzleId],
        };
        progressRef.current = next;
        setProgress((prev) => {
          if (!prev || prev.claimed || prev.completedBonusPuzzleIds.includes(puzzleId)) {
            return prev ?? next;
          }
          return {
            ...prev,
            completedBonusPuzzleIds: [...prev.completedBonusPuzzleIds, puzzleId],
          };
        });
        void saveDailyChallengeProgress(next).catch(() => undefined);
        onEffect('bonus');
        showFeedback({ text: t('daily.bonusFound'), tone: 'bonus' }, 1850);
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
      clearHintTimer,
      clearLevelCompleteTimer,
      currentPuzzle,
      onEffect,
      showFeedback,
      t,
    ],
  );

  const handleBack = useCallback(() => {
    clearLevelCompleteTimer();
    onBack();
  }, [clearLevelCompleteTimer, onBack]);

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

  const handleShuffle = useCallback(() => {
    clearHintTimer();
    setHintIndices([]);
    setPreview(null);
    setSelectionCount(0);
    onEffect('shuffle');
  }, [clearHintTimer, onEffect]);

  const handleNextPuzzle = useCallback(() => {
    if (!challenge || !progress || !targetComplete) return;
    const nextPuzzleIndex = challenge.puzzles.findIndex(
      (puzzle) => !progress.completedPuzzleIds.includes(puzzle.id),
    );
    clearPuzzleVisuals();
    if (nextPuzzleIndex < 0) {
      setPhase('treasure');
      return;
    }
    setPuzzleIndex(nextPuzzleIndex);
  }, [challenge, clearPuzzleVisuals, progress, targetComplete]);

  const handleClaim = useCallback(() => {
    if (!challenge || !progress || !allPuzzlesComplete || progress.claimed || claimInFlightRef.current) {
      return;
    }
    claimInFlightRef.current = true;
    const claimedProgress = claimDailyChallengeProgress(progress, challenge);
    persistProgress(claimedProgress);
    onReward(rewardTotal);
    onEffect('points');
    setPhase('completed');
  }, [
    allPuzzlesComplete,
    challenge,
    onEffect,
    onReward,
    persistProgress,
    progress,
    rewardTotal,
  ]);

  if (!active) return null;

  const puzzleTotal = challenge?.puzzles.length ?? PUZZLE_COUNT;
  const displayedFeedback = feedback ?? (preview ? { text: preview, tone: 'live' as const } : null);
  const operationSymbol = currentPuzzle
    ? OPERATION_DETAILS[currentPuzzle.op].symbol
    : undefined;

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={['#BFE8EE', '#E8F6F0', '#FFF3D9', '#F9E3B5']}
        locations={[0, 0.38, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.waveOne} />
      <View pointerEvents="none" style={styles.waveTwo} />
      <Animated.View pointerEvents="none" style={[styles.sunGlow, sunStyle]} />

      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel={t('daily.backA11y')}
            accessibilityRole="button"
            hitSlop={10}
            onPress={handleBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <View pointerEvents="none" style={styles.headerTitleBlock}>
            <Text numberOfLines={1} style={styles.headerTitle}>
              {t('daily.title')}
            </Text>
          </View>
          <View accessible accessibilityLabel={`${gemCount} 💎`} style={styles.gemPill}>
            <Text style={styles.gemPillText}>💎 {gemCount}</Text>
          </View>
        </View>

        {phase === 'loading' || !challenge || !progress ? (
          <View style={styles.loadingContent}>
            <View style={styles.loadingSun}>
              <Text style={styles.loadingSunText}>☀</Text>
            </View>
            <Text style={styles.loadingText}>{t('daily.loading')}</Text>
          </View>
        ) : null}

        {phase === 'briefing' && challenge && progress ? (
          <ScrollView
            contentContainerStyle={[styles.briefingScroll, compact && styles.briefingScrollCompact]}
            showsVerticalScrollIndicator={false}>
            <View style={styles.heroMedallion}>
              <Text style={styles.heroSun}>☀</Text>
              <Text style={styles.heroSparkle}>✦</Text>
            </View>
            <Text style={styles.briefingTitle}>{t('daily.title')}</Text>
            <Text style={styles.briefingSubtitle}>{t('daily.subtitle')}</Text>

            <View style={styles.progressCard}>
              <View style={styles.progressCardTop}>
                <Text style={styles.progressCaption}>
                  {t('daily.puzzleProgress', {
                    completed: completedPuzzleCount,
                    total: puzzleTotal,
                  })}
                </Text>
                <Text style={styles.progressValue}>{completedPuzzleCount}/{puzzleTotal}</Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${(completedPuzzleCount / puzzleTotal) * 100}%` },
                  ]}
                />
              </View>
            </View>

            <View style={styles.goalCard}>
              <GoalRow complete={allPuzzlesComplete} reward={DAILY_CHALLENGE_BASE_REWARD}>
                {t('daily.goalSolvePuzzles')}
              </GoalRow>
              <GoalRow complete={allBonusesFound} reward={DAILY_CHALLENGE_ALL_BONUS_REWARD}>
                {t('daily.goalBonus')}
              </GoalRow>
              <GoalRow complete={noHintsUsed} reward={DAILY_CHALLENGE_NO_HINT_REWARD}>
                {t('daily.goalNoHints')}
              </GoalRow>
            </View>

            <Text style={styles.streakText}>{t('daily.streak', { count: progress.streak })}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                clearPuzzleVisuals();
                setPhase('play');
              }}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryPressed]}>
              <LinearGradient
                colors={['#F9C85C', '#E99A2E', '#C96D20']}
                end={{ x: 0.72, y: 1 }}
                start={{ x: 0.15, y: 0 }}
                style={styles.primaryButtonSurface}>
                <Text style={styles.primaryButtonText}>{t('daily.start')}</Text>
              </LinearGradient>
            </Pressable>
          </ScrollView>
        ) : null}

        {phase === 'play' && currentPuzzle && progress ? (
          <ScrollView
            contentContainerStyle={[styles.playScroll, compact && styles.playScrollCompact]}
            showsVerticalScrollIndicator={false}>
            <View style={styles.playProgressRow}>
              <Text style={styles.playProgressText}>
                {t('daily.puzzleProgress', {
                  completed: completedPuzzleCount,
                  total: puzzleTotal,
                })}
              </Text>
              <View style={styles.miniProgressTrack}>
                <View
                  style={[
                    styles.miniProgressFill,
                    { width: `${(completedPuzzleCount / puzzleTotal) * 100}%` },
                  ]}
                />
              </View>
            </View>

            <View style={styles.targetDeck}>
              <View
                accessible
                accessibilityLabel={t('daily.targetA11y', {
                  value: currentPuzzle.target.value,
                  steps: currentPuzzle.target.steps,
                })}
                style={[styles.targetCard, targetComplete && styles.targetCardComplete]}>
                <View style={styles.targetIconCircle}>
                  <Text style={styles.targetIcon}>{targetComplete ? '✓' : '✦'}</Text>
                </View>
                <View style={styles.targetCopy}>
                  <Text style={styles.targetEyebrow}>🎯</Text>
                  <Text style={styles.targetValue}>{currentPuzzle.target.value}</Text>
                  <Text style={styles.targetMeta}>
                    {operationSymbol} · {currentPuzzle.target.steps}
                  </Text>
                </View>
              </View>

              <View
                accessible
                accessibilityLabel={t('daily.bonusA11y', {
                  value: currentPuzzle.bonusTarget.value,
                  steps: currentPuzzle.bonusTarget.steps,
                })}
                style={[styles.bonusCard, bonusComplete && styles.bonusCardComplete]}>
                <Text style={styles.bonusIcon}>{bonusComplete ? '✓' : '💎'}</Text>
                <Text style={styles.bonusValue}>{currentPuzzle.bonusTarget.value}</Text>
                <Text style={styles.bonusMeta}>
                  {operationSymbol} · {currentPuzzle.bonusTarget.steps}
                </Text>
              </View>
            </View>

            <View style={styles.expressionSlot}>
              {displayedFeedback ? (
                <View
                  style={[
                    styles.feedbackPill,
                    {
                      backgroundColor: FEEDBACK_COLORS[displayedFeedback.tone].background,
                      borderColor: FEEDBACK_COLORS[displayedFeedback.tone].border,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.feedbackText,
                      { color: FEEDBACK_COLORS[displayedFeedback.tone].text },
                    ]}>
                    {displayedFeedback.text}
                  </Text>
                </View>
              ) : (
                <Text style={styles.connectHint}>{operationSymbol}</Text>
              )}
            </View>

            <View style={styles.wheelShell}>
              <NumberWheel
                key={`${challenge?.dateKey ?? ''}-${currentPuzzle.id}-${wheelSize}`}
                canUseHint={gemCount >= HINT_GEM_COST && !targetComplete}
                hintCost={HINT_GEM_COST}
                hintIndices={hintIndices}
                numbers={currentPuzzle.numbers}
                operationGuideSymbol={operationSymbol}
                onComplete={handleComplete}
                onDraggingChange={(dragging) => {
                  if (!dragging) {
                    setSelectionCount(0);
                    setPreview(null);
                  }
                }}
                onHint={handleHint}
                onNodeAdded={(count) => {
                  setSelectionCount(count);
                  onEffect(selectionSound(count));
                }}
                onNodeRemoved={(count) => {
                  setSelectionCount(count);
                  onEffect(selectionSound(count));
                }}
                onPreview={handlePreview}
                onShuffle={handleShuffle}
                size={wheelSize}
              />
            </View>

            <View style={styles.selectionHintRow}>
              <View style={styles.selectionDot} />
              <Text style={styles.selectionHintText}>
                {selectionCount}/{currentPuzzle.target.steps}
              </Text>
            </View>

            {targetComplete ? (
              <Pressable
                accessibilityRole="button"
                onPress={handleNextPuzzle}
                style={({ pressed }) => [styles.nextButton, pressed && styles.primaryPressed]}>
                <Text style={styles.nextButtonText}>{t('daily.nextPuzzle')} ›</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        ) : null}

        {phase === 'treasure' && challenge && progress ? (
          <ScrollView contentContainerStyle={styles.treasureScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.treasureChest}>
              <Text style={styles.treasureSparkleLeft}>✦</Text>
              <Text style={styles.treasureEmoji}>🎁</Text>
              <Text style={styles.treasureSparkleRight}>✦</Text>
            </View>
            <Text style={styles.treasureTitle}>{t('daily.treasureTitle')}</Text>
            <Text style={styles.treasureSubtitle}>{t('daily.treasureSubtitle')}</Text>

            <View style={styles.rewardCard}>
              <Text style={styles.rewardBig}>💎 +{rewardTotal}</Text>
              <Text style={styles.rewardLabel}>{t('daily.reward', { gems: rewardTotal })}</Text>
              <View style={styles.rewardDivider} />
              <GoalRow complete={true} reward={DAILY_CHALLENGE_BASE_REWARD}>
                {t('daily.goalSolvePuzzles')}
              </GoalRow>
              <GoalRow complete={allBonusesFound} reward={DAILY_CHALLENGE_ALL_BONUS_REWARD}>
                {t('daily.goalBonus')}
              </GoalRow>
              <GoalRow complete={noHintsUsed} reward={DAILY_CHALLENGE_NO_HINT_REWARD}>
                {t('daily.goalNoHints')}
              </GoalRow>
            </View>
            <Text style={styles.streakText}>{t('daily.streak', { count: progress.streak })}</Text>
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
          </ScrollView>
        ) : null}

        {phase === 'completed' && progress ? (
          <View style={styles.completedContent}>
            <View style={styles.completedBadge}>
              <Text style={styles.completedBadgeText}>✓</Text>
            </View>
            <Text style={styles.completedTitle}>{t('daily.completedTitle')}</Text>
            <Text style={styles.completedSummary}>
              {t('daily.completedSummary', { total: puzzleTotal })}
            </Text>
            <Text style={styles.streakText}>{t('daily.streak', { count: progress.streak })}</Text>
            <View style={styles.alreadyCard}>
              <Text style={styles.alreadyText}>{t('daily.alreadyCompleted')}</Text>
            </View>
            <Pressable
              accessibilityLabel={t('daily.backA11y')}
              accessibilityRole="button"
              onPress={handleBack}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <Text style={styles.secondaryButtonText}>{t('daily.returnHome')}</Text>
            </Pressable>
          </View>
        ) : null}
      </SafeAreaView>
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
    backgroundColor: '#DFF2EE',
  },
  safeArea: {
    flex: 1,
  },
  waveOne: {
    position: 'absolute',
    width: '142%',
    height: 210,
    left: '-20%',
    top: '29%',
    borderRadius: 190,
    backgroundColor: 'rgba(255,255,255,0.26)',
    transform: [{ rotate: '-8deg' }],
  },
  waveTwo: {
    position: 'absolute',
    width: '156%',
    height: 260,
    left: '-29%',
    bottom: '-8%',
    borderRadius: 240,
    backgroundColor: 'rgba(255,249,229,0.54)',
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
  header: {
    minHeight: 54,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 39,
    height: 39,
    borderRadius: 19.5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(42,101,111,0.24)',
    backgroundColor: 'rgba(255,255,255,0.67)',
    shadowColor: '#4B8589',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 5,
    elevation: 3,
  },
  backIcon: {
    marginTop: -4,
    color: '#236675',
    fontFamily: FONTS.bold,
    fontSize: 34,
    lineHeight: 36,
  },
  headerTitleBlock: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    color: '#285C68',
    fontFamily: FONTS.black,
    fontSize: 15,
    letterSpacing: 0.9,
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
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 30,
  },
  briefingScrollCompact: {
    paddingTop: 4,
    paddingBottom: 18,
  },
  heroMedallion: {
    width: 104,
    height: 104,
    marginBottom: 12,
    borderRadius: 52,
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
    fontSize: 53,
  },
  heroSparkle: {
    position: 'absolute',
    right: 2,
    top: 6,
    color: '#E59B2E',
    fontFamily: FONTS.black,
    fontSize: 22,
  },
  briefingTitle: {
    color: '#245C66',
    fontFamily: FONTS.black,
    fontSize: 23,
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  briefingSubtitle: {
    maxWidth: 335,
    marginTop: 8,
    color: '#4C7377',
    fontFamily: FONTS.semibold,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  progressCard: {
    width: '100%',
    maxWidth: 390,
    marginTop: 24,
    padding: 15,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(48,128,133,0.16)',
    backgroundColor: 'rgba(255,255,255,0.71)',
  },
  progressCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressCaption: {
    flex: 1,
    color: '#39737A',
    fontFamily: FONTS.bold,
    fontSize: 13,
  },
  progressValue: {
    color: '#22707B',
    fontFamily: FONTS.black,
    fontSize: 14,
  },
  progressTrack: {
    height: 9,
    marginTop: 11,
    overflow: 'hidden',
    borderRadius: 4.5,
    backgroundColor: '#D9ECE9',
  },
  progressFill: {
    height: '100%',
    minWidth: 0,
    borderRadius: 4.5,
    backgroundColor: '#42AA9B',
  },
  goalCard: {
    width: '100%',
    maxWidth: 390,
    marginTop: 13,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(120,97,46,0.12)',
    backgroundColor: 'rgba(255,252,241,0.8)',
  },
  goalRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(123,111,77,0.1)',
  },
  goalRowComplete: {
    opacity: 0.82,
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
  goalText: {
    flex: 1,
    color: '#587477',
    fontFamily: FONTS.bold,
    fontSize: 13,
  },
  goalTextComplete: {
    color: '#387B6D',
  },
  goalReward: {
    marginLeft: 8,
    color: '#B2751A',
    fontFamily: FONTS.extraBold,
    fontSize: 12,
  },
  streakText: {
    marginTop: 14,
    color: '#357378',
    fontFamily: FONTS.bold,
    fontSize: 13,
    textAlign: 'center',
  },
  primaryButton: {
    width: '100%',
    maxWidth: 355,
    marginTop: 17,
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
  playScroll: {
    alignItems: 'center',
    paddingHorizontal: 17,
    paddingTop: 9,
    paddingBottom: 25,
  },
  playScrollCompact: {
    paddingTop: 2,
    paddingBottom: 16,
  },
  playProgressRow: {
    width: '100%',
    maxWidth: 408,
    flexDirection: 'row',
    alignItems: 'center',
  },
  playProgressText: {
    marginRight: 10,
    color: '#3B7277',
    fontFamily: FONTS.bold,
    fontSize: 12,
  },
  miniProgressTrack: {
    flex: 1,
    height: 7,
    overflow: 'hidden',
    borderRadius: 4,
    backgroundColor: 'rgba(67,139,143,0.18)',
  },
  miniProgressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#3EA79C',
  },
  targetDeck: {
    width: '100%',
    maxWidth: 408,
    marginTop: 11,
    flexDirection: 'row',
  },
  targetCard: {
    minHeight: 88,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#7AC9C7',
    backgroundColor: 'rgba(245,255,252,0.9)',
    shadowColor: '#3D8585',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.13,
    shadowRadius: 5,
    elevation: 3,
  },
  targetCardComplete: {
    borderColor: '#55B087',
    backgroundColor: 'rgba(232,253,240,0.93)',
  },
  targetIconCircle: {
    width: 40,
    height: 40,
    marginRight: 9,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D2F0E8',
  },
  targetIcon: {
    color: '#278B83',
    fontFamily: FONTS.black,
    fontSize: 20,
  },
  targetCopy: {
    flex: 1,
  },
  targetEyebrow: {
    marginBottom: -3,
    fontSize: 12,
  },
  targetValue: {
    color: '#1F6970',
    fontFamily: FONTS.black,
    fontSize: 29,
    lineHeight: 33,
  },
  targetMeta: {
    color: '#638789',
    fontFamily: FONTS.bold,
    fontSize: 11,
  },
  bonusCard: {
    width: 100,
    minHeight: 88,
    marginLeft: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E9C36A',
    backgroundColor: 'rgba(255,250,224,0.92)',
    shadowColor: '#AA7D32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 3,
  },
  bonusCardComplete: {
    borderColor: '#D6A441',
    backgroundColor: 'rgba(255,243,195,0.98)',
  },
  bonusIcon: {
    fontSize: 17,
  },
  bonusValue: {
    marginTop: -2,
    color: '#9C691A',
    fontFamily: FONTS.black,
    fontSize: 23,
    lineHeight: 27,
  },
  bonusMeta: {
    color: '#A68248',
    fontFamily: FONTS.bold,
    fontSize: 10,
  },
  expressionSlot: {
    width: '100%',
    minHeight: 36,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackPill: {
    maxWidth: '100%',
    paddingHorizontal: 15,
    paddingVertical: 7,
    borderRadius: 15,
    borderWidth: 1,
  },
  feedbackText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  connectHint: {
    color: '#4D9294',
    fontFamily: FONTS.black,
    fontSize: 20,
  },
  wheelShell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionHintRow: {
    minHeight: 16,
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectionDot: {
    width: 6,
    height: 6,
    marginRight: 5,
    borderRadius: 3,
    backgroundColor: '#54AFA9',
  },
  selectionHintText: {
    color: '#538084',
    fontFamily: FONTS.bold,
    fontSize: 11,
  },
  nextButton: {
    minWidth: 220,
    minHeight: 45,
    marginTop: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    backgroundColor: '#3E9C94',
    shadowColor: '#2B7472',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontFamily: FONTS.black,
    fontSize: 13,
    letterSpacing: 0.5,
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
    marginTop: 23,
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
