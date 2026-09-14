import { createDailyAwardLedger } from '../src/game/daily-award-ledger.ts';
import {
  claimDailyChallengeProgress,
  claimDailyRunAward,
  createDailyChallengeProgress,
  dailyAwardKey,
  dailyTreasureAwardKey,
  getDailyChallenge,
  getDailyChallengeReward,
  startDailyChallengeReplay,
} from '../src/game/daily-challenge.ts';
import { normalizeDailyChallengeProgress } from '../src/game/daily-challenge-storage.ts';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const dateKey = '2026-09-12';
const skill = { countryIndex: 8, difficultyModifier: 0 };

// (a) Arrival reports: reserved amount is paid in full once.
const arrive = createDailyAwardLedger();
const arriveKey = dailyAwardKey(0, 'target', `${dateKey}-1`);
assert(arrive.reserve('score', arriveKey, 76), 'a: reserve');
assert(arrive.pendingCount() === 1, 'a: pending queued');
assert(arrive.settle(arriveKey)?.amount === 76, 'a: arrive pays full amount');
assert(arrive.settle(arriveKey) === null, 'a: second arrive is a no-op');
assert(arrive.pendingCount() === 0, 'a: queue empty after arrive');

// (b) Arrival never reports: timeout/flush pays the same amount.
const timeout = createDailyAwardLedger();
const timeoutKey = dailyAwardKey(1, 'gem', `${dateKey}-2`);
assert(timeout.reserve('gem', timeoutKey, 4), 'b: reserve');
const timeoutPay = timeout.flush();
assert(timeoutPay.gems === 4 && timeoutPay.score === 0, 'b: flush pays the reserved gem amount');
assert(timeout.settle(timeoutKey) === null, 'b: late arrive after flush pays nothing');

// (c) Arrive and flush both fire: still a single payment.
const bothArriveFirst = createDailyAwardLedger();
const bothKey = dailyAwardKey(2, 'target', `${dateKey}-3`);
bothArriveFirst.reserve('score', bothKey, 30);
assert(bothArriveFirst.settle(bothKey)?.amount === 30, 'c: arrive pays');
assert(bothArriveFirst.flush().score === 0, 'c: flush after arrive is empty');

const bothFlushFirst = createDailyAwardLedger();
bothFlushFirst.reserve('score', bothKey, 30);
assert(bothFlushFirst.flush().score === 30, 'c: flush pays');
assert(bothFlushFirst.settle(bothKey) === null, 'c: arrive after flush is empty');

// (d) Eight rapid solves queue every payment; none drop.
const queue = createDailyAwardLedger();
let expectedScore = 0;
let expectedGems = 0;
for (let index = 1; index <= 8; index += 1) {
  const pointsKey = dailyAwardKey(3, 'target', `${dateKey}-${index}`);
  const bonusKey = dailyAwardKey(3, 'bonus', `${dateKey}-${index}`);
  const gemKey = dailyAwardKey(3, 'gem', `${dateKey}-${index}`);
  const points = 10 + index;
  const bonus = 6 + index;
  const gems = index % 2 === 0 ? 4 : 2;
  assert(queue.reserve('score', pointsKey, points), `d: reserve target ${index}`);
  assert(queue.reserve('score', bonusKey, bonus), `d: reserve bonus ${index}`);
  assert(queue.reserve('gem', gemKey, gems), `d: reserve gem ${index}`);
  expectedScore += points + bonus;
  expectedGems += gems;
}
assert(queue.pendingCount() === 24, 'd: all 24 awards stay pending');
const queued = queue.flush();
assert(queued.score === expectedScore && queued.gems === expectedGems, 'd: flush pays the full queue');

// (e) Mid-run unmount / replay flushes whatever is still reserved.
const midRun = createDailyAwardLedger();
midRun.reserve('score', dailyAwardKey(5, 'target', `${dateKey}-1`), 20);
midRun.reserve('gem', dailyAwardKey(5, 'gem', `${dateKey}-1`), 7);
midRun.reserve('score', dailyAwardKey(5, 'bonus', `${dateKey}-2`), 18);
const flushed = midRun.flush();
assert(flushed.score === 38 && flushed.gems === 7, 'e: unmount/replay flush writes pending');
midRun.reset();
assert(midRun.pendingCount() === 0, 'e: reset clears the book');
assert(
  midRun.reserve('score', dailyAwardKey(6, 'target', `${dateKey}-1`), 20),
  'e: a new run can reserve the same puzzle id',
);

const paid = new Set();
assert(claimDailyRunAward(paid, 'k', 5) === 5, 'claim first pays');
assert(claimDailyRunAward(paid, 'k', 5) === 0, 'claim second is zero');
assert(dailyAwardKey(0, 'gem', 'x') !== dailyAwardKey(1, 'gem', 'x'), 'run seed is in the key');
assert(
  dailyTreasureAwardKey(0, dateKey) !== dailyAwardKey(0, 'gem', `${dateKey}-1`),
  'treasure key is distinct from card gems',
);

const challenge = getDailyChallenge(dateKey, skill, 0);
const completeIds = challenge.puzzles.map((puzzle) => puzzle.id);
const dirtyPartial = normalizeDailyChallengeProgress(
  {
    dateKey,
    completedPuzzleIds: ['stale-id', `${dateKey}-1`],
    claimed: true,
    runIndex: 40,
    claimedAllBonuses: true,
    claimedNoHint: true,
    lastCompletedDate: dateKey,
    streak: 3,
  },
  dateKey,
  { countryIndex: 8 },
);
assert(dirtyPartial.runSeed === 0, 'legacy missing runSeed is 0');
assert(dirtyPartial.claimed === true, 'legacy claimed for today stays');
assert(dirtyPartial.runClaimed === false, 'unfinished legacy runClaimed is dropped');
assert(dirtyPartial.completedPuzzleIds.includes(`${dateKey}-1`), 'known puzzle id kept');
assert(!dirtyPartial.completedPuzzleIds.includes('stale-id'), 'stale puzzle id dropped');

const dirtyComplete = normalizeDailyChallengeProgress(
  {
    dateKey,
    completedPuzzleIds: completeIds,
    claimed: true,
    lastCompletedDate: dateKey,
    streak: 5,
  },
  dateKey,
  { countryIndex: 8 },
);
assert(dirtyComplete.runClaimed === true, 'legacy claimed on a finished run becomes runClaimed');

const staleRunClaimed = normalizeDailyChallengeProgress(
  {
    dateKey,
    completedPuzzleIds: [completeIds[0]],
    runClaimed: true,
    claimed: true,
    lastCompletedDate: dateKey,
  },
  dateKey,
  { countryIndex: 8 },
);
assert(staleRunClaimed.runClaimed === false, 'runClaimed on an unfinished run is dropped');

const replay = startDailyChallengeReplay({
  ...createDailyChallengeProgress(dateKey, skill),
  claimed: true,
  runClaimed: true,
  runScore: 99,
});
assert(replay.runClaimed === false && replay.runScore === 0 && replay.runSeed === 1, 'replay reopens a paid run');
const replayChallenge = getDailyChallenge(dateKey, skill, replay.runSeed);
assert(replayChallenge.packId !== challenge.packId, 'replay builds a different set');

const finished = {
  ...createDailyChallengeProgress(dateKey, skill),
  completedPuzzleIds: completeIds,
  completedBonusPuzzleIds: completeIds,
  usedHint: false,
};
const pack = getDailyChallengeReward(finished, challenge);
assert(pack.total === 21, 'full finish pack is 15+4+2');
const claimed = claimDailyChallengeProgress(finished, challenge);
assert(claimed.runClaimed === true, 'claim locks only this run');
assert(getDailyChallengeReward(claimed, challenge).total === 0, 'same run cannot claim twice');
const replayed = startDailyChallengeReplay(claimed);
const replayFinished = {
  ...replayed,
  completedPuzzleIds: replayChallenge.puzzles.map((puzzle) => puzzle.id),
  completedBonusPuzzleIds: replayChallenge.puzzles.map((puzzle) => puzzle.id),
};
assert(
  getDailyChallengeReward(replayFinished, replayChallenge).total === 21,
  'next run can claim the full pack again',
);

console.log('OK: daily award ledger, flush/arrive idempotency, queue, and legacy normalize.');
