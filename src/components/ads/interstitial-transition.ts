import {
  INTERSTITIAL_MIN_COUNTRY_INDEX,
  PRODUCTION_INTERSTITIAL_AD_UNIT_ID,
} from './admob-ids';
import { getGoogleMobileAds, initializeMobileAds } from './google-mobile-ads';

type InterstitialAd = import('react-native-google-mobile-ads').InterstitialAd;

export type InterstitialTransitionPoint = {
  countryIndex: number;
  locationId: string;
};

type LoadState = 'idle' | 'loading' | 'ready' | 'showing';

let interstitialAd: InterstitialAd | null = null;
let loadState: LoadState = 'idle';

export function shouldShowInterstitialTransition(
  from: InterstitialTransitionPoint,
  to: InterstitialTransitionPoint,
) {
  if (from.countryIndex < INTERSTITIAL_MIN_COUNTRY_INDEX) return false;
  if (to.countryIndex < INTERSTITIAL_MIN_COUNTRY_INDEX) return false;
  if (from.countryIndex !== to.countryIndex) return true;
  return from.locationId !== to.locationId;
}

export function shouldPreloadInterstitialTransition(countryIndex: number) {
  return countryIndex >= INTERSTITIAL_MIN_COUNTRY_INDEX;
}

function interstitialUnitId() {
  const ads = getGoogleMobileAds();
  if (!ads) return PRODUCTION_INTERSTITIAL_AD_UNIT_ID;
  return __DEV__ ? ads.TestIds.INTERSTITIAL : PRODUCTION_INTERSTITIAL_AD_UNIT_ID;
}

function bindLoadListeners(ad: InterstitialAd) {
  const ads = getGoogleMobileAds();
  if (!ads) return;

  ad.addAdEventListener(ads.AdEventType.LOADED, () => {
    if (interstitialAd !== ad) return;
    loadState = 'ready';
  });
  ad.addAdEventListener(ads.AdEventType.ERROR, () => {
    if (interstitialAd !== ad) return;
    loadState = 'idle';
    interstitialAd = null;
  });
}

function ensureInterstitialAd() {
  const ads = getGoogleMobileAds();
  if (!ads) return null;
  if (interstitialAd) return interstitialAd;

  interstitialAd = ads.InterstitialAd.createForAdRequest(interstitialUnitId());
  bindLoadListeners(interstitialAd);
  return interstitialAd;
}

export function preloadInterstitialTransitionAd() {
  if (!getGoogleMobileAds()) return;
  if (loadState === 'loading' || loadState === 'ready' || loadState === 'showing') return;

  void initializeMobileAds()
    .then(() => {
      if (loadState !== 'idle') return;
      const ad = ensureInterstitialAd();
      if (!ad) return;
      loadState = 'loading';
      ad.load();
    })
    .catch(() => {
      loadState = 'idle';
      interstitialAd = null;
    });
}

export async function showInterstitialIfReady() {
  const ads = getGoogleMobileAds();
  const ad = interstitialAd;
  if (!ads || !ad || loadState !== 'ready' || !ad.loaded) return false;

  return new Promise<boolean>((resolve) => {
    let settled = false;
    loadState = 'showing';

    const finish = (shown: boolean) => {
      if (settled) return;
      settled = true;
      unsubscribeClose();
      unsubscribeError();
      loadState = 'idle';
      interstitialAd = null;
      resolve(shown);
    };

    const unsubscribeClose = ad.addAdEventListener(ads.AdEventType.CLOSED, () => {
      finish(true);
    });
    const unsubscribeError = ad.addAdEventListener(ads.AdEventType.ERROR, () => {
      finish(false);
    });

    ad.show().catch(() => {
      finish(false);
    });
  });
}
