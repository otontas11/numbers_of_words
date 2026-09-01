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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FONTS } from '@/constants/fonts';
import { SoundPressable as Pressable } from '@/components/common/sound-pressable';
import type { LevelData } from '@/game/levels';
import {
  COUNTRY_BY_ID,
  ROUTE_BY_ID,
  TOTAL_WORLD_LEVELS,
  getCompletedCountryCount,
  getCompletedWorldLevelCount,
  getCountryProgress,
} from '@/game/travel';

const HOME_BACKGROUND = require('../../../assets/images/img/bg.png');

type MainMenuProps = {
  bonusCount: number;
  currentLevel: number;
  gemCount: number;
  levelData: LevelData;
  score: number;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onOpenTravel: () => void;
  onPlay: () => void;
};

function RoundAction({
  accessibilityLabel,
  icon,
  label,
  onPress,
}: {
  accessibilityLabel: string;
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.bottomAction, pressed && styles.pressed]}>
      <LinearGradient
        colors={['rgba(52,72,83,0.98)', 'rgba(25,42,53,0.98)']}
        style={styles.bottomActionIcon}>
        <Text style={styles.bottomActionEmoji}>{icon}</Text>
      </LinearGradient>
      <Text style={styles.bottomActionLabel}>{label}</Text>
    </Pressable>
  );
}

export function MainMenu({
  bonusCount,
  currentLevel,
  gemCount,
  levelData,
  score,
  onOpenProfile,
  onOpenSettings,
  onOpenTravel,
  onPlay,
}: MainMenuProps) {
  const [pulse] = useState(() => new Animated.Value(0));
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const compact = height < 700;
  const country = COUNTRY_BY_ID.get(levelData.countryId);
  const route = ROUTE_BY_ID.get(levelData.routeId);
  const countryProgress = country ? getCountryProgress(currentLevel, country.id) : 0;

  useEffect(() => {
    const animation = Animated.loop(
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
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View style={styles.screen}>
      <Image
        cachePolicy="memory-disk"
        contentFit="cover"
        source={HOME_BACKGROUND}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(7,19,31,0.38)', 'rgba(9,25,37,0.16)', 'rgba(7,20,31,0.79)']}
        locations={[0, 0.46, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={[styles.topBar, compact && styles.topBarCompact]}>
          <View accessibilityLabel={`${score} puan`} style={styles.scorePill}>
            <View style={styles.scoreCoin}><Text style={styles.scoreCoinText}>★</Text></View>
            <View>
              <Text style={styles.scoreLabel}>PUAN</Text>
              <Text style={styles.scoreValue}>{score.toLocaleString('tr-TR')}</Text>
            </View>
          </View>

          <Pressable
            accessibilityLabel="Oyun ayarlarını aç"
            accessibilityRole="button"
            onPress={onOpenSettings}
            style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]}>
            <Text style={styles.settingsIcon}>⚙</Text>
          </Pressable>
        </View>

        <View style={[styles.brandBlock, compact && styles.brandBlockCompact]} pointerEvents="none">
          <Text style={styles.brandEyebrow}>NUMBER OF</Text>
          <Text style={[styles.brandTitle, compact && styles.brandTitleCompact]}>WONDERS</Text>
          <Text style={styles.routeName}>{route?.emoji ?? '🧭'} {route?.name ?? 'Dünya Turu'}</Text>
        </View>

        <View style={styles.playArea}>
          <View style={[styles.destinationPill, compact && styles.destinationPillCompact]}>
            <Text style={styles.destinationCountry}>{levelData.flag} {levelData.country}</Text>
            <Text style={styles.destinationDivider}>•</Text>
            <Text numberOfLines={1} style={styles.destinationCity}>{levelData.emoji} {levelData.city}</Text>
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
              accessibilityLabel={`Bölüm ${levelData.locationLevel}, devam et`}
              accessibilityRole="button"
              onPress={onPlay}
              style={({ pressed }) => [
                styles.playButtonFrame,
                compact && styles.playButtonFrameCompact,
                pressed && styles.playPressed,
              ]}>
              <LinearGradient
                colors={['#FFF0A8', '#EDB53D', '#B97715']}
                end={{ x: 0.65, y: 1 }}
                start={{ x: 0.2, y: 0 }}
                style={styles.playButtonBorder}>
                <LinearGradient
                  colors={['#3F6975', '#1C3948']}
                  style={styles.playButtonInner}>
                  <Text style={styles.playCaption}>BÖLÜM</Text>
                  <Text style={[styles.playLevel, compact && styles.playLevelCompact]}>
                    {levelData.locationLevel}
                  </Text>
                  <View style={styles.playContinueRow}>
                    <Text style={styles.playTriangle}>▶</Text>
                    <Text style={styles.playContinue}>DEVAM ET</Text>
                  </View>
                </LinearGradient>
              </LinearGradient>
            </Pressable>
          </View>

          <View style={[styles.progressCard, compact && styles.progressCardCompact]}>
            <View style={styles.progressCopy}>
              <Text style={styles.progressTitle}>{levelData.city}</Text>
              <Text style={styles.progressValue}>
                {levelData.locationLevel}/{levelData.locationLevelCount} puzzle
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <LinearGradient
                colors={['#F5CA5A', '#FFF0A2']}
                end={{ x: 1, y: 0 }}
                start={{ x: 0, y: 0 }}
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.max(4, (countryProgress / 20) * 100)}%` as `${number}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.bonusText}>
              💎 {gemCount} Mücevher  •  ⭐ {bonusCount} Bonus Keşif
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.bottomBar,
            compact && styles.bottomBarCompact,
            { paddingBottom: Math.max(2, insets.bottom * 0.12) },
          ]}>
          <RoundAction
            accessibilityLabel="Profil sayfasını aç"
            icon="👤"
            label="PROFİL"
            onPress={onOpenProfile}
          />
          <View style={styles.bottomCenterMark} pointerEvents="none">
            <Text style={styles.bottomCenterEmoji}>🧭</Text>
          </View>
          <RoundAction
            accessibilityLabel="Seyahat rotalarını aç"
            icon="🌍"
            label="SEYAHAT"
            onPress={onOpenTravel}
          />
        </View>
      </SafeAreaView>
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
              ['🌍', `${completedCountries}/100`, 'ÜLKE'],
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
              <Text style={styles.profileActionSubtitle}>{completedCountries}/100 ülke damgası</Text>
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
  screen: { flex: 1, backgroundColor: '#0B2532' },
  safeArea: { flex: 1 },
  topBar: {
    height: 62,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarCompact: { height: 52 },
  scorePill: {
    minWidth: 112,
    height: 48,
    paddingHorizontal: 9,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255,239,184,0.78)',
    backgroundColor: 'rgba(25,44,54,0.91)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 7,
    elevation: 6,
  },
  scoreCoin: {
    width: 33,
    height: 33,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    borderWidth: 2,
    borderColor: '#FFF1A8',
    backgroundColor: '#D99A24',
  },
  scoreCoinText: { color: '#FFF8CA', fontSize: 17 },
  scoreLabel: { color: '#BFD1D4', fontFamily: FONTS.bold, fontSize: 8, letterSpacing: 1, fontWeight: '700' },
  scoreValue: { marginTop: 1, color: '#FFFFFF', fontFamily: FONTS.extraBold, fontSize: 14, fontWeight: '800' },
  settingsButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(222,243,244,0.84)',
    backgroundColor: 'rgba(30,53,65,0.92)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 7,
    elevation: 6,
  },
  settingsIcon: { color: '#FFFFFF', fontSize: 26, lineHeight: 29 },
  brandBlock: { alignItems: 'center', paddingTop: 4 },
  brandBlockCompact: { paddingTop: 0 },
  brandEyebrow: { color: '#E8F4F1', fontFamily: FONTS.extraBold, fontSize: 12, letterSpacing: 5.2, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 6 },
  brandTitle: { marginTop: -1, color: '#FFF3AF', fontFamily: FONTS.extraBold, fontSize: 31, letterSpacing: 1.6, fontWeight: '800', textShadowColor: 'rgba(27,42,48,0.9)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 6 },
  brandTitleCompact: { fontSize: 26, lineHeight: 31 },
  routeName: { marginTop: 5, color: '#F5FBFA', fontFamily: FONTS.bold, fontSize: 10.5, letterSpacing: 0.7, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 4 },
  playArea: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', paddingTop: 4 },
  destinationPill: { maxWidth: '88%', minHeight: 33, marginBottom: 17, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', backgroundColor: 'rgba(19,42,53,0.82)' },
  destinationPillCompact: { minHeight: 30, marginBottom: 7 },
  destinationCountry: { color: '#FFE99B', fontFamily: FONTS.extraBold, fontSize: 11, fontWeight: '800' },
  destinationDivider: { color: '#9AB1B7', fontFamily: FONTS.bold, fontSize: 11 },
  destinationCity: { flexShrink: 1, color: '#FFFFFF', fontFamily: FONTS.bold, fontSize: 11, fontWeight: '700' },
  playButtonStack: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center' },
  playButtonStackCompact: { width: 164, height: 164 },
  playGlow: { position: 'absolute', width: 190, height: 190, borderRadius: 95, backgroundColor: '#FFD85F', shadowColor: '#FFE583', shadowOpacity: 0.9, shadowRadius: 34, elevation: 4 },
  playGlowCompact: { width: 154, height: 154, borderRadius: 77 },
  playButtonFrame: { width: 174, height: 174, borderRadius: 87, shadowColor: '#000', shadowOffset: { width: 0, height: 9 }, shadowOpacity: 0.38, shadowRadius: 14, elevation: 14 },
  playButtonFrameCompact: { width: 144, height: 144, borderRadius: 72 },
  playPressed: { transform: [{ scale: 0.96 }], opacity: 0.95 },
  playButtonBorder: { flex: 1, padding: 8, borderRadius: 87 },
  playButtonInner: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 79, borderWidth: 2, borderColor: 'rgba(255,255,255,0.44)' },
  playCaption: { color: '#D8E9E9', fontFamily: FONTS.extraBold, fontSize: 12, letterSpacing: 2.4, fontWeight: '800' },
  playLevel: { marginTop: -2, color: '#FFFFFF', fontFamily: FONTS.extraBold, fontSize: 51, lineHeight: 58, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.25)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 3 },
  playLevelCompact: { fontSize: 39, lineHeight: 44 },
  playContinueRow: { marginTop: 0, flexDirection: 'row', alignItems: 'center', gap: 5 },
  playTriangle: { color: '#FFE883', fontSize: 11 },
  playContinue: { color: '#FFE883', fontFamily: FONTS.extraBold, fontSize: 10, letterSpacing: 0.8, fontWeight: '800' },
  progressCard: { width: '82%', maxWidth: 380, marginTop: 20, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.37)', backgroundColor: 'rgba(17,38,48,0.82)' },
  progressCardCompact: { marginTop: 8, paddingVertical: 7 },
  progressCopy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressTitle: { color: '#FFFFFF', fontFamily: FONTS.bold, fontSize: 11, fontWeight: '700' },
  progressValue: { color: '#D3E4E5', fontFamily: FONTS.semibold, fontSize: 9.5, fontWeight: '600' },
  progressTrack: { height: 6, marginTop: 7, overflow: 'hidden', borderRadius: 4, backgroundColor: 'rgba(111,138,145,0.58)' },
  progressFill: { height: '100%', borderRadius: 4 },
  bonusText: { marginTop: 7, color: '#FFE99B', fontFamily: FONTS.bold, fontSize: 9.5, fontWeight: '700', textAlign: 'center' },
  bottomBar: { height: 103, marginHorizontal: 14, marginBottom: 6, paddingHorizontal: 21, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 31, borderWidth: 1.5, borderColor: 'rgba(232,246,246,0.72)', backgroundColor: 'rgba(17,37,48,0.92)', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.32, shadowRadius: 10, elevation: 10 },
  bottomBarCompact: { height: 91 },
  bottomAction: { width: 96, alignItems: 'center', justifyContent: 'center' },
  bottomActionIcon: { width: 55, height: 55, alignItems: 'center', justifyContent: 'center', borderRadius: 28, borderWidth: 1.5, borderColor: '#D9EEEE' },
  bottomActionEmoji: { fontSize: 25 },
  bottomActionLabel: { marginTop: 6, color: '#FFFFFF', fontFamily: FONTS.extraBold, fontSize: 9, letterSpacing: 1.1, fontWeight: '800' },
  bottomCenterMark: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 27, borderWidth: 1, borderColor: 'rgba(241,211,128,0.55)', backgroundColor: 'rgba(233,183,67,0.15)' },
  bottomCenterEmoji: { fontSize: 25, opacity: 0.9 },
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
