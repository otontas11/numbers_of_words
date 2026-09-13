import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { logAdImpression } from '@/analytics/app-analytics';

type GoogleMobileAds = typeof import('react-native-google-mobile-ads');

/**
 * Expo Go does not contain RNGoogleMobileAdsModule. Keep this require behind
 * a guard so importing the root layout never crashes Expo Go before the app
 * can render. A development/native build with the config plugin still loads
 * the module normally.
 */
function resolveGoogleMobileAds(): GoogleMobileAds | null {
  if (Platform.OS === 'web') return null;

  try {
    // Expo Go does not ship this native module; load it only when available.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-google-mobile-ads') as GoogleMobileAds;
  } catch {
    return null;
  }
}

const googleMobileAds = resolveGoogleMobileAds();

/** Standard BANNER height plus a little slot padding. Keep this reserved even when no ad fills. */
export const AD_BANNER_SLOT_HEIGHT = 58;

const PRODUCTION_BANNER_UNIT_ID = Platform.select({
  android: 'ca-app-pub-5659145727748457/7023807959',
  ios: 'ca-app-pub-5659145727748457/9099306955',
  default: '',
});

let initializationPromise: ReturnType<ReturnType<GoogleMobileAds['MobileAds']>['initialize']> | null = null;

function initializeMobileAds() {
  if (!googleMobileAds) return Promise.resolve(null);

  if (!initializationPromise) {
    initializationPromise = (async () => {
      try {
        // Google UMP system form when required (EEA). No custom permission UI.
        await googleMobileAds.AdsConsent.gatherConsent();
      } catch {
        // Consent request failed; still initialize ads.
      }
      return googleMobileAds.MobileAds().initialize();
    })().catch((error: unknown) => {
      initializationPromise = null;
      throw error;
    });
  }

  return initializationPromise;
}

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
  const unitId = __DEV__ ? TestIds.BANNER : PRODUCTION_BANNER_UNIT_ID || TestIds.BANNER;

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
