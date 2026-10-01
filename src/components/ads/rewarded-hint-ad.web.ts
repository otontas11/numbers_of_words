import { HINT_AD_GEM_REWARD } from './admob-ids';

export { HINT_AD_GEM_REWARD };

export type RewardedHintAdResult = 'earned' | 'dismissed' | 'unavailable';

export function isRewardedHintAdSupported() {
  return false;
}

export function preloadRewardedHintAd() {}

export async function showRewardedHintAd(
  _onEarned: () => void,
): Promise<RewardedHintAdResult> {
  return 'unavailable';
}
