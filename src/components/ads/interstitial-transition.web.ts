import { INTERSTITIAL_MIN_COUNTRY_INDEX } from './admob-ids';

export type InterstitialTransitionPoint = {
  countryIndex: number;
  locationId: string;
};

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

export function preloadInterstitialTransitionAd() {}

export async function showInterstitialIfReady() {
  return false;
}
