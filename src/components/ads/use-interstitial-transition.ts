import { useCallback, useEffect } from 'react';

import {
  preloadInterstitialTransitionAd,
  shouldPreloadInterstitialTransition,
  shouldShowInterstitialTransition,
  showInterstitialIfReady,
  type InterstitialTransitionPoint,
} from './interstitial-transition';

export function useInterstitialTransition(countryIndex: number) {
  const canPreload = shouldPreloadInterstitialTransition(countryIndex);

  useEffect(() => {
    if (!canPreload) return;
    preloadInterstitialTransitionAd();
  }, [canPreload]);

  const presentTransitionAd = useCallback(
    async (from: InterstitialTransitionPoint, to: InterstitialTransitionPoint) => {
      if (!shouldShowInterstitialTransition(from, to)) return false;
      const shown = await showInterstitialIfReady();
      if (shouldPreloadInterstitialTransition(to.countryIndex)) {
        preloadInterstitialTransitionAd();
      }
      return shown;
    },
    [],
  );

  return { presentTransitionAd };
}
