import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { logAdImpression } from '@/analytics/app-analytics';

import { PRODUCTION_BANNER_AD_UNIT_ID } from './admob-ids';
import { getGoogleMobileAds, initializeMobileAds } from './google-mobile-ads';

const googleMobileAds = getGoogleMobileAds();

/** Standard BANNER height plus a little slot padding. Keep this reserved even when no ad fills. */
export const AD_BANNER_SLOT_HEIGHT = 58;

export function AdMobBanner() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!googleMobileAds) return undefined;

    let mounted = true;

    void initializeMobileAds()
      .then(() => {
        if (mounted) setInitialized(true);
      })
      .catch((error: unknown) => {
        if (__DEV__) console.warn('Google Mobile Ads could not be initialized.', error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (!googleMobileAds) return null;

  const { BannerAd, BannerAdSize, TestIds } = googleMobileAds;
  const unitId = __DEV__ ? TestIds.BANNER : PRODUCTION_BANNER_AD_UNIT_ID || TestIds.BANNER;

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <View style={styles.slot}>
        {initialized ? (
          <BannerAd
            size={BannerAdSize.BANNER}
            unitId={unitId}
            onPaid={(event) => {
              logAdImpression({
                adPlatform: 'AdMob',
                adFormat: 'banner',
                value: event.value,
                currency: event.currency || 'USD',
                adUnitName: unitId,
              });
            }}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#020617',
  },
  slot: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
