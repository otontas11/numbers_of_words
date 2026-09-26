import { Platform } from 'react-native';

/** AdMob app ID. Also set on the config plugin in `app.json`. */
export const ADMOB_APP_ID = Platform.select({
  ios: 'ca-app-pub-5659145727748457~2512268171',
  default: 'ca-app-pub-5659145727748457~8041376159',
});

/** NOW-Rewarded — single source for the hint crystal rewarded unit. */
export const PRODUCTION_REWARDED_AD_UNIT_ID = Platform.select({
  ios: 'ca-app-pub-5659145727748457/8630205536',
  default: 'ca-app-pub-5659145727748457/1166461130',
});

/** NOW_Interstitial — single source for country/city transition interstitials. */
export const PRODUCTION_INTERSTITIAL_AD_UNIT_ID = Platform.select({
  ios: 'ca-app-pub-5659145727748457/4100682010',
  default: 'ca-app-pub-5659145727748457/7543780183',
});

/** Banner ad unit. */
export const PRODUCTION_BANNER_AD_UNIT_ID = Platform.select({
  ios: 'ca-app-pub-5659145727748457/9099306955',
  default: 'ca-app-pub-5659145727748457/7023807959',
});

/** Crystals granted only after a real RewardedAd earned-reward callback. */
export const HINT_AD_GEM_REWARD = 30;

/** First country (`countryIndex === 0`) never shows or preloads interstitials. */
export const INTERSTITIAL_MIN_COUNTRY_INDEX = 1;
