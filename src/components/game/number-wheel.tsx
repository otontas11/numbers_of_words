import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  GestureResponderEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

import { FONTS } from '@/constants/fonts';
import { updateWheelSelection } from '@/game/wheel-selection';

type Point = {
  x: number;
  y: number;
};

type NumberWheelProps = {
  size: number;
  numbers: number[];
  hintIndices: number[];
  onPreview: (indices: number[]) => void;
  onComplete: (indices: number[], resultOrigin?: Point) => void;
  onHint: () => void;
  onShuffle: () => void;
  onNodeAdded: (selectionCount: number) => void;
  onDraggingChange: (dragging: boolean) => void;
};

const SHUFFLE_DURATION = 450;
const SHUFFLE_EASING = Easing.bezier(0.34, 1.3, 0.64, 1);

function findNodesAlongSegment(
  from: Point,
  to: Point,
  positions: Point[],
  hitRadius: number,
): number[] {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;

  return positions
    .map((position, index) => {
      const rawProgress =
        lengthSquared > 0
          ? ((position.x - from.x) * deltaX + (position.y - from.y) * deltaY) /
            lengthSquared
          : 0;
      const progress = Math.max(0, Math.min(1, rawProgress));
      const nearestX = from.x + deltaX * progress;
      const nearestY = from.y + deltaY * progress;
      const distance = Math.hypot(position.x - nearestX, position.y - nearestY);
      return distance <= hitRadius ? { index, progress } : null;
    })
    .filter((match): match is { index: number; progress: number } => match !== null)
    .sort((left, right) => left.progress - right.progress)
    .map((match) => match.index);
}

function HintIcon() {
  return (
    <Svg height={22} viewBox="0 0 24 24" width={22}>
      <Path
        d="M9 21h6v-1H9v1zm3-19a7 7 0 0 0-4.35 12.48C8.48 15.14 9 16.12 9 17h6c0-.88.52-1.86 1.35-2.52A7 7 0 0 0 12 2zm-2 16v-1h4v1h-4zm5.1-5.08c-1.14.9-1.8 1.63-2.02 2.08h-2.16c-.22-.45-.88-1.18-2.02-2.08a5 5 0 1 1 6.2 0z"
        fill="#FFFFFF"
      />
    </Svg>
  );
}

function ShuffleIcon() {
  return (
    <Svg height={22} viewBox="0 0 24 24" width={22}>
      <Path
        d="M16 3h5v5l-1.8-1.8-3.55 3.55-1.4-1.4 3.55-3.55L16 3zM3 6h3.25c1.54 0 2.94.88 3.62 2.26l4.26 8.48A4.04 4.04 0 0 0 17.75 19H21v-2h-3.25c-.78 0-1.49-.44-1.84-1.14l-4.26-8.48A6.02 6.02 0 0 0 6.25 4H3v2zm5.63 8.28 1.12 2.23A6.03 6.03 0 0 1 6.25 20H3v-2h3.25c.78 0 1.49-.44 1.84-1.14l.54-1.08zm10.57 3.52L21 16v5h-5l1.8-1.8 1.4-1.4z"
        fill="#FFFFFF"
      />
    </Svg>
  );
}

function shuffledIndices(count: number): number[] {
  const result = Array.from({ length: count }, (_, index) => index);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function ConnectorLine({
  from,
  to,
  fromRadius = 0,
  toRadius = 0,
}: {
  from: Point;
  to: Point;
  fromRadius?: number;
  toRadius?: number;
}) {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const centerDistance = Math.hypot(deltaX, deltaY);
  const length = centerDistance - fromRadius - toRadius;
  if (length < 2 || centerDistance === 0) return null;

  const angle = Math.atan2(deltaY, deltaX);
  const unitX = deltaX / centerDistance;
  const unitY = deltaY / centerDistance;
  const start = {
    x: from.x + unitX * fromRadius,
    y: from.y + unitY * fromRadius,
  };
  const end = {
    x: to.x - unitX * toRadius,
    y: to.y - unitY * toRadius,
  };
  return (
    <View
      style={[
        styles.connector,
        {
          left: (start.x + end.x) / 2 - length / 2,
          top: (start.y + end.y) / 2 - 2.5,
          width: length,
          transform: [{ rotate: `${angle}rad` }],
        },
      ]}
    />
  );
}

export function NumberWheel({
  size,
  numbers,
  hintIndices,
  onPreview,
  onComplete,
  onHint,
  onShuffle,
  onNodeAdded,
  onDraggingChange,
}: NumberWheelProps) {
  const [slotOrder, setSlotOrder] = useState(() =>
    Array.from({ length: numbers.length }, (_, index) => index),
  );
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [pointer, setPointer] = useState<Point | null>(null);
  const wheelRef = useRef<View>(null);
  const originRef = useRef<Point>({ x: 0, y: 0 });
  const lastPointerRef = useRef<Point | null>(null);
  const selectedRef = useRef<number[]>([]);
  const slotOrderRef = useRef(slotOrder);
  const isShufflingRef = useRef(false);
  const shuffleAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const hintAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const rotationTurnsRef = useRef(0);
  const [rotation] = useState(() => new Animated.Value(0));
  const [hintPulse] = useState(() => new Animated.Value(0));

  const nodeSize = size < 300 ? 60 : 62;
  const innerSize = size;
  const center = innerSize / 2;
  const radius = Math.max(72, center - nodeSize / 2 - 10);
  const slots = useMemo(
    () =>
      numbers.map((_, index) => {
        const angle = (index * Math.PI * 2) / numbers.length - Math.PI / 2;
        return {
          x: center + radius * Math.cos(angle),
          y: center + radius * Math.sin(angle),
        };
      }),
    [center, numbers, radius],
  );
  const [animatedPositions] = useState(() =>
    slots.map((slot) => new Animated.ValueXY({ x: slot.x, y: slot.y })),
  );
  const positions = useMemo(
    () => numbers.map((_, numberIndex) => slots[slotOrder[numberIndex] ?? numberIndex]),
    [numbers, slotOrder, slots],
  );

  useEffect(
    () => () => {
      shuffleAnimationRef.current?.stop();
      hintAnimationRef.current?.stop();
    },
    [],
  );

  useEffect(() => {
    hintAnimationRef.current?.stop();
    hintPulse.setValue(0);
    if (hintIndices.length === 0) return;

    const animation = Animated.sequence([
      Animated.timing(hintPulse, { toValue: 1, duration: 375, useNativeDriver: true }),
      Animated.timing(hintPulse, { toValue: 0, duration: 375, useNativeDriver: true }),
      Animated.timing(hintPulse, { toValue: 1, duration: 375, useNativeDriver: true }),
      Animated.timing(hintPulse, { toValue: 0, duration: 375, useNativeDriver: true }),
    ]);
    hintAnimationRef.current = animation;
    animation.start();
    return () => animation.stop();
  }, [hintIndices, hintPulse]);

  const findNode = (point: Point) => {
    if (isShufflingRef.current) return -1;
    return positions.findIndex(
      (position) =>
        Math.hypot(position.x - point.x, position.y - point.y) <= nodeSize / 2 + 9,
    );
  };

  const grantPoint = (event: GestureResponderEvent): Point => {
    const { locationX, locationY, pageX, pageY } = event.nativeEvent;
    if (
      Number.isFinite(pageX) &&
      Number.isFinite(pageY) &&
      Number.isFinite(locationX) &&
      Number.isFinite(locationY)
    ) {
      originRef.current = { x: pageX - locationX, y: pageY - locationY };
    }
    return { x: locationX, y: locationY };
  };

  const movePoint = (event: GestureResponderEvent): Point => {
    const { locationX, locationY, pageX, pageY } = event.nativeEvent;
    if (Number.isFinite(pageX) && Number.isFinite(pageY)) {
      return { x: pageX - originRef.current.x, y: pageY - originRef.current.y };
    }
    return { x: locationX, y: locationY };
  };

  const clearGesture = () => {
    selectedRef.current = [];
    setSelectedIndices([]);
    setPointer(null);
    lastPointerRef.current = null;
    onDraggingChange(false);
  };

  const handleGrant = (event: GestureResponderEvent) => {
    const point = grantPoint(event);
    const nodeIndex = findNode(point);
    if (nodeIndex < 0) return;

    const next = [nodeIndex];
    selectedRef.current = next;
    setSelectedIndices(next);
    setPointer(point);
    lastPointerRef.current = point;
    onDraggingChange(true);
    onNodeAdded(next.length);
    onPreview(next);
  };

  const handleMove = (event: GestureResponderEvent) => {
    if (selectedRef.current.length === 0) return;
    const point = movePoint(event);
    setPointer(point);

    const previousPoint = lastPointerRef.current ?? point;
    lastPointerRef.current = point;
    const current = selectedRef.current;
    const update = updateWheelSelection(
      current,
      findNodesAlongSegment(previousPoint, point, positions, nodeSize / 2 + 10),
      numbers.length,
    );
    update.addedSelectionCounts.forEach(onNodeAdded);

    if (update.changed) {
      selectedRef.current = update.selection;
      setSelectedIndices(update.selection);
      onPreview(update.selection);
    }
  };

  const handleRelease = () => {
    const completedSelection = [...selectedRef.current];
    if (completedSelection.length > 0) {
      const lastIndex = completedSelection[completedSelection.length - 1];
      const lastPosition = positions[lastIndex];
      const resultOrigin = lastPosition
        ? {
            x: originRef.current.x + lastPosition.x,
            y: originRef.current.y + lastPosition.y,
          }
        : undefined;
      onComplete(completedSelection, resultOrigin);
    }
    clearGesture();
  };

  const shuffleNodes = () => {
    let next = shuffledIndices(numbers.length);
    let attempts = 0;
    while (next.every((value, index) => value === slotOrderRef.current[index]) && attempts < 8) {
      next = shuffledIndices(numbers.length);
      attempts += 1;
    }

    shuffleAnimationRef.current?.stop();
    slotOrderRef.current = next;
    setSlotOrder(next);
    rotationTurnsRef.current += 1;
    isShufflingRef.current = true;

    const animation = Animated.parallel([
      ...animatedPositions.map((position, numberIndex) =>
        Animated.timing(position, {
          toValue: slots[next[numberIndex] ?? numberIndex],
          duration: SHUFFLE_DURATION,
          easing: SHUFFLE_EASING,
          useNativeDriver: true,
        }),
      ),
      Animated.timing(rotation, {
        toValue: rotationTurnsRef.current,
        duration: SHUFFLE_DURATION,
        easing: SHUFFLE_EASING,
        useNativeDriver: true,
      }),
    ]);
    shuffleAnimationRef.current = animation;
    animation.start(() => {
      if (shuffleAnimationRef.current === animation) {
        shuffleAnimationRef.current = null;
        isShufflingRef.current = false;
      }
    });
    onShuffle();
  };

  const selectedPoints = selectedIndices.map((index) => positions[index]);
  const selectedRadius = (nodeSize * 1.25) / 2;
  const hintScale = hintPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.3],
  });
  const rotationStyle = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
    extrapolate: 'extend',
  });

  return (
    <View style={[styles.wheelArea, { width: size }]}>
      <View style={[styles.wheelShadow, { width: size, height: size }]}>
        <View
          ref={wheelRef}
          accessibilityLabel="Sayı bağlantı çemberi"
          onLayout={() => {
            wheelRef.current?.measureInWindow((x, y) => {
              originRef.current = { x, y };
            });
          }}
          onMoveShouldSetResponder={() => selectedRef.current.length > 0}
          onResponderGrant={handleGrant}
          onResponderMove={handleMove}
          onResponderRelease={handleRelease}
          onResponderTerminate={clearGesture}
          onResponderTerminationRequest={() => false}
          onStartShouldSetResponder={(event) => findNode(grantPoint(event)) >= 0}
          style={[styles.wheel, { borderRadius: innerSize / 2 }]}>
          <Svg height="100%" pointerEvents="none" style={StyleSheet.absoluteFill} width="100%">
            <Circle
              cx={center}
              cy={center + 3}
              fill="transparent"
              r={radius}
              stroke="rgba(0,0,0,0.10)"
              strokeLinecap="round"
              strokeWidth={10}
            />
            <Circle
              cx={center}
              cy={center}
              fill="transparent"
              r={radius}
              stroke="rgba(55,83,92,0.42)"
              strokeLinecap="round"
              strokeWidth={7}
            />
          </Svg>

          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {selectedPoints.slice(1).map((point, index) => (
              <ConnectorLine
                key={`selected-${selectedIndices[index]}-${selectedIndices[index + 1]}`}
                from={selectedPoints[index]}
                fromRadius={selectedRadius}
                to={point}
                toRadius={selectedRadius}
              />
            ))}
            {pointer && selectedPoints.length > 0 ? (
              <ConnectorLine
                from={selectedPoints[selectedPoints.length - 1]}
                fromRadius={selectedRadius}
                to={pointer}
              />
            ) : null}
          </View>

          {numbers.map((number, index) => {
            const selected = selectedIndices.includes(index);
            const hinted = hintIndices.includes(index);
            return (
              <Animated.View
                key={`${index}-${number}`}
                pointerEvents="none"
                style={[
                  styles.nodeShadow,
                  {
                    width: nodeSize,
                    height: nodeSize,
                    borderRadius: nodeSize / 2,
                    left: 0,
                    top: 0,
                    transform: [
                      {
                        translateX: Animated.subtract(
                          animatedPositions[index].x,
                          nodeSize / 2,
                        ),
                      },
                      {
                        translateY: Animated.subtract(
                          animatedPositions[index].y,
                          nodeSize / 2,
                        ),
                      },
                      { scale: selected ? 1.25 : hinted ? hintScale : 1 },
                    ],
                  },
                  selected && styles.nodeSelectedShadow,
                  hinted && styles.nodeHintedShadow,
                ]}>
                <View
                  style={[
                    styles.node,
                    { width: nodeSize, height: nodeSize, borderRadius: nodeSize / 2 },
                    selected && styles.nodeSelected,
                    hinted && styles.nodeHinted,
                  ]}>
                  <Svg
                    height="100%"
                    pointerEvents="none"
                    style={StyleSheet.absoluteFill}
                    width="100%">
                    <Defs>
                      <SvgLinearGradient
                        id={`node-surface-${index}`}
                        x1="0%"
                        x2="100%"
                        y1="0%"
                        y2="100%">
                        <Stop offset="0%" stopColor={selected ? '#4B98AA' : '#F8FCFB'} />
                        <Stop offset="100%" stopColor={selected ? '#316D80' : '#DAEBEB'} />
                      </SvgLinearGradient>
                    </Defs>
                    <Circle
                      cx="50%"
                      cy="50%"
                      fill={`url(#node-surface-${index})`}
                      r="50%"
                    />
                    {!selected ? (
                      <Circle cx="34%" cy="31%" fill="rgba(255,255,255,0.34)" r="15%" />
                    ) : null}
                  </Svg>
                  <Text
                    style={[
                      styles.nodeText,
                      selected && styles.nodeTextSelected,
                      { fontSize: size < 300 ? 20 : 24, lineHeight: size < 300 ? 25 : 30 },
                    ]}>
                    {number}
                  </Text>
                </View>
              </Animated.View>
            );
          })}
        </View>
      </View>

      <View style={[styles.actionRow, { width: size }]}>
        <Pressable
          accessibilityLabel="İpucu göster"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onHint}
          style={({ pressed }) => [styles.controlButton, pressed && styles.controlPressed]}>
          <ExpoLinearGradient
            colors={['rgba(50,58,62,0.73)', 'rgba(28,36,41,0.75)']}
            end={{ x: 0, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.controlSurface}>
            <HintIcon />
            <Text style={styles.controlLabel}>İpucu</Text>
          </ExpoLinearGradient>
        </Pressable>

        <Pressable
          accessibilityLabel="Sayıları karıştır"
          accessibilityRole="button"
          hitSlop={8}
          onPress={shuffleNodes}
          style={({ pressed }) => [styles.controlButton, pressed && styles.controlPressed]}>
          <ExpoLinearGradient
            colors={['rgba(50,58,62,0.73)', 'rgba(28,36,41,0.75)']}
            end={{ x: 0, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.controlSurface}>
            <Animated.View style={{ transform: [{ rotate: rotationStyle }] }}>
              <ShuffleIcon />
            </Animated.View>
            <Text style={styles.controlLabel}>Karıştır</Text>
          </ExpoLinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wheelArea: {
    alignItems: 'center',
  },
  wheelShadow: {
    position: 'relative',
  },
  wheel: {
    flex: 1,
    position: 'relative',
    overflow: 'visible',
  },
  connector: {
    position: 'absolute',
    height: 5,
    borderRadius: 999,
    backgroundColor: '#3A7A8D',
    shadowColor: '#233C48',
    shadowOpacity: 0.28,
    shadowRadius: 4,
    elevation: 2,
  },
  nodeShadow: {
    position: 'absolute',
    zIndex: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
    elevation: 6,
  },
  nodeSelectedShadow: {
    shadowColor: '#3D7F91',
    shadowOpacity: 0.72,
    shadowRadius: 12,
    elevation: 12,
  },
  nodeHintedShadow: {
    zIndex: 30,
    shadowColor: '#EEC362',
    shadowOpacity: 0.94,
    shadowRadius: 15,
    elevation: 14,
  },
  node: {
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(92,122,130,0.76)',
  },
  nodeSelected: {
    borderColor: 'rgba(232,247,247,0.95)',
    borderWidth: 3,
  },
  nodeHinted: {
    borderColor: '#EEC362',
    borderWidth: 4,
  },
  nodeText: {
    zIndex: 1,
    color: '#233540',
    fontFamily: FONTS.black,
    fontWeight: '900',
  },
  nodeTextSelected: {
    color: '#FFFFFF',
  },
  actionRow: {
    height: 62,
    marginTop: 1,
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlButton: {
    width: 52,
    height: 52,
    overflow: 'hidden',
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: 'rgba(236,240,240,0.74)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 4,
  },
  controlPressed: {
    opacity: 0.76,
    transform: [{ scale: 0.94 }],
  },
  controlSurface: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    borderRadius: 26,
    padding: 3,
  },
  controlLabel: {
    color: '#FFFFFF',
    fontFamily: FONTS.black,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '900',
  },
});
