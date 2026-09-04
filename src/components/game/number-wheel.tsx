import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import {
  useCallback,
  useEffect,
  memo,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import {
  Animated as RNAnimated,
  Easing,
  type GestureResponderEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  cancelAnimation,
  runOnJS,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Marker,
  Path,
  Stop,
} from 'react-native-svg';

import { HintIcon, ShuffleIcon } from '@/components/common/game-icons';
import { FONTS } from '@/constants/fonts';
import { useI18n } from '@/i18n';

type Point = {
  x: number;
  y: number;
};

type NumberWheelProps = {
  size: number;
  numbers: number[];
  canUseHint: boolean;
  hintCost: number;
  hintIndices: number[];
  onPreview: (indices: number[]) => void;
  onComplete: (indices: number[], resultOrigin?: Point) => WheelSelectionOutcome;
  onHint: () => void;
  onShuffle: () => void | Promise<void>;
  onShuffleComplete?: () => void;
  onNodeAdded: (selectionCount: number) => void;
  onNodeRemoved: (selectionCount: number) => void;
  onDraggingChange: (dragging: boolean) => void;
  tutorialFocus?: 'shuffle' | 'hint';
  tutorialAutoConnect?: readonly [number, number];
  onTutorialAutoConnectComplete?: () => void;
  tutorialGuideIndex?: number;
  tutorialStepIndices?: readonly number[];
  tutorialOperator?: string;
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
  const removedSelectionCounts: number[] = [];
  let changed = false;

  traversedNodeIndices.forEach((nodeIndex) => {
    const lastIndex = selection[selection.length - 1];
    if (nodeIndex === lastIndex) return;

    const previousIndex = selection[selection.length - 2];
    if (selection.length > 1 && nodeIndex === previousIndex) {
      selection = selection.slice(0, -1);
      removedSelectionCounts.push(selection.length);
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

  return { selection, addedSelectionCounts, removedSelectionCounts, changed };
}

function WheelGestureSurface({
  children,
  gesture,
}: {
  children: ReactElement;
  gesture: ReturnType<typeof Gesture.Manual>;
}) {
  // iOS'ta ScrollView içine yerleşen Manual RNGH recognizer bazı cihazlarda
  // touchesDown olayını hiç teslim etmiyor. O platformda native recognizer'ı
  // ağaca eklemeyip doğrudan RN responder kullanmak bu çakışmayı ortadan kaldırır.
  if (Platform.OS !== 'android') return children;
  return <GestureDetector gesture={gesture}>{children}</GestureDetector>;
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
  tone,
}: {
  active: SharedValue<boolean>;
  pointerX: SharedValue<number>;
  pointerY: SharedValue<number>;
  positions: Point[];
  selection: SharedValue<number[]>;
  tone: ConnectionTone;
}) {
  const colors = CONNECTION_COLORS[tone];
  const animatedProps = useAnimatedProps(() => {
    const currentSelection = selection.value;
    if (!active.value || currentSelection.length === 0) {
      return { d: '', opacity: 0 };
    }

    const firstPosition = positions[currentSelection[0]];
    if (!firstPosition) return { d: '', opacity: 0 };
    let path = '';

    // Android WordWheelView ile aynı merkezden merkeze tek path kullanılır.
    // Düğümler path üzerine çizildiği için hat düğüm yüzeylerinin
    // altında kaybolur; ayrı ayrı M komutları arada ikinci bir çizgi hissi vermez.
    path += `M ${firstPosition.x} ${firstPosition.y} `;
    for (let index = 1; index < currentSelection.length; index += 1) {
      const to = positions[currentSelection[index]];
      path += `L ${to.x} ${to.y} `;
    }

    const lastPosition = positions[currentSelection[currentSelection.length - 1]];
    const pointerDeltaX = pointerX.value - lastPosition.x;
    const pointerDeltaY = pointerY.value - lastPosition.y;
    const pointerDistance = Math.hypot(pointerDeltaX, pointerDeltaY);
    if (pointerDistance > 1) {
      path += `L ${pointerX.value} ${pointerY.value}`;
    }

    return { d: path, opacity: 1 };
  }, [positions]);

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
    </Svg>
  );
}

function TutorialAutoConnectPath({
  from,
  progress,
  to,
}: {
  from: Point;
  progress: SharedValue<number>;
  to: Point;
}) {
  const colors = CONNECTION_COLORS.active;
  const animatedProps = useAnimatedProps(() => {
    const currentProgress = Math.max(0, Math.min(1, progress.value));
    const currentX = from.x + (to.x - from.x) * currentProgress;
    const currentY = from.y + (to.y - from.y) * currentProgress;
    return {
      d: `M ${from.x} ${from.y} L ${currentX} ${currentY}`,
      opacity: currentProgress > 0.01 ? 1 : 0,
    };
  }, [from.x, from.y, to.x, to.y]);

  return (
    <Svg height="100%" pointerEvents="none" style={StyleSheet.absoluteFill} width="100%">
      <Defs>
        <SvgLinearGradient id="tutorial-selection-flow" x1="0%" x2="100%" y1="0%" y2="100%">
          <Stop offset="0%" stopColor={colors.start} />
          <Stop offset="100%" stopColor={colors.end} />
        </SvgLinearGradient>
        <Marker
          id="tutorial-selection-arrow"
          markerHeight={10}
          markerUnits="userSpaceOnUse"
          markerWidth={10}
          orient="auto"
          refX={8}
          refY={5}
          viewBox="0 0 10 10">
          <Path d="M 0 0 L 10 5 L 0 10 z" fill={colors.end} />
        </Marker>
      </Defs>
      <ReanimatedPath
        animatedProps={animatedProps}
        fill="none"
        stroke={colors.glow}
        strokeLinecap="round"
        strokeWidth={14}
      />
      <ReanimatedPath
        animatedProps={animatedProps}
        fill="none"
        markerEnd="url(#tutorial-selection-arrow)"
        stroke="url(#tutorial-selection-flow)"
        strokeLinecap="round"
        strokeWidth={6}
      />
    </Svg>
  );
}

function TutorialAutoConnectHand({
  from,
  progress,
  to,
}: {
  from: Point;
  progress: SharedValue<number>;
  to: Point;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const currentProgress = Math.max(0, Math.min(1, progress.value));
    return {
      transform: [
        { translateX: from.x + (to.x - from.x) * currentProgress - 9 },
        { translateY: from.y + (to.y - from.y) * currentProgress - 6 },
        { scale: 0.96 + Math.sin(currentProgress * Math.PI) * 0.06 },
      ],
    };
  }, [from.x, from.y, to.x, to.y]);

  return (
    <Reanimated.View pointerEvents="none" style={[styles.tutorialAutoHand, animatedStyle]}>
      <Image
        source={require('../../../assets/images/img/hint_arrow.png')}
        style={styles.tutorialAutoHandImage}
      />
    </Reanimated.View>
  );
}

export const NumberWheel = memo(function NumberWheel({
  size,
  numbers,
  canUseHint,
  hintCost,
  hintIndices,
  onPreview,
  onComplete,
  onHint,
  onShuffle,
  onShuffleComplete,
  onNodeAdded,
  onNodeRemoved,
  onDraggingChange,
  tutorialFocus,
  tutorialAutoConnect,
  onTutorialAutoConnectComplete,
  tutorialGuideIndex,
  tutorialStepIndices,
  tutorialOperator,
}: NumberWheelProps) {
  const { t } = useI18n();
  const [slotOrder, setSlotOrder] = useState(() =>
    Array.from({ length: numbers.length }, (_, index) => index),
  );
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [connectionTone, setConnectionTone] = useState<ConnectionTone>('active');
  const wheelRef = useRef<View>(null);
  const originRef = useRef<Point>({ x: 0, y: 0 });
  const slotOrderRef = useRef(slotOrder);
  const shuffleAnimationRef = useRef<RNAnimated.CompositeAnimation | null>(null);
  const shuffleRunRef = useRef(0);
  const hintAnimationRef = useRef<RNAnimated.CompositeAnimation | null>(null);
  const selectionReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rotationTurnsRef = useRef(0);
  const [rotation] = useState(() => new RNAnimated.Value(0));
  const [hintPulse] = useState(() => new RNAnimated.Value(0));
  const [tutorialHandPulse] = useState(() => new RNAnimated.Value(0));
  const activePointer = useSharedValue(false);
  const pointerX = useSharedValue(0);
  const pointerY = useSharedValue(0);
  const lastPointerX = useSharedValue(0);
  const lastPointerY = useSharedValue(0);
  const gestureAccepted = useSharedValue(false);
  const selectionOnUI = useSharedValue<number[]>([]);
  const shufflingOnUI = useSharedValue(false);
  const holdingOnUI = useSharedValue(false);
  const responderGestureAcceptedRef = useRef(false);
  const responderSelectionRef = useRef<number[]>([]);
  const shuffleStartPendingRef = useRef(false);
  const tutorialAutoRunRef = useRef(0);
  const tutorialAutoStartFrameRef = useRef<number | null>(null);
  const tutorialAutoHadSelectionRef = useRef(false);
  const tutorialConnectionProgress = useSharedValue(0);
  const callbacksRef = useRef({
    onComplete,
    onDraggingChange,
    onNodeAdded,
    onNodeRemoved,
    onPreview,
    onShuffleComplete,
    onTutorialAutoConnectComplete,
  });

  const nodeSize = size < 330 ? 70 : 73;
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
  const tutorialAutoFrom = tutorialAutoConnect?.[0];
  const tutorialAutoTo = tutorialAutoConnect?.[1];
  const tutorialAutoConnectEnabled =
    tutorialAutoFrom !== undefined &&
    tutorialAutoTo !== undefined &&
    Number.isInteger(tutorialAutoFrom) &&
    Number.isInteger(tutorialAutoTo) &&
    tutorialAutoFrom >= 0 &&
    tutorialAutoTo >= 0 &&
    tutorialAutoFrom < numbers.length &&
    tutorialAutoTo < numbers.length &&
    tutorialAutoFrom !== tutorialAutoTo;

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
    callbacksRef.current = {
      onComplete,
      onDraggingChange,
      onNodeAdded,
      onNodeRemoved,
      onPreview,
      onShuffleComplete,
      onTutorialAutoConnectComplete,
    };
  }, [
    onComplete,
    onDraggingChange,
    onNodeAdded,
    onNodeRemoved,
    onPreview,
    onShuffleComplete,
    onTutorialAutoConnectComplete,
  ]);

  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);

  useEffect(
    () => () => {
      shuffleRunRef.current += 1;
      shuffleStartPendingRef.current = false;
      const shuffleAnimation = shuffleAnimationRef.current;
      shuffleAnimationRef.current = null;
      shuffleAnimation?.stop();
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

  useEffect(() => {
    tutorialHandPulse.stopAnimation();
    tutorialHandPulse.setValue(0);
    if (!tutorialFocus) return;
    const animation = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(tutorialHandPulse, { toValue: 1, duration: 460, useNativeDriver: true }),
        RNAnimated.timing(tutorialHandPulse, { toValue: 0, duration: 460, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [tutorialFocus, tutorialHandPulse]);

  const beginSelection = useCallback((nodeIndex: number) => {
    const next = [nodeIndex];
    setConnectionTone('active');
    setSelectedIndices(next);
    callbacksRef.current.onDraggingChange(true);
    callbacksRef.current.onNodeAdded(1);
    callbacksRef.current.onPreview(next);
  }, []);

  const syncSelection = useCallback(
    (
      next: number[],
      addedSelectionCounts: number[],
      removedSelectionCounts: number[],
    ) => {
      setSelectedIndices(next);
      addedSelectionCounts.forEach((selectionCount) => {
        callbacksRef.current.onNodeAdded(selectionCount);
      });
      removedSelectionCounts.forEach((selectionCount) => {
        callbacksRef.current.onNodeRemoved(selectionCount);
      });
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
      // Yanlış sonuçta düğümler kırmızıya boyanmaz; bağlantı
      // mevcut nötr turkuaz tonunda kısa süre görünür.
      setConnectionTone(outcome === 'invalid' ? 'active' : outcome);
      selectionReleaseTimerRef.current = setTimeout(
        clearSelectionVisuals,
        SELECTION_HOLD_DURATION[outcome],
      );
    },
    [clearSelectionVisuals],
  );

  /*
   * Web responder and RNGH worklet callbacks intentionally update Reanimated
   * SharedValues. React's generic ref/immutability rules cannot model them.
   */
  /* eslint-disable react-hooks/immutability, react-hooks/refs */
  const finishTutorialAutoConnect = useCallback(
    (runId: number, fromIndex: number, toIndex: number) => {
      if (tutorialAutoRunRef.current !== runId) return;
      syncSelection([fromIndex, toIndex], [2], []);
      callbacksRef.current.onTutorialAutoConnectComplete?.();
    },
    [syncSelection],
  );

  useEffect(() => {
    if (
      !tutorialAutoConnectEnabled ||
      tutorialAutoFrom === undefined ||
      tutorialAutoTo === undefined
    ) {
      cancelAnimation(tutorialConnectionProgress);
      tutorialConnectionProgress.value = 0;
      if (!tutorialAutoHadSelectionRef.current) return;

      tutorialAutoHadSelectionRef.current = false;
      const resetRunId = tutorialAutoRunRef.current + 1;
      tutorialAutoRunRef.current = resetRunId;
      tutorialAutoStartFrameRef.current = requestAnimationFrame(() => {
        tutorialAutoStartFrameRef.current = null;
        if (tutorialAutoRunRef.current !== resetRunId) return;
        clearSelectionVisuals();
        callbacksRef.current.onPreview([]);
      });
      return () => {
        if (tutorialAutoRunRef.current === resetRunId) {
          tutorialAutoRunRef.current += 1;
        }
        if (tutorialAutoStartFrameRef.current !== null) {
          cancelAnimationFrame(tutorialAutoStartFrameRef.current);
          tutorialAutoStartFrameRef.current = null;
        }
      };
    }

    const runId = tutorialAutoRunRef.current + 1;
    tutorialAutoRunRef.current = runId;
    tutorialAutoHadSelectionRef.current = true;
    cancelAnimation(tutorialConnectionProgress);
    tutorialConnectionProgress.value = 0;

    // State başlangıçları effect gövdesinde senkron çalıştırılmaz. Aynı frame
    // callback'i A seçimini, ilk düğüm sesini ve çizgi hareketini birlikte başlatır.
    tutorialAutoStartFrameRef.current = requestAnimationFrame(() => {
      tutorialAutoStartFrameRef.current = null;
      if (tutorialAutoRunRef.current !== runId) return;
      clearSelectionVisuals();
      responderGestureAcceptedRef.current = false;
      responderSelectionRef.current = [];
      beginSelection(tutorialAutoFrom);
      tutorialConnectionProgress.value = withTiming(
        1,
        { duration: 760 },
        (finished) => {
          if (finished) {
            runOnJS(finishTutorialAutoConnect)(runId, tutorialAutoFrom, tutorialAutoTo);
          }
        },
      );
    });

    return () => {
      if (tutorialAutoRunRef.current === runId) {
        tutorialAutoRunRef.current += 1;
      }
      if (tutorialAutoStartFrameRef.current !== null) {
        cancelAnimationFrame(tutorialAutoStartFrameRef.current);
        tutorialAutoStartFrameRef.current = null;
      }
      cancelAnimation(tutorialConnectionProgress);
      if (tutorialAutoHadSelectionRef.current) {
        callbacksRef.current.onDraggingChange(false);
        callbacksRef.current.onPreview([]);
      }
    };
  }, [
    beginSelection,
    clearSelectionVisuals,
    finishTutorialAutoConnect,
    tutorialAutoConnectEnabled,
    tutorialAutoFrom,
    tutorialAutoTo,
    tutorialConnectionProgress,
  ]);

  const getResponderTouchPoint = useCallback((event: GestureResponderEvent): Point => {
    const { locationX, locationY } = event.nativeEvent;
    return { x: locationX, y: locationY };
  }, []);

  const canStartResponderSelection = useCallback(
    (event: GestureResponderEvent) => {
      if (
        Platform.OS === 'android' ||
        tutorialFocus ||
        tutorialAutoConnectEnabled ||
        shufflingOnUI.value ||
        holdingOnUI.value ||
        responderGestureAcceptedRef.current
      ) {
        return false;
      }

      return (
        findNodeAtPoint(getResponderTouchPoint(event), positionsRef.current, hitRadius) >= 0
      );
    },
    [
      getResponderTouchPoint,
      hitRadius,
      holdingOnUI,
      shufflingOnUI,
      tutorialAutoConnectEnabled,
      tutorialFocus,
    ],
  );

  const startResponderSelection = useCallback(
    (event: GestureResponderEvent) => {
      const point = getResponderTouchPoint(event);
      const nodeIndex = findNodeAtPoint(point, positionsRef.current, hitRadius);
      if (nodeIndex < 0) return;

      responderGestureAcceptedRef.current = true;
      responderSelectionRef.current = [nodeIndex];
      selectionOnUI.value = [nodeIndex];
      pointerX.value = point.x;
      pointerY.value = point.y;
      lastPointerX.value = point.x;
      lastPointerY.value = point.y;
      activePointer.value = true;
      beginSelection(nodeIndex);
    },
    [
      activePointer,
      beginSelection,
      getResponderTouchPoint,
      hitRadius,
      lastPointerX,
      lastPointerY,
      pointerX,
      pointerY,
      selectionOnUI,
    ],
  );

  const moveResponderSelection = useCallback(
    (event: GestureResponderEvent) => {
      if (!responderGestureAcceptedRef.current) return;

      const point = getResponderTouchPoint(event);
      const previousPoint = {
        x: lastPointerX.value,
        y: lastPointerY.value,
      };
      pointerX.value = point.x;
      pointerY.value = point.y;
      lastPointerX.value = point.x;
      lastPointerY.value = point.y;

      const update = updateSelectionOnUI(
        responderSelectionRef.current,
        findNodesAlongSegment(previousPoint, point, positionsRef.current, hitRadius),
        numbers.length,
      );
      if (!update.changed) return;

      responderSelectionRef.current = update.selection;
      selectionOnUI.value = update.selection;
      syncSelection(
        update.selection,
        update.addedSelectionCounts,
        update.removedSelectionCounts,
      );
    },
    [
      getResponderTouchPoint,
      hitRadius,
      lastPointerX,
      lastPointerY,
      numbers.length,
      pointerX,
      pointerY,
      selectionOnUI,
      syncSelection,
    ],
  );

  const finishResponderSelection = useCallback(() => {
    if (!responderGestureAcceptedRef.current) return;

    const completedSelection = [...responderSelectionRef.current];
    responderGestureAcceptedRef.current = false;
    responderSelectionRef.current = [];
    holdingOnUI.value = true;
    finishSelection(completedSelection, true);
  }, [finishSelection, holdingOnUI]);

  const cancelResponderSelection = useCallback(() => {
    if (!responderGestureAcceptedRef.current) return;

    const cancelledSelection = [...responderSelectionRef.current];
    responderGestureAcceptedRef.current = false;
    responderSelectionRef.current = [];
    activePointer.value = false;
    selectionOnUI.value = [];
    finishSelection(cancelledSelection, false);
  }, [activePointer, finishSelection, selectionOnUI]);

  const gesture = useMemo(
    () =>
      // A manual gesture claims node touches immediately, before the parent
      // ScrollView can turn them into scrolling and cancel the wheel path.
      Gesture.Manual()
        .enabled(
          Platform.OS === 'android' && !tutorialFocus && !tutorialAutoConnectEnabled,
        )
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
          stateManager.begin();
          stateManager.activate();
          runOnJS(beginSelection)(nodeIndex);
        })
        .onTouchesMove((event) => {
          'worklet';
          if (!gestureAccepted.value) return;

          const touch = event.changedTouches[0] ?? event.allTouches[0];
          if (!touch) return;
          const point = { x: touch.x, y: touch.y };
          // Path, Android referansındaki gibi gerçek pointer noktasını
          // gecikmeden takip eder; hit-test ve görsel hat aynı koordinatı kullanır.
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
          runOnJS(syncSelection)(
            update.selection,
            update.addedSelectionCounts,
            update.removedSelectionCounts,
          );
        })
        .onTouchesUp((event, stateManager) => {
          'worklet';
          if (!gestureAccepted.value) return;

          const touch = event.changedTouches[0];
          if (touch) {
            const point = { x: touch.x, y: touch.y };
            const previousPoint = {
              x: lastPointerX.value,
              y: lastPointerY.value,
            };
            pointerX.value = point.x;
            pointerY.value = point.y;

            const update = updateSelectionOnUI(
              selectionOnUI.value,
              findNodesAlongSegment(previousPoint, point, positions, hitRadius),
              numbers.length,
            );
            if (update.changed) {
              selectionOnUI.value = update.selection;
              runOnJS(syncSelection)(
                update.selection,
                update.addedSelectionCounts,
                update.removedSelectionCounts,
              );
            }
          }

          const completedSelection = [...selectionOnUI.value];
          gestureAccepted.value = false;
          holdingOnUI.value = true;
          runOnJS(finishSelection)(completedSelection, true);
          stateManager.end();
        })
        .onTouchesCancelled((_event, stateManager) => {
          'worklet';
          if (!gestureAccepted.value) return;
          const cancelledSelection = [...selectionOnUI.value];
          gestureAccepted.value = false;
          activePointer.value = false;
          selectionOnUI.value = [];
          runOnJS(finishSelection)(cancelledSelection, false);
          stateManager.fail();
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
      tutorialAutoConnectEnabled,
      tutorialFocus,
    ],
  );
  /* eslint-enable react-hooks/immutability, react-hooks/refs */

  const startShuffleAnimation = (shuffleRun: number) => {
    if (shuffleRunRef.current !== shuffleRun) return;
    clearSelectionVisuals();
    let next = shuffledIndices(numbers.length);
    let attempts = 0;
    while (next.every((value, index) => value === slotOrderRef.current[index]) && attempts < 8) {
      next = shuffledIndices(numbers.length);
      attempts += 1;
    }
    if (next.every((value, index) => value === slotOrderRef.current[index])) {
      next = [...slotOrderRef.current];
      [next[0], next[1]] = [next[1], next[0]];
    }

    const previousAnimation = shuffleAnimationRef.current;
    shuffleAnimationRef.current = null;
    previousAnimation?.stop();
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
    animation.start(({ finished }) => {
      if (
        shuffleRunRef.current === shuffleRun &&
        shuffleAnimationRef.current === animation
      ) {
        shuffleAnimationRef.current = null;
        shuffleStartPendingRef.current = false;
        shufflingOnUI.value = false;
        if (finished) callbacksRef.current.onShuffleComplete?.();
      }
    });
  };

  const shuffleNodes = () => {
    if (shuffleStartPendingRef.current) return;

    const shuffleRun = shuffleRunRef.current + 1;
    shuffleRunRef.current = shuffleRun;
    let shuffleStart: void | Promise<void>;
    try {
      // Senkron gerçek oyun callback'inde animasyon aynı basış karesinde başlar.
      // Tutorial ses kanalı Promise döndürürse görsel hareket play komutunu bekler.
      shuffleStart = onShuffle();
    } catch {
      // Ses/geri bildirim hatası oynanışı kilitlememeli.
      shuffleStart = undefined;
    }

    if (!shuffleStart) {
      startShuffleAnimation(shuffleRun);
      return;
    }

    shuffleStartPendingRef.current = true;
    // Ses hazırlanırken yeni gesture başlamasın; tekrar shuffle basışları da
    // shuffleStartPendingRef tarafından yutulur.
    // eslint-disable-next-line react-hooks/immutability
    shufflingOnUI.value = true;
    void shuffleStart
      .catch(() => undefined)
      .then(() => {
        if (shuffleRunRef.current !== shuffleRun) {
          shuffleStartPendingRef.current = false;
          return;
        }
        startShuffleAnimation(shuffleRun);
      });
  };

  // Düğümler seçilirken artık büyümez; çizgi sabit görsel çapa tam oturur.
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
        <WheelGestureSurface gesture={gesture}>
          <View
            ref={wheelRef}
            accessibilityLabel={t('wheel.a11y')}
            collapsable={false}
            onMoveShouldSetResponder={canStartResponderSelection}
            onResponderGrant={startResponderSelection}
            onResponderMove={moveResponderSelection}
            onResponderRelease={finishResponderSelection}
            onResponderTerminate={cancelResponderSelection}
            onResponderTerminationRequest={() => false}
            onStartShouldSetResponder={canStartResponderSelection}
            pointerEvents="box-only"
            onLayout={() => {
              wheelRef.current?.measureInWindow((x, y) => {
                originRef.current = { x, y };
              });
            }}
            style={[
              styles.wheel,
              { borderRadius: innerSize / 2 },
              Platform.OS === 'web' && styles.webWheel,
            ]}>
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
              pointerX={pointerX}
              pointerY={pointerY}
              positions={positions}
              selection={selectionOnUI}
              tone={connectionTone}
            />
            {tutorialAutoConnectEnabled &&
            tutorialAutoFrom !== undefined &&
            tutorialAutoTo !== undefined &&
            positions[tutorialAutoFrom] &&
            positions[tutorialAutoTo] ? (
              <TutorialAutoConnectPath
                from={positions[tutorialAutoFrom]}
                progress={tutorialConnectionProgress}
                to={positions[tutorialAutoTo]}
              />
            ) : null}
          </View>

          {tutorialGuideIndex !== undefined && positions[tutorialGuideIndex] ? (
            <RNAnimated.View
              pointerEvents="none"
              style={[
                styles.tutorialNodeHand,
                {
                  left: positions[tutorialGuideIndex].x + nodeSize / 5,
                  top: positions[tutorialGuideIndex].y + nodeSize / 5,
                  transform: [{ scale: hintScale }],
                },
              ]}>
              <Image source={require('../../../assets/images/img/hint_arrow.png')} style={styles.tutorialNodeHandImage} />
            </RNAnimated.View>
          ) : null}

          {tutorialStepIndices?.map((nodeIndex, stepIndex) => {
            const position = positions[nodeIndex];
            if (!position) return null;
            return <View key={`tutorial-step-${nodeIndex}`} pointerEvents="none" style={[styles.tutorialStepBadge, { left: position.x - 12, top: position.y - nodeSize / 2 - 12 }]}><Text style={styles.tutorialStepBadgeText}>{stepIndex + 1}</Text></View>;
          })}
          {tutorialOperator && tutorialStepIndices && tutorialStepIndices.length >= 2 && positions[tutorialStepIndices[0]] && positions[tutorialStepIndices[1]] ? <View pointerEvents="none" style={[styles.tutorialOperatorBadge, { left: (positions[tutorialStepIndices[0]].x + positions[tutorialStepIndices[1]].x) / 2 - 15, top: (positions[tutorialStepIndices[0]].y + positions[tutorialStepIndices[1]].y) / 2 - 15 }]}><Text style={styles.tutorialOperatorText}>{tutorialOperator}</Text></View> : null}

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
                <View
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
                          fontSize: size < 330 ? 24 : 28,
                          lineHeight: size < 330 ? 29 : 34,
                        },
                      ]}>
                      {number}
                    </Text>
                  </View>
                </View>
              </RNAnimated.View>
            );
          })}
          {tutorialAutoConnectEnabled &&
          tutorialAutoFrom !== undefined &&
          tutorialAutoTo !== undefined &&
          positions[tutorialAutoFrom] &&
          positions[tutorialAutoTo] ? (
            <TutorialAutoConnectHand
              from={positions[tutorialAutoFrom]}
              progress={tutorialConnectionProgress}
              to={positions[tutorialAutoTo]}
            />
          ) : null}
          </View>
        </WheelGestureSurface>
      </View>

      <View style={[styles.actionRow, { width: size }]}> 
        <Pressable
          accessibilityLabel={
            canUseHint
              ? t('wheel.hintA11y', { cost: hintCost })
              : t('wheel.noHints')
          }
          accessibilityRole="button"
          hitSlop={8}
          disabled={tutorialFocus === 'shuffle' || tutorialAutoConnectEnabled}
          // Basış anında tetiklemek, özellikle iOS'ta hızlı modal geçişlerinde
          // onPress'in kaybolmasını önler.
          onPressIn={onHint}
          style={({ pressed }) => [styles.controlButton, tutorialFocus === 'hint' && styles.controlFocused, pressed && styles.controlPressed]}>
          <ExpoLinearGradient
            colors={['rgba(50,58,62,0.73)', 'rgba(28,36,41,0.75)']}
            end={{ x: 0, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.controlSurface}>
            <HintIcon size={27} />
            <Text style={styles.controlLabel}>{t('wheel.hint', { cost: hintCost })}</Text>
          </ExpoLinearGradient>
          {tutorialFocus === 'hint' ? <RNAnimated.View pointerEvents="none" style={[styles.tutorialHand, { transform: [{ translateY: tutorialHandPulse.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] }]}><Image source={require('../../../assets/images/img/hint_arrow.png')} style={styles.tutorialHandImage} /></RNAnimated.View> : null}
        </Pressable>

        <Pressable
          accessibilityLabel={t('wheel.shuffleA11y')}
          accessibilityRole="button"
          hitSlop={8}
          disabled={tutorialFocus === 'hint' || tutorialAutoConnectEnabled}
          // Senkron callback'te anında, Promise döndüğünde ses hazır olur olmaz başlar.
          onPressIn={shuffleNodes}
          style={({ pressed }) => [styles.controlButton, tutorialFocus === 'shuffle' && styles.controlFocused, pressed && styles.controlPressed]}>
          <ExpoLinearGradient
            colors={['rgba(50,58,62,0.73)', 'rgba(28,36,41,0.75)']}
            end={{ x: 0, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.controlSurface}>
            <RNAnimated.View style={{ transform: [{ rotate: rotationStyle }] }}>
              <ShuffleIcon size={32} />
            </RNAnimated.View>
          </ExpoLinearGradient>
          {tutorialFocus === 'shuffle' ? <RNAnimated.View pointerEvents="none" style={[styles.tutorialHand, { transform: [{ translateY: tutorialHandPulse.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] }]}><Image source={require('../../../assets/images/img/hint_arrow.png')} style={styles.tutorialHandImage} /></RNAnimated.View> : null}
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
  webWheel: {
    touchAction: 'none',
    userSelect: 'none',
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
    height: 68,
    marginTop: 1,
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlButton: {
    width: 57,
    height: 57,
    overflow: 'visible',
    borderRadius: 28.5,
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
  controlFocused: {
    overflow: 'visible',
    borderColor: '#FFF7BB',
    borderWidth: 3,
    shadowColor: '#FDE047',
    shadowOpacity: 0.95,
    shadowRadius: 16,
    elevation: 14,
  },
  tutorialHand: {
    position: 'absolute',
    top: 39,
    left: 28,
    zIndex: 4,
    width: 42,
    height: 42,
  },
  tutorialHandImage: { width: 42, height: 42 },
  tutorialAutoHand: { position: 'absolute', zIndex: 50, width: 42, height: 42 },
  tutorialAutoHandImage: { width: 42, height: 42 },
  tutorialNodeHand: { position: 'absolute', zIndex: 40, width: 34, height: 34 },
  tutorialNodeHandImage: { width: 34, height: 34 },
  tutorialStepBadge: { position: 'absolute', zIndex: 45, width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#F4C653', borderWidth: 2, borderColor: '#FFFFFF' },
  tutorialStepBadgeText: { color: '#5A3B0B', fontFamily: FONTS.black, fontSize: 13, fontWeight: '900' },
  tutorialOperatorBadge: { position: 'absolute', zIndex: 44, width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#176F7A', borderWidth: 2, borderColor: '#E8FFFF' },
  tutorialOperatorText: { color: '#FFFFFF', fontFamily: FONTS.black, fontSize: 19, fontWeight: '900' },
  controlSurface: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    borderRadius: 28.5,
    overflow: 'visible',
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
