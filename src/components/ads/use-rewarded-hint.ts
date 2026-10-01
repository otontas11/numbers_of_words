import { useCallback, useEffect, useRef } from 'react';

import { HINT_AD_GEM_REWARD } from './admob-ids';
import {
  isRewardedHintAdSupported,
  preloadRewardedHintAd,
  showRewardedHintAd,
  type RewardedHintAdResult,
} from './rewarded-hint-ad';

type UseRewardedHintAdOptions = {
  gemCount: number;
  hintCost: number;
  onEarned: () => void;
};

export function useRewardedHintAd({
  gemCount,
  hintCost,
  onEarned,
}: UseRewardedHintAdOptions) {
  const onEarnedRef = useRef(onEarned);
  onEarnedRef.current = onEarned;

  const needsAd = isRewardedHintAdSupported() && gemCount < hintCost;

  useEffect(() => {
    if (!needsAd) return;
    preloadRewardedHintAd();
  }, [needsAd]);

  const requestRewardedHintAd = useCallback((): Promise<RewardedHintAdResult> => {
    return showRewardedHintAd(() => {
      onEarnedRef.current();
    });
  }, []);

  return {
    requestRewardedHintAd,
    offerHintAd: needsAd,
    hintAdReward: HINT_AD_GEM_REWARD,
  };
}
