import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
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
import { SoundPressable as Pressable } from '@/components/common/sound-pressable';
import type { DifficultyModifier, PuzzlePerformance } from '@/game/adaptive-difficulty';
import type { LevelData } from '@/game/levels';
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
const BIRD_FRAMES = [
  require('../../../assets/images/flying-bird/image_0.png'),
  require('../../../assets/images/flying-bird/image_1.png'),
  require('../../../assets/images/flying-bird/image_2.png'),
  require('../../../assets/images/flying-bird/image_3.png'),
  require('../../../assets/images/flying-bird/image_4.png'),
  require('../../../assets/images/flying-bird/image_5.png'),
  require('../../../assets/images/flying-bird/image_6.png'),
  require('../../../assets/images/flying-bird/image_7.png'),
  require('../../../assets/images/flying-bird/image_8.png'),
  require('../../../assets/images/flying-bird/image_9.png'),
  require('../../../assets/images/flying-bird/image_10.png'),
  require('../../../assets/images/flying-bird/image_11.png'),
  require('../../../assets/images/flying-bird/image_12.png'),
  require('../../../assets/images/flying-bird/image_13.png'),
  require('../../../assets/images/flying-bird/image_14.png'),
  require('../../../assets/images/flying-bird/image_15.png'),
] as const;

type MainMenuProps = {
  active: boolean;
  currentLevel: number;
  gemCount: number;
  levelData: LevelData;
  score: number;
  onOpenCollection: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onOpenTravel: () => void;
  onPlay: () => void;
};

function ResourcePill({
  accessibilityLabel,
  icon,
  label,
  value,
  onPress,
  compact,
}: {
  accessibilityLabel: string;
  icon: string;
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
      <Text style={[styles.resourceIcon, compact && styles.resourceIconCompact]}>{icon}</Text>
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
  gemCount,
  levelData,
  score,
  onOpenCollection,
  onOpenProfile,
  onOpenSettings,
  onOpenTravel,
  onPlay,
}: MainMenuProps) {
  const [birdFlight] = useState(() => new Animated.Value(0));
  const [birdFrame, setBirdFrame] = useState(0);
  const [pulse] = useState(() => new Animated.Value(0));
  const [orbit] = useState(() => new Animated.Value(0));
  const { height, width } = useWindowDimensions();
  const compact = height < 760;
  const route = ROUTE_BY_ID.get(levelData.routeId);
  const completedCountries = getCompletedCountryCount(currentLevel);
  const routeProgress = route ? getRouteProgress(currentLevel, route) : 0;

  useEffect(() => {
    if (!active) {
      birdFlight.stopAnimation();
      return;
    }

    birdFlight.setValue(0);
    const flightAnimation = Animated.loop(
      Animated.timing(birdFlight, {
        toValue: 1,
        duration: 9000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const wingTimer = setInterval(() => {
      setBirdFrame((frame) => (frame + 1) % BIRD_FRAMES.length);
    }, 110);

    flightAnimation.start();
    return () => {
      clearInterval(wingTimer);
      flightAnimation.stop();
    };
  }, [active, birdFlight]);

  useEffect(() => {
    if (!active) {
      pulse.stopAnimation();
      orbit.stopAnimation();
      return;
    }
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1150,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1150,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );
    const orbitAnimation = Animated.loop(
      Animated.timing(orbit, {
        toValue: 1,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
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
              accessibilityLabel={`${score} puan`}
              compact={compact}
              icon="★"
              label="PUAN"
              onPress={onOpenProfile}
              value={score.toLocaleString('tr-TR')}
            />
            <ResourcePill
              accessibilityLabel={`${gemCount} mücevher`}
              compact={compact}
              icon="💎"
              label="ELMAS"
              onPress={onOpenProfile}
              value={gemCount.toLocaleString('tr-TR')}
            />
          </View>

          <Pressable
            accessibilityLabel="Oyun ayarlarını aç"
            accessibilityRole="button"
            onPress={onOpenSettings}
            style={({ pressed }) => [
              styles.settingsButton,
              compact && styles.settingsButtonCompact,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.settingsIcon}>⚙</Text>
          </Pressable>
        </View>

        <View style={[styles.homeContent, compact && styles.homeContentCompact]}>
          <View style={[styles.brandBlock, compact && styles.brandBlockCompact]} pointerEvents="none">
            <Image
              cachePolicy="memory-disk"
              contentFit="contain"
              source={HOME_LOGO}
              style={[styles.brandLogo, compact && styles.brandLogoCompact]}
            />
            <View style={styles.birdFlightLayer}>
              <Animated.View
                style={[
                  styles.flyingBird,
                  styles.flyingBirdLarge,
                  {
                    transform: [
                      {
                        translateX: birdFlight.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-100, width + 80],
                        }),
                      },
                      {
                        translateY: birdFlight.interpolate({
                          inputRange: [0, 0.35, 0.7, 1],
                          outputRange: [0, -7, 4, 0],
                        }),
                      },
                    ],
                  },
                ]}>
                <Image contentFit="contain" source={BIRD_FRAMES[birdFrame]} style={styles.birdImage} />
              </Animated.View>
              <Animated.View
                style={[
                  styles.flyingBird,
                  styles.flyingBirdMedium,
                  {
                    transform: [
                      {
                        translateX: birdFlight.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-170, width + 50],
                        }),
                      },
                      {
                        translateY: birdFlight.interpolate({
                          inputRange: [0, 0.5, 1],
                          outputRange: [0, 8, 0],
                        }),
                      },
                    ],
                  },
                ]}>
                <Image
                  contentFit="contain"
                  source={BIRD_FRAMES[(birdFrame + 5) % BIRD_FRAMES.length]}
                  style={styles.birdImage}
                />
              </Animated.View>
              <Animated.View
                style={[
                  styles.flyingBird,
                  styles.flyingBirdSmall,
                  {
                    transform: [
                      {
                        translateX: birdFlight.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-240, width + 20],
                        }),
                      },
                      {
                        translateY: birdFlight.interpolate({
                          inputRange: [0, 0.4, 0.8, 1],
                          outputRange: [0, -4, 6, 0],
                        }),
                      },
                    ],
                  },
                ]}>
                <Image
                  contentFit="contain"
                  source={BIRD_FRAMES[(birdFrame + 10) % BIRD_FRAMES.length]}
                  style={styles.birdImage}
                />
              </Animated.View>
            </View>
          </View>

          <View style={[styles.playButtonStack, compact && styles.playButtonStackCompact]}>
            <Animated.View
              style={[
                styles.playGlow,
                compact && styles.playGlowCompact,
                {
                  opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.58] }),
                  transform: [
                    { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.09] }) },
                  ],
                },
              ]}
            />
            <Pressable
              accessibilityHint="Kaldığın sayı bulmacasını açar"
              accessibilityLabel={`Bölüm ${currentLevel}, devam et`}
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
                    {currentLevel}.
                  </Text>
                  <Text style={styles.playCaption}>BÖLÜM</Text>
                </LinearGradient>
              </LinearGradient>
            </Pressable>
          </View>

          <View
            accessible
            accessibilityLabel={`${route?.name ?? 'Dünya rotası'}, ${routeProgress}/${route?.countryIds.length ?? 0} ülke tamamlandı`}
            style={[styles.countryCard, compact && styles.countryCardCompact]}>
            <View style={styles.countryCopy}>
              <Text numberOfLines={1} style={[styles.countryTitle, compact && styles.countryTitleCompact]}>
                {levelData.country.toLocaleUpperCase('tr-TR')}
              </Text>
              <Text numberOfLines={1} style={styles.routeTitle}>
                {route?.name?.toLocaleUpperCase('tr-TR') ?? 'DÜNYA ROTASI'}
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
                      <Animated.View
                        accessible
                        accessibilityLabel={`${routeCountry?.country ?? countryId}, ${done ? 'tamamlandı' : active ? 'mevcut ülke' : 'henüz açılmadı'}`}
                        style={[
                          styles.stepDot,
                          done && styles.stepDotDone,
                          active && styles.stepDotActive,
                          active && {
                            transform: [
                              {
                                scale: pulse.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [1.12, 1.34],
                                }),
                              },
                            ],
                          },
                        ]}>
                        <Text style={styles.stepDotText}>{routeCountry?.flag ?? '•'}</Text>
                        {active ? (
                          <Animated.View
                            pointerEvents="none"
                            style={[
                              styles.stepActiveOrbit,
                              {
                                transform: [
                                  {
                                    rotate: orbit.interpolate({
                                      inputRange: [0, 1],
                                      outputRange: ['0deg', '360deg'],
                                    }),
                                  },
                                ],
                              },
                            ]}>
                            <View style={styles.stepActiveMarker} />
                          </Animated.View>
                        ) : null}
                      </Animated.View>
                    </View>
                  );
                })}
              </View>
              <Text style={styles.discoveryText}>
                🌍 {completedCountries}/{TOTAL_COUNTRIES} ülke keşfedildi
              </Text>
            </View>
            <View style={[styles.countryImageFrame, compact && styles.countryImageFrameCompact]}>
              <Image
                cachePolicy="memory-disk"
                contentFit="cover"
                source={{ uri: levelData.background }}
                style={[StyleSheet.absoluteFill, styles.countryImage]}
              />
              <View style={styles.mapPin}>
                <Text style={styles.mapPinDot}>●</Text>
              </View>
            </View>
          </View>
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
  onOpenPassport,
  onPlay,
  performanceHistory,
  cityDifficultyModifier,
  score,
}: {
  bonusCount: number;
  currentLevel: number;
  gemCount: number;
  levelData: LevelData;
  onOpenPassport: () => void;
  onPlay: () => void;
  performanceHistory: PuzzlePerformance[];
  cityDifficultyModifier: DifficultyModifier;
  score: number;
}) {
  const completedCountries = getCompletedCountryCount(currentLevel);
  const completedLevels = getCompletedWorldLevelCount(currentLevel);
  const country = COUNTRY_BY_ID.get(levelData.countryId);
  const countryProgress = country ? getCountryProgress(currentLevel, country.id) : 0;
  const difficultyLabel = cityDifficultyModifier > 0 ? 'İLERİ' : cityDifficultyModifier < 0 ? 'DESTEKLİ' : 'DENGELİ';
  const difficultyDescription = performanceHistory.length < 3
    ? 'Birkaç puzzle daha çözüldüğünde sana uygun zorluk seviyesi netleşecek.'
    : cityDifficultyModifier > 0
      ? 'Son performansına göre sonraki şehirlerde sayı havuzu biraz daha geniş olacak.'
      : cityDifficultyModifier < 0
        ? 'Son performansına göre sonraki şehirlerde sayı havuzu biraz daha erişilebilir olacak.'
        : 'Son performansına göre mevcut zorluk seviyesi korunuyor.';

  return (
    <LinearGradient colors={['#EAF5F5', '#F7EEDC', '#E6D0A9']} style={styles.profileScreen}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.profileHeader}>
          <Text style={styles.profileHeaderTitle}>PROFİL</Text>
        </View>

        <ScrollView
          bounces={false}
          contentContainerStyle={styles.profileScroll}
          showsVerticalScrollIndicator={false}>
          <View style={styles.profileHero}>
            <Image
              cachePolicy="memory-disk"
              contentFit="cover"
              source={{ uri: levelData.background }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['rgba(14,34,45,0.20)', 'rgba(14,34,45,0.92)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.avatar}><Text style={styles.avatarText}>{levelData.flag}</Text></View>
            <Text style={styles.explorerName}>Dünya Gezgini</Text>
            <Text style={styles.explorerLocation}>
              Seviye {currentLevel} • {levelData.country} • {levelData.city}
            </Text>
          </View>

          <View style={styles.difficultyCard}>
            <View style={styles.difficultyHeader}>
              <View style={styles.difficultyIcon}><Text style={styles.difficultyIconText}>⚙</Text></View>
              <View style={styles.difficultyCopy}>
                <Text style={styles.difficultyEyebrow}>OYUN ZORLUK AYARI</Text>
                <Text style={styles.difficultyTitle}>Öğrenme seviyesi: {difficultyLabel}</Text>
              </View>
            </View>
            <Text style={styles.difficultyDescription}>{difficultyDescription}</Text>
            <Text style={styles.difficultyMeta}>Son {performanceHistory.length} puzzle değerlendirildi • Zorluk yalnız yeni şehirde değişir</Text>
          </View>

          <View style={styles.statsGrid}>
            {[
              ['★', score.toLocaleString('tr-TR'), 'PUAN'],
              ['✓', `${completedLevels}`, 'TAMAMLANAN PUZZLE'],
              ['🌍', `${completedCountries}/${TOTAL_COUNTRIES}`, 'ÜLKE'],
              ['💎', `${gemCount}`, 'MÜCEVHER'],
            ].map(([icon, value, label]) => (
              <View key={label} style={styles.statCard}>
                <Text style={styles.statIcon}>{icon}</Text>
                <Text style={styles.statValue}>{value}</Text>
                <Text style={styles.statLabel}>{label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.profileProgressCard}>
            <View style={styles.profileProgressHeader}>
              <View>
                <Text style={styles.profileProgressEyebrow}>MEVCUT YOLCULUK</Text>
                <Text style={styles.profileProgressTitle}>{levelData.flag} {levelData.country}</Text>
              </View>
              <Text style={styles.profileProgressCount}>
                {countryProgress}/{COUNTRY_LEVEL_COUNT}
              </Text>
            </View>
            <View style={styles.profileProgressTrack}>
              <LinearGradient
                colors={['#3D7F91', '#8AD1D6']}
                style={[
                  styles.profileProgressFill,
                  {
                    width: `${(countryProgress / COUNTRY_LEVEL_COUNT) * 100}%` as `${number}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.worldProgress}>Dünya turu: {completedLevels}/{TOTAL_WORLD_LEVELS}</Text>
            <Text style={styles.worldProgress}>Oyuncu seviyesi: {currentLevel}</Text>
            <Text style={styles.worldProgress}>⭐ {bonusCount} bonus kombinasyon keşfedildi</Text>
          </View>

          <Pressable
            accessibilityLabel="Seyahat pasaportunu aç"
            accessibilityRole="button"
            onPress={onOpenPassport}
            style={({ pressed }) => [styles.profileAction, pressed && styles.pressed]}>
            <Text style={styles.profileActionIcon}>📘</Text>
            <View style={styles.profileActionCopy}>
              <Text style={styles.profileActionTitle}>Seyahat Pasaportu</Text>
              <Text style={styles.profileActionSubtitle}>
                {completedCountries}/{TOTAL_COUNTRIES} ülke damgası
              </Text>
            </View>
            <Text style={styles.profileActionArrow}>›</Text>
          </Pressable>

          <Pressable
            accessibilityLabel="Kaldığın bölüme devam et"
            accessibilityRole="button"
            onPress={onPlay}
            style={({ pressed }) => [styles.profilePlayButton, pressed && styles.pressed]}>
            <Text style={styles.profilePlayText}>▶  BÖLÜME DEVAM ET</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
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
  resourceCopy: { flex: 1, minWidth: 0, justifyContent: 'center' },
  resourceLabel: { color: '#A46E20', fontFamily: FONTS.bold, fontSize: 6.5, lineHeight: 8, letterSpacing: 0.5, fontWeight: '700' },
  resourceValue: { color: '#173E72', fontFamily: FONTS.extraBold, fontSize: 13, lineHeight: 16, fontWeight: '800' },
  resourceValueCompact: { fontSize: 11 },
  resourcePlus: { width: 23, height: 23, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 2, borderColor: '#C98D28', backgroundColor: '#FFFEFA' },
  resourcePlusCompact: { width: 20, height: 20, borderRadius: 10 },
  resourcePlusText: { marginTop: -2, color: '#18467A', fontFamily: FONTS.extraBold, fontSize: 20, lineHeight: 21, fontWeight: '800' },
  settingsButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#E8B94D',
    backgroundColor: '#245C91',
    shadowColor: '#76521B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 5,
    elevation: 6,
  },
  settingsButtonCompact: { width: 40, height: 40, borderRadius: 20 },
  settingsIcon: { color: '#FFF4CC', fontSize: 26, lineHeight: 29 },
  homeContent: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, paddingBottom: 112 },
  homeContentCompact: { paddingBottom: 92 },
  brandBlock: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  brandBlockCompact: { marginTop: -4 },
  brandLogo: { width: '78%', maxWidth: 410, aspectRatio: 2.04 },
  brandLogoCompact: { width: '66%', maxWidth: 300 },
  birdFlightLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1, overflow: 'visible' },
  flyingBird: { position: 'absolute' },
  flyingBirdLarge: { top: '12%', width: 68, height: 47 },
  flyingBirdMedium: { top: '43%', width: 48, height: 33 },
  flyingBirdSmall: { top: '68%', width: 34, height: 24 },
  birdImage: { width: '100%', height: '100%' },
  playButtonStack: { width: 154, height: 154, alignItems: 'center', justifyContent: 'center' },
  playButtonStackCompact: { width: 124, height: 124 },
  playGlow: { position: 'absolute', width: 148, height: 148, borderRadius: 74, backgroundColor: '#FFF2B2', shadowColor: '#FFFFFF', shadowOpacity: 0.95, shadowRadius: 30, elevation: 4 },
  playGlowCompact: { width: 119, height: 119, borderRadius: 60 },
  playButtonFrame: { width: 138, height: 138, borderRadius: 69, shadowColor: '#265782', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.34, shadowRadius: 11, elevation: 12 },
  playButtonFrameCompact: { width: 110, height: 110, borderRadius: 55 },
  playPressed: { transform: [{ scale: 0.96 }], opacity: 0.95 },
  playButtonBorder: { flex: 1, padding: 6, borderRadius: 69 },
  playButtonInner: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 63, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.68)' },
  playCompass: { color: '#F5D270', fontFamily: FONTS.bold, fontSize: 21, lineHeight: 24 },
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
  stepItem: { flexDirection: 'row', alignItems: 'center' },
  stepConnector: { width: 6, height: 1.5, backgroundColor: '#AAB5BE' },
  stepConnectorDone: { backgroundColor: '#D19A34' },
  stepDot: { width: 17, height: 17, alignItems: 'center', justifyContent: 'center', borderRadius: 9, borderWidth: 1.5, borderColor: '#57799B', backgroundColor: '#FFFFFF' },
  stepDotDone: { borderColor: '#D69B2B', backgroundColor: '#1A6096' },
  stepDotActive: { zIndex: 3, borderWidth: 2.4, borderColor: '#F2B62F', backgroundColor: '#DDF6FF', shadowColor: '#159FE3', shadowOpacity: 0.95, shadowRadius: 7, elevation: 6 },
  stepDotText: { color: '#FFFFFF', fontFamily: FONTS.bold, fontSize: 10, lineHeight: 12, fontWeight: '700' },
  stepActiveOrbit: { position: 'absolute', top: -8, left: -8, width: 29, height: 29 },
  stepActiveMarker: { position: 'absolute', top: 0, left: 11.5, width: 6, height: 6, borderRadius: 3, borderWidth: 1, borderColor: '#FFFFFF', backgroundColor: '#F2B62F' },
  discoveryText: { marginTop: 9, color: '#234C78', fontFamily: FONTS.semibold, fontSize: 9.5, fontWeight: '600', textAlign: 'center' },
  countryImageFrame: { width: 112, height: 112, overflow: 'visible', borderRadius: 56, borderWidth: 3, borderColor: '#DBA643', backgroundColor: '#9EDCF4', shadowColor: '#B07B22', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 },
  countryImageFrameCompact: { width: 92, height: 92, borderRadius: 46 },
  countryImage: { borderRadius: 999 },
  mapPin: { position: 'absolute', top: -17, left: '50%', width: 24, height: 30, marginLeft: -12, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 3, borderRadius: 13, borderWidth: 2, borderColor: '#B67A16', backgroundColor: '#F4B739', transform: [{ rotate: '45deg' }] },
  mapPinDot: { color: '#FFF8DA', fontSize: 10, lineHeight: 12, transform: [{ rotate: '-45deg' }] },
  pressed: { opacity: 0.78, transform: [{ scale: 0.95 }] },

  profileScreen: { flex: 1 },
  profileHeader: { height: 58, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center' },
  profileHeaderTitle: { color: '#253947', fontFamily: FONTS.extraBold, fontSize: 16, letterSpacing: 1.7, fontWeight: '800' },
  profileScroll: { width: '100%', maxWidth: 512, alignSelf: 'center', paddingHorizontal: 16, paddingBottom: 26 },
  profileHero: { height: 226, marginTop: 8, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden', borderRadius: 26, paddingBottom: 22, shadowColor: '#2D2219', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.24, shadowRadius: 10, elevation: 7 },
  avatar: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', borderRadius: 38, borderWidth: 4, borderColor: '#F5D779', backgroundColor: '#FFF8E8' },
  avatarText: { fontSize: 37 },
  explorerName: { marginTop: 9, color: '#FFFFFF', fontFamily: FONTS.extraBold, fontSize: 20, fontWeight: '800' },
  explorerLocation: { marginTop: 3, color: '#D7E6E7', fontFamily: FONTS.semibold, fontSize: 11, fontWeight: '600' },
  statsGrid: { marginTop: 13, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  statCard: { width: '48.5%', minHeight: 105, alignItems: 'center', justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: '#E3D2B4', backgroundColor: '#FFFCF7' },
  statIcon: { color: '#C28B24', fontSize: 20 },
  statValue: { marginTop: 3, color: '#263C48', fontFamily: FONTS.extraBold, fontSize: 19, fontWeight: '800' },
  statLabel: { marginTop: 3, color: '#857665', fontFamily: FONTS.bold, fontSize: 8, letterSpacing: 0.7, fontWeight: '700', textAlign: 'center' },
  profileProgressCard: { marginTop: 12, padding: 15, borderRadius: 21, borderWidth: 1, borderColor: '#D3E3E2', backgroundColor: '#F7FCFB' },
  profileProgressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  profileProgressEyebrow: { color: '#6D868A', fontFamily: FONTS.bold, fontSize: 8, letterSpacing: 1, fontWeight: '700' },
  profileProgressTitle: { marginTop: 3, color: '#273F4B', fontFamily: FONTS.extraBold, fontSize: 15, fontWeight: '800' },
  profileProgressCount: { color: '#3D7F91', fontFamily: FONTS.extraBold, fontSize: 15, fontWeight: '800' },
  profileProgressTrack: { height: 8, marginTop: 12, overflow: 'hidden', borderRadius: 5, backgroundColor: '#CFDFDF' },
  profileProgressFill: { height: '100%', borderRadius: 5 },
  difficultyCard: { marginTop: 12, padding: 15, borderRadius: 21, borderWidth: 1, borderColor: '#D9C99F', backgroundColor: '#FFF9EA' },
  difficultyHeader: { flexDirection: 'row', alignItems: 'center' },
  difficultyIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: '#F1D58A' },
  difficultyIconText: { color: '#76551B', fontSize: 20 },
  difficultyCopy: { flex: 1, marginLeft: 10 },
  difficultyEyebrow: { color: '#9B7A35', fontFamily: FONTS.bold, fontSize: 8, letterSpacing: 1, fontWeight: '700' },
  difficultyTitle: { marginTop: 3, color: '#49382E', fontFamily: FONTS.extraBold, fontSize: 14, fontWeight: '800' },
  difficultyDescription: { marginTop: 11, color: '#6D5B43', fontFamily: FONTS.medium, fontSize: 11, lineHeight: 17 },
  difficultyMeta: { marginTop: 8, color: '#9A896C', fontFamily: FONTS.medium, fontSize: 9, lineHeight: 13 },
  worldProgress: { marginTop: 7, color: '#708286', fontFamily: FONTS.semibold, fontSize: 9.5, fontWeight: '600', textAlign: 'right' },
  profileAction: { minHeight: 70, marginTop: 12, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: 1, borderColor: '#DFC88F', backgroundColor: '#FFF9EA' },
  profileActionIcon: { fontSize: 28 },
  profileActionCopy: { flex: 1, paddingHorizontal: 11 },
  profileActionTitle: { color: '#3D362C', fontFamily: FONTS.extraBold, fontSize: 13, fontWeight: '800' },
  profileActionSubtitle: { marginTop: 3, color: '#877A66', fontFamily: FONTS.medium, fontSize: 10 },
  profileActionArrow: { color: '#B68122', fontFamily: FONTS.bold, fontSize: 31, lineHeight: 32 },
  profilePlayButton: { height: 52, marginTop: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#346B7B', shadowColor: '#24434B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 7, elevation: 4 },
  profilePlayText: { color: '#FFFFFF', fontFamily: FONTS.extraBold, fontSize: 12, letterSpacing: 0.9, fontWeight: '800' },
});
