import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FONTS } from '@/constants/fonts';
import { AppFooter } from '@/components/common/app-footer';
import { SoundPressable as Pressable } from '@/components/common/sound-pressable';
import type { LevelData } from '@/game/levels';
import {
  COUNTRY_BY_ID,
  ROUTE_BY_ID,
  TRAVEL_ROUTES,
  WORLD_COUNTRIES,
  getCountryProgress,
  getLocationProgress,
  isCountryComplete,
  isCountryUnlocked,
  isLocationUnlocked,
  isRouteComplete,
  isRouteUnlocked,
  routeCountries,
  type TravelCountry,
  type TravelRoute,
} from '@/game/travel';

const WORLD_BACKGROUND = require('../../../assets/images/img/bg.png');
type MapLayer = 'world' | 'route';

type JourneyMapProps = {
  level: number;
  levelData: LevelData;
  onBack: () => void;
  onContinue: () => void;
  onOpenPassport: () => void;
  onOpenTasks: () => void;
};

function Entrance({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.timing(opacity, {
      toValue: 1,
      delay: Math.min(delay, 420),
      duration: 360,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, opacity]);

  return (
    <Animated.View
      style={{
        opacity,
        transform: [
          { translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) },
        ],
      }}>
      {children}
    </Animated.View>
  );
}

function RouteCard({
  active,
  index,
  level,
  onPress,
  route,
}: {
  active: boolean;
  index: number;
  level: number;
  onPress: () => void;
  route: TravelRoute;
}) {
  const countries = routeCountries(route);
  const progress = countries.reduce((sum, country) => sum + getCountryProgress(level, country.id), 0);
  const total = countries.reduce((sum, country) => sum + country.levelCount, 0);
  const unlocked = isRouteUnlocked(level, route);
  const complete = isRouteComplete(level, route);
  const currentStep = Math.min(4, Math.floor((progress / Math.max(1, total)) * 5));

  return (
    <Entrance delay={index * 42}>
      <Pressable
        accessibilityLabel={`${route.name}, ${progress}/${total} bölüm`}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.worldRouteCard,
          active && styles.worldRouteCardActive,
          !unlocked && styles.worldRouteCardLocked,
          pressed && styles.pressed,
        ]}>
        <View style={styles.worldRouteImageFrame}>
          <Image
            cachePolicy="memory-disk"
            contentFit="cover"
            source={{ uri: route.background }}
            style={[StyleSheet.absoluteFill, styles.worldRouteImage]}
            transition={160}
          />
          {!unlocked ? <View style={styles.worldRouteImageShade} /> : null}
          <View style={styles.worldRouteNumber}>
            <Text style={styles.worldRouteNumberText}>{route.order}</Text>
          </View>
        </View>

        <View style={styles.worldRouteContent}>
          <View style={styles.worldRouteTitleRow}>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.72}
              numberOfLines={1}
              style={[styles.worldRouteName, !unlocked && styles.worldRouteTextLocked]}>
              {route.name}
            </Text>
            {unlocked ? (
              <Text style={styles.worldRouteCount}>{progress}/{total}</Text>
            ) : (
              <View style={styles.worldLockBadge}>
                <Text style={styles.worldLockIcon}>♙</Text>
                <Text style={styles.worldLockText}>KİLİTLİ</Text>
              </View>
            )}
          </View>
          <Text numberOfLines={1} style={[styles.worldRouteCaption, !unlocked && styles.worldRouteTextLocked]}>
            {route.theme}.
          </Text>
          <View style={styles.worldRouteFooter}>
            <View style={styles.worldStageRail}>
              {[0, 1, 2, 3, 4].map((step) => (
                <Fragment key={step}>
                  {step > 0 ? (
                    <View style={[styles.worldStageLine, unlocked && step <= currentStep && styles.worldStageLineDone]} />
                  ) : null}
                  <View
                    style={[
                      styles.worldStageDot,
                      unlocked && step < currentStep && styles.worldStageDotDone,
                      unlocked && step === currentStep && !complete && styles.worldStageDotActive,
                    ]}>
                    <Text style={styles.worldStageDotText}>
                      {unlocked && (step < currentStep || complete) ? '✓' : step === 4 ? '✥' : ''}
                    </Text>
                  </View>
                </Fragment>
              ))}
            </View>
            {active && !complete ? (
              <LinearGradient colors={['#FFF3A7', '#EAAF35', '#C27B13']} style={styles.worldContinueButton}>
                <Text style={styles.worldContinueText}>DEVAM ET</Text>
              </LinearGradient>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Entrance>
  );
}

function DestinationRail({ country, level }: { country: TravelCountry; level: number }) {
  const nodes = [...country.locations, country.challenge];
  return (
    <View style={styles.stageRail}>
      {nodes.map((location, index) => {
        const progress = getLocationProgress(level, country, location);
        const unlocked = isLocationUnlocked(level, country, location);
        const done = progress >= location.levelCount;
        return (
          <Fragment key={location.id}>
            <View
              style={[
                styles.stageCircle,
                done ? styles.stageDone : unlocked ? styles.stageActive : styles.stageLocked,
              ]}>
              <Text style={[styles.stageText, unlocked && !done && styles.stageActiveText]}>
                {done ? '✓' : location.kind === 'challenge' ? '🏆' : index + 1}
              </Text>
            </View>
            {index < nodes.length - 1 ? (
              <View style={[styles.stageConnector, done && styles.stageConnectorDone]} />
            ) : null}
          </Fragment>
        );
      })}
    </View>
  );
}

function CountryCard({
  active,
  country,
  index,
  level,
  onPress,
}: {
  active: boolean;
  country: TravelCountry;
  index: number;
  level: number;
  onPress: () => void;
}) {
  const progress = getCountryProgress(level, country.id);
  const unlocked = isCountryUnlocked(level, country.id);
  const complete = isCountryComplete(level, country.id);
  return (
    <Entrance delay={index * 50}>
      <Pressable
        accessibilityHint={active ? 'Mevcut sayı bulmacasını açar' : undefined}
        accessibilityLabel={`${country.country}, ${progress}/${country.levelCount} bölüm`}
        accessibilityRole="button"
        accessibilityState={{ disabled: !unlocked }}
        disabled={!unlocked}
        onPress={onPress}
        style={({ pressed }) => [
          styles.routeCountryCard,
          active && styles.routeCountryCardActive,
          !unlocked && styles.routeCountryCardLocked,
          pressed && styles.pressed,
        ]}>
        <View style={styles.routeCountryImageFrame}>
          <Image
            cachePolicy="memory-disk"
            contentFit="cover"
            source={{ uri: country.background }}
            style={[StyleSheet.absoluteFill, styles.routeCountryImage]}
            transition={160}
          />
          {!unlocked ? <View style={styles.routeCountryImageShade} /> : null}
          <View style={styles.routeCountryNumber}>
            <Text style={styles.routeCountryNumberText}>{index + 1}</Text>
          </View>
        </View>
        <View style={styles.routeCountryContent}>
          <View style={styles.routeCountryTitleRow}>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.72}
              numberOfLines={1}
              style={[styles.routeCountryName, !unlocked && styles.routeCountryTextLocked]}>
              {country.flag} {country.country}
            </Text>
            <Text style={[styles.routeCountryCount, !unlocked && styles.routeCountryTextLocked]}>
              {unlocked ? `${progress}/${country.levelCount}` : '🔒'}
            </Text>
          </View>
          <Text style={[styles.routeCountryCaption, !unlocked && styles.routeCountryTextLocked]}>
            {!unlocked ? 'Önceki ülkeyi tamamlayarak aç' : complete ? 'Ülke tamamlandı' : active ? 'Mevcut yolculuk' : 'Keşfedilmeye hazır'}
          </Text>
          <DestinationRail country={country} level={level} />
          {active && !complete ? (
            <LinearGradient colors={['#FFF3A7', '#EAAF35', '#C27B13']} style={styles.routeCountryContinue}>
              <Text style={styles.routeCountryContinueText}>DEVAM ET</Text>
            </LinearGradient>
          ) : null}
        </View>
      </Pressable>
    </Entrance>
  );
}

export function JourneyMap({
  level,
  levelData,
  onBack,
  onContinue,
  onOpenPassport,
  onOpenTasks,
}: JourneyMapProps) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [layer, setLayer] = useState<MapLayer>('world');
  const [selectedRouteId, setSelectedRouteId] = useState(levelData.routeId);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ animated: false, y: 0 });
  }, [layer, selectedRouteId]);

  const activeRoute = ROUTE_BY_ID.get(levelData.routeId) ?? TRAVEL_ROUTES[0];
  const selectedRoute = ROUTE_BY_ID.get(selectedRouteId) ?? activeRoute;
  const activeCountry = COUNTRY_BY_ID.get(levelData.countryId) ?? WORLD_COUNTRIES[0];
  const selectedRouteCountries = useMemo(() => routeCountries(selectedRoute), [selectedRoute]);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    setTimeout(() => {
      setNotice((current) => (current === message ? null : current));
    }, 1900);
  }, []);

  const goBack = () => {
    if (layer === 'route') {
      setLayer('world');
      return;
    }
    onBack();
  };

  const openRoute = (route: TravelRoute) => {
    if (!isRouteUnlocked(level, route)) {
      const previous = TRAVEL_ROUTES[route.order - 2];
      showNotice(`Önce ${previous.name} rotasını tamamla`);
      return;
    }
    setSelectedRouteId(route.id);
    setLayer('route');
  };

  const openCountry = (country: TravelCountry) => {
    if (!isCountryUnlocked(level, country.id)) {
      showNotice('Bu ülke seyahat rotasında henüz açılmadı');
      return;
    }
    if (country.id === activeCountry.id) {
      onContinue();
      return;
    }
    showNotice(
      isCountryComplete(level, country.id)
        ? `${country.country} tamamlandı ✓ • Mevcut yolculuk: ${activeCountry.country}`
        : `Mevcut ülke: ${activeCountry.country}`,
    );
  };

  if (layer === 'world') {
    return (
      <View style={styles.worldScreen}>
        <Image
          cachePolicy="memory-disk"
          contentFit="cover"
          source={WORLD_BACKGROUND}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.18)', 'rgba(17,77,121,0.28)']}
          locations={[0, 0.48, 1]}
          style={StyleSheet.absoluteFill}
        />

        <ScrollView
          ref={scrollRef}
          bounces={false}
          contentContainerStyle={[
            styles.worldList,
            { paddingTop: insets.top + 14, paddingBottom: 116 + insets.bottom },
          ]}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}>
          {TRAVEL_ROUTES.map((route, index) => (
            <RouteCard
              active={route.id === activeRoute.id}
              index={index}
              key={route.id}
              level={level}
              onPress={() => openRoute(route)}
              route={route}
            />
          ))}
        </ScrollView>

        <AppFooter
          activeItem="map"
          onCollection={onOpenPassport}
          onHome={onBack}
          onMap={() => {}}
          onTasks={onOpenTasks}
        />

        {notice ? (
          <View pointerEvents="none" style={[styles.notice, { top: insets.top + 72 }]}>
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.worldScreen}>
      <Image
        cachePolicy="memory-disk"
        contentFit="cover"
        source={WORLD_BACKGROUND}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.18)', 'rgba(17,77,121,0.28)']}
        locations={[0, 0.48, 1]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        ref={scrollRef}
        bounces={false}
        contentContainerStyle={[
          styles.routeCountryList,
          { paddingTop: insets.top + 14, paddingBottom: 116 + insets.bottom },
        ]}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}>
        <View style={styles.routeSummary}>
          <Text style={styles.routeSummaryEyebrow}>ROTA {selectedRoute.order}</Text>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            numberOfLines={1}
            style={styles.routeSummaryTitle}>
            {selectedRoute.emoji} {selectedRoute.name}
          </Text>
          <Text style={styles.routeSummaryCaption}>
            {selectedRoute.countryIds.length} ülke • {selectedRoute.countryIds.length * 20} bölüm
          </Text>
        </View>
        {selectedRouteCountries.map((country, index) => (
          <CountryCard
            active={country.id === activeCountry.id}
            country={country}
            index={index}
            key={country.id}
            level={level}
            onPress={() => openCountry(country)}
          />
        ))}
      </ScrollView>

      <AppFooter
        activeItem="map"
        onCollection={onOpenPassport}
        onHome={onBack}
        onMap={goBack}
        onTasks={onOpenTasks}
      />
      {notice ? (
        <View pointerEvents="none" style={[styles.notice, { top: insets.top + 72 }]}>
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  worldScreen: { flex: 1, backgroundColor: '#78C9EF' },
  cityHeader: { height: 260, alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 15 },
  cityHeaderControls: { position: 'absolute', left: 12, right: 12, zIndex: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cityHeaderButton: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1.8, borderColor: '#E3B553', backgroundColor: '#245A90', shadowColor: '#5C3D0E', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.26, shadowRadius: 4, elevation: 5 },
  cityBackText: { marginTop: -4, color: '#FFF4C7', fontFamily: FONTS.bold, fontSize: 34, lineHeight: 36 },
  citySettingsText: { color: '#FFF4C7', fontSize: 24, lineHeight: 27 },
  cityLogo: { width: 196, aspectRatio: 2.04, marginTop: 2 },
  countryPlaque: { width: '82%', maxWidth: 400, minHeight: 116, marginTop: 4, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 10, borderRadius: 25, borderWidth: 1.8, borderColor: '#D3A750', backgroundColor: 'rgba(255,253,249,0.96)', shadowColor: '#376178', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 7 },
  countryPlaqueSymbol: { fontSize: 25, lineHeight: 30 },
  countryPlaqueTitle: { marginTop: 1, color: '#173F72', fontFamily: FONTS.extraBold, fontSize: 25, letterSpacing: 1.2, fontWeight: '800', textAlign: 'center' },
  countryPlaqueSubtitleRow: { width: '72%', marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  countryPlaqueLine: { flex: 1, height: 1, backgroundColor: '#D0A047' },
  countryPlaqueSubtitle: { color: '#284C72', fontFamily: FONTS.semibold, fontSize: 13, fontWeight: '600' },
  cityList: { width: '100%', maxWidth: 512, alignSelf: 'center', paddingHorizontal: 14, paddingTop: 7 },
  cityCard: { minHeight: 160, marginBottom: 14, marginLeft: 16, padding: 10, paddingLeft: 142, justifyContent: 'center', borderRadius: 25, borderWidth: 1.8, borderColor: '#D3A750', backgroundColor: 'rgba(255,253,249,0.96)', shadowColor: '#356479', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.26, shadowRadius: 8, elevation: 7 },
  cityCardActive: { borderWidth: 2.4, borderColor: '#F0C34F', shadowColor: '#EAB739', shadowOpacity: 0.52, shadowRadius: 10, elevation: 9 },
  cityCardLocked: { borderColor: '#BFC4C7', backgroundColor: 'rgba(246,246,244,0.95)' },
  cityImageFrame: { position: 'absolute', left: -16, top: 7, width: 142, height: 142, borderRadius: 71, borderWidth: 2.3, borderColor: '#C58C29', backgroundColor: '#C8E8F2', shadowColor: '#6E4D18', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.26, shadowRadius: 5, elevation: 6 },
  cityImage: { borderRadius: 71 },
  cityImageShade: { ...StyleSheet.absoluteFill, borderRadius: 71, backgroundColor: 'rgba(230,232,231,0.58)' },
  cityCardContent: { minHeight: 112, justifyContent: 'center', paddingLeft: 8 },
  cityName: { color: '#173F72', fontFamily: FONTS.extraBold, fontSize: 24, fontWeight: '800' },
  cityNameLocked: { color: '#7A7E81' },
  cityLockedLabel: { marginTop: 3, color: '#888B8E', fontFamily: FONTS.bold, fontSize: 8, letterSpacing: 0.5, fontWeight: '700' },
  cityProgressRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cityStageRail: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  cityStageLine: { flex: 1, height: 1.5, backgroundColor: '#B9B9B4' },
  cityStageLineDone: { backgroundColor: '#C79530' },
  cityStageDot: { width: 25, height: 25, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1.4, borderColor: '#C9A154', backgroundColor: '#FAF9F4' },
  cityStageDotDone: { borderColor: '#E1B550', backgroundColor: '#1D5A91' },
  cityStageDotActive: { borderWidth: 2.4, borderColor: '#EBC04E', backgroundColor: '#39A9E6', shadowColor: '#36B9F1', shadowOpacity: 0.8, shadowRadius: 6, elevation: 4 },
  cityStageDotText: { color: '#FFFFFF', fontFamily: FONTS.bold, fontSize: 12, lineHeight: 14, fontWeight: '700' },
  cityCompass: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1.6, borderColor: '#5F7188', backgroundColor: '#FBFAF5' },
  cityCompassActive: { borderColor: '#D39B2C', backgroundColor: '#FFF3C7' },
  cityCompassText: { color: '#244C76', fontFamily: FONTS.extraBold, fontSize: 22, fontWeight: '800' },
  worldHeader: { height: 292, alignItems: 'center', paddingHorizontal: 14 },
  worldHeaderCompact: { height: 244 },
  worldTopBar: { width: '100%', maxWidth: 512, height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 9 },
  worldStats: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  topStatPill: { flex: 1, maxWidth: 132, height: 46, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 23, borderWidth: 1.7, borderColor: '#EAC563', backgroundColor: 'rgba(22,64,106,0.94)', shadowColor: '#62400F', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 },
  topStatIcon: { width: 29, color: '#F9C547', fontFamily: FONTS.extraBold, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  topStatCopy: { flex: 1, minWidth: 0 },
  topStatLabel: { color: '#EACB82', fontFamily: FONTS.bold, fontSize: 6.5, lineHeight: 8, letterSpacing: 0.6, fontWeight: '700' },
  topStatValue: { color: '#FFFFFF', fontFamily: FONTS.extraBold, fontSize: 13, lineHeight: 17, fontWeight: '800' },
  topStatPlus: { width: 23, height: 23, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1.6, borderColor: '#EFC862', backgroundColor: '#174676' },
  topStatPlusText: { marginTop: -2, color: '#FFF5C9', fontFamily: FONTS.extraBold, fontSize: 20, lineHeight: 21, fontWeight: '800' },
  worldSettings: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, borderWidth: 2, borderColor: '#E8C15A', backgroundColor: '#245A90', shadowColor: '#62400F', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 },
  worldSettingsText: { color: '#FFF3C2', fontSize: 26, lineHeight: 29 },
  worldLogo: { width: 252, aspectRatio: 2.04, marginTop: 7 },
  worldLogoCompact: { width: 194, marginTop: 0 },
  worldTitleRow: { width: '100%', maxWidth: 470, marginTop: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  worldTitleLine: { flex: 1, maxWidth: 58, height: 1.3, alignItems: 'flex-end', justifyContent: 'center', backgroundColor: '#D39B2B' },
  worldTitleDiamond: { width: 8, height: 8, marginRight: -4, borderWidth: 1.2, borderColor: '#D39B2B', backgroundColor: '#B7E9FA', transform: [{ rotate: '45deg' }] },
  worldTitle: { color: '#173F72', fontFamily: FONTS.extraBold, fontSize: 28, letterSpacing: 1.1, fontWeight: '800', textAlign: 'center', textShadowColor: 'rgba(255,255,255,0.72)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  worldTitleCompact: { fontSize: 22 },
  worldDiscovery: { marginTop: 3, color: '#32648C', fontFamily: FONTS.bold, fontSize: 9, letterSpacing: 0.4, fontWeight: '700' },
  worldList: { width: '100%', maxWidth: 512, alignSelf: 'center', paddingHorizontal: 14, paddingTop: 5 },
  worldRouteCard: { minHeight: 148, marginBottom: 10, padding: 11, flexDirection: 'row', alignItems: 'center', borderRadius: 25, borderWidth: 1.7, borderColor: '#D6B25B', backgroundColor: 'rgba(255,253,249,0.96)', shadowColor: '#2D6178', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.24, shadowRadius: 8, elevation: 6 },
  worldRouteCardActive: { borderWidth: 2.4, borderColor: '#F0C54E', shadowColor: '#EAB738', shadowOpacity: 0.58, shadowRadius: 11, elevation: 9 },
  worldRouteCardLocked: { borderColor: '#C7C7C2', backgroundColor: 'rgba(248,248,246,0.94)' },
  worldRouteImageFrame: { width: 110, height: 110, borderRadius: 55, borderWidth: 2.2, borderColor: '#C28B2C', backgroundColor: '#CFE8F0', shadowColor: '#73511B', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.24, shadowRadius: 4, elevation: 4 },
  worldRouteImage: { borderRadius: 55 },
  worldRouteImageShade: { ...StyleSheet.absoluteFill, borderRadius: 55, backgroundColor: 'rgba(230,231,229,0.56)' },
  worldRouteNumber: { position: 'absolute', top: -10, left: -7, width: 37, height: 37, alignItems: 'center', justifyContent: 'center', borderRadius: 19, borderWidth: 2, borderColor: '#E5BA54', backgroundColor: '#1D5387', shadowColor: '#5B3B0C', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.24, shadowRadius: 3, elevation: 4 },
  worldRouteNumberText: { color: '#FFFFFF', fontFamily: FONTS.extraBold, fontSize: 17, fontWeight: '800' },
  worldRouteContent: { flex: 1, minWidth: 0, alignSelf: 'stretch', justifyContent: 'center', paddingLeft: 14 },
  worldRouteTitleRow: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  worldRouteName: { flex: 1, color: '#173F72', fontFamily: FONTS.extraBold, fontSize: 18, fontWeight: '800' },
  worldRouteCount: { color: '#1D5790', fontFamily: FONTS.extraBold, fontSize: 16, fontWeight: '800' },
  worldRouteCaption: { color: '#5E6267', fontFamily: FONTS.medium, fontSize: 9.5, lineHeight: 14 },
  worldRouteTextLocked: { color: '#777B7F' },
  worldLockBadge: { minWidth: 48, alignItems: 'center' },
  worldLockIcon: { color: '#8A8C8E', fontSize: 22, lineHeight: 24 },
  worldLockText: { marginTop: 1, color: '#77797A', fontFamily: FONTS.bold, fontSize: 8, fontWeight: '700' },
  worldRouteFooter: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  worldStageRail: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  worldStageLine: { flex: 1, height: 1.5, backgroundColor: '#ADB2B7' },
  worldStageLineDone: { backgroundColor: '#C99932' },
  worldStageDot: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1.3, borderColor: '#B4B8BC', backgroundColor: '#F1F2F2' },
  worldStageDotDone: { borderColor: '#D0A13B', backgroundColor: '#1E5B91' },
  worldStageDotActive: { borderWidth: 2.5, borderColor: '#EAC151', backgroundColor: '#38A7E5', shadowColor: '#31B7F3', shadowOpacity: 0.85, shadowRadius: 6, elevation: 4 },
  worldStageDotText: { color: '#FFFFFF', fontFamily: FONTS.bold, fontSize: 9, lineHeight: 11, fontWeight: '700' },
  worldContinueButton: { minWidth: 78, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, borderWidth: 1, borderColor: '#C8891B', shadowColor: '#A46B0E', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  worldContinueText: { color: '#71430B', fontFamily: FONTS.extraBold, fontSize: 10, fontWeight: '800' },
  routeCountryList: { width: '100%', maxWidth: 512, alignSelf: 'center', paddingHorizontal: 14 },
  routeSummary: { minHeight: 94, marginBottom: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 24, borderWidth: 1.8, borderColor: '#D6AD51', backgroundColor: 'rgba(255,253,249,0.96)', shadowColor: '#2D6178', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.24, shadowRadius: 8, elevation: 6 },
  routeSummaryEyebrow: { color: '#B17820', fontFamily: FONTS.bold, fontSize: 8, letterSpacing: 1.2, fontWeight: '700' },
  routeSummaryTitle: { marginTop: 3, color: '#173F72', fontFamily: FONTS.extraBold, fontSize: 21, fontWeight: '800', textAlign: 'center' },
  routeSummaryCaption: { marginTop: 3, color: '#66737D', fontFamily: FONTS.semibold, fontSize: 9.5, fontWeight: '600' },
  routeCountryCard: { minHeight: 146, marginBottom: 11, padding: 11, flexDirection: 'row', alignItems: 'center', borderRadius: 25, borderWidth: 1.7, borderColor: '#D6B25B', backgroundColor: 'rgba(255,253,249,0.96)', shadowColor: '#2D6178', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.24, shadowRadius: 8, elevation: 6 },
  routeCountryCardActive: { borderWidth: 2.4, borderColor: '#F0C54E', shadowColor: '#EAB738', shadowOpacity: 0.58, shadowRadius: 11, elevation: 9 },
  routeCountryCardLocked: { borderColor: '#C7C7C2', backgroundColor: 'rgba(248,248,246,0.94)' },
  routeCountryImageFrame: { width: 108, height: 108, borderRadius: 54, borderWidth: 2.2, borderColor: '#C28B2C', backgroundColor: '#CFE8F0', shadowColor: '#73511B', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.24, shadowRadius: 4, elevation: 4 },
  routeCountryImage: { borderRadius: 54 },
  routeCountryImageShade: { ...StyleSheet.absoluteFill, borderRadius: 54, backgroundColor: 'rgba(230,231,229,0.58)' },
  routeCountryNumber: { position: 'absolute', top: -9, left: -6, width: 35, height: 35, alignItems: 'center', justifyContent: 'center', borderRadius: 18, borderWidth: 2, borderColor: '#E5BA54', backgroundColor: '#1D5387' },
  routeCountryNumberText: { color: '#FFFFFF', fontFamily: FONTS.extraBold, fontSize: 16, fontWeight: '800' },
  routeCountryContent: { flex: 1, minWidth: 0, alignSelf: 'stretch', justifyContent: 'center', paddingLeft: 14 },
  routeCountryTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  routeCountryName: { flex: 1, color: '#173F72', fontFamily: FONTS.extraBold, fontSize: 18, fontWeight: '800' },
  routeCountryCount: { color: '#1D5790', fontFamily: FONTS.extraBold, fontSize: 15, fontWeight: '800' },
  routeCountryCaption: { marginTop: 3, color: '#66737D', fontFamily: FONTS.medium, fontSize: 9.5 },
  routeCountryTextLocked: { color: '#7B7E80' },
  routeCountryContinue: { position: 'absolute', right: 0, bottom: 0, minWidth: 74, height: 29, alignItems: 'center', justifyContent: 'center', borderRadius: 15, borderWidth: 1, borderColor: '#C8891B' },
  routeCountryContinueText: { color: '#71430B', fontFamily: FONTS.extraBold, fontSize: 9, fontWeight: '800' },
  worldBottomBar: { position: 'absolute', left: 10, right: 10, bottom: 0, minHeight: 91, paddingTop: 9, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-around', borderTopLeftRadius: 34, borderTopRightRadius: 34, borderWidth: 1.5, borderBottomWidth: 0, borderColor: '#E4BD59', shadowColor: '#143350', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 12 },
  worldNavAction: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  worldNavIcon: { color: '#D9E1EB', fontFamily: FONTS.extraBold, fontSize: 29, lineHeight: 34, fontWeight: '800' },
  worldNavIconActive: { color: '#F5C64F', textShadowColor: '#FFE9A1', textShadowRadius: 5 },
  worldNavLabel: { marginTop: 3, color: '#9CADC1', fontFamily: FONTS.extraBold, fontSize: 9, letterSpacing: 0.4, fontWeight: '800', textAlign: 'center' },
  worldNavLabelActive: { color: '#F7D56D' },
  screen: { flex: 1 },
  mapCanvas: { maxWidth: 512, alignSelf: 'center' },
  hero: { width: '100%', overflow: 'hidden', backgroundColor: '#253245' },
  heroControls: {
    position: 'absolute', left: 14, right: 14, zIndex: 4,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  heroControlGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroPassport: {
    minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 12, borderRadius: 22, borderWidth: 1,
    borderColor: 'rgba(244,211,123,0.62)', backgroundColor: 'rgba(35,42,49,0.84)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.32,
    shadowRadius: 6, elevation: 5,
  },
  heroControlText: { color: '#FFF', fontFamily: FONTS.bold, fontSize: 12, fontWeight: '700' },
  heroCount: { minWidth: 38, paddingHorizontal: 6, paddingVertical: 3, alignItems: 'center', borderRadius: 12, backgroundColor: '#F4D37B' },
  heroCountText: { color: '#2D394B', fontFamily: FONTS.extraBold, fontSize: 9, fontWeight: '800' },
  heroRoundControl: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.34)', backgroundColor: 'rgba(35,42,49,0.84)',
  },
  heroSettingsText: { color: '#FFFFFF', fontSize: 24, lineHeight: 27 },
  backText: { color: '#FFF', fontFamily: FONTS.bold, fontSize: 34, lineHeight: 36, marginTop: -3 },
  heroCopy: { position: 'absolute', left: 22, right: 22, bottom: 30, alignItems: 'center' },
  heroEyebrow: { color: '#F4D37B', fontFamily: FONTS.extraBold, fontSize: 11, letterSpacing: 1.2, fontWeight: '800', textAlign: 'center' },
  heroTitle: { marginTop: 6, color: '#FFF', fontFamily: FONTS.extraBold, fontSize: 29, lineHeight: 35, fontWeight: '800', textAlign: 'center' },
  heroSubtitle: { marginTop: 6, maxWidth: 390, color: '#E5E7EB', fontFamily: FONTS.medium, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  continueCard: {
    zIndex: 6, marginTop: -16, marginHorizontal: 16, padding: 13, borderRadius: 18,
    borderWidth: 1, borderColor: '#E6D6B7', backgroundColor: '#FFFCF7',
    shadowColor: '#2B2118', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2,
    shadowRadius: 12, elevation: 8,
  },
  continueRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center' },
  continueIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#293649' },
  continueIconText: { color: '#F5D77F', fontSize: 19 },
  continueCopy: { flex: 1, minWidth: 0, paddingHorizontal: 10 },
  continueTitle: { color: '#293649', fontFamily: FONTS.extraBold, fontSize: 13, fontWeight: '800' },
  continueSubtitle: { marginTop: 3, color: '#7E7264', fontFamily: FONTS.semibold, fontSize: 10.5, fontWeight: '600' },
  continueArrow: { width: 31, height: 31, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#E9B844' },
  continueArrowText: { color: '#243145', fontFamily: FONTS.bold, fontSize: 27, lineHeight: 28, marginTop: -3 },
  continueFooter: { marginTop: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  overallProgress: { color: '#8A7761', fontFamily: FONTS.semibold, fontSize: 9.5, fontWeight: '600' },
  bonusProgress: { color: '#A27416', fontFamily: FONTS.bold, fontSize: 9.5, fontWeight: '700' },
  headingRow: { marginTop: 24, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headingCopy: { flex: 1, paddingRight: 12 },
  heading: { color: '#334155', fontFamily: FONTS.extraBold, fontSize: 14, letterSpacing: 1.2, fontWeight: '800' },
  headingCaption: { marginTop: 3, color: '#8B7A68', fontFamily: FONTS.medium, fontSize: 10.5 },
  compass: { fontSize: 28 },
  list: { paddingTop: 14, paddingBottom: 10 },
  routeCard: {
    height: 158, marginBottom: 14, borderRadius: 22, overflow: 'hidden',
    backgroundColor: '#283648', shadowColor: '#291E14', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24, shadowRadius: 9, elevation: 6,
  },
  countryCard: {
    height: 198, marginBottom: 0, borderRadius: 22, overflow: 'hidden',
    backgroundColor: '#283648', shadowColor: '#291E14', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24, shadowRadius: 9, elevation: 6,
  },
  cardLeft: { marginLeft: 24, marginRight: 54 },
  cardRight: { marginLeft: 54, marginRight: 24 },
  cardGlow: { shadowColor: '#D9A830', shadowOpacity: 0.55, shadowRadius: 13, elevation: 10 },
  cardContent: { flex: 1, padding: 13 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  numberChip: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12, backgroundColor: 'rgba(20,28,39,0.82)' },
  numberChipText: { color: '#FFF', fontFamily: FONTS.bold, fontSize: 9, letterSpacing: 0.4, fontWeight: '700' },
  stateChip: { maxWidth: 132, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 11, borderWidth: 1 },
  stateLocked: { borderColor: 'rgba(148,163,184,0.48)', backgroundColor: 'rgba(51,65,85,0.88)' },
  stateComplete: { borderColor: 'rgba(253,224,71,0.76)', backgroundColor: 'rgba(113,63,18,0.88)' },
  stateActive: { borderColor: 'rgba(110,231,183,0.82)', backgroundColor: 'rgba(6,78,59,0.9)' },
  stateAvailable: { borderColor: 'rgba(147,197,253,0.72)', backgroundColor: 'rgba(30,64,175,0.78)' },
  stateText: { color: '#FFF', fontFamily: FONTS.extraBold, fontSize: 8, fontWeight: '800' },
  cardSpacer: { flex: 1 },
  routeName: { color: '#FFF', fontFamily: FONTS.extraBold, fontSize: 20, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  countryName: { color: '#FFF', fontFamily: FONTS.extraBold, fontSize: 23, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  countryLocations: { marginTop: 5, flexDirection: 'row', gap: 4 },
  countryLocationChip: {
    minHeight: 31, flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4, paddingVertical: 3, borderRadius: 9,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(20,28,39,0.64)',
  },
  countryLocationText: {
    color: '#F8FAFC', fontFamily: FONTS.semibold, fontSize: 8.5, lineHeight: 10.5,
    fontWeight: '600', textAlign: 'center',
  },
  cardCaption: { marginTop: 2, color: '#E8EDF3', fontFamily: FONTS.semibold, fontSize: 9.5, fontWeight: '600' },
  cardFooterText: { marginTop: 5, color: '#E8EDF3', fontFamily: FONTS.semibold, fontSize: 9.2, fontWeight: '600' },
  progressTrack: { height: 5, marginTop: 8, overflow: 'hidden', borderRadius: 3, backgroundColor: 'rgba(15,23,42,0.28)' },
  progressFill: { height: '100%', borderRadius: 3 },
  stageRail: { height: 26, marginTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  stageCircle: { width: 23, height: 23, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1.5 },
  stageDone: { borderColor: '#F9D96F', backgroundColor: '#B47B12' },
  stageActive: { borderColor: '#A7F3D0', backgroundColor: '#087A59' },
  stageLocked: { borderColor: '#6B7280', backgroundColor: '#374151' },
  stageText: { color: '#D1D5DB', fontFamily: FONTS.extraBold, fontSize: 9, fontWeight: '800' },
  stageActiveText: { color: '#FFF' },
  stageConnector: { width: 22, height: 2, backgroundColor: '#64748B' },
  stageConnectorDone: { backgroundColor: '#D9AF46' },
  transport: { height: 56, alignItems: 'center', justifyContent: 'center' },
  transportLine: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: 'rgba(174,135,51,0.48)' },
  transportChip: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, height: 26, borderRadius: 13, borderWidth: 1, borderColor: '#DBC48F', backgroundColor: '#FFF9ED' },
  transportLabel: { color: '#4A4033', fontFamily: FONTS.bold, fontSize: 9.5, fontWeight: '700' },
  transportSeparator: { width: 1, height: 11, backgroundColor: '#D6C6A9' },
  transportDistance: { color: '#8A7761', fontFamily: FONTS.semibold, fontSize: 8.5, fontWeight: '600' },
  lockedOverlay: { ...StyleSheet.absoluteFill, zIndex: 1, backgroundColor: 'rgba(30,38,48,0.56)' },
  cardBorder: { ...StyleSheet.absoluteFill, zIndex: 5, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  activeBorder: { borderWidth: 2, borderColor: '#E7BB4E' },
  notice: { position: 'absolute', left: 24, right: 24, zIndex: 30, alignItems: 'center' },
  noticeText: { overflow: 'hidden', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 18, color: '#FFF8E7', backgroundColor: 'rgba(35,43,55,0.96)', fontFamily: FONTS.bold, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
});
