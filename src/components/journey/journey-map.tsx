import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FONTS } from '@/constants/fonts';
import type { LevelData } from '@/game/levels';
import {
  COUNTRY_BY_ID,
  ROUTE_BY_ID,
  TOTAL_DESTINATIONS,
  TOTAL_WORLD_LEVELS,
  TRAVEL_ROUTES,
  WORLD_COUNTRIES,
  getCompletedCountryCount,
  getCompletedWorldLevelCount,
  getCountryProgress,
  getLocationProgress,
  getRouteProgress,
  isCountryComplete,
  isCountryUnlocked,
  isLocationUnlocked,
  isRouteComplete,
  isRouteUnlocked,
  routeCountries,
  routeLeg,
  type TravelCountry,
  type TravelRoute,
} from '@/game/travel';

const HERO_HEIGHT = 268;
const WORLD_MAP_IMAGE = require('../../../assets/images/world-tour-map.png');
type MapLayer = 'world' | 'route';

type JourneyMapProps = {
  level: number;
  levelData: LevelData;
  bonusCount: number;
  gemCount: number;
  onBack: () => void;
  onContinue: () => void;
  onOpenPassport: () => void;
  onOpenSettings: () => void;
};

function percent(value: number, total: number) {
  return `${Math.max(0, Math.min(100, total > 0 ? (value / total) * 100 : 0))}%` as `${number}%`;
}

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

function StateChip({
  active,
  complete,
  label,
  unlocked,
}: {
  active: boolean;
  complete: boolean;
  label: string;
  unlocked: boolean;
}) {
  return (
    <View
      style={[
        styles.stateChip,
        !unlocked
          ? styles.stateLocked
          : complete
            ? styles.stateComplete
            : active
              ? styles.stateActive
              : styles.stateAvailable,
      ]}>
      <Text style={styles.stateText}>{!unlocked ? '🔒 KİLİTLİ' : complete ? '✓ TAMAMLANDI' : label}</Text>
    </View>
  );
}

function ProgressBar({ progress, total }: { progress: number; total: number }) {
  return (
    <View style={styles.progressTrack}>
      <LinearGradient
        colors={['#DCA83A', '#FFE394']}
        end={{ x: 1, y: 0 }}
        start={{ x: 0, y: 0 }}
        style={[styles.progressFill, { width: percent(progress, total) }]}
      />
    </View>
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
  const progress = getRouteProgress(level, route);
  const unlocked = isRouteUnlocked(level, route);
  const complete = isRouteComplete(level, route);

  return (
    <Entrance delay={index * 42}>
      <Pressable
        accessibilityLabel={`${route.name}, ${progress}/${route.countryIds.length} ülke`}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.routeCard,
          index % 2 === 0 ? styles.cardLeft : styles.cardRight,
          active && styles.cardGlow,
          pressed && styles.pressed,
        ]}>
        <Image
          cachePolicy="memory-disk"
          contentFit="cover"
          source={{ uri: route.background }}
          style={StyleSheet.absoluteFill}
          transition={420}
        />
        <LinearGradient
          colors={['rgba(11,18,26,0.10)', 'rgba(19,27,38,0.94)']}
          locations={[0.08, 1]}
          style={StyleSheet.absoluteFill}
        />
        {!unlocked ? <View style={styles.lockedOverlay} /> : null}
        <View style={styles.cardContent}>
          <View style={styles.cardTopRow}>
            <View style={styles.numberChip}>
              <Text style={styles.numberChipText}>ROTA {String(route.order).padStart(2, '0')}</Text>
            </View>
            <StateChip
              active={active}
              complete={complete}
              label={active ? 'MEVCUT ROTA' : 'AÇIK'}
              unlocked={unlocked}
            />
          </View>
          <View style={styles.cardSpacer} />
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={styles.routeName}>
            {route.emoji} {route.name}
          </Text>
          <Text numberOfLines={1} style={styles.cardCaption}>
            {route.countryIds.length} ülke • Zorluk {route.difficulty}/14
          </Text>
          <ProgressBar progress={progress} total={route.countryIds.length} />
          <Text numberOfLines={1} style={styles.cardFooterText}>
            {progress}/{route.countryIds.length} ülke • {route.theme}
          </Text>
        </View>
        <View style={[styles.cardBorder, active && styles.activeBorder]} />
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
        accessibilityLabel={`${country.country}, ${country.locations
          .map((location) => location.name)
          .join(', ')}, ${progress}/${country.levelCount}`}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.countryCard,
          index % 2 === 0 ? styles.cardLeft : styles.cardRight,
          active && styles.cardGlow,
          pressed && styles.pressed,
        ]}>
        <Image
          cachePolicy="memory-disk"
          contentFit="cover"
          source={{ uri: country.background }}
          style={StyleSheet.absoluteFill}
          transition={420}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.03)', 'rgba(18,26,36,0.96)']}
          locations={[0.1, 1]}
          style={StyleSheet.absoluteFill}
        />
        {!unlocked ? <View style={styles.lockedOverlay} /> : null}
        <View style={styles.cardContent}>
          <View style={styles.cardTopRow}>
            <View style={styles.numberChip}>
              <Text style={styles.numberChipText}>
                {String(country.worldIndex + 1).padStart(2, '0')}. ÜLKE {country.flag}
              </Text>
            </View>
            <StateChip
              active={active}
              complete={complete}
              label={active ? '▶ DEVAM ET' : `${progress}/20`}
              unlocked={unlocked}
            />
          </View>
          <View style={styles.cardSpacer} />
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={styles.countryName}>
            {country.country}
          </Text>
          <View accessibilityLabel={`${country.country} şehirleri`} style={styles.countryLocations}>
            {country.locations.map((location) => (
              <View key={location.id} style={styles.countryLocationChip}>
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                  numberOfLines={2}
                  style={styles.countryLocationText}>
                  {location.emoji} {location.name}
                </Text>
              </View>
            ))}
          </View>
          <ProgressBar progress={progress} total={country.levelCount} />
          <DestinationRail country={country} level={level} />
        </View>
        <View style={[styles.cardBorder, active && styles.activeBorder]} />
      </Pressable>
    </Entrance>
  );
}

function TravelConnector({
  active,
  index,
  route,
}: {
  active: boolean;
  index: number;
  route: TravelRoute;
}) {
  const leg = routeLeg(route, index);
  const [arrival] = useState(() => new Animated.Value(active ? 0 : 1));

  useEffect(() => {
    if (!active) return;
    const animation = Animated.timing(arrival, {
      toValue: 1,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [active, arrival]);

  return (
    <View style={[styles.transport, { transform: [{ translateX: index % 2 === 0 ? 38 : -38 }] }]}>
      <View style={styles.transportLine} />
      <Animated.View
        style={[
          styles.transportChip,
          active && {
            opacity: arrival,
            transform: [
              { translateY: arrival.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }) },
            ],
          },
        ]}>
        <Text style={styles.transportLabel}>{leg.label}</Text>
        <View style={styles.transportSeparator} />
        <Text style={styles.transportDistance}>{leg.distance}</Text>
      </Animated.View>
    </View>
  );
}

export function JourneyMap({
  level,
  levelData,
  bonusCount,
  gemCount,
  onBack,
  onContinue,
  onOpenPassport,
  onOpenSettings,
}: JourneyMapProps) {
  const { width } = useWindowDimensions();
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
  const completedCountries = getCompletedCountryCount(level);
  const completedLevels = getCompletedWorldLevelCount(level);
  const mapWidth = Math.min(width, 512);
  const heroHeight = HERO_HEIGHT + insets.top;

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

  const heroBackground = selectedRoute.background;
  const heroEyebrow =
    layer === 'world'
      ? `🌍 ${completedCountries}/100 ÜLKE KEŞFEDİLDİ`
      : `${selectedRoute.emoji} ROTA ${selectedRoute.order}/14`;
  const heroTitle =
    layer === 'world'
      ? 'Dünya Yolculuğu'
      : selectedRoute.name;
  const heroSubtitle =
    layer === 'world'
      ? 'Sayıları çöz, yeni rotaları aydınlat ve dünyayı keşfet.'
      : selectedRoute.theme;

  const primaryTitle = 'OYUNA DEVAM ET';
  const primarySubtitle = levelData.countryChallenge
    ? `${activeCountry.flag} ${activeCountry.country} • ${levelData.city}`
    : `${activeCountry.flag} ${activeCountry.country} • ${levelData.emoji} ${levelData.city} • ${levelData.locationLevel}/${levelData.locationLevelCount}`;
  const primaryProgress = {
    value: getCountryProgress(level, activeCountry.id),
    total: activeCountry.levelCount,
  };

  return (
    <LinearGradient colors={['#FBF7EE', '#F3E7D3', '#E7D3B4']} style={styles.screen}>
      <ScrollView
        ref={scrollRef}
        bounces={false}
        contentContainerStyle={{ paddingBottom: 28 + insets.bottom }}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}>
        <View style={[styles.mapCanvas, { width: mapWidth }]}>
          <View style={[styles.hero, { height: heroHeight }]}>
            <Image
              cachePolicy="memory-disk"
              contentFit="cover"
              source={layer === 'world' ? WORLD_MAP_IMAGE : { uri: heroBackground }}
              style={StyleSheet.absoluteFill}
              transition={700}
            />
            <LinearGradient
              colors={['rgba(0,0,0,0.04)', 'rgba(25,34,47,0.30)', 'rgba(29,36,49,0.94)']}
              locations={[0, 0.45, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.heroControls, { top: insets.top + 14 }]}>
              <View style={styles.heroControlGroup}>
                <Pressable
                  accessibilityLabel={layer === 'world' ? 'Ana sayfaya dön' : 'Dünya rotalarına dön'}
                  accessibilityRole="button"
                  onPress={goBack}
                  style={({ pressed }) => [styles.heroRoundControl, pressed && styles.pressed]}>
                  <Text style={styles.backText}>‹</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="Seyahat pasaportunu aç"
                  accessibilityRole="button"
                  onPress={onOpenPassport}
                  style={({ pressed }) => [styles.heroPassport, pressed && styles.pressed]}>
                  <Text style={styles.heroControlText}>📘 Pasaport</Text>
                  <View style={styles.heroCount}>
                    <Text style={styles.heroCountText}>{completedCountries}/100</Text>
                  </View>
                </Pressable>
              </View>
              <Pressable
                accessibilityLabel="Oyun ayarlarını aç"
                accessibilityRole="button"
                onPress={onOpenSettings}
                style={({ pressed }) => [styles.heroRoundControl, pressed && styles.pressed]}>
                <Text style={styles.heroSettingsText}>⚙</Text>
              </Pressable>
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>{heroEyebrow}</Text>
              <Text numberOfLines={2} adjustsFontSizeToFit style={styles.heroTitle}>{heroTitle}</Text>
              <Text numberOfLines={2} style={styles.heroSubtitle}>{heroSubtitle}</Text>
            </View>
          </View>

          <Pressable
            accessibilityHint="Rota ve ülke ekranlarını atlayarak mevcut puzzle'ı açar"
            accessibilityLabel={`${primaryTitle}, ${primarySubtitle}`}
            accessibilityRole="button"
            onPress={onContinue}
            style={({ pressed }) => [styles.continueCard, pressed && styles.pressed]}>
            <View style={styles.continueRow}>
              <View style={styles.continueIcon}><Text style={styles.continueIconText}>▶</Text></View>
              <View style={styles.continueCopy}>
                <Text numberOfLines={1} adjustsFontSizeToFit style={styles.continueTitle}>{primaryTitle}</Text>
                <Text numberOfLines={1} style={styles.continueSubtitle}>{primarySubtitle}</Text>
              </View>
              <View style={styles.continueArrow}><Text style={styles.continueArrowText}>›</Text></View>
            </View>
            <ProgressBar progress={primaryProgress.value} total={primaryProgress.total} />
            <View style={styles.continueFooter}>
              <Text style={styles.overallProgress}>
                Ülke {getCountryProgress(level, activeCountry.id)}/{activeCountry.levelCount} • Dünya {completedLevels}/{TOTAL_WORLD_LEVELS}
              </Text>
              <Text style={styles.bonusProgress}>
                💎 {gemCount} Mücevher • ⭐ {bonusCount} Bonus Keşif
              </Text>
            </View>
          </Pressable>

          <View style={styles.headingRow}>
            <View style={styles.headingCopy}>
              <Text style={styles.heading}>
                {layer === 'world' ? 'DÜNYA ROTALARI' : 'ÜLKE ROTASI'}
              </Text>
              <Text style={styles.headingCaption}>
                {layer === 'world'
                  ? `14 rota • 100 ülke • ${TOTAL_DESTINATIONS} destinasyon`
                  : `${selectedRoute.countryIds.length} ülke • ${selectedRoute.countryIds.length * 20} puzzle`}
              </Text>
            </View>
            <Text style={styles.compass}>🧭</Text>
          </View>

          <View style={styles.list}>
            {layer === 'world'
              ? TRAVEL_ROUTES.map((route, index) => (
                  <RouteCard
                    active={route.id === activeRoute.id}
                    index={index}
                    key={route.id}
                    level={level}
                    onPress={() => openRoute(route)}
                    route={route}
                  />
                ))
              : selectedRouteCountries.map((country, index) => (
                  <View key={country.id}>
                    {index > 0 ? (
                      <TravelConnector
                        active={country.id === activeCountry.id}
                        index={index - 1}
                        route={selectedRoute}
                      />
                    ) : null}
                    <CountryCard
                      active={country.id === activeCountry.id}
                      country={country}
                      index={index}
                      level={level}
                      onPress={() => openCountry(country)}
                    />
                  </View>
                ))}
          </View>
        </View>
      </ScrollView>

      {notice ? (
        <View pointerEvents="none" style={[styles.notice, { top: insets.top + 72 }]}>
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
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
