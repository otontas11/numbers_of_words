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
import type { LevelData } from '@/game/levels';
import {
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

type MainMenuProps = {
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
  const [pulse] = useState(() => new Animated.Value(0));
  const [orbit] = useState(() => new Animated.Value(0));
  const { height } = useWindowDimensions();
  const compact = height < 760;
  const route = ROUTE_BY_ID.get(levelData.routeId);
  const completedCountries = getCompletedCountryCount(currentLevel);
  const routeProgress = route ? getRouteProgress(currentLevel, route) : 0;

  useEffect(() => {
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
  }, [orbit, pulse]);

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
  onBack,
  onOpenPassport,
  onPlay,
  score,
}: {
  bonusCount: number;
  currentLevel: number;
  gemCount: number;
  levelData: LevelData;
  onBack: () => void;
  onOpenPassport: () => void;
  onPlay: () => void;
  score: number;
}) {
  const completedCountries = getCompletedCountryCount(currentLevel);
  const completedLevels = getCompletedWorldLevelCount(currentLevel);
  const country = COUNTRY_BY_ID.get(levelData.countryId);
  const countryProgress = country ? getCountryProgress(currentLevel, country.id) : 0;

  return (
    <LinearGradient colors={['#EAF5F5', '#F7EEDC', '#E6D0A9']} style={styles.profileScreen}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.profileHeader}>
          <Pressable
            accessibilityLabel="Ana sayfaya dön"
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [styles.profileBack, pressed && styles.pressed]}>
            <Text style={styles.profileBackText}>‹</Text>
          </Pressable>
          <Text style={styles.profileHeaderTitle}>PROFİL</Text>
          <View style={styles.profileHeaderSpacer} />
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
            <Text style={styles.explorerLocation}>{levelData.country} • {levelData.city}</Text>
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
              <Text style={styles.profileProgressCount}>{countryProgress}/20</Text>
            </View>
            <View style={styles.profileProgressTrack}>
              <LinearGradient
                colors={['#3D7F91', '#8AD1D6']}
                style={[
                  styles.profileProgressFill,
                  { width: `${(countryProgress / 20) * 100}%` as `${number}%` },
                ]}
              />
            </View>
            <Text style={styles.worldProgress}>Dünya turu: {completedLevels}/{TOTAL_WORLD_LEVELS}</Text>
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
  profileHeader: { height: 58, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  profileBack: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: '#2D4B58' },
  profileBackText: { marginTop: -4, color: '#FFFFFF', fontFamily: FONTS.bold, fontSize: 36, lineHeight: 38 },
  profileHeaderTitle: { color: '#253947', fontFamily: FONTS.extraBold, fontSize: 16, letterSpacing: 1.7, fontWeight: '800' },
  profileHeaderSpacer: { width: 44 },
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
