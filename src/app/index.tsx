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
import { COUNTRY_BY_ID, WORLD_COUNTRIES, getCompletedCountryCount } from '@/game/travel';
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
            ? ['rgba(16,185,129,0.15)', 'rgba(16,185,129,0.15)']
            : ['rgba(30,41,59,0.95)', 'rgba(15,23,42,0.98)']
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
    return { background: 'rgba(6,78,59,0.96)', border: '#10B981', text: '#A7F3D0' };
  }
  if (tone === 'bonus') {
    return { background: 'rgba(120,53,15,0.96)', border: '#F59E0B', text: '#FDE68A' };
  }
  if (tone === 'info') {
    return { background: 'rgba(30,41,59,0.97)', border: '#64748B', text: '#CBD5E1' };
  }
  return { background: 'rgba(15,23,42,0.97)', border: '#06B6D4', text: '#67E8F9' };
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
  const targetColumnCount = compact ? 2 : 4;
  const targetWidth = (compact ? '48.7%' : '23.5%') as `${number}%`;
  const targetSpacerCount =
    (targetColumnCount - (levelData.targets.length % targetColumnCount)) % targetColumnCount;
  const operation = OPERATION_DETAILS[levelData.op];
  const feedbackColors = feedback ? getFeedbackColors(feedback.tone) : null;
  const maxSelection: 2 | 3 =
    levelData.steps === 3 || levelData.targets.some((target) => target.steps === 3) ? 3 : 2;
  const passportStampCount = getCompletedCountryCount(level);

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
          const completedLocation =
            !levelData.countryChallenge &&
            levelData.locationLevel === levelData.locationLevelCount;
          const completionMessage = levelData.worldTourFinal
            ? '100/100 ülke • WORLD TOUR COMPLETED! Golden Compass ve World Explorer kazanıldı'
            : levelData.countryChallenge
              ? `${levelData.country} tamamlandı! Pasaport damgası ve ${COUNTRY_BY_ID.get(levelData.countryId)?.rewardLandmark ?? levelData.country} kartı kazanıldı`
              : completedLocation
                ? `${levelData.city} tamamlandı! Yeni destinasyon açıldı`
                : `${levelData.city} puzzle'ı tamamlandı`;
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
    triggerEffect('select');
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
      playSound('select', true);
      void Haptics.selectionAsync().catch(() => undefined);
    }
  }, [effectsEnabled, playSound]);

  const headerProgress = `${(levelData.locationLevel / levelData.locationLevelCount) * 100}%` as `${number}%`;

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
              triggerEffect('select');
            }}
            onOpenPassport={() => setPassportVisible(true)}
            onToggleEffects={handleToggleEffects}
          />
        </BlurTargetView>
        <PassportModal
          blurTarget={blurTarget}
          currentLevel={level}
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
          cachePolicy="memory-disk"
          contentFit="cover"
          source={{ uri: levelData.background }}
          style={styles.backgroundImage}
          transition={1000}
        />
        <LinearGradient
          colors={['rgba(2,6,23,0.95)', 'rgba(2,6,23,0.8)', 'rgba(2,6,23,0.98)']}
          locations={[0, 0.48, 1]}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />

        <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={[styles.header, compactHeader && styles.headerCompact]}>
          <View style={[styles.headerSide, compactHeader && styles.headerSideCompact]}>
            <Pressable
              accessibilityLabel="Seyahat pasaportunu aç"
              accessibilityRole="button"
              hitSlop={5}
              onPress={() => setPassportVisible(true)}
              style={({ pressed }) => [
                styles.headerButton,
                compactHeader && styles.headerButtonCompact,
                pressed && styles.buttonPressed,
              ]}>
              <Text style={styles.headerButtonText}>{compactHeader ? '📘' : '📘 Pasaport'}</Text>
              <View style={[styles.passportCount, compactHeader && styles.passportCountCompact]}>
                <Text
                  style={[
                    styles.passportCountText,
                    compactHeader && styles.passportCountTextCompact,
                  ]}>
                  {passportStampCount}/{WORLD_COUNTRIES.length}
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityLabel="Dünya rotasına dön"
              accessibilityRole="button"
              hitSlop={5}
              onPress={() => setJourneyVisible(true)}
              style={({ pressed }) => [
                styles.squareButton,
                compactHeader && styles.squareButtonCompact,
                pressed && styles.buttonPressed,
              ]}>
              <Text style={styles.squareButtonText}>🗺️</Text>
            </Pressable>
          </View>

          <View style={[styles.destination, compactHeader && styles.destinationCompact]}>
            <Text numberOfLines={1} style={styles.countryLabel}>
              {levelData.flag} {levelData.country}
            </Text>
            <Text numberOfLines={1} style={styles.destinationTitle}>
              {levelData.emoji} {levelData.city}
            </Text>
            <View style={[styles.progressTrack, compactHeader && styles.progressTrackCompact]}>
              <LinearGradient
                colors={['#FBBF24', '#F97316', '#34D399']}
                end={{ x: 1, y: 0 }}
                start={{ x: 0, y: 0 }}
                style={[styles.progressFill, { width: headerProgress }]}
              />
            </View>
            <Text numberOfLines={1} style={styles.levelLabel}>
              {levelData.countryChallenge ? 'Country Challenge' : 'Puzzle'}{' '}
              {levelData.locationLevel}/{levelData.locationLevelCount}
            </Text>
          </View>

          <View
            style={[
              styles.headerSide,
              styles.headerRight,
              compactHeader && styles.headerSideCompact,
            ]}>
            <PulsingBonus compact={compactHeader} count={bonusCount} />
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
              style={({ pressed }) => [
                styles.squareButton,
                compactHeader && styles.squareButtonCompact,
                pressed && styles.buttonPressed,
              ]}>
              <Text style={styles.squareButtonText}>{effectsEnabled ? '🔊' : '🔇'}</Text>
            </Pressable>
          </View>
        </View>

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
            <View style={styles.topSection}>
              <View style={styles.operationRow}>
                <View style={styles.operationSide}>
                  <Text style={styles.operationLabel}>İŞLEM:</Text>
                  <LinearGradient
                    colors={[operation.color, operation.darkColor]}
                    end={{ x: 1, y: 1 }}
                    start={{ x: 0, y: 0 }}
                    style={styles.operationBadge}>
                    <Text style={styles.operationText}>{operation.name}</Text>
                    <Text style={styles.operationSymbol}>({operation.symbol})</Text>
                  </LinearGradient>
                </View>
                <View style={styles.requiredBadge}>
                  <Text style={styles.requiredLabel}>Gereken:</Text>
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
                {Array.from({ length: targetSpacerCount }, (_, index) => (
                  <View key={`target-spacer-${index}`} style={{ width: targetWidth }} />
                ))}
              </View>
            </View>

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
              ) : null}
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
                onNodeAdded={() => triggerEffect('select')}
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

        <View style={styles.footer}>
          <Text style={styles.footerText}>Number of Wonders • Dünya Turu & Sayı Bulmacası</Text>
        </View>
        </SafeAreaView>

        <Celebration visible={celebrating} />
      </BlurTargetView>
      <PassportModal
        blurTarget={blurTarget}
        currentLevel={level}
        onClose={() => setPassportVisible(false)}
        visible={passportVisible}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#020617',
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.25,
    transform: [{ scale: 1.05 }],
  },
  safeArea: {
    flex: 1,
  },
  header: {
    width: '100%',
    maxWidth: 512,
    alignSelf: 'center',
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerCompact: {
    minHeight: 56,
    paddingHorizontal: 8,
    paddingVertical: 8,
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
    gap: 6,
  },
  headerButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
    backgroundColor: 'rgba(15,23,42,0.92)',
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  headerButtonCompact: {
    minHeight: 34,
    gap: 2,
    paddingHorizontal: 6,
    borderRadius: 14,
  },
  headerButtonText: {
    color: '#FBBF24',
    fontFamily: FONTS.bold,
    fontSize: 12,
    fontWeight: '900',
  },
  passportCount: {
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#F59E0B',
  },
  passportCountCompact: {
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  passportCountText: {
    color: '#0F172A',
    fontFamily: FONTS.black,
    fontSize: 10,
    fontWeight: '900',
  },
  passportCountTextCompact: {
    fontSize: 9,
  },
  squareButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(15,23,42,0.92)',
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  squareButtonCompact: {
    width: 34,
    height: 34,
    borderRadius: 14,
  },
  squareButtonText: {
    fontSize: 16,
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  destination: {
    maxWidth: 180,
    flexShrink: 1,
    alignItems: 'center',
    minWidth: 90,
  },
  destinationCompact: {
    minWidth: 78,
    maxWidth: 108,
  },
  countryLabel: {
    color: '#FBBF24',
    fontFamily: FONTS.extraBold,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  destinationTitle: {
    maxWidth: 170,
    color: '#F8FAFC',
    fontFamily: FONTS.black,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  progressTrack: {
    width: 112,
    height: 8,
    padding: 1,
    overflow: 'hidden',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1E293B',
    backgroundColor: '#020617',
    marginTop: 2,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressTrackCompact: {
    width: 88,
  },
  levelLabel: {
    color: '#22D3EE',
    fontFamily: FONTS.extraBold,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    marginTop: 1,
  },
  bonusButton: {
    height: 40,
    minWidth: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.5)',
    backgroundColor: 'rgba(15,23,42,0.92)',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  bonusButtonCompact: {
    height: 34,
    minWidth: 44,
    paddingHorizontal: 6,
    borderRadius: 14,
  },
  bonusStar: {
    fontSize: 14,
  },
  bonusText: {
    color: '#FDE68A',
    fontFamily: FONTS.black,
    fontSize: 12,
    fontWeight: '900',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 4,
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
  },
  operationRow: {
    width: '100%',
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 8,
    gap: 8,
  },
  operationSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  operationLabel: {
    color: '#94A3B8',
    fontFamily: FONTS.extraBold,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.9,
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
    borderColor: 'rgba(255,255,255,0.2)',
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
    borderColor: '#1E293B',
    backgroundColor: 'rgba(15,23,42,0.92)',
  },
  requiredLabel: {
    color: '#94A3B8',
    fontFamily: FONTS.bold,
    fontSize: 11,
    fontWeight: '800',
  },
  requiredDots: {
    color: '#FBBF24',
    fontFamily: FONTS.black,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  targets: {
    width: '100%',
    minHeight: 90,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  targetCardFrame: {
    position: 'relative',
    minHeight: 72,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 7,
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
    minHeight: 72,
    flex: 1,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(71,85,105,0.9)',
    padding: 12,
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
    color: '#F8FAFC',
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
    color: '#94A3B8',
    fontFamily: FONTS.bold,
    fontSize: 10,
    fontWeight: '800',
  },
  targetDots: {
    color: '#94A3B8',
    fontFamily: FONTS.bold,
    fontSize: 10,
    fontWeight: '900',
  },
  targetSolvedText: {
    color: '#6EE7B7',
  },
  feedbackSlot: {
    width: '100%',
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  feedbackPill: {
    maxWidth: '96%',
    minHeight: 32,
    paddingHorizontal: 20,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 9,
    elevation: 8,
  },
  feedbackText: {
    fontFamily: FONTS.black,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  wheelContainer: {
    width: '100%',
    minHeight: 290,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  instruction: {
    color: '#94A3B8',
    fontFamily: FONTS.bold,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    fontWeight: '700',
    marginVertical: 4,
  },
  footer: {
    minHeight: 35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(30,41,59,0.75)',
    backgroundColor: 'rgba(2,6,23,0.88)',
  },
  footerText: {
    color: '#64748B',
    fontFamily: FONTS.medium,
    fontSize: 11,
    fontWeight: '500',
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
