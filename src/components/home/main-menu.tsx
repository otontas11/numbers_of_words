import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FONTS } from '@/constants/fonts';
import { AppFooter } from '@/components/common/app-footer';
import { SettingsIcon } from '@/components/common/game-icons';
import { SoundPressable as Pressable } from '@/components/common/sound-pressable';
import { FlyingBirds } from '@/components/home/flying-birds';
import { learningScoreLabel, type DifficultyModifier, type PuzzlePerformance } from '@/game/adaptive-difficulty';
import type { LevelData } from '@/game/levels';
import { localizeCountry, localizeRoute, SUPPORTED_LANGUAGES, useI18n } from '@/i18n';
import {
  COUNTRY_LEVEL_COUNT,
  COUNTRY_BY_ID,
  ROUTE_BY_ID,
  TOTAL_COUNTRIES,
  TOTAL_WORLD_LEVELS,
  getCompletedCountryCount,
  getCompletedWorldLevelCount,
  getCountryProgress,
  getRouteProgress,
} from '@/game/travel';

const HOME_BACKGROUND = require('../../../assets/images/img/bg.png');
const HOME_LOGO = require('../../../assets/images/img/number_of_wonders.png');
const COVER_IMAGE = require('../../../assets/images/cover_1.png');

type MainMenuProps = {
  active: boolean;
  currentLevel: number;
  dailySummary: {
    claimed: boolean;
    completed: boolean;
    streak: number;
  } | null;
  gemCount: number;
  learningLevel: number;
  levelData: LevelData;
  score: number;
  onOpenCollection: () => void;
  onOpenProfile: () => void;
  onOpenDaily: () => void;
  onOpenSettings: () => void;
  onOpenTravel: () => void;
  onPlay: () => void;
};

function ScoreEmblem({ compact }: { compact?: boolean }) {
  return (
    <View style={[styles.scoreEmblem, compact && styles.scoreEmblemCompact]}>
      <LinearGradient
        colors={['#4B8194', '#214F68', '#17374E']}
        end={{ x: 0.75, y: 1 }}
        start={{ x: 0.2, y: 0 }}
        style={styles.scoreEmblemSurface}>
        <View style={styles.scoreEmblemRing} />
        <View style={styles.scoreEmblemShine} />
        <Text style={[styles.scoreEmblemStar, compact && styles.scoreEmblemStarCompact]}>★</Text>
      </LinearGradient>
    </View>
  );
}

function ResourcePill({
  accessibilityLabel,
  icon,
  iconVariant = 'default',
  label,
  value,
  onPress,
  compact,
}: {
  accessibilityLabel: string;
  icon: string;
  iconVariant?: 'default' | 'score';
  label: string;
  value: string;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.resourcePill,
        compact && styles.resourcePillCompact,
        pressed && styles.pressed,
      ]}>
      {iconVariant === 'score' ? (
        <ScoreEmblem compact={compact} />
      ) : (
        <Text style={[styles.resourceIcon, compact && styles.resourceIconCompact]}>{icon}</Text>
      )}
      <View style={styles.resourceCopy}>
        <Text numberOfLines={1} style={styles.resourceLabel}>{label}</Text>
        <Text numberOfLines={1} style={[styles.resourceValue, compact && styles.resourceValueCompact]}>
          {value}
        </Text>
      </View>
      <View style={[styles.resourcePlus, compact && styles.resourcePlusCompact]}>
        <Text style={styles.resourcePlusText}>+</Text>
      </View>
    </Pressable>
  );
}

export function MainMenu({
  active,
  currentLevel,
  dailySummary,
  gemCount,
  learningLevel,
  levelData,
  score,
  onOpenCollection,
  onOpenDaily,
  onOpenProfile,
  onOpenSettings,
  onOpenTravel,
  onPlay,
}: MainMenuProps) {
  const [pulse] = useState(() => new Animated.Value(0));
  const [orbit] = useState(() => new Animated.Value(0));
  const { height } = useWindowDimensions();
  const compact = height < 760;
  const { language, locale, t } = useI18n();
  const route = ROUTE_BY_ID.get(levelData.routeId);
  const currentCountry = COUNTRY_BY_ID.get(levelData.countryId);
  const currentCountryName = currentCountry
    ? localizeCountry(currentCountry, language)
    : levelData.country;
  const routeName = route ? localizeRoute(route, language) : t('home.worldRoute');
  const completedCountries = getCompletedCountryCount(currentLevel);
  // The player-facing level advances once per completed country. The puzzle's
  // global level remains internal so the home screen never exposes 4-digit IDs.
  const countryLevel = Math.min(TOTAL_COUNTRIES, completedCountries + 1);
  const routeProgress = route ? getRouteProgress(currentLevel, route) : 0;
  const dailyCta = dailySummary?.claimed
    ? t('home.dailyDone')
    : dailySummary?.completed
      ? t('home.dailyClaim')
      : t('home.dailyReady');
  const dailyStreak = dailySummary?.streak ?? 0;
  const playGlowOpacity = useMemo(
    () => pulse.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.58] }),
    [pulse],
  );
  const playGlowScale = useMemo(
    () => pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.09] }),
    [pulse],
  );
  const activeStepRotation = useMemo(
    () =>
      orbit.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
      }),
    [orbit],
  );

  useEffect(() => {
    pulse.stopAnimation();
    orbit.stopAnimation();
    pulse.setValue(0);
    orbit.setValue(0);

    if (!active) {
      return;
    }
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1150,
          easing: Easing.inOut(Easing.cubic),
          isInteraction: false,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1150,
          easing: Easing.inOut(Easing.cubic),
          isInteraction: false,
          useNativeDriver: true,
        }),
      ]),
    );
    const orbitAnimation = Animated.loop(
      Animated.timing(orbit, {
        toValue: 1,
        duration: 1800,
        easing: Easing.linear,
        isInteraction: false,
        useNativeDriver: true,
      }),
      { resetBeforeIteration: true },
    );
    pulseAnimation.start();
    orbitAnimation.start();
    return () => {
      pulseAnimation.stop();
      orbitAnimation.stop();
    };
  }, [active, orbit, pulse]);

  return (
    <View style={styles.screen}>
      <Image
        cachePolicy="memory-disk"
        contentFit="cover"
        source={HOME_BACKGROUND}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)', 'rgba(255,248,235,0.78)']}
        locations={[0, 0.64, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={[styles.topBar, compact && styles.topBarCompact]}>
          <View style={styles.resourceRow}>
            <ResourcePill
              accessibilityLabel={t('home.pointsA11y', { value: score })}
              compact={compact}
              icon="★"
              iconVariant="score"
              label={t('common.score')}
              onPress={onOpenProfile}
              value={score.toLocaleString(locale)}
            />
            <ResourcePill
              accessibilityLabel={t('home.gemsA11y', { value: gemCount })}
              compact={compact}
              icon="💎"
              label={t('common.gems')}
              onPress={onOpenProfile}
              value={gemCount.toLocaleString(locale)}
            />
          </View>

          <Pressable
            accessibilityLabel={t('settings.openA11y')}
            accessibilityRole="button"
            hitSlop={5}
            onPress={onOpenSettings}
            style={({ pressed }) => [
              styles.settingsButton,
              pressed && styles.settingsButtonPressed,
            ]}>
            <SettingsIcon />
          </Pressable>
        </View>

        <View style={[styles.homeContent, compact && styles.homeContentCompact]}>
          <View pointerEvents="none" style={[styles.brandSky, compact && styles.brandSkyCompact]}>
            <View style={[styles.brandBlock, compact && styles.brandBlockCompact]} pointerEvents="none">
              <Image
                cachePolicy="memory-disk"
                contentFit="contain"
                source={HOME_LOGO}
                style={[styles.brandLogo, compact && styles.brandLogoCompact]}
              />
            </View>
            <View pointerEvents="none" style={[styles.skyFlightBand, compact && styles.skyFlightBandCompact]}>
              <FlyingBirds active={active} />
            </View>
          </View>

          <View style={[styles.playButtonStack, compact && styles.playButtonStackCompact]}>
            <Animated.View
              style={[
                styles.playGlow,
                compact && styles.playGlowCompact,
                {
                  opacity: playGlowOpacity,
                  transform: [{ scale: playGlowScale }],
                },
              ]}
            />
            <Pressable
              accessibilityHint={t('home.playHint')}
              accessibilityLabel={t('home.playA11y', { level: countryLevel })}
              accessibilityRole="button"
              onPress={onPlay}
              style={({ pressed }) => [
                styles.playButtonFrame,
                compact && styles.playButtonFrameCompact,
                pressed && styles.playPressed,
              ]}>
                <LinearGradient
                  colors={['#FFF9D7', '#E6B84E', '#B87916']}
                end={{ x: 0.65, y: 1 }}
                start={{ x: 0.2, y: 0 }}
                style={styles.playButtonBorder}>
                <LinearGradient
                  colors={['#3F6975', '#1C3948']}
                  style={styles.playButtonInner}>
                  <Text style={styles.playCompass}>✥</Text>
                  <Text style={[styles.playLevel, compact && styles.playLevelCompact]}>
                    {countryLevel}.
                  </Text>
                  <Text style={styles.playCaption}>{t('common.level')}</Text>
                </LinearGradient>
              </LinearGradient>
            </Pressable>
          </View>

          <Pressable
            accessibilityLabel={`${t('home.dailyCardA11y')}. ${dailyCta}. ${t('daily.hudStreak', { count: dailyStreak })}`}
            accessibilityRole="button"
            onPress={onOpenDaily}
            style={({ pressed }) => [
              styles.dailyCard,
              compact && styles.dailyCardCompact,
              pressed && styles.cardPressed,
            ]}>
            <View style={[styles.dailyEmblem, compact && styles.dailyEmblemCompact]}>
              <Text style={[styles.dailyEmblemFire, compact && styles.dailyEmblemFireCompact]}>🔥</Text>
            </View>
            <View style={styles.dailyCopy}>
              <Text ellipsizeMode="tail" numberOfLines={1} style={styles.dailyTitle}>
                {t('daily.title')}
              </Text>
              <Text ellipsizeMode="tail" numberOfLines={1} style={styles.dailyCtaText}>
                {dailyCta}
              </Text>
            </View>
            <View style={styles.dailyStreakChip}>
              <Text style={styles.dailyStreakText}>{t('daily.hudStreak', { count: dailyStreak })}</Text>
            </View>
            <Text style={styles.dailyArrow}>›</Text>
          </Pressable>

          <Pressable
            accessibilityHint={t('home.playHint')}
            accessibilityLabel={`${t('home.playA11y', { level: countryLevel })}. ${t('home.routeProgress', { route: routeName, progress: routeProgress, total: route?.countryIds.length ?? 0 })}. ${t('home.learningLevel', { level: learningLevel })}`}
            accessibilityRole="button"
            onPress={onPlay}
            style={({ pressed }) => [
              styles.countryCard,
              compact && styles.countryCardCompact,
              pressed && styles.cardPressed,
            ]}>
            <View style={styles.countryCopy}>
              <Text numberOfLines={1} style={[styles.countryTitle, compact && styles.countryTitleCompact]}>
                {currentCountryName.toLocaleUpperCase(locale)}
              </Text>
              <Text numberOfLines={1} style={styles.routeTitle}>
                {routeName.toLocaleUpperCase(locale)}
              </Text>
              <View style={styles.ornamentRow}>
                <View style={styles.ornamentLine} />
                <Text style={styles.ornament}>✣</Text>
                <View style={styles.ornamentLine} />
              </View>
              <View style={styles.stepRow}>
                {route?.countryIds.map((countryId, countryIndex) => {
                  const routeCountry = COUNTRY_BY_ID.get(countryId);
                  const done = countryIndex < routeProgress;
                  const active = countryId === levelData.countryId;
                  return (
                    <View key={countryId} style={styles.stepItem}>
                      {countryIndex > 0 ? (
                        <View
                          style={[
                            styles.stepConnector,
                            countryIndex <= routeProgress && styles.stepConnectorDone,
                          ]}
                        />
                      ) : null}
                      <View style={styles.stepDotSlot}>
                        {active ? (
                          <Animated.View
                            pointerEvents="none"
                            style={[
                              styles.stepActiveOrbit,
                              {
                                transform: [{ rotate: activeStepRotation }],
                              },
                            ]}>
                            <View style={styles.stepActiveMarker} />
                          </Animated.View>
                        ) : null}
                        <View
                          accessible
                          accessibilityLabel={`${routeCountry ? localizeCountry(routeCountry, language) : countryId}, ${done ? t('home.countryDone') : active ? t('home.currentCountry') : t('home.notUnlocked')}`}
                          style={[
                            styles.stepDot,
                            done && styles.stepDotDone,
                            active && styles.stepDotActive,
                          ]}>
                          <Text style={styles.stepDotText}>{routeCountry?.flag ?? '•'}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
              <Text style={styles.discoveryText}>
                {t('home.discovered', { done: completedCountries, total: TOTAL_COUNTRIES })}
              </Text>
              <Text style={styles.learningLevelText}>
                {t('home.learningLevel', { level: learningLevel })}
              </Text>
            </View>
            <View style={[styles.countryImageFrame, compact && styles.countryImageFrameCompact]}>
              <Image
                cachePolicy="memory-disk"
                contentFit="cover"
                source={{ uri: levelData.background }}
                style={[StyleSheet.absoluteFill, styles.countryImage]}
              />
            </View>
          </Pressable>
        </View>

      </SafeAreaView>
      <AppFooter
        activeItem="home"
        onCollection={onOpenCollection}
        onHome={() => {}}
        onMap={onOpenTravel}
        onTasks={onOpenProfile}
      />
    </View>
  );
}

export function ProfileScreen({
  bonusCount,
  currentLevel,
  gemCount,
  levelData,
  onHome,
  onMap,
  onOpenPassport,
  performanceHistory,
  learningScore,
  learningLevel,
  cityDifficultyModifier,
  score,
}: {
  bonusCount: number;
  currentLevel: number;
  gemCount: number;
  levelData: LevelData;
  onHome: () => void;
  onMap: () => void;
  onOpenPassport: () => void;
  performanceHistory: PuzzlePerformance[];
  learningScore: number;
  learningLevel: number;
  cityDifficultyModifier: DifficultyModifier;
  score: number;
}) {
  const { language, locale, setLanguage, t } = useI18n();
  const completedCountries = getCompletedCountryCount(currentLevel);
  const playerLevel = Math.min(TOTAL_COUNTRIES, completedCountries + 1);
  const completedLevels = getCompletedWorldLevelCount(currentLevel);
  const country = COUNTRY_BY_ID.get(levelData.countryId);
  const countryName = country ? localizeCountry(country, language) : levelData.country;
  const countryProgress = country ? getCountryProgress(currentLevel, country.id) : 0;
  const scoreBand = learningScoreLabel(learningScore);
  const difficultyLabel = scoreBand === 'strong'
    ? t('profile.difficultyAdvanced')
    : scoreBand === 'struggling'
      ? t('profile.difficultySupported')
      : t('profile.difficultyBalanced');
  const difficultyDescription = performanceHistory.length < 3
    ? t('profile.difficultyPending')
    : cityDifficultyModifier > 0
      ? t('profile.difficultyHarder')
      : cityDifficultyModifier < 0
        ? t('profile.difficultyEasier')
        : t('profile.difficultySame');

  const progressPct = Math.round((countryProgress / COUNTRY_LEVEL_COUNT) * 100);

  return (
    <LinearGradient colors={['#F5EFE0', '#EDE4D0', '#E2D5BC']} style={pStyles.screen}>
      <ScrollView
        bounces={false}
        contentContainerStyle={pStyles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* ── Cover Banner ── */}
        <View style={pStyles.coverWrapper}>
          <Image
            cachePolicy="memory-disk"
            contentFit="cover"
            source={COVER_IMAGE}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(60,107,88,0.35)', 'rgba(30,50,40,0.72)']}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView edges={['top']} style={pStyles.coverSafe}>
            <Text style={pStyles.coverTitle}>{t('profile.title')}</Text>
          </SafeAreaView>
        </View>

        {/* ── Identity Card ── */}
        <View style={pStyles.identityCard}>
          <View style={pStyles.avatarRing}>
            <Text style={pStyles.avatarEmoji}>{levelData.flag}</Text>
          </View>
          <View style={pStyles.identityInfo}>
            <Text style={pStyles.identityName}>{t('profile.explorer')}</Text>
            <Text style={pStyles.identityLocation}>
              {t('profile.location', { level: playerLevel, country: countryName, city: levelData.city })}
            </Text>
          </View>
          <View style={pStyles.lvlBadge}>
            <Text style={pStyles.lvlBadgeLabel}>LVL</Text>
            <Text style={pStyles.lvlBadgeValue}>{playerLevel}</Text>
          </View>
        </View>

        {/* ── Stats Row ── */}
        <View style={pStyles.statsRow}>
          {([
            ['#E8B84A', '★', score.toLocaleString(locale), t('common.score')],
            ['#5BA88C', '✓', `${completedLevels}`, t('profile.completedPuzzles')],
            ['#4A90B8', '🌍', `${completedCountries}/${TOTAL_COUNTRIES}`, t('profile.country')],
            ['#9B6CC4', '💎', `${gemCount}`, t('profile.gem')],
          ] as const).map(([color, icon, value, label]) => (
            <View key={label} style={pStyles.statPill}>
              <View style={[pStyles.statIconCircle, { backgroundColor: color + '22' }]}>
                <Text style={[pStyles.statIcon, { color }]}>{icon}</Text>
              </View>
              <Text style={pStyles.statValue}>{value}</Text>
              <Text style={pStyles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* ── Journey Tracker ── */}
        <View style={pStyles.journeyCard}>
          <View style={pStyles.journeyHeader}>
            <Text style={pStyles.journeyEyebrow}>{t('profile.currentJourney')}</Text>
            <Text style={pStyles.journeyPct}>{progressPct}%</Text>
          </View>
          <View style={pStyles.journeyCountryRow}>
            <Text style={pStyles.journeyFlag}>{levelData.flag}</Text>
            <Text style={pStyles.journeyCountryName}>{countryName}</Text>
            <Text style={pStyles.journeyCount}>{countryProgress}/{COUNTRY_LEVEL_COUNT}</Text>
          </View>
          <View style={pStyles.progressTrack}>
            <LinearGradient
              colors={['#C4882A', '#E8B84A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                pStyles.progressFill,
                { width: `${progressPct}%` as `${number}%` },
              ]}
            />
          </View>
          <View style={pStyles.journeyMeta}>
            <Text style={pStyles.journeyMetaText}>{t('profile.worldTour', { done: completedLevels, total: TOTAL_WORLD_LEVELS })}</Text>
            <Text style={pStyles.journeyMetaText}>{t('profile.bonuses', { count: bonusCount })}</Text>
          </View>
        </View>

        {/* ── Language Card ── */}
        <View style={pStyles.langCard}>
          <Text style={pStyles.langTitle}>🌐  {t('settings.language')}</Text>
          <View style={pStyles.langOptions}>
            {SUPPORTED_LANGUAGES.map((option) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: language === option }}
                key={option}
                onPress={() => setLanguage(option)}
                style={({ pressed }) => [
                  pStyles.langPill,
                  language === option && pStyles.langPillActive,
                  pressed && styles.pressed,
                ]}>
                <Text
                  numberOfLines={1}
                  style={[
                    pStyles.langPillText,
                    language === option && pStyles.langPillTextActive,
                  ]}>
                  {t(`language.${option}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Difficulty Card ── */}
        <View style={pStyles.diffCard}>
          <View style={pStyles.diffHeader}>
            <View style={pStyles.diffIcon}><Text style={pStyles.diffIconText}>⚙</Text></View>
            <View style={pStyles.diffCopy}>
              <Text style={pStyles.diffEyebrow}>{t('profile.difficultyEyebrow')}</Text>
              <Text style={pStyles.diffTitle}>{t('home.learningLevel', { level: learningLevel })} · {difficultyLabel}</Text>
            </View>
          </View>
          <Text style={pStyles.diffDesc}>{difficultyDescription}</Text>
          <Text style={pStyles.diffMeta}>{t('profile.difficultyMeta', { count: performanceHistory.length })}</Text>
        </View>

      </ScrollView>
      <AppFooter
        activeItem="tasks"
        onCollection={onOpenPassport}
        onHome={onHome}
        onMap={onMap}
        onTasks={() => {}}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#7FCFF3' },
  safeArea: { flex: 1 },
  topBar: {
    height: 64,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 9,
  },
  topBarCompact: { height: 52, paddingHorizontal: 8, gap: 6 },
  resourceRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  resourcePill: {
    flex: 1,
    minWidth: 78,
    maxWidth: 118,
    height: 46,
    paddingLeft: 6,
    paddingRight: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: '#E2B65C',
    backgroundColor: 'rgba(255,253,249,0.94)',
    shadowColor: '#8E5D17',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.23,
    shadowRadius: 4,
    elevation: 5,
  },
  resourcePillCompact: { minWidth: 69, height: 40, paddingLeft: 4, gap: 3 },
  resourceIcon: {
    width: 28,
    color: '#C98314',
    fontFamily: FONTS.extraBold,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '800',
    textAlign: 'center',
    textShadowColor: '#FFF1A8',
    textShadowRadius: 3,
  },
  resourceIconCompact: { width: 23, fontSize: 20 },
  scoreEmblem: { width: 32, height: 32, borderRadius: 16, shadowColor: '#8E5D17', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.36, shadowRadius: 3, elevation: 5 },
  scoreEmblemCompact: { width: 27, height: 27, borderRadius: 13.5 },
  scoreEmblemSurface: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 999, borderWidth: 2, borderColor: '#E8B94D' },
  scoreEmblemRing: { position: 'absolute', top: 3, right: 3, bottom: 3, left: 3, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,238,172,0.42)' },
  scoreEmblemShine: { position: 'absolute', top: 4, left: 6, width: 8, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.55)', transform: [{ rotate: '-24deg' }] },
  scoreEmblemStar: { color: '#FFE27A', fontFamily: FONTS.black, fontSize: 20, lineHeight: 23, textAlign: 'center', textShadowColor: '#8C5811', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  scoreEmblemStarCompact: { fontSize: 17, lineHeight: 20 },
  resourceCopy: { flex: 1, minWidth: 0, justifyContent: 'center' },
  resourceLabel: { color: '#A46E20', fontFamily: FONTS.bold, fontSize: 6.5, lineHeight: 8, letterSpacing: 0.5, fontWeight: '700' },
  resourceValue: { color: '#173E72', fontFamily: FONTS.extraBold, fontSize: 13, lineHeight: 16, fontWeight: '800' },
  resourceValueCompact: { fontSize: 11 },
  resourcePlus: { width: 23, height: 23, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 2, borderColor: '#C98D28', backgroundColor: '#FFFEFA' },
  resourcePlusCompact: { width: 20, height: 20, borderRadius: 10 },
  resourcePlusText: { color: '#18467A', fontFamily: FONTS.extraBold, fontSize: 20, lineHeight: 20, fontWeight: '800', textAlign: 'center', includeFontPadding: false },
  settingsButton: {
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
  settingsButtonPressed: {
    opacity: 0.76,
    transform: [{ scale: 0.94 }],
  },
  homeContent: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, paddingBottom: 112 },
  homeContentCompact: { paddingBottom: 92 },
  brandSky: { width: '100%', position: 'relative', alignItems: 'center', paddingTop: 48 },
  brandSkyCompact: { paddingTop: 32 },
  skyFlightBand: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    height: 124,
    zIndex: 2,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  skyFlightBandCompact: { height: 100 },
  brandBlock: { width: '100%', alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  brandBlockCompact: { marginTop: -4 },
  brandLogo: { width: '78%', maxWidth: 410, aspectRatio: 2.04 },
  brandLogoCompact: { width: '66%', maxWidth: 300 },
  playButtonStack: { width: 154, height: 154, alignItems: 'center', justifyContent: 'center' },
  playButtonStackCompact: { width: 124, height: 124 },
  dailyCard: {
    width: '94%',
    maxWidth: 500,
    marginBottom: 10,
    paddingLeft: 12,
    paddingRight: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#E2B65C',
    backgroundColor: 'rgba(255,251,246,0.95)',
    shadowColor: '#456E80',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  dailyCardCompact: {
    marginBottom: 8,
    paddingVertical: 8,
    borderRadius: 20,
  },
  dailyEmblem: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#DBA643',
    backgroundColor: '#FFF4D6',
  },
  dailyEmblemCompact: { width: 38, height: 38, borderRadius: 19 },
  dailyEmblemFire: { fontSize: 22, lineHeight: 26 },
  dailyEmblemFireCompact: { fontSize: 19, lineHeight: 22 },
  dailyCopy: { flex: 1, minWidth: 0, marginHorizontal: 10 },
  dailyTitle: {
    color: '#173E72',
    fontFamily: FONTS.extraBold,
    fontSize: 13,
    fontWeight: '800',
  },
  dailyCtaText: {
    marginTop: 3,
    color: '#B97825',
    fontFamily: FONTS.bold,
    fontSize: 10,
    letterSpacing: 0.3,
    fontWeight: '700',
  },
  dailyStreakChip: {
    height: 28,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2B65C',
    backgroundColor: '#FFF9EA',
  },
  dailyStreakText: {
    color: '#173E72',
    fontFamily: FONTS.extraBold,
    fontSize: 12,
    fontWeight: '800',
  },
  dailyArrow: {
    marginLeft: 2,
    color: '#B68122',
    fontFamily: FONTS.bold,
    fontSize: 28,
    lineHeight: 28,
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
  },
  playGlow: { position: 'absolute', width: 148, height: 148, borderRadius: 74, backgroundColor: '#FFF2B2', shadowColor: '#FFFFFF', shadowOpacity: 0.95, shadowRadius: 30, elevation: 4 },
  playGlowCompact: { width: 119, height: 119, borderRadius: 60 },
  playButtonFrame: { width: 138, height: 138, borderRadius: 69, shadowColor: '#265782', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.34, shadowRadius: 11, elevation: 12 },
  playButtonFrameCompact: { width: 110, height: 110, borderRadius: 55 },
  playPressed: { transform: [{ scale: 0.96 }], opacity: 0.95 },
  playButtonBorder: { flex: 1, padding: 6, borderRadius: 69 },
  playButtonInner: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 63, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.68)' },
  playCompass: { color: '#F5D270', fontFamily: FONTS.bold, fontSize: 21, lineHeight: 21, textAlign: 'center', includeFontPadding: false },
  playCaption: { marginTop: -2, color: '#FFFFFF', fontFamily: FONTS.bold, fontSize: 11, letterSpacing: 1.1, fontWeight: '700' },
  playLevel: { marginTop: -3, color: '#FFFFFF', fontFamily: FONTS.medium, fontSize: 39, lineHeight: 45, fontWeight: '500', textShadowColor: 'rgba(0,0,0,0.25)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 3 },
  playLevelCompact: { fontSize: 31, lineHeight: 35 },
  countryCard: { width: '94%', maxWidth: 500, minHeight: 144, paddingLeft: 24, paddingRight: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', borderRadius: 28, borderWidth: 2, borderColor: '#E2B65C', backgroundColor: 'rgba(255,251,246,0.95)', shadowColor: '#456E80', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.26, shadowRadius: 12, elevation: 9 },
  countryCardCompact: { width: '94%', minHeight: 116, paddingLeft: 18, paddingVertical: 9, borderRadius: 23 },
  cardPressed: { opacity: 0.93, transform: [{ scale: 0.985 }] },
  countryCopy: { flex: 1, minWidth: 0, alignItems: 'center', paddingRight: 8 },
  countryTitle: { color: '#173E72', fontFamily: FONTS.extraBold, fontSize: 21, fontWeight: '800', textAlign: 'center' },
  countryTitleCompact: { fontSize: 17 },
  routeTitle: { marginTop: 3, color: '#B97825', fontFamily: FONTS.bold, fontSize: 9, letterSpacing: 0.8, fontWeight: '700', textAlign: 'center' },
  ornamentRow: { width: '72%', marginTop: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  ornamentLine: { flex: 1, height: 1, backgroundColor: '#D6AB57' },
  ornament: { color: '#D19A34', fontSize: 10 },
  stepRow: { width: '100%', marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  stepItem: { height: 29, flexDirection: 'row', alignItems: 'center' },
  stepConnector: { width: 6, height: 1.5, backgroundColor: '#AAB5BE' },
  stepConnectorDone: { backgroundColor: '#D19A34' },
  stepDotSlot: { position: 'relative', width: 17, height: 29, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  stepDot: { width: 17, height: 17, alignItems: 'center', justifyContent: 'center', borderRadius: 9, borderWidth: 1.5, borderColor: '#57799B', backgroundColor: '#FFFFFF' },
  stepDotDone: { borderColor: '#D69B2B', backgroundColor: '#1A6096' },
  stepDotActive: { zIndex: 3, borderWidth: 2.4, borderColor: '#F2B62F', backgroundColor: '#DDF6FF', shadowColor: '#159FE3', shadowOpacity: 0.95, shadowRadius: 7, elevation: 6 },
  stepDotText: { color: '#FFFFFF', fontFamily: FONTS.bold, fontSize: 10, lineHeight: 12, fontWeight: '700' },
  stepActiveOrbit: { position: 'absolute', top: 0, left: -6, zIndex: 4, width: 29, height: 29, borderRadius: 14.5 },
  stepActiveMarker: { position: 'absolute', top: 0, left: 11.5, width: 6, height: 6, borderRadius: 3, borderWidth: 1, borderColor: '#FFFFFF', backgroundColor: '#F2B62F' },
  discoveryText: { marginTop: 9, color: '#234C78', fontFamily: FONTS.semibold, fontSize: 9.5, fontWeight: '600', textAlign: 'center' },
  learningLevelText: { marginTop: 4, color: '#6A7F8C', fontFamily: FONTS.bold, fontSize: 9, letterSpacing: 0.5, fontWeight: '700', textAlign: 'center' },
  countryImageFrame: { width: 112, height: 112, overflow: 'visible', borderRadius: 56, borderWidth: 3, borderColor: '#DBA643', backgroundColor: '#9EDCF4', shadowColor: '#B07B22', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 },
  countryImageFrameCompact: { width: 92, height: 92, borderRadius: 46 },
  countryImage: { borderRadius: 999 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.95 }] },
});

const pStyles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingBottom: 100 },

  /* Cover Banner */
  coverWrapper: { width: '100%', height: 240, overflow: 'hidden' },
  coverSafe: { paddingHorizontal: 18, paddingTop: 8 },
  coverTitle: { color: '#FFFFFF', fontFamily: FONTS.extraBold, fontSize: 14, letterSpacing: 2.2, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },

  /* Identity Card */
  identityCard: { marginTop: -44, marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 22, backgroundColor: '#FFFDF6', shadowColor: '#3C2A10', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 5 },
  avatarRing: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 32, borderWidth: 3, borderColor: '#E8B84A', backgroundColor: '#FFF8E8' },
  avatarEmoji: { fontSize: 30 },
  identityInfo: { flex: 1, marginLeft: 12 },
  identityName: { color: '#2D3B2E', fontFamily: FONTS.extraBold, fontSize: 17, fontWeight: '800' },
  identityLocation: { marginTop: 3, color: '#7A8A6E', fontFamily: FONTS.semibold, fontSize: 10.5, fontWeight: '600' },
  lvlBadge: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#3C6B58' },
  lvlBadgeLabel: { color: '#A8D4BF', fontFamily: FONTS.bold, fontSize: 8, letterSpacing: 1, fontWeight: '700' },
  lvlBadgeValue: { color: '#FFFFFF', fontFamily: FONTS.extraBold, fontSize: 18, fontWeight: '800', marginTop: -2 },

  /* Stats Row */
  statsRow: { marginTop: 16, marginHorizontal: 16, flexDirection: 'row', gap: 8 },
  statPill: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 16, backgroundColor: '#FFFDF6', borderWidth: 1, borderColor: '#E8DCC8' },
  statIconCircle: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
  statIcon: { fontSize: 15 },
  statValue: { marginTop: 6, color: '#2D3B2E', fontFamily: FONTS.extraBold, fontSize: 14, fontWeight: '800' },
  statLabel: { marginTop: 2, color: '#8A7E6A', fontFamily: FONTS.bold, fontSize: 7.5, letterSpacing: 0.4, fontWeight: '700', textAlign: 'center' },

  /* Journey Tracker */
  journeyCard: { marginTop: 14, marginHorizontal: 16, padding: 16, borderRadius: 20, backgroundColor: '#FFFDF6', borderWidth: 1, borderColor: '#E8DCC8' },
  journeyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  journeyEyebrow: { color: '#8A7E6A', fontFamily: FONTS.bold, fontSize: 8, letterSpacing: 1.2, fontWeight: '700' },
  journeyPct: { color: '#C4882A', fontFamily: FONTS.extraBold, fontSize: 13, fontWeight: '800' },
  journeyCountryRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center' },
  journeyFlag: { fontSize: 22 },
  journeyCountryName: { flex: 1, marginLeft: 8, color: '#2D3B2E', fontFamily: FONTS.extraBold, fontSize: 15, fontWeight: '800' },
  journeyCount: { color: '#3C6B58', fontFamily: FONTS.extraBold, fontSize: 13, fontWeight: '800' },
  progressTrack: { height: 10, marginTop: 12, overflow: 'hidden', borderRadius: 5, backgroundColor: '#E8DCC8' },
  progressFill: { height: '100%', borderRadius: 5 },
  journeyMeta: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  journeyMetaText: { color: '#8A7E6A', fontFamily: FONTS.semibold, fontSize: 9, fontWeight: '600' },

  /* Language Card */
  langCard: { marginTop: 14, marginHorizontal: 16, padding: 14, borderRadius: 20, backgroundColor: '#FFFDF6', borderWidth: 1, borderColor: '#E8DCC8' },
  langTitle: { color: '#2D3B2E', fontFamily: FONTS.extraBold, fontSize: 13, fontWeight: '800' },
  langOptions: { marginTop: 10, flexDirection: 'row', gap: 6 },
  langPill: { flex: 1, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#EDE4D0' },
  langPillActive: { backgroundColor: '#3C6B58' },
  langPillText: { color: '#5A4E3C', fontFamily: FONTS.bold, fontSize: 10, fontWeight: '700' },
  langPillTextActive: { color: '#FFFFFF' },

  /* Difficulty Card */
  diffCard: { marginTop: 14, marginHorizontal: 16, padding: 16, borderRadius: 20, backgroundColor: '#FFFDF6', borderWidth: 1, borderColor: '#E8DCC8' },
  diffHeader: { flexDirection: 'row', alignItems: 'center' },
  diffIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#E8B84A33' },
  diffIconText: { color: '#C4882A', fontSize: 20, lineHeight: 20, textAlign: 'center', includeFontPadding: false },
  diffCopy: { flex: 1, marginLeft: 12 },
  diffEyebrow: { color: '#8A7E6A', fontFamily: FONTS.bold, fontSize: 8, letterSpacing: 1, fontWeight: '700' },
  diffTitle: { marginTop: 3, color: '#2D3B2E', fontFamily: FONTS.extraBold, fontSize: 14, fontWeight: '800' },
  diffDesc: { marginTop: 12, color: '#5A4E3C', fontFamily: FONTS.medium, fontSize: 11, lineHeight: 17 },
  diffMeta: { marginTop: 8, color: '#8A7E6A', fontFamily: FONTS.medium, fontSize: 9, lineHeight: 13 },
});
