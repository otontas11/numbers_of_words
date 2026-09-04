import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import {
  BannerAd,
  BannerAdSize,
  MobileAds,
  TestIds,
} from 'react-native-google-mobile-ads';
import { SafeAreaView } from 'react-native-safe-area-context';

const PRODUCTION_BANNER_UNIT_ID = Platform.select({
  android: 'ca-app-pub-5659145727748457/7023807959',
  ios: 'ca-app-pub-5659145727748457/9099306955',
  default: TestIds.BANNER,
});

let initializationPromise: ReturnType<ReturnType<typeof MobileAds>['initialize']> | null = null;

function initializeMobileAds() {
  if (!initializationPromise) {
    initializationPromise = MobileAds().initialize().catch((error: unknown) => {
      initializationPromise = null;
      throw error;
    });
  }

  return initializationPromise;
}

export function AdMobBanner() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
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

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <View style={styles.slot}>
        {initialized ? (
          <BannerAd
            size={BannerAdSize.BANNER}
            unitId={__DEV__ ? TestIds.BANNER : PRODUCTION_BANNER_UNIT_ID}
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
