import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, type ReactNode, type RefObject } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { SoundPressable as Pressable } from '@/components/common/sound-pressable';
import { FONTS } from '@/constants/fonts';
import { localizeCountry, useI18n } from '@/i18n';
import {
  PASSPORT_COUNTRIES,
  TOTAL_COUNTRIES,
  TOTAL_ROUTES,
  getTravelLevelCompletion,
  isPassportEarned,
  resolveTravelLevel,
} from '@/game/travel';

type BaseModalProps = {
  visible: boolean;
  title: string;
  subtitle: string;
  icon: string;
  children: ReactNode;
  footer?: ReactNode;
  appearance?: 'dark' | 'journey';
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
  appearance = 'dark',
  blurTarget,
  onClose,
}: BaseModalProps) {
  const { t } = useI18n();
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
      intensity={appearance === 'journey' ? 18 : 72}
      style={styles.overlay}
      tint={appearance === 'journey' ? 'light' : 'dark'}>
      {appearance === 'journey' ? (
        <LinearGradient
          colors={[
            'rgba(188,234,247,0.96)',
            'rgba(143,207,211,0.94)',
            'rgba(240,217,173,0.96)',
          ]}
          locations={[0, 0.68, 1]}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View pointerEvents="none" style={styles.overlayTint} />
      )}
      <View style={[styles.modalCard, appearance === 'journey' && styles.journeyModalCard]}>
        <View style={[styles.modalHeader, appearance === 'journey' && styles.journeyModalHeader]}>
          <Text style={styles.modalIcon}>{icon}</Text>
          <View style={styles.modalHeading}>
            <Text style={[styles.modalTitle, appearance === 'journey' && styles.journeyModalTitle]}>
              {title}
            </Text>
            <Text
              style={[styles.modalSubtitle, appearance === 'journey' && styles.journeyModalSubtitle]}>
              {subtitle}
            </Text>
          </View>
          <Pressable
            accessibilityLabel={t('common.closeWindow')}
            accessibilityRole="button"
            hitSlop={8}
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeButton,
              appearance === 'journey' && styles.journeyCloseButton,
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.closeText, appearance === 'journey' && styles.journeyCloseText]}>
              ✕
            </Text>
          </Pressable>
        </View>

        <ScrollView
          bounces={false}
          contentContainerStyle={[
            styles.modalContent,
            appearance === 'journey' && styles.journeyModalContent,
          ]}
          showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>

        {footer ? (
          <View style={[styles.modalFooter, appearance === 'journey' && styles.journeyModalFooter]}>
            {footer}
          </View>
        ) : null}
      </View>
    </BlurView>
  );
}

/** Eğitim ekranı için ortak, açık deniz temalı modal kabuğu. */
export function TutorialModal({
  visible,
  children,
}: {
  visible: boolean;
  children: ReactNode;
}) {
  if (!visible) return null;
  return (
    <View pointerEvents="box-none" style={styles.tutorialModalOverlay}>
      <View style={styles.tutorialModalCard}>{children}</View>
    </View>
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
  const { language, t } = useI18n();
  const earnedCountries = PASSPORT_COUNTRIES.filter((country) =>
    isPassportEarned(currentLevel, country.passportId),
  );

  return (
    <GameModal
      blurTarget={blurTarget}
      footer={
        <Text style={styles.footerText}>
          {t('modal.passportFooter', { done: earnedCountries.length, total: TOTAL_COUNTRIES })}
        </Text>
      }
      icon="📘"
      onClose={onClose}
      subtitle={t('passport.earned', { done: earnedCountries.length, total: TOTAL_COUNTRIES })}
      title={t('modal.passportTitle')}
      visible={visible}>
      <View style={styles.stampGrid}>
        {earnedCountries.length === 0 ? (
          <View style={styles.emptyPassportCollection}>
            <Text style={styles.emptyPassportIcon}>📘</Text>
            <Text style={styles.emptyPassportTitle}>{t('passport.emptyTitle')}</Text>
            <Text style={styles.emptyPassportText}>
              {t('modal.firstPassport')}
            </Text>
          </View>
        ) : earnedCountries.map((country, index) => (
          <View key={country.country} style={[styles.stamp, styles.stampUnlocked]}>
            <Svg height="100%" pointerEvents="none" style={StyleSheet.absoluteFill} width="100%">
              <Defs>
                <RadialGradient id={`stamp-${index}`} r="72%">
                  <Stop offset="0%" stopColor="#FEF3C7" />
                  <Stop offset="100%" stopColor="#F59E0B" />
                </RadialGradient>
              </Defs>
              <Rect fill={`url(#stamp-${index})`} height="100%" rx={24} width="100%" />
            </Svg>
            <Text style={styles.stampEmoji}>{country.flag}</Text>
            <Text style={styles.stampCountry}>{localizeCountry(country, language)}</Text>
            <Text style={styles.stampStatus}>{t('modal.passportWon')}</Text>
          </View>
        ))}
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
  const { language, t } = useI18n();
  if (completedLevel === null) return null;

  const destination = resolveTravelLevel(completedLevel);
  const completion = getTravelLevelCompletion(completedLevel);
  const country = destination.country;
  const nextCountry = completion.nextDestination.country;
  const countryName = localizeCountry(country, language);
  const nextCountryName = localizeCountry(nextCountry, language);
  const worldTourCompleted = completion.worldTourCompleted;
  const passportWasAlreadyEarned = isPassportEarned(completedLevel, country.passportId);

  return (
    <GameModal
      appearance="journey"
      blurTarget={blurTarget}
      footer={
        <Pressable
          accessibilityLabel={
            worldTourCompleted
              ? t('modal.masterTour')
              : t('modal.goToCountry', { country: nextCountryName })
          }
          accessibilityRole="button"
          onPress={onContinue}
          style={({ pressed }) => [styles.countryContinueButton, pressed && styles.pressed]}>
          <LinearGradient
            colors={['#FFD469', '#F3A43B']}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.countryContinueSurface}>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.76}
              numberOfLines={1}
              style={styles.countryContinueText}>
              {worldTourCompleted
                ? t('modal.masterTourButton')
                : t('modal.countryButton', { flag: nextCountry.flag, country: nextCountryName })}
            </Text>
            <View pointerEvents="none" style={styles.countryContinueArrowCircle}>
              <Text style={styles.countryContinueArrow}>→</Text>
            </View>
          </LinearGradient>
        </Pressable>
      }
      icon={worldTourCompleted ? '🌍' : country.flag}
      onClose={onContinue}
      subtitle={
        worldTourCompleted
          ? t('modal.worldDiscovered', { count: TOTAL_COUNTRIES })
          : passportWasAlreadyEarned
            ? t('modal.newRouteStamp')
            : t('modal.passportStamp')
      }
      title={worldTourCompleted ? 'WORLD TOUR COMPLETED' : t('modal.countryComplete', { country: countryName })}
      visible>
      <View style={styles.countryCompleteHero}>
        <Text style={styles.countryCompleteFlag}>{country.flag}</Text>
        <Text style={styles.countryCompleteName}>{countryName}</Text>
        <Text style={styles.countryCompleteCheck}>✓</Text>
      </View>

      {!worldTourCompleted ? (
        <View style={styles.nextCountryCard}>
          <Text style={styles.nextCountryLabel}>{t('modal.newLeg')}</Text>
          <Text style={styles.nextCountryName}>
            {country.flag} {countryName}　→　{nextCountry.flag} {nextCountryName}
          </Text>
        </View>
      ) : (
        <View style={styles.nextCountryCard}>
          <Text style={styles.nextCountryLabel}>{t('modal.specialRewards')}</Text>
          <Text style={styles.nextCountryName}>Golden Compass • World Explorer</Text>
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
    body: `Oyuncu ${TOTAL_ROUTES} tematik rotada ${TOTAL_COUNTRIES} farklı ülkeyi gezer. Aynı ülkeye ait yeni şehir paketleri bağımsız rota etapları olarak eklenebilir; her etapta 3 destinasyon ve bir Country Challenge bulunur.`,
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
  tutorialModalOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(20, 119, 145, 0.28)',
  },
  tutorialModalCard: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '94%',
    alignItems: 'center',
    padding: 20,
    borderRadius: 30,
    backgroundColor: '#F7FFFC',
    borderWidth: 2,
    borderColor: '#9CE2E4',
    shadowColor: '#075985',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
    elevation: 10,
  },
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
  journeyModalCard: {
    maxWidth: 380,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#E2B65C',
    backgroundColor: 'rgba(255,253,249,0.97)',
    shadowColor: '#456E80',
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 10,
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
  journeyModalHeader: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomColor: '#D5E8E7',
    backgroundColor: 'rgba(239,249,248,0.96)',
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
  journeyModalTitle: {
    color: '#24434D',
  },
  modalSubtitle: {
    color: '#94A3B8',
    fontFamily: FONTS.regular,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  journeyModalSubtitle: {
    color: '#557782',
    fontFamily: FONTS.bold,
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#1E293B',
  },
  journeyCloseButton: {
    borderWidth: 1,
    borderColor: '#C7E2E3',
    backgroundColor: '#F7FCFB',
  },
  closeText: {
    color: '#CBD5E1',
    fontFamily: FONTS.extraBold,
    fontSize: 15,
    fontWeight: '800',
  },
  journeyCloseText: {
    color: '#557782',
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
  modalContent: {
    padding: 24,
  },
  journeyModalContent: {
    padding: 18,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    backgroundColor: 'rgba(2,6,23,0.7)',
  },
  journeyModalFooter: {
    padding: 16,
    borderTopColor: '#D5E8E7',
    backgroundColor: 'rgba(247,252,250,0.96)',
  },
  footerText: {
    color: '#94A3B8',
    fontFamily: FONTS.semibold,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '600',
  },
  countryCompleteHero: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E9D39B',
    backgroundColor: '#FFF9EA',
  },
  countryCompleteFlag: {
    fontSize: 42,
  },
  countryCompleteName: {
    marginTop: 4,
    color: '#49382E',
    fontFamily: FONTS.black,
    fontSize: 20,
    fontWeight: '900',
  },
  countryCompleteCheck: {
    marginTop: 7,
    color: '#2E8B68',
    fontFamily: FONTS.black,
    fontSize: 18,
    fontWeight: '900',
  },
  nextCountryCard: {
    marginTop: 12,
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#B9DCDD',
    backgroundColor: '#EAF7F7',
  },
  nextCountryLabel: {
    color: '#287A88',
    fontFamily: FONTS.black,
    fontSize: 9,
    letterSpacing: 1.1,
    fontWeight: '900',
  },
  nextCountryName: {
    marginTop: 5,
    color: '#24434D',
    fontFamily: FONTS.black,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  countryContinueButton: {
    minHeight: 58,
    alignSelf: 'stretch',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFF5CC',
    backgroundColor: '#F3A43B',
    shadowColor: '#8A5A20',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.34,
    shadowRadius: 9,
    elevation: 8,
  },
  countryContinueSurface: {
    minHeight: 56,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 50,
    borderRadius: 18,
  },
  countryContinueText: {
    width: '100%',
    color: '#294B58',
    fontFamily: FONTS.black,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
    letterSpacing: 0.25,
    textAlign: 'center',
    textShadowColor: 'rgba(255,248,219,0.46)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  countryContinueArrowCircle: {
    position: 'absolute',
    right: 10,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: '#24788A',
  },
  countryContinueArrow: {
    color: '#FFFFFF',
    fontFamily: FONTS.black,
    fontSize: 21,
    lineHeight: 24,
    fontWeight: '900',
  },
  stampGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 16,
  },
  emptyPassportCollection: {
    width: '100%',
    minHeight: 210,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#111C31',
  },
  emptyPassportIcon: { fontSize: 46 },
  emptyPassportTitle: {
    marginTop: 12,
    color: '#F8FAFC',
    fontFamily: FONTS.extraBold,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyPassportText: {
    marginTop: 7,
    color: '#94A3B8',
    fontFamily: FONTS.medium,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
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
