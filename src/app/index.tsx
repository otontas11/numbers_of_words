import { BlurTargetView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import {
  Animated,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PassportModal } from '@/components/game/game-modals';
import { NumberWheel } from '@/components/game/number-wheel';
import { JourneyMap } from '@/components/journey/journey-map';
import { FONTS } from '@/constants/fonts';
import {
  computeResult,
  findSolutionIndices,
  generateLevelData,
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
  getCountryProgress,
  getLocationProgress,
  getTravelLevelCompletion,
} from '@/game/travel';
import { useGameSounds, type GameSound } from '@/hooks/use-game-sounds';

type FeedbackTone = 'live' | 'success' | 'bonus' | 'info';

type Feedback = {
  text: string;
  tone: FeedbackTone;
};

type Timer = ReturnType<typeof setTimeout>;

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

function TargetCard({
  target,
  solved,
  hinted,
  large,
  width,
}: {
  target: Target;
  solved: boolean;
  hinted: boolean;
  large: boolean;
  width: `${number}%`;
}) {
  const operation = OPERATION_DETAILS[target.op];
  const [scale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    scale.stopAnimation();
    const animation = hinted
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
  }, [hinted, scale]);

  return (
    <Animated.View
      accessibilityLabel={`${target.value} hedefi, ${target.steps} sayı`}
      style={[
        styles.targetCardFrame,
        solved && styles.targetSolvedFrame,
        hinted && styles.targetHintedFrame,
        { width, transform: [{ scale }] },
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
  );
}

function PulsingBonus({ count, compact }: { count: number; compact: boolean }) {
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 1000, useNativeDriver: false }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        styles.bonusButton,
        compact && styles.bonusButtonCompact,
        {
          shadowOpacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.75] }),
          shadowRadius: pulse.interpolate({ inputRange: [0, 1], outputRange: [6, 14] }),
        },
      ]}>
      <Text style={styles.bonusStar}>⭐</Text>
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
  const [bonusCount, setBonusCount] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [hintIndices, setHintIndices] = useState<number[]>([]);
  const [hintedTarget, setHintedTarget] = useState<number | null>(null);
  const [passportVisible, setPassportVisible] = useState(false);
  const [journeyVisible, setJourneyVisible] = useState(true);
  const [effectsEnabled, setEffectsEnabled] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const blurTarget = useRef<View>(null);
  const discoveredBonuses = useRef(new Set<string>());
  const feedbackTimer = useRef<Timer | null>(null);
  const hintTimer = useRef<Timer | null>(null);
  const levelTimer = useRef<Timer | null>(null);

  const layout = getGameLayout(width, height);
  const { compact, compactHeader, wheelSize } = layout;
  const playSound = useGameSounds(effectsEnabled);
  const targetWidth = (levelData.targets.length === 3 ? '31.6%' : '23.5%') as `${number}%`;
  const operation = OPERATION_DETAILS[levelData.op];
  const feedbackColors = feedback ? getFeedbackColors(feedback.tone) : null;
  const maxSelection: 2 | 3 =
    levelData.steps === 3 || levelData.targets.some((target) => target.steps === 3) ? 3 : 2;
  const levelJustCompleted =
    levelData.targets.length > 0 && solvedTargets.size === levelData.targets.length;
  const displayedProgressLevel = level + (levelJustCompleted ? 1 : 0);
  const passportStampCount = getCompletedCountryCount(displayedProgressLevel);

  useEffect(() => {
    let active = true;

    void loadGameProgress().then((saved) => {
      if (!active) return;

      if (saved) {
        const restoredSolved = new Set(saved.solvedTargets);
        const restoredLevelComplete = restoredSolved.size === saved.levelData.targets.length;
        const restoredLevel = restoredLevelComplete ? saved.level + 1 : saved.level;
        const restoredLevelData = restoredLevelComplete
          ? generateLevelData(
              restoredLevel,
              saved.levelData.targets.map((target) => target.value),
            )
          : saved.levelData;

        setLevel(restoredLevel);
        setLevelData(restoredLevelData);
        setSolvedTargets(restoredLevelComplete ? new Set() : restoredSolved);
        setBonusCount(saved.bonusCount);
        setEffectsEnabled(saved.effectsEnabled);
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
      bonusCount,
      discoveredBonuses: [...discoveredBonuses.current],
      effectsEnabled,
    }).catch(() => undefined);
  }, [bonusCount, effectsEnabled, hydrated, level, levelData, solvedTargets]);

  useEffect(
    () => () => {
      clearTimer(feedbackTimer);
      clearTimer(hintTimer);
      clearTimer(levelTimer);
    },
    [],
  );

  useEffect(() => {
    if (journeyVisible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setJourneyVisible(true);
      return true;
    });
    return () => subscription.remove();
  }, [journeyVisible]);

  const triggerEffect = useCallback(
    (kind: GameSound) => {
      playSound(kind);
      if (!effectsEnabled) return;
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

  const startLevel = useCallback((nextLevel: number, previousTargetValues: readonly number[]) => {
    clearTimer(feedbackTimer);
    clearTimer(hintTimer);
    setLevel(nextLevel);
    setLevelData(generateLevelData(nextLevel, previousTargetValues));
    setSolvedTargets(new Set());
    setFeedback(null);
    setHintIndices([]);
    setHintedTarget(null);
    setCelebrating(false);
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
    (indices: number[]) => {
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

      const targetIndex = levelData.targets.findIndex(
        (target) => target.value === calculation.result && target.steps === indices.length,
      );

      if (targetIndex >= 0) {
        if (solvedTargets.has(targetIndex)) {
          showTimedFeedback({ text: 'Bu hedefi zaten keşfettin ✓', tone: 'info' });
          return;
        }

        clearTimer(hintTimer);
        setHintIndices([]);
        setHintedTarget(null);
        const nextSolved = new Set(solvedTargets);
        nextSolved.add(targetIndex);
        setSolvedTargets(nextSolved);

        if (nextSolved.size === levelData.targets.length) {
          const travelCompletion = getTravelLevelCompletion(level);
          const completedLocation = travelCompletion.locationCompleted;
          const nextDestination = travelCompletion.nextDestination;
          const completionMessage = travelCompletion.worldTourCompleted
            ? '100/100 ülke • WORLD TOUR COMPLETED! Golden Compass ve World Explorer kazanıldı'
            : travelCompletion.countryCompleted
              ? `${levelData.country} tamamlandı! Pasaport damgası ve ${COUNTRY_BY_ID.get(levelData.countryId)?.rewardLandmark ?? levelData.country} kartı kazanıldı`
              : completedLocation
                ? `${levelData.city} tamamlandı! ${
                    nextDestination.countryChallenge
                      ? `${levelData.country} Challenge açıldı`
                      : `${nextDestination.location.name} açıldı`
                  }`
                : `Puzzle ${levelData.locationLevel}/${levelData.locationLevelCount} tamamlandı • ${levelData.city}`;
          triggerEffect('success');
          showTimedFeedback(
            { text: `Harika! ${completionMessage} 🎉`, tone: 'success' },
            1400,
          );
          clearTimer(levelTimer);
          levelTimer.current = setTimeout(() => {
            setCelebrating(true);
            triggerEffect('levelComplete');
            levelTimer.current = setTimeout(() => {
              startLevel(level + 1, levelData.targets.map((target) => target.value));
              if (levelData.countryChallenge || completedLocation) setJourneyVisible(true);
            }, 1000);
          }, 400);
        } else {
          triggerEffect('success');
          showTimedFeedback(
            { text: `Hedef bulundu: ${calculation.result} ✓`, tone: 'success' },
            1150,
          );
        }
        return;
      }

      const bonusKey = `${calculation.expression}=${calculation.result}`;
      if (!discoveredBonuses.current.has(bonusKey)) {
        discoveredBonuses.current.add(bonusKey);
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
        showTimedFeedback({ text: 'Bu bonusu zaten buldun', tone: 'info' });
      }
    },
    [level, levelData, showTimedFeedback, solvedTargets, startLevel, triggerEffect],
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

  const handleToggleEffects = useCallback(() => {
    const nextEnabled = !effectsEnabled;
    setEffectsEnabled(nextEnabled);
    if (nextEnabled) {
      playSound('select1', true);
      void Haptics.selectionAsync().catch(() => undefined);
    }
  }, [effectsEnabled, playSound]);

  if (!hydrated) return <View style={styles.screen} />;

  if (journeyVisible) {
    return (
      <View style={styles.screen}>
        <BlurTargetView ref={blurTarget} style={styles.screen}>
          <JourneyMap
            bonusCount={bonusCount}
            effectsEnabled={effectsEnabled}
            level={level}
            levelData={levelData}
            onContinue={() => {
              setJourneyVisible(false);
              triggerEffect('select1');
            }}
            onOpenPassport={() => setPassportVisible(true)}
            onToggleEffects={handleToggleEffects}
          />
        </BlurTargetView>
        <PassportModal
          blurTarget={blurTarget}
          currentLevel={displayedProgressLevel}
          onClose={() => setPassportVisible(false)}
          visible={passportVisible}
        />
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
                accessibilityLabel="Dünya rotasına dön"
                accessibilityRole="button"
                hitSlop={5}
                onPress={() => setJourneyVisible(true)}
                style={({ pressed }) => [
                  styles.skyControl,
                  pressed && styles.buttonPressed,
                ]}>
                <Text style={styles.backIcon}>‹</Text>
              </Pressable>

              <PulsingBonus compact={compactHeader} count={bonusCount} />
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
                accessibilityLabel={
                  effectsEnabled
                    ? 'Ses ve dokunsal efektleri kapat'
                    : 'Ses ve dokunsal efektleri aç'
                }
                accessibilityRole="button"
                accessibilityState={{ checked: effectsEnabled }}
                hitSlop={5}
                onPress={handleToggleEffects}
                style={({ pressed }) => [styles.skyControl, pressed && styles.buttonPressed]}>
                <Text style={styles.skyControlIcon}>{effectsEnabled ? '🔊' : '🔇'}</Text>
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
                      large={!compact}
                      solved={solvedTargets.has(index)}
                      target={target}
                      width={targetWidth}
                    />
                  ))}
                </View>
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

              <View style={styles.wheelContainer}>
                <NumberWheel
                  key={`${level}-${wheelSize}`}
                  hintIndices={hintIndices}
                  maxSelection={maxSelection}
                  numbers={levelData.numbers}
                  onComplete={handleComplete}
                  onDraggingChange={setDragging}
                  onHint={handleHint}
                  onNodeAdded={(selectionCount) =>
                    triggerEffect(
                      selectionCount === 1
                        ? 'select1'
                        : selectionCount === 2
                          ? 'select2'
                          : 'select3',
                    )
                  }
                  onPreview={handlePreview}
                  onShuffle={() => {
                    setHintIndices([]);
                    setHintedTarget(null);
                    triggerEffect('shuffle');
                  }}
                  size={wheelSize}
                />
              </View>

              <Text style={styles.instruction}>
                Parmağınla sayıları sırayla birleştir, tüm hedefleri çöz!
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>

        <Celebration visible={celebrating} />
      </BlurTargetView>
      <PassportModal
        blurTarget={blurTarget}
        currentLevel={displayedProgressLevel}
        onClose={() => setPassportVisible(false)}
        visible={passportVisible}
      />
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
    position: 'relative',
    minHeight: 62,
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
