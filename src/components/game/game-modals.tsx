import { BlurView } from 'expo-blur';
import { useEffect, type ReactNode, type RefObject } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { FONTS } from '@/constants/fonts';
import {
  WORLD_COUNTRIES,
  ROUTE_BY_ID,
  getCountryProgress,
  isCountryComplete,
  isCountryUnlocked,
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
