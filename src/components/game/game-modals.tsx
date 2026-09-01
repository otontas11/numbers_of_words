import { BlurView } from 'expo-blur';
import { useEffect, type ReactNode, type RefObject } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { SoundPressable as Pressable } from '@/components/common/sound-pressable';
import { FONTS } from '@/constants/fonts';
import {
  WORLD_COUNTRIES,
  ROUTE_BY_ID,
  getCountryProgress,
  getTravelLevelCompletion,
  isCountryComplete,
  isCountryUnlocked,
  resolveTravelLevel,
} from '@/game/travel';

type BaseModalProps = {
  visible: boolean;
  title: string;
  subtitle: string;
  icon: string;
  children: ReactNode;
  footer?: ReactNode;
  blurTarget: RefObject<View | null>;
  onClose: () => void;
};

function GameModal({
  visible,
  title,
  subtitle,
  icon,
  children,
  footer,
  blurTarget,
  onClose,
}: BaseModalProps) {
  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [onClose, visible]);

  if (!visible) return null;

  return (
    <BlurView
      accessibilityViewIsModal
      blurMethod="dimezisBlurViewSdk31Plus"
      blurReductionFactor={2.2}
      blurTarget={blurTarget}
      intensity={72}
      style={styles.overlay}
      tint="dark">
      <View pointerEvents="none" style={styles.overlayTint} />
      <View style={styles.modalCard}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalIcon}>{icon}</Text>
          <View style={styles.modalHeading}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Text style={styles.modalSubtitle}>{subtitle}</Text>
          </View>
          <Pressable
            accessibilityLabel="Pencereyi kapat"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          bounces={false}
          contentContainerStyle={styles.modalContent}
          showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>

        {footer ? <View style={styles.modalFooter}>{footer}</View> : null}
      </View>
    </BlurView>
  );
}

export function PassportModal({
  visible,
  currentLevel,
  blurTarget,
  onClose,
}: {
  visible: boolean;
  currentLevel: number;
  blurTarget: RefObject<View | null>;
  onClose: () => void;
}) {
  return (
    <GameModal
      blurTarget={blurTarget}
      footer={
        <Text style={styles.footerText}>
          Her ülkenin 3 destinasyonu ve Country Challenge&apos;ı tamamlandığında pasaporta
          vize pulu basılır. Dünya hedefi: 100/100.
        </Text>
      }
      icon="📘"
      onClose={onClose}
      subtitle="Kazanılan Ülke Vize Pulları"
      title="Dünya Seyahat Pasaportu"
      visible={visible}>
      <View style={styles.stampGrid}>
        {WORLD_COUNTRIES.map((country, index) => {
          const complete = isCountryComplete(currentLevel, country.id);
          const available = isCountryUnlocked(currentLevel, country.id);
          const progress = getCountryProgress(currentLevel, country.id);
          if (complete) {
            return (
              <View key={country.country} style={[styles.stamp, styles.stampUnlocked]}>
                <Svg height="100%" pointerEvents="none" style={StyleSheet.absoluteFill} width="100%">
                  <Defs>
                    <RadialGradient id={`stamp-${index}`} r="72%">
                      <Stop offset="0%" stopColor="#FEF3C7" />
                      <Stop offset="100%" stopColor="#F59E0B" />
                    </RadialGradient>
                  </Defs>
                  <Rect
                    fill={`url(#stamp-${index})`}
                    height="100%"
                    rx={24}
                    width="100%"
                  />
                </Svg>
                <Text style={styles.stampEmoji}>{country.flag}</Text>
                <Text style={styles.stampCountry}>{country.country}</Text>
                <Text style={styles.stampStatus}>VİZE ONAYLANDI ✓</Text>
              </View>
            );
          }

          return (
            <View
              key={country.country}
              style={[styles.stamp, available ? styles.stampCurrent : styles.stampLocked]}>
              <Text style={styles.stampEmoji}>{available ? country.flag : '🔒'}</Text>
              <Text style={[styles.stampCountry, !available && styles.lockedText]}>
                {country.country}
              </Text>
              <Text style={[styles.stampStatus, !available && styles.lockedText]}>
                {available
                  ? `${progress}/20 • MEVCUT ÜLKE`
                  : `ROTA ${ROUTE_BY_ID.get(country.primaryRouteId)?.order ?? '—'} • KİLİTLİ`}
              </Text>
            </View>
          );
        })}
      </View>
    </GameModal>
  );
}

export function ChallengeIntroModal({
  visible,
  country,
  flag,
  worldTourFinal,
  blurTarget,
  onClose,
}: {
  visible: boolean;
  country: string;
  flag: string;
  worldTourFinal: boolean;
  blurTarget: RefObject<View | null>;
  onClose: () => void;
}) {
  const title = worldTourFinal ? 'WORLD TOUR FINAL CHALLENGE' : 'COUNTRY CHALLENGE';

  return (
    <GameModal
      blurTarget={blurTarget}
      footer={
        <Pressable
          accessibilityLabel="Oyuna başla"
          accessibilityRole="button"
          onPress={onClose}
          style={({ pressed }) => [styles.challengeStartButton, pressed && styles.pressed]}>
          <Text style={styles.challengeStartText}>BAŞLA</Text>
        </Pressable>
      }
      icon="🏆"
      onClose={onClose}
      subtitle={`${flag} ${country} • SON OYUN`}
      title={title}
      visible={visible}>
      <View style={styles.challengeIntroHero}>
        <Text style={styles.challengeIntroTrophy}>🏆</Text>
      </View>
    </GameModal>
  );
}

export function CountryCompletionModal({
  completedLevel,
  blurTarget,
  onContinue,
}: {
  completedLevel: number | null;
  blurTarget: RefObject<View | null>;
  onContinue: () => void;
}) {
  if (completedLevel === null) return null;

  const destination = resolveTravelLevel(completedLevel);
  const completion = getTravelLevelCompletion(completedLevel);
  const country = destination.country;
  const nextCountry = completion.nextDestination.country;
  const worldTourCompleted = completion.worldTourCompleted;

  return (
    <GameModal
      blurTarget={blurTarget}
      footer={
        <Pressable
          accessibilityLabel={
            worldTourCompleted
              ? 'Master World Tour turuna geç'
              : `${nextCountry.country} ülkesine geç`
          }
          accessibilityRole="button"
          onPress={onContinue}
          style={({ pressed }) => [styles.countryContinueButton, pressed && styles.pressed]}>
          <Text style={styles.countryContinueText}>
            {worldTourCompleted
              ? 'MASTER WORLD TOUR’A GEÇ'
              : `${nextCountry.flag} ${nextCountry.country}’A GEÇ`}
          </Text>
        </Pressable>
      }
      icon={worldTourCompleted ? '🌍' : country.flag}
      onClose={onContinue}
      subtitle={
        worldTourCompleted
          ? '100 / 100 ülke keşfedildi'
          : '20 / 20 puzzle • Pasaport damgası kazanıldı'
      }
      title={worldTourCompleted ? 'WORLD TOUR COMPLETED' : `${country.country} Tamamlandı!`}
      visible>
      <View style={styles.countryCompleteHero}>
        <Text style={styles.countryCompleteFlag}>{country.flag}</Text>
        <Text style={styles.countryCompleteName}>{country.country}</Text>
        <View style={styles.countryCompleteProgress}>
          <Text style={styles.countryCompleteProgressText}>20 / 20 ✓</Text>
        </View>
      </View>

      <View style={styles.completedLocations}>
        {country.locations.map((location) => (
          <View key={location.id} style={styles.completedLocationRow}>
            <Text style={styles.completedLocationIcon}>✓</Text>
            <Text style={styles.completedLocationName}>
              {location.emoji} {location.name}
            </Text>
          </View>
        ))}
        <View style={styles.completedLocationRow}>
          <Text style={styles.completedLocationIcon}>✓</Text>
          <Text style={styles.completedLocationName}>🏆 {country.country} Challenge</Text>
        </View>
      </View>

      <View style={styles.countryRewards}>
        <View style={styles.countryRewardCard}>
          <Text style={styles.countryRewardIcon}>📘</Text>
          <Text style={styles.countryRewardTitle}>Pasaport Damgası</Text>
        </View>
        <View style={styles.countryRewardCard}>
          <Text style={styles.countryRewardIcon}>🗺️</Text>
          <Text numberOfLines={2} style={styles.countryRewardTitle}>
            {country.rewardLandmark}
          </Text>
        </View>
      </View>

      {!worldTourCompleted ? (
        <View style={styles.nextCountryCard}>
          <Text style={styles.nextCountryLabel}>YENİ ÜLKE AÇILDI</Text>
          <Text style={styles.nextCountryName}>
            {country.flag} {country.country}　→　{nextCountry.flag} {nextCountry.country}
          </Text>
          <Text style={styles.nextCountryDestination}>
            İlk durak: {completion.nextDestination.location.emoji}{' '}
            {completion.nextDestination.location.name}
          </Text>
        </View>
      ) : (
        <View style={styles.nextCountryCard}>
          <Text style={styles.nextCountryLabel}>ÖZEL ÖDÜLLER</Text>
          <Text style={styles.nextCountryName}>Golden Compass • World Explorer</Text>
          <Text style={styles.nextCountryDestination}>Dünya haritasının tamamı aydınlandı.</Text>
        </View>
      )}
    </GameModal>
  );
}

const ANALYSIS_CARDS = [
  {
    icon: '🎯',
    title: 'Keşif Odaklı Tasarım (WOW Ruhu)',
    body: 'Sınav hissi yaratan formüller ("12 + 7 = ?") yerine, oyuncunun önüne hedefler konur ve çemberdeki sayıları parmağıyla bağlayarak ilişkileri kendisinin keşfetmesi sağlanır.',
    background: 'rgba(30,64,175,0.22)',
    border: 'rgba(59,130,246,0.42)',
    titleColor: '#93C5FD',
  },
  {
    icon: '🌍',
    title: 'Seyahat & Koleksiyon Motivasyonu',
    body: 'Oyuncu 14 tematik rotada 100 ülkeyi gezer. Her ülkede 3 destinasyon ve bir Country Challenge bulunur; ülke tamamlanınca pasaporta vize pulu basılır.',
    background: 'rgba(120,53,15,0.28)',
    border: 'rgba(245,158,11,0.42)',
    titleColor: '#FCD34D',
  },
  {
    icon: '⭐',
    title: 'Bonus Kombinasyonlar',
    body: 'Panoda aktif istenmeyen ancak matematiksel olarak doğru olan sayı bağlantıları "Bonus Keşif" kabul edilerek kavanozu doldurur.',
    background: 'rgba(6,78,59,0.28)',
    border: 'rgba(16,185,129,0.42)',
    titleColor: '#6EE7B7',
  },
] as const;

export function AnalysisModal({
  visible,
  blurTarget,
  onClose,
}: {
  visible: boolean;
  blurTarget: RefObject<View | null>;
  onClose: () => void;
}) {
  return (
    <GameModal
      blurTarget={blurTarget}
      footer={
        <Pressable
          accessibilityLabel="Oyuna dön"
          accessibilityRole="button"
          onPress={onClose}
          style={({ pressed }) => [styles.returnButton, pressed && styles.pressed]}>
          <Text style={styles.returnButtonText}>Oyuna Dön</Text>
        </Pressable>
      }
      icon="📊"
      onClose={onClose}
      subtitle="Psikolojik & Oyunsal Tasarım Prensipleri"
      title="Oyun Tasarım & WOW Analizi"
      visible={visible}>
      <View style={styles.analysisList}>
        {ANALYSIS_CARDS.map((card) => (
          <View
            key={card.title}
            style={[
              styles.analysisCard,
              { backgroundColor: card.background, borderColor: card.border },
            ]}>
            <Text style={[styles.analysisTitle, { color: card.titleColor }]}>
              {card.icon} {card.title}
            </Text>
            <Text style={styles.analysisBody}>{card.body}</Text>
          </View>
        ))}
      </View>
    </GameModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  overlayTint: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(2,6,23,0.68)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 448,
    maxHeight: '85%',
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0F172A',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.65,
    shadowRadius: 26,
    elevation: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: 'rgba(2,6,23,0.72)',
  },
  modalIcon: {
    fontSize: 26,
    marginRight: 10,
  },
  modalHeading: {
    flex: 1,
  },
  modalTitle: {
    color: '#F8FAFC',
    fontFamily: FONTS.black,
    fontSize: 16,
    fontWeight: '900',
  },
  modalSubtitle: {
    color: '#94A3B8',
    fontFamily: FONTS.regular,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#1E293B',
  },
  closeText: {
    color: '#CBD5E1',
    fontFamily: FONTS.extraBold,
    fontSize: 15,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
  modalContent: {
    padding: 24,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    backgroundColor: 'rgba(2,6,23,0.7)',
  },
  footerText: {
    color: '#94A3B8',
    fontFamily: FONTS.semibold,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '600',
  },
  challengeIntroHero: {
    minHeight: 150,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#F4D37B',
    backgroundColor: '#2D394B',
  },
  challengeIntroTrophy: {
    fontSize: 58,
  },
  challengeStartButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FFF1B9',
    backgroundColor: '#D9A62E',
  },
  challengeStartText: {
    color: '#2E261F',
    fontFamily: FONTS.black,
    fontSize: 12,
    fontWeight: '900',
  },
  countryCompleteHero: {
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#D9AE45',
    backgroundColor: '#FFF8E7',
  },
  countryCompleteFlag: {
    fontSize: 46,
  },
  countryCompleteName: {
    marginTop: 4,
    color: '#49382E',
    fontFamily: FONTS.black,
    fontSize: 20,
    fontWeight: '900',
  },
  countryCompleteProgress: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#2E8B68',
  },
  countryCompleteProgressText: {
    color: '#FFFFFF',
    fontFamily: FONTS.black,
    fontSize: 12,
    fontWeight: '900',
  },
  completedLocations: {
    marginTop: 14,
    gap: 7,
  },
  completedLocationRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(94,211,168,0.35)',
    backgroundColor: 'rgba(26,89,68,0.24)',
  },
  completedLocationIcon: {
    width: 24,
    color: '#6EE7B7',
    fontFamily: FONTS.black,
    fontSize: 15,
    fontWeight: '900',
  },
  completedLocationName: {
    flex: 1,
    color: '#E6F8F0',
    fontFamily: FONTS.bold,
    fontSize: 12,
    fontWeight: '700',
  },
  countryRewards: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  countryRewardCard: {
    minHeight: 78,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 9,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(245,190,73,0.46)',
    backgroundColor: 'rgba(120,74,18,0.25)',
  },
  countryRewardIcon: {
    fontSize: 24,
  },
  countryRewardTitle: {
    marginTop: 4,
    color: '#FFE5A4',
    fontFamily: FONTS.extraBold,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  nextCountryCard: {
    marginTop: 14,
    alignItems: 'center',
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4B7887',
    backgroundColor: 'rgba(47,91,105,0.35)',
  },
  nextCountryLabel: {
    color: '#9FE2EA',
    fontFamily: FONTS.black,
    fontSize: 9,
    letterSpacing: 1.1,
    fontWeight: '900',
  },
  nextCountryName: {
    marginTop: 5,
    color: '#FFFFFF',
    fontFamily: FONTS.black,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  nextCountryDestination: {
    marginTop: 4,
    color: '#B9CED4',
    fontFamily: FONTS.semibold,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  countryContinueButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FFF1B9',
    backgroundColor: '#D9A62E',
  },
  countryContinueText: {
    color: '#2E261F',
    fontFamily: FONTS.black,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  stampGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 16,
  },
  stamp: {
    width: '47.5%',
    minHeight: 128,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    padding: 12,
  },
  stampUnlocked: {
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: '#B45309',
    transform: [{ rotate: '-2deg' }],
  },
  stampLocked: {
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#020617',
    opacity: 0.58,
  },
  stampCurrent: {
    borderWidth: 2,
    borderColor: '#D9AE45',
    backgroundColor: '#FFF8E7',
  },
  stampEmoji: {
    fontSize: 32,
  },
  stampCountry: {
    color: '#451A03',
    fontFamily: FONTS.black,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 7,
  },
  stampStatus: {
    color: '#78350F',
    fontFamily: FONTS.bold,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 3,
    textAlign: 'center',
  },
  lockedText: {
    color: '#64748B',
  },
  analysisList: {
    gap: 14,
  },
  analysisCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  analysisTitle: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 6,
  },
  analysisBody: {
    color: '#CBD5E1',
    fontFamily: FONTS.regular,
    fontSize: 12,
    lineHeight: 19,
    fontWeight: '500',
  },
  returnButton: {
    alignSelf: 'flex-end',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 11,
    backgroundColor: '#F59E0B',
  },
  returnButtonText: {
    color: '#0F172A',
    fontFamily: FONTS.black,
    fontWeight: '900',
    fontSize: 12,
  },
});
