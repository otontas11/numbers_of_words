import { claimDailyRunAward } from './daily-challenge.ts';

export type DailyAwardKind = 'gem' | 'score';

export type SettledDailyAward = {
  kind: DailyAwardKind;
  amount: number;
};

export type DailyAwardLedger = {
  /**
   * Books an award the moment a match is verified. Returns `false` when the
   * key is already reserved or already paid, so a repeated match cannot queue
   * a second payment.
   */
  reserve: (kind: DailyAwardKind, awardKey: string, amount: number) => boolean;
  /** Pays one reserved award. Returns `null` if it was already paid. */
  settle: (awardKey: string) => SettledDailyAward | null;
  /** Pays everything still reserved, e.g. on replay, board swap or unmount. */
  flush: () => { gems: number; score: number };
  pendingKeys: () => string[];
  pendingCount: () => number;
  /** Forgets reserved and paid keys. Only call after a flush. */
  reset: () => void;
};

/**
 * Holds daily awards between "the player matched a target" and "the flying
 * badge reached its counter", so the HUD number never moves ahead of the
 * animation.
 *
 * The split exists because crediting straight from an animation callback used
 * to lose rewards whenever a callback never fired. Here the amount and its key
 * are computed at match time and parked in `pending`, so the animation only
 * decides *when* the credit lands, never *whether* it lands. Any trigger may
 * settle a key — arrival, a hard timeout, a failed measure, a board swap or an
 * unmount — and `paidKeys` guarantees that the first one to run is the only
 * one that pays.
 */
export function createDailyAwardLedger(): DailyAwardLedger {
  const pending = new Map<string, SettledDailyAward>();
  const paidKeys = new Set<string>();

  return {
    reserve(kind, awardKey, amount) {
      if (amount <= 0 || pending.has(awardKey) || paidKeys.has(awardKey)) return false;
      pending.set(awardKey, { kind, amount });
      return true;
    },

    settle(awardKey) {
      const reserved = pending.get(awardKey);
      if (!reserved) return null;
      pending.delete(awardKey);
      const amount = claimDailyRunAward(paidKeys, awardKey, reserved.amount);
      return amount > 0 ? { kind: reserved.kind, amount } : null;
    },

    flush() {
      let gems = 0;
      let score = 0;
      for (const [awardKey, reserved] of pending) {
        const amount = claimDailyRunAward(paidKeys, awardKey, reserved.amount);
        if (amount <= 0) continue;
        if (reserved.kind === 'gem') gems += amount;
        else score += amount;
      }
      pending.clear();
      return { gems, score };
    },

    pendingKeys() {
      return [...pending.keys()];
    },

    pendingCount() {
      return pending.size;
    },

    reset() {
      pending.clear();
      paidKeys.clear();
    },
  };
}
