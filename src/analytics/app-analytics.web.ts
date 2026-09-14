export type AdImpressionParams = {
  adPlatform: string;
  adFormat: string;
  value: number;
  currency: string;
  adUnitName?: string;
};

export function logTutorialComplete() {}

export function logDailyStart() {}

export function logAdImpression(_params: AdImpressionParams) {}
