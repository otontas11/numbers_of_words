import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { logReviewRequested } from '../analytics/app-analytics';

const STORAGE_KEY = '@number-of-wonders/review-requested';

export async function maybeRequestReview() {
  try {
    const alreadyRequested = await AsyncStorage.getItem(STORAGE_KEY);
    if (alreadyRequested) return;

    const available = await StoreReview.isAvailableAsync();
    if (!available) return;

    const hasAction = await StoreReview.hasAction();
    if (!hasAction) return;

    await AsyncStorage.setItem(STORAGE_KEY, '1');
    logReviewRequested();
    await StoreReview.requestReview();
  } catch {
    // Review must never affect gameplay.
  }
}
