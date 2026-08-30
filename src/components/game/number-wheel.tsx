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
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { FONTS } from '@/constants/fonts';

type Point = {
  x: number;
  y: number;
};

type NumberWheelProps = {
  size: number;
  numbers: number[];
  maxSelection: 2 | 3;
  hintIndices: number[];
  onPreview: (indices: number[]) => void;
  onComplete: (indices: number[]) => void;
  onHint: () => void;
  onShuffle: () => void;
  onNodeAdded: () => void;
  onDraggingChange: (dragging: boolean) => void;
};

const SHUFFLE_DURATION = 450;
const SHUFFLE_EASING = Easing.bezier(0.34, 1.3, 0.64, 1);
const WHEEL_BORDER_WIDTH = 5;

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
  maxSelection,
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
  const selectedRef = useRef<number[]>([]);
  const slotOrderRef = useRef(slotOrder);
  const isShufflingRef = useRef(false);
  const shuffleAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const hintAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const rotationTurnsRef = useRef(0);
  const [rotation] = useState(() => new Animated.Value(0));
  const [hintPulse] = useState(() => new Animated.Value(0));

  const nodeSize = size < 300 ? 60 : 62;
  const radius = size * 0.35;
  const innerSize = size - WHEEL_BORDER_WIDTH * 2;
  const center = innerSize / 2;
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
    onDraggingChange(true);
    onNodeAdded();
    onPreview(next);
  };

  const handleMove = (event: GestureResponderEvent) => {
    if (selectedRef.current.length === 0) return;
    const point = movePoint(event);
    setPointer(point);

    const nodeIndex = findNode(point);
    const current = selectedRef.current;
    if (nodeIndex >= 0 && !current.includes(nodeIndex) && current.length < maxSelection) {
      const next = [...current, nodeIndex];
      selectedRef.current = next;
      setSelectedIndices(next);
      onNodeAdded();
      onPreview(next);
    }
  };

  const handleRelease = () => {
    if (selectedRef.current.length > 0) onComplete([...selectedRef.current]);
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
    <View
      style={[styles.wheelShadow, { width: size, height: size, borderRadius: size / 2 }]}>
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
          <Defs>
            <RadialGradient cx="50%" cy="50%" id="wheel-surface" r="70%">
              <Stop offset="0%" stopColor="#1E293B" stopOpacity={0.92} />
              <Stop offset="100%" stopColor="#0F172A" stopOpacity={0.98} />
            </RadialGradient>
          </Defs>
          <Circle cx="50%" cy="50%" fill="url(#wheel-surface)" r="50%" />
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
                    <RadialGradient
                      cx="35%"
                      cy="35%"
                      id={`node-surface-${index}`}
                      r="72%">
                      <Stop
                        offset="0%"
                        stopColor={selected ? '#3B82F6' : hinted ? '#F59E0B' : '#334155'}
                      />
                      <Stop
                        offset="100%"
                        stopColor={selected ? '#1D4ED8' : hinted ? '#B45309' : '#0F172A'}
                      />
                    </RadialGradient>
                  </Defs>
                  <Circle
                    cx="50%"
                    cy="50%"
                    fill={`url(#node-surface-${index})`}
                    r="50%"
                  />
                </Svg>
                <Text
                  style={[
                    styles.nodeText,
                    { fontSize: size < 300 ? 20 : 24, lineHeight: size < 300 ? 25 : 30 },
                ]}>
                  {number}
                </Text>
              </View>
            </Animated.View>
          );
        })}

        <View style={styles.centerControls}>
          <View style={styles.instructionPill}>
            <Text style={styles.instructionText}>Sayıları Birleştir</Text>
          </View>
          <View style={styles.controlRow}>
            <Pressable
              accessibilityLabel="Sayıları karıştır"
              accessibilityRole="button"
              hitSlop={8}
              onPress={shuffleNodes}
              style={({ pressed }) => [styles.controlButton, pressed && styles.controlPressed]}>
              <Animated.Text style={[styles.controlIcon, { transform: [{ rotate: rotationStyle }] }]}>
                🔀
              </Animated.Text>
            </Pressable>
            <Pressable
              accessibilityLabel="İpucu göster"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onHint}
              style={({ pressed }) => [
                styles.controlButton,
                styles.hintButton,
                pressed && styles.controlPressed,
              ]}>
              <Text style={styles.controlIcon}>💡</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wheelShadow: {
    borderWidth: WHEEL_BORDER_WIDTH,
    borderColor: 'rgba(245,158,11,0.45)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.55,
    shadowRadius: 22,
    elevation: 18,
  },
  wheel: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  connector: {
    position: 'absolute',
    height: 5,
    borderRadius: 999,
    backgroundColor: '#3B82F6',
    shadowColor: '#60A5FA',
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 2,
  },
  nodeShadow: {
    position: 'absolute',
    zIndex: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.6,
    shadowRadius: 11,
    elevation: 10,
  },
  nodeSelectedShadow: {
    shadowColor: '#3B82F6',
    shadowOpacity: 0.95,
    shadowRadius: 18,
    elevation: 18,
  },
  nodeHintedShadow: {
    zIndex: 30,
    shadowColor: '#F59E0B',
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 18,
  },
  node: {
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(203,213,225,0.8)',
  },
  nodeSelected: {
    borderColor: '#BFDBFE',
    borderWidth: 3,
  },
  nodeHinted: {
    borderColor: '#FEF3C7',
    borderWidth: 3,
  },
  nodeText: {
    zIndex: 1,
    color: '#FFFFFF',
    fontFamily: FONTS.black,
    fontWeight: '900',
  },
  centerControls: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 152,
    marginLeft: -76,
    marginTop: -40,
    zIndex: 8,
    alignItems: 'center',
    gap: 8,
  },
  instructionPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.38)',
    backgroundColor: 'rgba(2,6,23,0.94)',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  instructionText: {
    color: '#FCD34D',
    fontFamily: FONTS.extraBold,
    fontWeight: '800',
    fontSize: 11,
  },
  controlRow: {
    flexDirection: 'row',
    gap: 10,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#64748B',
    backgroundColor: 'rgba(30,41,59,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.45,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  hintButton: {
    borderColor: 'rgba(245,158,11,0.75)',
    backgroundColor: 'rgba(120,53,15,0.5)',
  },
  controlPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.94 }],
  },
  controlIcon: {
    fontSize: 18,
  },
});
