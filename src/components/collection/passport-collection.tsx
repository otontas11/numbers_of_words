import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppFooter } from '@/components/common/app-footer';
import { FONTS } from '@/constants/fonts';
import { localizeCountry, useI18n } from '@/i18n';
import {
  PASSPORT_COUNTRIES,
  TOTAL_COUNTRIES,
  isPassportEarned,
  type TravelCountry,
} from '@/game/travel';

const DEFAULT_BACKGROUND = require('../../../assets/images/img/bg.png');

type PassportCollectionProps = {
  currentLevel: number;
  onHome: () => void;
  onMap: () => void;
  onTasks: () => void;
};

function PassportStamp({ country, index }: { country: TravelCountry; index: number }) {
  const rotation = index % 3 === 0 ? '-4deg' : index % 3 === 1 ? '2deg' : '-1deg';
  const { language, locale, t } = useI18n();
  const countryName = localizeCountry(country, language);

  return (
    <View style={styles.passportCard}>
      <View style={styles.passportTopLine} />
      <Text style={styles.passportLabel}>{t('passport.label')}</Text>
      <View style={[styles.stampOuter, { transform: [{ rotate: rotation }] }]}>
        <View style={styles.stampInner}>
          <Text style={styles.stampStars}>★  ★  ★</Text>
          <Text style={styles.stampFlag}>{country.flag}</Text>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.62}
            numberOfLines={1}
            style={styles.stampCountry}>
            {countryName.toLocaleUpperCase(locale)}
          </Text>
          <View style={styles.approvedBand}>
            <Text style={styles.approvedText}>{t('passport.approved')}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.passportNumber}>NO · {String(country.passportIndex + 1).padStart(3, '0')}</Text>
    </View>
  );
}

export function PassportCollection({
  currentLevel,
  onHome,
  onMap,
  onTasks,
}: PassportCollectionProps) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const earnedCountries = PASSPORT_COUNTRIES.filter((country) =>
    isPassportEarned(currentLevel, country.passportId),
  );

  return (
    <View style={styles.screen}>
      <Image
        cachePolicy="memory-disk"
        contentFit="cover"
        source={DEFAULT_BACKGROUND}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.18)', 'rgba(255,249,238,0.72)']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <FlatList
        bounces={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 18, paddingBottom: 118 + insets.bottom },
        ]}
        data={earnedCountries}
        initialNumToRender={12}
        keyExtractor={(country) => country.id}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🛂</Text>
            <Text style={styles.emptyTitle}>{t('passport.emptyTitle')}</Text>
            <Text style={styles.emptyText}>
              {t('passport.emptyText')}
            </Text>
          </View>
        }
        ListHeaderComponent={
          <View style={styles.titleCard}>
            <Text style={styles.titleIcon}>✦</Text>
            <Text style={styles.title}>{t('passport.title')}</Text>
            <Text style={styles.subtitle}>
              {t('passport.earned', { done: earnedCountries.length, total: TOTAL_COUNTRIES })}
            </Text>
          </View>
        }
        ListHeaderComponentStyle={styles.listHeader}
        maxToRenderPerBatch={12}
        numColumns={3}
        columnWrapperStyle={styles.passportRow}
        overScrollMode="never"
        removeClippedSubviews
        renderItem={({ item: country, index }) => (
          <PassportStamp country={country} index={index} />
        )}
        showsVerticalScrollIndicator={false}
        windowSize={5}
      />

      <AppFooter
        activeItem="collection"
        onCollection={() => {}}
        onHome={onHome}
        onMap={onMap}
        onTasks={onTasks}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#76C9EF' },
  content: { width: '100%', maxWidth: 512, alignSelf: 'center', paddingHorizontal: 13 },
  listHeader: { marginBottom: 5 },
  titleCard: { alignItems: 'center', paddingHorizontal: 18, paddingVertical: 15, borderRadius: 24, borderWidth: 1.8, borderColor: '#D5AA4D', backgroundColor: 'rgba(255,253,248,0.95)', shadowColor: '#35647A', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.24, shadowRadius: 8, elevation: 6 },
  titleIcon: { color: '#D29728', fontSize: 20 },
  title: { marginTop: 2, color: '#173F72', fontFamily: FONTS.extraBold, fontSize: 19, letterSpacing: 0.7, fontWeight: '800', textAlign: 'center' },
  subtitle: { marginTop: 4, color: '#8B682A', fontFamily: FONTS.semibold, fontSize: 10, fontWeight: '600' },
  passportRow: { marginTop: 9, justifyContent: 'space-between' },
  passportCard: { width: '31.5%', aspectRatio: 0.73, alignItems: 'center', paddingHorizontal: 5, paddingTop: 8, paddingBottom: 6, overflow: 'hidden', borderRadius: 12, borderWidth: 1.4, borderColor: '#C9983D', backgroundColor: '#FFF8E8', shadowColor: '#5A431E', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  passportTopLine: { width: '72%', height: 1, backgroundColor: '#C79B4D' },
  passportLabel: { marginTop: 3, color: '#8E6428', fontFamily: FONTS.bold, fontSize: 6.5, letterSpacing: 1.2, fontWeight: '700' },
  stampOuter: { width: 82, height: 82, marginTop: 5, alignItems: 'center', justifyContent: 'center', borderRadius: 41, borderWidth: 2.2, borderStyle: 'dashed', borderColor: '#9B3E32' },
  stampInner: { width: 69, height: 69, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 35, borderWidth: 1.4, borderColor: '#9B3E32', backgroundColor: 'rgba(164,64,50,0.04)' },
  stampStars: { color: '#9B3E32', fontSize: 6, letterSpacing: 1 },
  stampFlag: { marginTop: -1, fontSize: 18, lineHeight: 21 },
  stampCountry: { width: 60, color: '#87372E', fontFamily: FONTS.extraBold, fontSize: 7, lineHeight: 9, fontWeight: '800', textAlign: 'center' },
  approvedBand: { width: 66, height: 12, marginTop: 2, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#9B3E32', backgroundColor: '#FFF8E8' },
  approvedText: { color: '#9B3E32', fontFamily: FONTS.extraBold, fontSize: 6.5, letterSpacing: 0.7, fontWeight: '800' },
  passportNumber: { marginTop: 'auto', color: '#8E6A35', fontFamily: FONTS.bold, fontSize: 6.5, letterSpacing: 0.5, fontWeight: '700' },
  emptyCard: { minHeight: 230, marginTop: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, borderRadius: 24, borderWidth: 1.8, borderColor: '#D5AA4D', backgroundColor: 'rgba(255,253,248,0.95)' },
  emptyIcon: { fontSize: 45 },
  emptyTitle: { marginTop: 12, color: '#173F72', fontFamily: FONTS.extraBold, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  emptyText: { marginTop: 7, color: '#66737D', fontFamily: FONTS.medium, fontSize: 11, lineHeight: 17, textAlign: 'center' },
});
