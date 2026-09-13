import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { GemIcon } from '@/components/common/game-icons';
import { FONTS } from '@/constants/fonts';

export type ResultFlightKind = 'result' | 'gem' | 'points';

export type MeasuredRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ScreenPoint = {
  x: number;
  y: number;
};

export type ResultFlight = {
  id: number;
  kind: ResultFlightKind;
  value: number;
  delay?: number;
  followUpGemReward?: number;
  followUpPoints?: number;
  /** Reserved award this flight delivers; paid when it reaches its counter. */
  awardKey?: string;
  /** Reserved awards handed to the follow-up HUD flights this one spawns. */
  followUpPointsAwardKey?: string;
  followUpGemAwardKey?: string;
  targetIndex: number;
  railSlot?: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
};

export type CardGemLift = {
  id: number;
  value: number;
  /** Reserved gem award, paid when the lift reaches the total gem pill. */
  awardKey?: string;
  delay?: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
};

export const RESULT_FLIGHT_DURATION = 720;
export const RESULT_FLIGHT_ARRIVAL_PROGRESS = 0.9;
export const BONUS_GEM_LAUNCH_DELAY = 360;
export const BONUS_GEM_FLIGHT_DURATION = 960;
export const BONUS_GEM_ARRIVAL_PROGRESS = 0.92;
export const POINTS_FLIGHT_DURATION = 860;
export const POINTS_FLIGHT_ARRIVAL_PROGRESS = 0.9;
export const TARGET_COLOR_REVEAL_DURATION = 300;
export const CARD_GEM_LIFT_SIZE = 24;
export const RESULT_FLIGHT_WIDTH = 52;
export const RESULT_FLIGHT_HEIGHT = 52;
export const POINTS_FLIGHT_WIDTH = 66;
export const POINTS_FLIGHT_HEIGHT = 38;
export const BONUS_TARGET_INDEX = -1;
export const TARGET_LANDING_MS = 320;
const MEASURE_IN_WINDOW_TIMEOUT_MS = 240;

export function measureViewInWindow(view: View | null): Promise<MeasuredRect | null> {
  if (!view) return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (rect: MeasuredRect | null) => {
      if (settled) return;
      settled = true;
      resolve(rect);
    };
    const timeout = setTimeout(() => finish(null), MEASURE_IN_WINDOW_TIMEOUT_MS);
    view.measureInWindow((x, y, width, height) => {
      clearTimeout(timeout);
      finish(width > 0 && height > 0 ? { x, y, width, height } : null);
    });
  });
}

export function createResultFlight({
  id,
  kind,
  value,
  rootRect,
  sourceRect,
  targetRect,
  origin,
  delay,
  followUpGemReward,
  followUpPoints,
  awardKey,
  followUpPointsAwardKey,
  followUpGemAwardKey,
  targetIndex,
  railSlot,
}: {
  id: number;
  kind: ResultFlightKind;
  value: number;
  rootRect: MeasuredRect;
  sourceRect: MeasuredRect;
  targetRect: MeasuredRect;
  origin?: ScreenPoint;
  delay?: number;
  followUpGemReward?: number;
  followUpPoints?: number;
  awardKey?: string;
  followUpPointsAwardKey?: string;
  followUpGemAwardKey?: string;
  targetIndex: number;
  railSlot?: number;
}): ResultFlight {
  const sourceAnchorY = kind === 'result' && !origin ? 0.44 : 0.5;
  return {
    id,
    kind,
    value,
    delay,
    followUpGemReward,
    followUpPoints,
    awardKey,
    followUpPointsAwardKey,
    followUpGemAwardKey,
    targetIndex,
    railSlot,
    fromX: (origin?.x ?? sourceRect.x + sourceRect.width / 2) - rootRect.x,
    fromY: (origin?.y ?? sourceRect.y + sourceRect.height * sourceAnchorY) - rootRect.y,
    toX: targetRect.x + targetRect.width / 2 - rootRect.x,
    toY: targetRect.y + targetRect.height / 2 - rootRect.y,
  };
}

export function resultFlightEventKey(flight: Pick<ResultFlight, 'id' | 'kind'>): string {
  return `${flight.id}:${flight.kind}`;
}

export function createCardGemLift({
  id,
  value,
  rootRect,
  sourceRect,
  targetRect,
  awardKey,
  delay,
}: {
  id: number;
  value: number;
  rootRect: MeasuredRect;
  sourceRect: MeasuredRect;
  targetRect: MeasuredRect;
  awardKey?: string;
  delay?: number;
}): CardGemLift {
  return {
    id,
    value,
    awardKey,
    delay,
    fromX: sourceRect.x + sourceRect.width / 2 - rootRect.x,
    fromY: sourceRect.y + sourceRect.height / 2 - rootRect.y,
    toX: targetRect.x + targetRect.width / 2 - rootRect.x,
    toY: targetRect.y + targetRect.height / 2 - rootRect.y,
  };
}

export function cardGemLiftEventKey(lift: Pick<CardGemLift, 'id'>): string {
  return `card-gem:${lift.id}`;
}

export function ResultFlightBadge({
  flight,
  onArrive,
  onComplete,
}: {
  flight: ResultFlight;
  onArrive: (flight: ResultFlight) => void;
  onComplete: (flight: ResultFlight) => void;
}) {
  const [progress] = useState(() => new Animated.Value(0));
  const isGem = flight.kind === 'gem';
  const isPoints = flight.kind === 'points';
  const arrivedRef = useRef(false);
  const completedRef = useRef(false);
  const onArriveRef = useRef(onArrive);
  const onCompleteRef = useRef(onComplete);
  const flightRef = useRef(flight);
  onArriveRef.current = onArrive;
  onCompleteRef.current = onComplete;
  flightRef.current = flight;

  useEffect(() => {
    const markArrived = () => {
      if (arrivedRef.current) return;
      arrivedRef.current = true;
      onArriveRef.current(flightRef.current);
    };
    const markCompleted = () => {
      if (completedRef.current) return;
      completedRef.current = true;
      markArrived();
      onCompleteRef.current(flightRef.current);
    };

    progress.setValue(0);
    // Native sürücüyle çalışan Animated animasyonlarında JS addListener
    // geri çağrıları tetiklenmez; bu yüzden varış noktası platformdan
    // bağımsız ve deterministik olarak zamanlayıcı ile kurulum yapılır.
    const duration = isGem
      ? BONUS_GEM_FLIGHT_DURATION
      : isPoints
        ? POINTS_FLIGHT_DURATION
        : RESULT_FLIGHT_DURATION;
    const arrivalProgress = isGem
      ? BONUS_GEM_ARRIVAL_PROGRESS
      : isPoints
        ? POINTS_FLIGHT_ARRIVAL_PROGRESS
        : RESULT_FLIGHT_ARRIVAL_PROGRESS;
    const launchDelay = flightRef.current.delay ?? 0;
    const arrivalTimer = setTimeout(markArrived, launchDelay + duration * arrivalProgress);
    const completeTimer = setTimeout(markCompleted, launchDelay + duration);
    const timingAnimation = Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: isGem
        ? Easing.bezier(0.22, 0.61, 0.36, 1)
        : isPoints
          ? Easing.bezier(0.2, 0.72, 0.3, 1)
          : Easing.bezier(0.175, 0.885, 0.32, 1),
      useNativeDriver: true,
    });
    const animation =
      launchDelay > 0
        ? Animated.sequence([Animated.delay(launchDelay), timingAnimation])
        : timingAnimation;
    animation.start(({ finished }) => {
      if (!finished) return;
      markCompleted();
    });
    return () => {
      clearTimeout(arrivalTimer);
      clearTimeout(completeTimer);
      if (!completedRef.current) animation.stop();
      // Native sürücü `finished` vermeden kesilirse HUD ödülü yine bir kez basılsın.
      if (isGem || isPoints) markArrived();
    };
    // onArrive / onComplete her render’da yeni referans olabilir; bağımlılığa
    // almak animasyonu sıfırlar ve ödülü sonsuz döngüye sokar.
  }, [flight.id, isGem, isPoints, progress]);

  const middleX = flight.fromX + (flight.toX - flight.fromX) * 0.56;
  const middleY = (flight.fromY + flight.toY) / 2 - (isGem ? 82 : isPoints ? 64 : 48);
  const translateX = progress.interpolate({
    inputRange: [0, 0.56, 1],
    outputRange: [flight.fromX, middleX, flight.toX],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 0.56, 1],
    outputRange: [flight.fromY, middleY, flight.toY],
  });
  const scale = progress.interpolate(
    isGem
      ? {
          inputRange: [0, 0.16, 0.58, 0.84, 1],
          outputRange: [0.72, 1.16, 1, 1.08, 0.35],
        }
      : isPoints
        ? {
            inputRange: [0, 0.16, 0.72, 1],
            outputRange: [0.64, 1.14, 1, 0.38],
          }
        : {
            inputRange: [0, 0.2, 0.8, 1],
            outputRange: [1, 1.25, 1.02, 0.3],
          },
  );
  const opacity = progress.interpolate(
    isPoints
      ? { inputRange: [0, 0.06, 0.82, 1], outputRange: [0, 1, 1, 0] }
      : { inputRange: [0, 0.82, 1], outputRange: [1, 1, 0] },
  );
  const rotate = progress.interpolate({
    inputRange: [0, 0.56, 1],
    outputRange: isPoints ? ['-9deg', '5deg', '0deg'] : ['-5deg', '2deg', '0deg'],
  });

  return (
    <Animated.View
      style={[
        styles.resultFlight,
        isGem && styles.resultGemFlight,
        isPoints && styles.resultPointsFlight,
        {
          opacity,
          transform: [{ translateX }, { translateY }, { scale }, { rotate }],
        },
      ]}>
      {isGem ? (
        <Text style={styles.resultFlightGem}>💎</Text>
      ) : isPoints ? (
        <LinearGradient
          colors={['#FFE790', '#E7A928']}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.resultPointsSurface}>
          <Text style={styles.resultPointsStar}>★</Text>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.resultPointsValue}>
            +{flight.value}
          </Text>
        </LinearGradient>
      ) : (
        <LinearGradient
          colors={['#63D5B1', '#16906B']}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.resultFlightSurface}>
          <Text style={styles.resultFlightValue}>{flight.value}</Text>
        </LinearGradient>
      )}
    </Animated.View>
  );
}

export function CardGemLiftFlight({
  lift,
  onArrive,
  onComplete,
  onLiftStart,
}: {
  lift: CardGemLift;
  onArrive: (lift: CardGemLift) => void;
  onComplete: (lift: CardGemLift) => void;
  onLiftStart?: (lift: CardGemLift) => void;
}) {
  const [progress] = useState(() => new Animated.Value(0));
  const [visible, setVisible] = useState(() => (lift.delay ?? 0) <= 0);
  const arrivedRef = useRef(false);
  const completedRef = useRef(false);
  const startedRef = useRef(false);
  const onArriveRef = useRef(onArrive);
  const onCompleteRef = useRef(onComplete);
  const onLiftStartRef = useRef(onLiftStart);
  const liftRef = useRef(lift);
  onArriveRef.current = onArrive;
  onCompleteRef.current = onComplete;
  onLiftStartRef.current = onLiftStart;
  liftRef.current = lift;

  useEffect(() => {
    const markCompleted = () => {
      if (completedRef.current) return;
      completedRef.current = true;
      if (!arrivedRef.current) {
        arrivedRef.current = true;
        onArriveRef.current(liftRef.current);
      }
      onCompleteRef.current(liftRef.current);
    };
    const launchDelay = liftRef.current.delay ?? 0;
    const failSafeTimer = setTimeout(markCompleted, launchDelay + BONUS_GEM_FLIGHT_DURATION);
    const startTimer =
      launchDelay > 0 ? setTimeout(() => setVisible(true), launchDelay) : undefined;
    return () => {
      if (startTimer) clearTimeout(startTimer);
      clearTimeout(failSafeTimer);
    };
  }, [lift.id]);

  useLayoutEffect(() => {
    if (!visible || startedRef.current) return;
    startedRef.current = true;
    onLiftStartRef.current?.(liftRef.current);
  }, [lift.id, visible]);

  useEffect(() => {
    if (!visible) return;

    const markArrived = () => {
      if (arrivedRef.current) return;
      arrivedRef.current = true;
      onArriveRef.current(liftRef.current);
    };
    const markCompleted = () => {
      if (completedRef.current) return;
      completedRef.current = true;
      markArrived();
      onCompleteRef.current(liftRef.current);
    };

    progress.setValue(0);
    const duration = BONUS_GEM_FLIGHT_DURATION;
    const arrivalTimer = setTimeout(markArrived, duration * BONUS_GEM_ARRIVAL_PROGRESS);
    const completeTimer = setTimeout(markCompleted, duration);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.bezier(0.22, 0.61, 0.36, 1),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (!finished) return;
      markCompleted();
    });
    return () => {
      clearTimeout(arrivalTimer);
      clearTimeout(completeTimer);
      if (!completedRef.current) animation.stop();
      markArrived();
    };
    // onArrive / onComplete her render’da yeni referans olabilir; bağımlılığa
    // almak animasyonu sıfırlar ve ödülü sonsuz döngüye sokar.
  }, [lift.id, progress, visible]);

  if (!visible) return null;

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [lift.fromX, lift.toX],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [lift.fromY, lift.toY],
  });
  const scale = progress.interpolate({
    inputRange: [0, 0.24, 1],
    outputRange: [1, 1.2, 0.78],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.08, 0.78, 1],
    outputRange: [1, 1, 1, 0],
  });

  return (
    <Animated.View
      style={[
        styles.cardGemLift,
        {
          opacity,
          transform: [{ translateX }, { translateY }, { scale }],
        },
      ]}>
      <GemIcon color="#66D7FF" facetColor="#FFFFFF" outlineColor="#0B5875" size={16} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardGemLift: {
    position: 'absolute',
    left: -CARD_GEM_LIFT_SIZE / 2,
    top: -CARD_GEM_LIFT_SIZE / 2,
    width: CARD_GEM_LIFT_SIZE,
    height: CARD_GEM_LIFT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultFlight: {
    position: 'absolute',
    left: -RESULT_FLIGHT_WIDTH / 2,
    top: -RESULT_FLIGHT_HEIGHT / 2,
    width: RESULT_FLIGHT_WIDTH,
    height: RESULT_FLIGHT_HEIGHT,
    borderRadius: RESULT_FLIGHT_HEIGHT / 2,
    shadowColor: '#064E3B',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.42,
    shadowRadius: 9,
    elevation: 16,
  },
  resultFlightSurface: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RESULT_FLIGHT_HEIGHT / 2,
    borderWidth: 2,
    borderColor: 'rgba(236,253,245,0.96)',
  },
  resultGemFlight: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6B3E91',
    shadowOpacity: 0.32,
    shadowRadius: 5,
  },
  resultPointsFlight: {
    left: -POINTS_FLIGHT_WIDTH / 2,
    top: -POINTS_FLIGHT_HEIGHT / 2,
    width: POINTS_FLIGHT_WIDTH,
    height: POINTS_FLIGHT_HEIGHT,
    borderRadius: POINTS_FLIGHT_HEIGHT / 2,
    shadowColor: '#8A5A08',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.34,
    shadowRadius: 7,
    elevation: 18,
  },
  resultPointsSurface: {
    flex: 1,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: POINTS_FLIGHT_HEIGHT / 2,
    borderWidth: 2,
    borderColor: 'rgba(255,250,220,0.98)',
  },
  resultPointsStar: {
    color: '#FFFDF0',
    fontFamily: FONTS.black,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
    textShadowColor: 'rgba(98,62,4,0.42)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  resultPointsValue: {
    minWidth: 0,
    flexShrink: 1,
    color: '#583A0C',
    fontFamily: FONTS.black,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  resultFlightValue: {
    color: '#FFFFFF',
    fontFamily: FONTS.black,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
    textShadowColor: 'rgba(4,47,46,0.42)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  resultFlightGem: {
    fontSize: 32,
    lineHeight: 40,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
});
