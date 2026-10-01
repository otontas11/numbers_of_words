import { Platform } from 'react-native';

export type GoogleMobileAds = typeof import('react-native-google-mobile-ads');

/**
 * Expo Go does not contain RNGoogleMobileAdsModule. Keep this require behind
 * a guard so importing the root layout never crashes Expo Go before the app
 * can render.
 */
export function resolveGoogleMobileAds(): GoogleMobileAds | null {
  if (Platform.OS === 'web') return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-google-mobile-ads') as GoogleMobileAds;
  } catch {
    return null;
  }
}

const googleMobileAds = resolveGoogleMobileAds();

let initializationPromise: ReturnType<
  ReturnType<GoogleMobileAds['MobileAds']>['initialize']
> | null = null;

export function initializeMobileAds() {
  if (!googleMobileAds) return Promise.resolve(null);

  if (!initializationPromise) {
    initializationPromise = (async () => {
      try {
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

export function getGoogleMobileAds() {
  return googleMobileAds;
}
