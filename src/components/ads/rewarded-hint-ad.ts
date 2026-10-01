import { HINT_AD_GEM_REWARD, PRODUCTION_REWARDED_AD_UNIT_ID } from './admob-ids';
import { getGoogleMobileAds, initializeMobileAds } from './google-mobile-ads';

export { HINT_AD_GEM_REWARD };

export type RewardedHintAdResult = 'earned' | 'dismissed' | 'unavailable';

type RewardedAd = import('react-native-google-mobile-ads').RewardedAd;

const SHOW_LOAD_TIMEOUT_MS = 4000;

type LoadState = 'idle' | 'loading' | 'ready' | 'showing';

let rewardedAd: RewardedAd | null = null;
let loadState: LoadState = 'idle';
let loadWaiters: Array<(ready: boolean) => void> = [];

function rewardedUnitId() {
  const ads = getGoogleMobileAds();
  if (!ads) return PRODUCTION_REWARDED_AD_UNIT_ID;
  return __DEV__ ? ads.TestIds.REWARDED : PRODUCTION_REWARDED_AD_UNIT_ID;
}

function flushLoadWaiters(ready: boolean) {
  const waiters = loadWaiters;
  loadWaiters = [];
  waiters.forEach((wait) => wait(ready));
}

function waitForReady(timeoutMs: number) {
  if (loadState === 'ready' && rewardedAd?.loaded) return Promise.resolve(true);
  if (loadState === 'showing') return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      loadWaiters = loadWaiters.filter((wait) => wait !== onReady);
      resolve(loadState === 'ready' && Boolean(rewardedAd?.loaded));
    }, timeoutMs);

    const onReady = (ready: boolean) => {
      clearTimeout(timer);
      resolve(ready);
    };
    loadWaiters.push(onReady);
  });
}

function bindLoadListeners(ad: RewardedAd) {
  const ads = getGoogleMobileAds();
  if (!ads) return;

  ad.addAdEventListener(ads.RewardedAdEventType.LOADED, () => {
    if (rewardedAd !== ad) return;
    loadState = 'ready';
    flushLoadWaiters(true);
  });
  ad.addAdEventListener(ads.AdEventType.ERROR, () => {
    if (rewardedAd !== ad) return;
    loadState = 'idle';
    rewardedAd = null;
    flushLoadWaiters(false);
  });
}

function ensureRewardedAd() {
  const ads = getGoogleMobileAds();
  if (!ads) return null;
  if (rewardedAd) return rewardedAd;

  rewardedAd = ads.RewardedAd.createForAdRequest(rewardedUnitId());
  bindLoadListeners(rewardedAd);
  return rewardedAd;
}

export function isRewardedHintAdSupported() {
  return getGoogleMobileAds() !== null;
}

export function preloadRewardedHintAd() {
  if (!getGoogleMobileAds()) return;
  if (loadState === 'loading' || loadState === 'ready' || loadState === 'showing') return;

  void initializeMobileAds()
    .then(() => {
      if (loadState !== 'idle') return;
      const ad = ensureRewardedAd();
      if (!ad) return;
      loadState = 'loading';
      ad.load();
    })
    .catch(() => {
      loadState = 'idle';
      rewardedAd = null;
      flushLoadWaiters(false);
    });
}

export async function showRewardedHintAd(
  onEarned: () => void,
): Promise<RewardedHintAdResult> {
  if (!getGoogleMobileAds()) return 'unavailable';
  if (loadState === 'showing') return 'unavailable';

  if (loadState !== 'ready' || !rewardedAd?.loaded) {
    preloadRewardedHintAd();
    const ready = await waitForReady(SHOW_LOAD_TIMEOUT_MS);
    if (!ready || !rewardedAd?.loaded) return 'unavailable';
  }

  const ads = getGoogleMobileAds();
  const ad = rewardedAd;
  if (!ads || !ad) return 'unavailable';

  return new Promise((resolve) => {
    let settled = false;
    let earned = false;
    loadState = 'showing';

    const finish = (result: RewardedHintAdResult) => {
      if (settled) return;
      settled = true;
      unsubscribeEarn();
      unsubscribeClose();
      unsubscribeError();
      loadState = 'idle';
      rewardedAd = null;
      resolve(result);
    };

    const unsubscribeEarn = ad.addAdEventListener(ads.RewardedAdEventType.EARNED_REWARD, () => {
      if (earned) return;
      earned = true;
      onEarned();
    });
    const unsubscribeClose = ad.addAdEventListener(ads.AdEventType.CLOSED, () => {
      finish(earned ? 'earned' : 'dismissed');
    });
    const unsubscribeError = ad.addAdEventListener(ads.AdEventType.ERROR, () => {
      finish(earned ? 'earned' : 'unavailable');
    });

    ad.show().catch(() => {
      finish(earned ? 'earned' : 'unavailable');
    });
  });
}
