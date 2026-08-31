import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import {
  useCallback,
  useEffect,
  memo,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated as RNAnimated,
  Easing,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  runOnJS,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

import { FONTS } from '@/constants/fonts';

type Point = {
  x: number;
  y: number;
};

type NumberWheelProps = {
  size: number;
  numbers: number[];
  hintIndices: number[];
  onPreview: (indices: number[]) => void;
  onComplete: (indices: number[], resultOrigin?: Point) => WheelSelectionOutcome;
  onHint: () => void;
  onShuffle: () => void;
  onNodeAdded: (selectionCount: number) => void;
  onDraggingChange: (dragging: boolean) => void;
};

export type WheelSelectionOutcome = 'success' | 'bonus' | 'invalid';
type ConnectionTone = WheelSelectionOutcome | 'active';

const SHUFFLE_DURATION = 450;
const SHUFFLE_EASING = Easing.bezier(0.34, 1.3, 0.64, 1);
const SELECTION_HOLD_DURATION: Record<WheelSelectionOutcome, number> = {
  success: 520,
  bonus: 440,
  invalid: 180,
};
const CONNECTION_COLORS: Record<
  ConnectionTone,
  { core: string; end: string; glow: string; start: string }
> = {
  active: {
    start: '#78E1EA',
    end: '#347C91',
    core: 'rgba(235,255,255,0.92)',
    glow: 'rgba(79,195,211,0.28)',
  },
  success: {
    start: '#8CF0C3',
    end: '#15966D',
    core: 'rgba(238,255,247,0.96)',
    glow: 'rgba(34,197,135,0.34)',
  },
  bonus: {
    start: '#FFE58A',
    end: '#C58A24',
    core: 'rgba(255,251,224,0.97)',
    glow: 'rgba(245,190,62,0.36)',
  },
  invalid: {
    start: '#FFA09A',
    end: '#CC4F57',
    core: 'rgba(255,240,240,0.94)',
    glow: 'rgba(232,91,100,0.3)',
  },
};
const ReanimatedPath = Reanimated.createAnimatedComponent(Path);

function findNodesAlongSegment(
  from: Point,
  to: Point,
  positions: Point[],
  hitRadius: number,
): number[] {
  'worklet';
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  const matches: { index: number; progress: number }[] = [];

  for (let index = 0; index < positions.length; index += 1) {
    const position = positions[index];
    const rawProgress =
      lengthSquared > 0
        ? ((position.x - from.x) * deltaX + (position.y - from.y) * deltaY) /
          lengthSquared
        : 0;
    const progress = Math.max(0, Math.min(1, rawProgress));
    const nearestX = from.x + deltaX * progress;
    const nearestY = from.y + deltaY * progress;
    const distanceX = position.x - nearestX;
    const distanceY = position.y - nearestY;
    if (distanceX * distanceX + distanceY * distanceY <= hitRadius * hitRadius) {
      matches.push({ index, progress });
    }
  }

  matches.sort((left, right) => left.progress - right.progress);
  return matches.map((match) => match.index);
}

function findNodeAtPoint(
  point: Point,
  positions: Point[],
  hitRadius: number,
): number {
  'worklet';
  const hitRadiusSquared = hitRadius * hitRadius;
  for (let index = 0; index < positions.length; index += 1) {
    const position = positions[index];
    const distanceX = position.x - point.x;
    const distanceY = position.y - point.y;
    if (distanceX * distanceX + distanceY * distanceY <= hitRadiusSquared) {
      return index;
    }
  }
  return -1;
}

function updateSelectionOnUI(
  currentSelection: number[],
  traversedNodeIndices: number[],
  nodeCount: number,
) {
  'worklet';
  let selection = [...currentSelection];
  const addedSelectionCounts: number[] = [];
  let changed = false;

  traversedNodeIndices.forEach((nodeIndex) => {
    const lastIndex = selection[selection.length - 1];
    if (nodeIndex === lastIndex) return;

    const previousIndex = selection[selection.length - 2];
    if (selection.length > 1 && nodeIndex === previousIndex) {
      selection = selection.slice(0, -1);
      changed = true;
      return;
    }

    if (
      nodeIndex < 0 ||
      nodeIndex >= nodeCount ||
      selection.includes(nodeIndex) ||
      selection.length >= nodeCount
    ) {
      return;
    }

    selection = [...selection, nodeIndex];
    addedSelectionCounts.push(selection.length);
    changed = true;
  });

  return { selection, addedSelectionCounts, changed };
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

function ActiveSelectionPath({
  active,
  pointerX,
  pointerY,
  positions,
  selection,
  fromRadius,
  tone,
}: {
  active: SharedValue<boolean>;
  pointerX: SharedValue<number>;
  pointerY: SharedValue<number>;
  positions: Point[];
  selection: SharedValue<number[]>;
  fromRadius: number;
  tone: ConnectionTone;
}) {
  const colors = CONNECTION_COLORS[tone];
  const animatedProps = useAnimatedProps(() => {
    const currentSelection = selection.value;
    if (!active.value || currentSelection.length === 0) {
      return { d: '', opacity: 0 };
    }

    let path = '';
    for (let index = 1; index < currentSelection.length; index += 1) {
      const from = positions[currentSelection[index - 1]];
      const to = positions[currentSelection[index]];
      const deltaX = to.x - from.x;
      const deltaY = to.y - from.y;
      const distance = Math.hypot(deltaX, deltaY);
      if (distance <= fromRadius * 2) continue;
      const unitX = deltaX / distance;
      const unitY = deltaY / distance;
      path += `M ${from.x + unitX * fromRadius} ${from.y + unitY * fromRadius} `;
      path += `L ${to.x - unitX * fromRadius} ${to.y - unitY * fromRadius} `;
    }

    const lastPosition = positions[currentSelection[currentSelection.length - 1]];
    const pointerDeltaX = pointerX.value - lastPosition.x;
    const pointerDeltaY = pointerY.value - lastPosition.y;
    const pointerDistance = Math.hypot(pointerDeltaX, pointerDeltaY);
    if (pointerDistance > fromRadius) {
      const unitX = pointerDeltaX / pointerDistance;
      const unitY = pointerDeltaY / pointerDistance;
      path += `M ${lastPosition.x + unitX * fromRadius} `;
      path += `${lastPosition.y + unitY * fromRadius} `;
      path += `L ${pointerX.value} ${pointerY.value}`;
    }

    return { d: path, opacity: 1 };
  }, [fromRadius, positions]);

  return (
    <Svg height="100%" pointerEvents="none" style={StyleSheet.absoluteFill} width="100%">
      <Defs>
        <SvgLinearGradient id="selection-flow" x1="0%" x2="100%" y1="0%" y2="100%">
          <Stop offset="0%" stopColor={colors.start} />
          <Stop offset="100%" stopColor={colors.end} />
        </SvgLinearGradient>
      </Defs>
      <ReanimatedPath
        animatedProps={animatedProps}
        fill="none"
        stroke={colors.glow}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeWidth={14}
      />
      <ReanimatedPath
        animatedProps={animatedProps}
        fill="none"
        stroke="url(#selection-flow)"
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeWidth={6}
      />
      <ReanimatedPath
        animatedProps={animatedProps}
        fill="none"
        stroke={colors.core}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeWidth={2}
      />
    </Svg>
  );
}

function SpringSelectionSurface({
  children,
  selected,
  style,
}: {
  children: ReactNode;
  selected: boolean;
  style: StyleProp<ViewStyle>;
}) {
  const scale = useSharedValue(selected ? 1.25 : 1);

  useEffect(() => {
    scale.value = withSpring(selected ? 1.25 : 1, {
      damping: 16,
      stiffness: 280,
      mass: 0.65,
      overshootClamping: false,
    });
  }, [scale, selected]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return <Reanimated.View style={[style, animatedStyle]}>{children}</Reanimated.View>;
}

export const NumberWheel = memo(function NumberWheel({
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
  const [connectionTone, setConnectionTone] = useState<ConnectionTone>('active');
  const wheelRef = useRef<View>(null);
  const originRef = useRef<Point>({ x: 0, y: 0 });
  const slotOrderRef = useRef(slotOrder);
  const shuffleAnimationRef = useRef<RNAnimated.CompositeAnimation | null>(null);
  const hintAnimationRef = useRef<RNAnimated.CompositeAnimation | null>(null);
  const selectionReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rotationTurnsRef = useRef(0);
  const [rotation] = useState(() => new RNAnimated.Value(0));
  const [hintPulse] = useState(() => new RNAnimated.Value(0));
  const activePointer = useSharedValue(false);
  const pointerX = useSharedValue(0);
  const pointerY = useSharedValue(0);
  const lastPointerX = useSharedValue(0);
  const lastPointerY = useSharedValue(0);
  const gestureAccepted = useSharedValue(false);
  const selectionOnUI = useSharedValue<number[]>([]);
  const shufflingOnUI = useSharedValue(false);
  const holdingOnUI = useSharedValue(false);
  const callbacksRef = useRef({
    onComplete,
    onDraggingChange,
    onNodeAdded,
    onPreview,
  });

  const nodeSize = size < 300 ? 64 : 66;
  // Android WordWheelView ile aynı 1.18× yarıçap: kolay yakalanır, komşu düğüme
  // gereksiz yapışma üretmez. Hızlı hareketler ayrıca segment boyunca taranır.
  const hitRadius = (nodeSize / 2) * 1.18;
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
    slots.map((slot) => new RNAnimated.ValueXY({ x: slot.x, y: slot.y })),
  );
  const positions = useMemo(
    () => numbers.map((_, numberIndex) => slots[slotOrder[numberIndex] ?? numberIndex]),
    [numbers, slotOrder, slots],
  );
  const positionsRef = useRef(positions);

  const clearSelectionVisuals = useCallback(() => {
    if (selectionReleaseTimerRef.current) {
      clearTimeout(selectionReleaseTimerRef.current);
      selectionReleaseTimerRef.current = null;
    }
    setSelectedIndices([]);
    setConnectionTone('active');
    callbacksRef.current.onDraggingChange(false);
    // SharedValues are intentionally released from JS after the result hold.
    // eslint-disable-next-line react-hooks/immutability
    activePointer.value = false;
    // eslint-disable-next-line react-hooks/immutability
    selectionOnUI.value = [];
    // eslint-disable-next-line react-hooks/immutability
    holdingOnUI.value = false;
  }, [activePointer, holdingOnUI, selectionOnUI]);

  useEffect(() => {
    callbacksRef.current = { onComplete, onDraggingChange, onNodeAdded, onPreview };
  }, [onComplete, onDraggingChange, onNodeAdded, onPreview]);

  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);

  useEffect(
    () => () => {
      shuffleAnimationRef.current?.stop();
      hintAnimationRef.current?.stop();
      if (selectionReleaseTimerRef.current) {
        clearTimeout(selectionReleaseTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    hintAnimationRef.current?.stop();
    hintPulse.setValue(0);
    if (hintIndices.length === 0) return;

    const animation = RNAnimated.sequence([
      RNAnimated.timing(hintPulse, { toValue: 1, duration: 375, useNativeDriver: true }),
      RNAnimated.timing(hintPulse, { toValue: 0, duration: 375, useNativeDriver: true }),
      RNAnimated.timing(hintPulse, { toValue: 1, duration: 375, useNativeDriver: true }),
      RNAnimated.timing(hintPulse, { toValue: 0, duration: 375, useNativeDriver: true }),
    ]);
    hintAnimationRef.current = animation;
    animation.start();
    return () => animation.stop();
  }, [hintIndices, hintPulse]);

  const beginSelection = useCallback((nodeIndex: number) => {
    const next = [nodeIndex];
    setConnectionTone('active');
    setSelectedIndices(next);
    callbacksRef.current.onDraggingChange(true);
    callbacksRef.current.onNodeAdded(1);
    callbacksRef.current.onPreview(next);
  }, []);

  const syncSelection = useCallback(
    (next: number[], addedSelectionCounts: number[]) => {
      setSelectedIndices(next);
      addedSelectionCounts.forEach(callbacksRef.current.onNodeAdded);
      callbacksRef.current.onPreview(next);
    },
    [],
  );

  const finishSelection = useCallback(
    (completedSelection: number[], shouldComplete: boolean) => {
      if (!shouldComplete || completedSelection.length === 0) {
        clearSelectionVisuals();
        return;
      }

      const lastIndex = completedSelection[completedSelection.length - 1];
      const lastPosition = positionsRef.current[lastIndex];
      const resultOrigin = lastPosition
        ? {
            x: originRef.current.x + lastPosition.x,
            y: originRef.current.y + lastPosition.y,
          }
        : undefined;
      const outcome = callbacksRef.current.onComplete(completedSelection, resultOrigin);
      setConnectionTone(outcome);
      selectionReleaseTimerRef.current = setTimeout(
        clearSelectionVisuals,
        SELECTION_HOLD_DURATION[outcome],
      );
    },
    [clearSelectionVisuals],
  );

  /*
   * RNGH worklet callbacks intentionally read and update Reanimated SharedValues.
   * React's generic ref/immutability lint rules cannot model UI-thread SharedValues.
   */
  /* eslint-disable react-hooks/immutability, react-hooks/refs */
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .manualActivation(true)
        .maxPointers(1)
        .shouldCancelWhenOutside(false)
        .onTouchesDown((event, stateManager) => {
          'worklet';
          const touch = event.changedTouches[0] ?? event.allTouches[0];
          if (
            !touch ||
            shufflingOnUI.value ||
            holdingOnUI.value ||
            gestureAccepted.value
          ) {
            stateManager.fail();
            return;
          }

          const point = { x: touch.x, y: touch.y };
          const nodeIndex = findNodeAtPoint(point, positions, hitRadius);
          if (nodeIndex < 0) {
            stateManager.fail();
            return;
          }

          gestureAccepted.value = true;
          selectionOnUI.value = [nodeIndex];
          pointerX.value = point.x;
          pointerY.value = point.y;
          lastPointerX.value = point.x;
          lastPointerY.value = point.y;
          activePointer.value = true;
          stateManager.activate();
          runOnJS(beginSelection)(nodeIndex);
        })
        .onUpdate((event) => {
          'worklet';
          if (!gestureAccepted.value) return;

          const point = { x: event.x, y: event.y };
          pointerX.value = point.x;
          pointerY.value = point.y;
          const previousPoint = {
            x: lastPointerX.value,
            y: lastPointerY.value,
          };
          lastPointerX.value = point.x;
          lastPointerY.value = point.y;

          const update = updateSelectionOnUI(
            selectionOnUI.value,
            findNodesAlongSegment(previousPoint, point, positions, hitRadius),
            numbers.length,
          );
          if (!update.changed) return;

          selectionOnUI.value = update.selection;
          runOnJS(syncSelection)(update.selection, update.addedSelectionCounts);
        })
        .onEnd(() => {
          'worklet';
          if (!gestureAccepted.value) return;
          const completedSelection = [...selectionOnUI.value];
          gestureAccepted.value = false;
          holdingOnUI.value = true;
          runOnJS(finishSelection)(completedSelection, true);
        })
        .onFinalize(() => {
          'worklet';
          if (!gestureAccepted.value) return;
          const cancelledSelection = [...selectionOnUI.value];
          gestureAccepted.value = false;
          activePointer.value = false;
          selectionOnUI.value = [];
          runOnJS(finishSelection)(cancelledSelection, false);
        }),
    [
      activePointer,
      beginSelection,
      finishSelection,
      gestureAccepted,
      lastPointerX,
      lastPointerY,
      hitRadius,
      holdingOnUI,
      numbers.length,
      pointerX,
      pointerY,
      positions,
      selectionOnUI,
      shufflingOnUI,
      syncSelection,
    ],
  );
  /* eslint-enable react-hooks/immutability, react-hooks/refs */

  const shuffleNodes = () => {
    clearSelectionVisuals();
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
    // Reanimated SharedValue; this update is consumed by the UI-thread gesture.
    // eslint-disable-next-line react-hooks/immutability
    shufflingOnUI.value = true;

    const animation = RNAnimated.parallel([
      ...animatedPositions.map((position, numberIndex) =>
        RNAnimated.timing(position, {
          toValue: slots[next[numberIndex] ?? numberIndex],
          duration: SHUFFLE_DURATION,
          easing: SHUFFLE_EASING,
          useNativeDriver: true,
        }),
      ),
      RNAnimated.timing(rotation, {
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
        shufflingOnUI.value = false;
      }
    });
    onShuffle();
  };

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
        <GestureDetector gesture={gesture}>
          <View
            ref={wheelRef}
            accessibilityLabel="Sayı bağlantı çemberi"
            onLayout={() => {
              wheelRef.current?.measureInWindow((x, y) => {
                originRef.current = { x, y };
              });
            }}
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
            <ActiveSelectionPath
              active={activePointer}
              fromRadius={selectedRadius}
              pointerX={pointerX}
              pointerY={pointerY}
              positions={positions}
              selection={selectionOnUI}
              tone={connectionTone}
            />
          </View>

          {numbers.map((number, index) => {
            const selected = selectedIndices.includes(index);
            const hinted = hintIndices.includes(index);
            return (
              <RNAnimated.View
                key={`${index}-${number}`}
                pointerEvents="none"
                style={[
                  styles.nodePosition,
                  {
                    width: nodeSize,
                    height: nodeSize,
                    borderRadius: nodeSize / 2,
                    left: 0,
                    top: 0,
                    transform: [
                      {
                        translateX: RNAnimated.subtract(
                          animatedPositions[index].x,
                          nodeSize / 2,
                        ),
                      },
                      {
                        translateY: RNAnimated.subtract(
                          animatedPositions[index].y,
                          nodeSize / 2,
                        ),
                      },
                      { scale: !selected && hinted ? hintScale : 1 },
                    ],
                  },
                  selected && styles.nodeSelectedLayer,
                  hinted && styles.nodeHintedLayer,
                ]}>
                <SpringSelectionSurface
                  selected={selected}
                  style={[
                    styles.nodeShadow,
                    { width: nodeSize, height: nodeSize, borderRadius: nodeSize / 2 },
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
                          <Stop
                            offset="0%"
                            stopColor={
                              selected ? CONNECTION_COLORS[connectionTone].start : '#F8FCFB'
                            }
                          />
                          <Stop
                            offset="100%"
                            stopColor={
                              selected ? CONNECTION_COLORS[connectionTone].end : '#DAEBEB'
                            }
                          />
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
                        {
                          fontSize: size < 300 ? 22 : 26,
                          lineHeight: size < 300 ? 27 : 32,
                        },
                      ]}>
                      {number}
                    </Text>
                  </View>
                </SpringSelectionSurface>
              </RNAnimated.View>
            );
          })}
          </View>
        </GestureDetector>
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
            <RNAnimated.View style={{ transform: [{ rotate: rotationStyle }] }}>
              <ShuffleIcon />
            </RNAnimated.View>
            <Text style={styles.controlLabel}>Karıştır</Text>
          </ExpoLinearGradient>
        </Pressable>
      </View>
    </View>
  );
});

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
  nodePosition: {
    position: 'absolute',
    zIndex: 3,
  },
  nodeShadow: {
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
    elevation: 6,
  },
  nodeSelectedLayer: {
    zIndex: 20,
  },
  nodeHintedLayer: {
    zIndex: 30,
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
