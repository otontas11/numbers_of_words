import { Platform } from 'react-native';

type AnalyticsClient = {
  logEvent: (name: string, params?: Record<string, string | number>) => Promise<void>;
};

type AnalyticsFactory = () => AnalyticsClient;

export type AdImpressionParams = {
  adPlatform: string;
  adFormat: string;
  value: number;
  currency: string;
  adUnitName?: string;
};

function resolveAnalytics(): AnalyticsFactory | null {
  if (Platform.OS === 'web') return null;

  try {
    // Expo Go does not ship RN Firebase Analytics; load only when native is present.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@react-native-firebase/app');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@react-native-firebase/analytics').default as AnalyticsFactory;
  } catch {
    return null;
  }
}

const analytics = resolveAnalytics();

/** Custom GA4 names (`now_` = Number of Wonders). Avoid Firebase recommended/reserved events. */
const EVENT_TUTORIAL_COMPLETE = 'now_tutorial_complete';
const EVENT_DAILY_START = 'now_daily_start';
const EVENT_AD_IMPRESSION = 'now_ad_impression';

function logSafe(run: () => Promise<void>) {
  try {
    void run().catch(() => undefined);
  } catch {
    // Analytics must never affect gameplay.
  }
}

export function logTutorialComplete() {
  if (!analytics) return;
  logSafe(() => analytics().logEvent(EVENT_TUTORIAL_COMPLETE));
}

export function logDailyStart() {
  if (!analytics) return;
  logSafe(() => analytics().logEvent(EVENT_DAILY_START));
}

export function logAdImpression(params: AdImpressionParams) {
  if (!analytics) return;
  if (!Number.isFinite(params.value) || !params.currency) return;

  const eventParams: Record<string, string | number> = {
    ad_platform: params.adPlatform,
    ad_format: params.adFormat,
    value: params.value,
    currency: params.currency,
  };
  if (params.adUnitName) eventParams.ad_unit_name = params.adUnitName;

  logSafe(() => analytics().logEvent(EVENT_AD_IMPRESSION, eventParams));
}
