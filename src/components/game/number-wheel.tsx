import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
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
import { Gesture } from 'react-native-gesture-handler';
import Reanimated, {
  cancelAnimation,
  ReduceMotion,
  runOnJS,
  runOnUI,
  useAnimatedProps,
  useAnimatedReaction,
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

import { HintIcon, ShuffleIcon } from '@/components/common/game-icons';
import { FONTS } from '@/constants/fonts';
import { useI18n } from '@/i18n';

type Point = {
  x: number;
  y: number;
};

type DepartingWheelNode = {
  number: number;
  x: number;
  y: number;
};

type NumberWheelProps = {
  size: number;
  numbers: number[];
  canUseHint: boolean;
  hintCost: number;
  hintIndices: number[];
  operationGuideSymbol?: string;
  onPreview: (indices: number[]) => void;
  onComplete: (indices: number[], resultOrigin?: Point) => WheelSelectionOutcome;
  onHint: () => void;
  onShuffle: () => void;
  onNodeAdded: (selectionCount: number) => void;
  onNodeRemoved: (selectionCount: number) => void;
  onDraggingChange: (dragging: boolean) => void;
  introToken?: string | number;
  outroToken?: number;
  /** When false, intro is parked at center and played at full duration once visible. */
  motionEnabled?: boolean;
};

export type WheelSelectionOutcome = 'success' | 'bonus' | 'invalid';
type ConnectionTone = WheelSelectionOutcome | 'active';

const SHUFFLE_DURATION = 450;
const SHUFFLE_EASING = Easing.bezier(0.34, 1.3, 0.64, 1);
const MAX_WHEEL_NODES = 7;
const NODE_INTRO_DURATION = 460;
export const NODE_OUTRO_DURATION = 220;
const NODE_INTRO_STAGGER_MAX = 40;
const NODE_INTRO_SCALE = 0.22;
const NODE_OUTRO_SCALE = 0.55;
const NODE_OUTRO_OPACITY = 0.6;
const NODE_OUTRO_RADIUS = 6;
const NODE_CENTER_OVERLAP_MS = 90;
const NODE_GHOST_FADE_MS = 80;
const SELECTION_HOLD_DURATION: Record<WheelSelectionOutcome, number> = {
  success: 520,
  bonus: 440,
  invalid: 180,
};
// Lastik dönüşü, m=1 piksel-kütle: F = −k·x − c·v (Hooke + sönüm).
// ζ=0.86 ≈ kritik; lastik gibi minik overshoot, sonsuz salınım yok.
// k,c gerilmeye göre: kısa ~180ms (k≈384, c≈34), uzun ~420ms (k≈196, c≈24).
// Sabit k ile süre neredeyse genlikten bağımsız kalırdı; ω=ln(A/ε)/(ζT)
// T’yi parmak ucu mesafesine bağlar. v0 çekmenin tersi, uzun çekmede daha sıkı.
const RUBBER_ZETA = 0.86;
const RUBBER_MIN_MS = 180;
const RUBBER_MAX_MS = 420;
const RUBBER_SHORT_PX = 28;
const RUBBER_LONG_PX = 210;
const RUBBER_SETTLE_POS = 1.35;
const RUBBER_UNLOCK_TIMEOUT_MS = 500;
const CONNECTION_COLORS: Record<
  ConnectionTone,
  { core: string; end: string; glow: string; start: string }
> = {
  active: {
    start: '#78E1EA',
    end: '#347C91',
    core: 'rgba(235,255,255,0.92)',
    glow: 'rgba(67,196,211,0.38)',
  },
  success: {
    start: '#8CF0C3',
    end: '#15966D',
    core: 'rgba(238,255,247,0.96)',
    glow: 'rgba(50,205,143,0.48)',
  },
  bonus: {
    start: '#FFE58A',
    end: '#C58A24',
    core: 'rgba(255,251,224,0.97)',
    glow: 'rgba(245,188,58,0.52)',
  },
  invalid: {
    start: '#FFA09A',
    end: '#CC4F57',
    core: 'rgba(255,240,240,0.94)',
    glow: 'rgba(231,92,88,0.42)',
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

function rubberPhysicsForStretch(stretch: number) {
  'worklet';
  const t = Math.max(
    0,
    Math.min(1, (stretch - RUBBER_SHORT_PX) / (RUBBER_LONG_PX - RUBBER_SHORT_PX)),
  );
  const eased = t * t * (3 - 2 * t);
  const durationMs = RUBBER_MIN_MS + (RUBBER_MAX_MS - RUBBER_MIN_MS) * eased;
  const durationS = durationMs / 1000;
  const lnTerm = Math.log(Math.max(stretch, RUBBER_SETTLE_POS) / RUBBER_SETTLE_POS);
  const omega = Math.max(10, lnTerm / (RUBBER_ZETA * durationS));
  return {
    durationMs,
    stiffness: omega * omega,
    damping: 2 * RUBBER_ZETA * omega,
    velocity: (-stretch * (0.85 + 1.25 * eased)) / durationS,
  };
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
  // Eğitim modalındaki kararlı RN responder akışını oyun tahtasında da
  // kullanıyoruz. ScrollView artık kaydırılmadığı için Android'de gesture
  // handler'ın responder'ı yarışla devralmasına gerek kalmıyor.
  void gesture;
  return children;
}

function shuffledIndices(count: number): number[] {
  const result = Array.from({ length: count }, (_, index) => index);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function restPointTowardCenter(slot: Point, center: number, restRadius: number): Point {
  const orbitX = slot.x - center;
  const orbitY = slot.y - center;
  const distance = Math.hypot(orbitX, orbitY) || 1;
  return {
    x: center + (orbitX / distance) * restRadius,
    y: center + (orbitY / distance) * restRadius,
  };
}

function ActiveSelectionPath({
  animatedProps,
  tone,
}: {
  animatedProps: ReturnType<typeof useAnimatedProps>;
  tone: ConnectionTone;
}) {
  const colors = CONNECTION_COLORS[tone];

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
        strokeWidth={16}
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

export const NumberWheel = memo(function NumberWheel({
  size,
  numbers,
  canUseHint,
  hintCost,
  hintIndices,
  operationGuideSymbol,
  onPreview,
  onComplete,
  onHint,
  onShuffle,
  onNodeAdded,
  onNodeRemoved,
  onDraggingChange,
  introToken,
  outroToken,
  motionEnabled = true,
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
  const orbitMotionLockRef = useRef(false);
  const lastOutroTokenRef = useRef(outroToken);
  const motionEnabledRef = useRef(motionEnabled);
  const pendingIntroRef = useRef(false);
  const numbersRef = useRef(numbers);
  motionEnabledRef.current = motionEnabled;
  const departingNodesRef = useRef<DepartingWheelNode[] | null>(null);
  const ghostAnimationRef = useRef<RNAnimated.CompositeAnimation | null>(null);
  const [departingNodes, setDepartingNodes] = useState<DepartingWheelNode[] | null>(null);
  const [ghostOpacity] = useState(() => new RNAnimated.Value(NODE_OUTRO_OPACITY));
  const [rotation] = useState(() => new RNAnimated.Value(0));
  const [hintPulse] = useState(() => new RNAnimated.Value(0));
  const activePointer = useSharedValue(false);
  const pointerX = useSharedValue(0);
  const pointerY = useSharedValue(0);
  const lastPointerX = useSharedValue(0);
  const lastPointerY = useSharedValue(0);
  const rubberActive = useSharedValue(false);
  const rubberT = useSharedValue(0);
  const rubberRestX = useSharedValue(0);
  const rubberRestY = useSharedValue(0);
  const rubberDirX = useSharedValue(1);
  const rubberDirY = useSharedValue(0);
  const rubberToken = useSharedValue(0);
  const gestureAccepted = useSharedValue(false);
  const selectionOnUI = useSharedValue<number[]>([]);
  const shufflingOnUI = useSharedValue(false);
  const holdingOnUI = useSharedValue(false);
  const responderGestureAcceptedRef = useRef(false);
  const responderSelectionRef = useRef<number[]>([]);
  const callbacksRef = useRef({
    onComplete,
    onDraggingChange,
    onNodeAdded,
    onNodeRemoved,
    onPreview,
  });

  const nodeSize = size < 330 ? 70 : 73;
  // Android WordWheelView ile aynı 1.18× yarıçap: kolay yakalanır, komşu düğüme
  // gereksiz yapışma üretmez. Hızlı hareketler ayrıca segment boyunca taranır.
  const hitRadius = (nodeSize / 2) * 1.18;
  const innerSize = size;
  const center = innerSize / 2;
  const radius = Math.max(72, center - nodeSize / 2 - 10);
  const nodeCount = numbers.length;
  const slots = useMemo(
    () =>
      Array.from({ length: nodeCount }, (_, index) => {
        const angle = (index * Math.PI * 2) / nodeCount - Math.PI / 2;
        return {
          x: center + radius * Math.cos(angle),
          y: center + radius * Math.sin(angle),
        };
      }),
    [center, nodeCount, radius],
  );
  const introFromCenter = introToken != null;
  const [animatedPositions] = useState(() =>
    Array.from({ length: MAX_WHEEL_NODES }, (_, index) => {
      const slot = slots[index];
      const start =
        introFromCenter || !slot ? { x: center, y: center } : slot;
      return new RNAnimated.ValueXY(start);
    }),
  );
  const [nodeScales] = useState(() =>
    Array.from(
      { length: MAX_WHEEL_NODES },
      () => new RNAnimated.Value(introFromCenter ? NODE_INTRO_SCALE : 1),
    ),
  );
  const [nodeOpacities] = useState(() =>
    Array.from(
      { length: MAX_WHEEL_NODES },
      () => new RNAnimated.Value(introFromCenter ? NODE_OUTRO_OPACITY : 1),
    ),
  );
  const positions = useMemo(
    () => numbers.map((_, numberIndex) => slots[slotOrder[numberIndex] ?? numberIndex]),
    [numbers, slotOrder, slots],
  );
  const positionsRef = useRef(positions);
  const layoutRef = useRef({ center, nodeCount, slots });
  layoutRef.current = { center, nodeCount, slots };
  numbersRef.current = numbers;

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
    rubberToken.value += 1;
    cancelAnimation(rubberT);
    // eslint-disable-next-line react-hooks/immutability
    rubberActive.value = false;
    // eslint-disable-next-line react-hooks/immutability
    activePointer.value = false;
    // eslint-disable-next-line react-hooks/immutability
    selectionOnUI.value = [];
    // eslint-disable-next-line react-hooks/immutability
    holdingOnUI.value = false;
  }, [
    activePointer,
    holdingOnUI,
    rubberActive,
    rubberT,
    rubberToken,
    selectionOnUI,
  ]);

  useEffect(() => {
    callbacksRef.current = {
      onComplete,
      onDraggingChange,
      onNodeAdded,
      onNodeRemoved,
      onPreview,
    };
  }, [onComplete, onDraggingChange, onNodeAdded, onNodeRemoved, onPreview]);

  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);

  // Path worklet NumberWheel ile aynı hook scope'ta; child prop SharedValue
  // worklet'te undefined oluyordu (313 crash). Uç her zaman pointer.
  const selectionPathProps = useAnimatedProps(() => {
    const currentSelection = selectionOnUI.value;
    const returning = rubberActive?.value === true;
    if ((!activePointer.value && !returning) || currentSelection.length === 0) {
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
    const tipX = pointerX.value;
    const tipY = pointerY.value;
    if (Math.hypot(tipX - lastPosition.x, tipY - lastPosition.y) > 1) {
      path += `L ${tipX} ${tipY}`;
    }

    return { d: path, opacity: 1 };
  }, [positions]);

  useAnimatedReaction(
    () => (rubberActive.value ? rubberT.value : -1),
    (travel) => {
      if (travel < 0) return;
      pointerX.value = rubberRestX.value + rubberDirX.value * travel;
      pointerY.value = rubberRestY.value + rubberDirY.value * travel;
    },
  );

  const stopOrbitMotion = useCallback(() => {
    shuffleRunRef.current += 1;
    const shuffleAnimation = shuffleAnimationRef.current;
    shuffleAnimationRef.current = null;
    shuffleAnimation?.stop();
  }, []);

  const clearDepartingGhosts = useCallback(() => {
    const ghostAnimation = ghostAnimationRef.current;
    ghostAnimationRef.current = null;
    ghostAnimation?.stop();
    departingNodesRef.current = null;
    setDepartingNodes(null);
  }, []);

  const lockOrbitMotion = useCallback(
    (locked: boolean) => {
      orbitMotionLockRef.current = locked;
      shufflingOnUI.value = locked;
    },
    [shufflingOnUI],
  );

  const playNodeIntro = useCallback(() => {
    const { center: wheelCenter, nodeCount: count, slots: wheelSlots } = layoutRef.current;
    if (count <= 0) return;

    stopOrbitMotion();
    clearSelectionVisuals();
    const identity = Array.from({ length: count }, (_, index) => index);
    slotOrderRef.current = identity;
    setSlotOrder(identity);
    lockOrbitMotion(true);

    const departing = departingNodesRef.current;
    const startScale = departing && departing.length > 0 ? NODE_OUTRO_SCALE : NODE_INTRO_SCALE;
    for (let index = 0; index < count; index += 1) {
      animatedPositions[index].setValue({ x: wheelCenter, y: wheelCenter });
      nodeScales[index].setValue(startScale);
      nodeOpacities[index].setValue(NODE_OUTRO_OPACITY);
    }

    // Overlay açıkken 0 ms yörünge snap intro'yu tüketir. Merkezde bekle, görününce 460 ms oyna.
    if (!motionEnabledRef.current) {
      pendingIntroRef.current = true;
      return;
    }
    pendingIntroRef.current = false;

    const staggerStep = count > 1 ? NODE_INTRO_STAGGER_MAX / (count - 1) : 0;
    const run = shuffleRunRef.current;

    if (departing && departing.length > 0) {
      ghostOpacity.setValue(NODE_OUTRO_OPACITY);
      const fade = RNAnimated.sequence([
        RNAnimated.delay(NODE_CENTER_OVERLAP_MS),
        RNAnimated.timing(ghostOpacity, {
          toValue: 0,
          duration: NODE_GHOST_FADE_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]);
      ghostAnimationRef.current?.stop();
      ghostAnimationRef.current = fade;
      fade.start(({ finished }) => {
        if (!finished || ghostAnimationRef.current !== fade) return;
        ghostAnimationRef.current = null;
        departingNodesRef.current = null;
        setDepartingNodes(null);
      });
    }

    const animation = RNAnimated.parallel(
      Array.from({ length: count }, (_, index) =>
        RNAnimated.sequence([
          RNAnimated.delay(index * staggerStep),
          RNAnimated.parallel([
            RNAnimated.timing(animatedPositions[index], {
              toValue: wheelSlots[index] ?? { x: wheelCenter, y: wheelCenter },
              duration: NODE_INTRO_DURATION,
              easing: SHUFFLE_EASING,
              useNativeDriver: true,
            }),
            RNAnimated.timing(nodeScales[index], {
              toValue: 1,
              duration: NODE_INTRO_DURATION,
              easing: SHUFFLE_EASING,
              useNativeDriver: true,
            }),
            RNAnimated.timing(nodeOpacities[index], {
              toValue: 1,
              duration: Math.round(NODE_INTRO_DURATION * 0.62),
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        ]),
      ),
    );
    shuffleAnimationRef.current = animation;
    animation.start(({ finished }) => {
      if (!finished || shuffleRunRef.current !== run || shuffleAnimationRef.current !== animation) {
        return;
      }
      shuffleAnimationRef.current = null;
      lockOrbitMotion(false);
    });
  }, [
    animatedPositions,
    clearSelectionVisuals,
    ghostOpacity,
    lockOrbitMotion,
    nodeOpacities,
    nodeScales,
    stopOrbitMotion,
  ]);

  const playNodeOutro = useCallback(() => {
    const { center: wheelCenter, nodeCount: count, slots: wheelSlots } = layoutRef.current;
    if (count <= 0) return;

    stopOrbitMotion();
    clearSelectionVisuals();
    lockOrbitMotion(true);
    clearDepartingGhosts();

    const run = shuffleRunRef.current;
    const order = slotOrderRef.current;
    const currentNumbers = numbersRef.current;
    const departing: DepartingWheelNode[] = Array.from({ length: count }, (_, index) => {
      const slot = wheelSlots[order[index] ?? index] ?? { x: wheelCenter, y: wheelCenter };
      const rest = restPointTowardCenter(slot, wheelCenter, NODE_OUTRO_RADIUS);
      return { number: currentNumbers[index] ?? 0, x: rest.x, y: rest.y };
    });
    departingNodesRef.current = departing;
    setDepartingNodes(departing);
    ghostOpacity.setValue(NODE_OUTRO_OPACITY);

    if (!motionEnabledRef.current) {
      for (let index = 0; index < count; index += 1) {
        const rest = departing[index];
        animatedPositions[index].setValue({ x: rest.x, y: rest.y });
        nodeScales[index].setValue(NODE_OUTRO_SCALE);
        nodeOpacities[index].setValue(NODE_OUTRO_OPACITY);
      }
      return;
    }

    const animation = RNAnimated.parallel(
      Array.from({ length: count }, (_, index) => {
        const rest = departing[index];
        return RNAnimated.parallel([
          RNAnimated.timing(animatedPositions[index], {
            toValue: { x: rest.x, y: rest.y },
            duration: NODE_OUTRO_DURATION,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          RNAnimated.timing(nodeScales[index], {
            toValue: NODE_OUTRO_SCALE,
            duration: NODE_OUTRO_DURATION,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          RNAnimated.timing(nodeOpacities[index], {
            toValue: NODE_OUTRO_OPACITY,
            duration: NODE_OUTRO_DURATION,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]);
      }),
    );
    shuffleAnimationRef.current = animation;
    animation.start(({ finished }) => {
      if (!finished || shuffleRunRef.current !== run || shuffleAnimationRef.current !== animation) {
        return;
      }
      shuffleAnimationRef.current = null;
      // Outro sonrası kilit açık kalır; sonraki intro veya unmount bırakır.
    });
  }, [
    animatedPositions,
    clearDepartingGhosts,
    clearSelectionVisuals,
    ghostOpacity,
    lockOrbitMotion,
    nodeOpacities,
    nodeScales,
    stopOrbitMotion,
  ]);

  useEffect(
    () => () => {
      shuffleRunRef.current += 1;
      const shuffleAnimation = shuffleAnimationRef.current;
      shuffleAnimationRef.current = null;
      shuffleAnimation?.stop();
      ghostAnimationRef.current?.stop();
      hintAnimationRef.current?.stop();
      if (selectionReleaseTimerRef.current) {
        clearTimeout(selectionReleaseTimerRef.current);
      }
      cancelAnimation(rubberT);
    },
    [rubberT],
  );

  useLayoutEffect(() => {
    if (introToken == null) return;
    playNodeIntro();
    // introToken is the only retrigger; playNodeIntro reads layout via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introToken]);

  useEffect(() => {
    if (!motionEnabled || !pendingIntroRef.current) return;
    playNodeIntro();
  }, [motionEnabled, playNodeIntro]);

  useEffect(() => {
    if (outroToken == null || lastOutroTokenRef.current === outroToken) return;
    lastOutroTokenRef.current = outroToken;
    playNodeOutro();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outroToken]);

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

  /*
   * Web responder and RNGH worklet callbacks intentionally update Reanimated
   * SharedValues. React's generic ref/immutability rules cannot model them.
   */
  /* eslint-disable react-hooks/immutability, react-hooks/refs */
  const finishRubberReturn = useCallback(() => {
    rubberActive.value = false;
    clearSelectionVisuals();
  }, [clearSelectionVisuals, rubberActive]);

  const startRubberReturn = useCallback(
    (completedSelection: number[]) => {
      const lastIndex = completedSelection[completedSelection.length - 1];
      const rest =
        lastIndex != null
          ? positionsRef.current[lastIndex]
          : positionsRef.current[0];
      if (!rest || completedSelection.length === 0) {
        clearSelectionVisuals();
        return;
      }

      if (selectionReleaseTimerRef.current) {
        clearTimeout(selectionReleaseTimerRef.current);
        selectionReleaseTimerRef.current = null;
      }

      const token = rubberToken.value + 1;
      rubberToken.value = token;
      const restX = rest.x;
      const restY = rest.y;

      selectionReleaseTimerRef.current = setTimeout(() => {
        if (rubberToken.value !== token) return;
        finishRubberReturn();
      }, RUBBER_UNLOCK_TIMEOUT_MS);

      // Stretch + withSpring aynı UI karesinde; cancelAnimation bu karede yok —
      // Reanimated yeni spring'i bir önceki cancel ile öldürüyordu.
      runOnUI((nextRestX: number, nextRestY: number, nextToken: number) => {
        'worklet';
        if (rubberToken.value !== nextToken) return;

        const deltaX = pointerX.value - nextRestX;
        const deltaY = pointerY.value - nextRestY;
        const stretch = Math.hypot(deltaX, deltaY);

        if (stretch < 2) {
          pointerX.value = nextRestX;
          pointerY.value = nextRestY;
          rubberActive.value = false;
          runOnJS(finishRubberReturn)();
          return;
        }

        const physics = rubberPhysicsForStretch(stretch);
        rubberRestX.value = nextRestX;
        rubberRestY.value = nextRestY;
        rubberDirX.value = deltaX / stretch;
        rubberDirY.value = deltaY / stretch;
        rubberT.value = stretch;
        rubberActive.value = true;
        rubberT.value = withSpring(
          0,
          {
            mass: 1,
            stiffness: physics.stiffness,
            damping: physics.damping,
            velocity: physics.velocity,
            overshootClamping: false,
            reduceMotion: ReduceMotion.Never,
          },
          (finished) => {
            'worklet';
            if (finished && rubberToken.value === nextToken) {
              runOnJS(finishRubberReturn)();
            }
          },
        );
      })(restX, restY, token);
    },
    [
      clearSelectionVisuals,
      finishRubberReturn,
      pointerX,
      pointerY,
      rubberActive,
      rubberDirX,
      rubberDirY,
      rubberRestX,
      rubberRestY,
      rubberT,
      rubberToken,
    ],
  );

  const finishSelection = useCallback(
    (completedSelection: number[], shouldComplete: boolean) => {
      if (completedSelection.length === 0) {
        clearSelectionVisuals();
        return;
      }

      // 1 düğüm / iptal: onComplete yok. JS setState spring'in ilk karelerini
      // geciktirip holding kilidini açık bırakıyordu.
      if (!shouldComplete || completedSelection.length < 2) {
        startRubberReturn(completedSelection);
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

      if (outcome === 'success' || outcome === 'bonus') {
        if (lastPosition) {
          pointerX.value = lastPosition.x;
          pointerY.value = lastPosition.y;
        }
        selectionReleaseTimerRef.current = setTimeout(
          clearSelectionVisuals,
          SELECTION_HOLD_DURATION[outcome],
        );
        return;
      }

      startRubberReturn(completedSelection);
    },
    [
      clearSelectionVisuals,
      pointerX,
      pointerY,
      startRubberReturn,
    ],
  );

  const getResponderTouchPoint = useCallback((event: GestureResponderEvent): Point => {
    const { pageX, pageY } = event.nativeEvent;
    // locationX/locationY may be relative to the changing child under a fast
    // finger move. page coordinates remain stable; translate them back to the
    // measured wheel origin just like the rendered node positions.
    const point = {
      x: pageX - originRef.current.x,
      y: pageY - originRef.current.y,
    };
    return point;
  }, []);

  const canStartResponderSelection = useCallback(
    (event: GestureResponderEvent) => {
      if (
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
    [getResponderTouchPoint, hitRadius, holdingOnUI, shufflingOnUI],
  );

  const startResponderSelection = useCallback(
    (event: GestureResponderEvent) => {
      const point = getResponderTouchPoint(event);
      const nodeIndex = findNodeAtPoint(point, positionsRef.current, hitRadius);
      if (nodeIndex < 0) return;

      responderGestureAcceptedRef.current = true;
      responderSelectionRef.current = [nodeIndex];
      selectionOnUI.value = [nodeIndex];
      rubberToken.value += 1;
      cancelAnimation(rubberT);
      rubberActive.value = false;
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
      rubberActive,
      rubberT,
      rubberToken,
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
      if (update.changed) {
        responderSelectionRef.current = update.selection;
        selectionOnUI.value = update.selection;
        syncSelection(
          update.selection,
          update.addedSelectionCounts,
          update.removedSelectionCounts,
        );
      }
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
    holdingOnUI.value = true;
    finishSelection(cancelledSelection, false);
  }, [finishSelection, holdingOnUI]);

  const gesture = useMemo(
    () =>
      // A manual gesture claims node touches immediately, before the parent
      // ScrollView can turn them into scrolling and cancel the wheel path.
      Gesture.Manual()
        .enabled(Platform.OS === 'android')
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
          rubberToken.value += 1;
          cancelAnimation(rubberT);
          rubberActive.value = false;
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
          if (update.changed) {
            selectionOnUI.value = update.selection;
            runOnJS(syncSelection)(
              update.selection,
              update.addedSelectionCounts,
              update.removedSelectionCounts,
            );
          }
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
          holdingOnUI.value = true;
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
      rubberActive,
      rubberT,
      rubberToken,
      selectionOnUI,
      shufflingOnUI,
      syncSelection,
    ],
  );
  /* eslint-enable react-hooks/immutability, react-hooks/refs */

  const shuffleNodes = () => {
    if (orbitMotionLockRef.current) return;
    // Ses geri bildirimi animasyonun tamamlanmasını beklemez; kullanıcı
    // dokunduğu anda karıştırma hareketiyle eşzamanlı başlar.
    onShuffle();
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

    const shuffleRun = shuffleRunRef.current + 1;
    shuffleRunRef.current = shuffleRun;
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
      ...animatedPositions.slice(0, numbers.length).map((position, numberIndex) =>
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
      if (
        shuffleRunRef.current === shuffleRun &&
        shuffleAnimationRef.current === animation
      ) {
        shuffleAnimationRef.current = null;
        shufflingOnUI.value = false;
      }
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
  const nodeFontSize = size < 330 ? 24 : 28;
  const nodeLineHeight = size < 330 ? 29 : 34;
  const showDepartingGhosts =
    departingNodes != null &&
    (departingNodes.length !== numbers.length ||
      departingNodes.some((node, index) => node.number !== numbers[index]));

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
              animatedProps={selectionPathProps}
              tone={connectionTone}
            />
          </View>

          {operationGuideSymbol ? (
            <View pointerEvents="none" style={styles.operationGuide}>
              <Text style={styles.operationGuideText}>{operationGuideSymbol}</Text>
            </View>
          ) : null}

          {departingNodes && showDepartingGhosts
            ? departingNodes.map((node, index) => (
                <RNAnimated.View
                  key={`departing-${index}-${node.number}`}
                  pointerEvents="none"
                  style={[
                    styles.nodePosition,
                    styles.nodeDepartingLayer,
                    {
                      width: nodeSize,
                      height: nodeSize,
                      borderRadius: nodeSize / 2,
                      left: 0,
                      top: 0,
                      opacity: ghostOpacity,
                      transform: [
                        { translateX: node.x - nodeSize / 2 },
                        { translateY: node.y - nodeSize / 2 },
                        { scale: NODE_OUTRO_SCALE },
                      ],
                    },
                  ]}>
                  <View
                    style={[
                      styles.nodeShadow,
                      { width: nodeSize, height: nodeSize, borderRadius: nodeSize / 2 },
                    ]}>
                    <View
                      style={[
                        styles.node,
                        { width: nodeSize, height: nodeSize, borderRadius: nodeSize / 2 },
                      ]}>
                      <Svg
                        height="100%"
                        pointerEvents="none"
                        style={StyleSheet.absoluteFill}
                        width="100%">
                        <Defs>
                          <SvgLinearGradient
                            id={`departing-node-surface-${index}`}
                            x1="0%"
                            x2="100%"
                            y1="0%"
                            y2="100%">
                            <Stop offset="0%" stopColor="#F8FCFB" />
                            <Stop offset="100%" stopColor="#DAEBEB" />
                          </SvgLinearGradient>
                        </Defs>
                        <Circle
                          cx="50%"
                          cy="50%"
                          fill={`url(#departing-node-surface-${index})`}
                          r="50%"
                        />
                        <Circle cx="34%" cy="31%" fill="rgba(255,255,255,0.34)" r="15%" />
                      </Svg>
                      <Text
                        style={[
                          styles.nodeText,
                          { fontSize: nodeFontSize, lineHeight: nodeLineHeight },
                        ]}>
                        {node.number}
                      </Text>
                    </View>
                  </View>
                </RNAnimated.View>
              ))
            : null}

          {numbers.map((number, index) => {
            const selected = selectedIndices.includes(index);
            const hinted = hintIndices.includes(index);
            const appearanceScale =
              hinted && !selected
                ? RNAnimated.multiply(nodeScales[index], hintScale)
                : nodeScales[index];
            return (
              <RNAnimated.View
                key={`node-${index}`}
                pointerEvents="none"
                style={[
                  styles.nodePosition,
                  {
                    width: nodeSize,
                    height: nodeSize,
                    borderRadius: nodeSize / 2,
                    left: 0,
                    top: 0,
                    opacity: nodeOpacities[index],
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
                      { scale: appearanceScale },
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
                          fontSize: nodeFontSize,
                          lineHeight: nodeLineHeight,
                        },
                      ]}>
                      {number}
                    </Text>
                  </View>
                </View>
              </RNAnimated.View>
            );
          })}
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
          // Basış anında tetiklemek, özellikle iOS'ta hızlı modal geçişlerinde
          // onPress'in kaybolmasını önler.
          onPressIn={onHint}
          style={({ pressed }) => [styles.controlButton, pressed && styles.controlPressed]}>
          <ExpoLinearGradient
            colors={['rgba(50,58,62,0.73)', 'rgba(28,36,41,0.75)']}
            end={{ x: 0, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.controlSurface}>
            <HintIcon size={27} />
            <Text style={styles.controlLabel}>{t('wheel.hint', { cost: hintCost })}</Text>
          </ExpoLinearGradient>
        </Pressable>

        <Pressable
          accessibilityLabel={t('wheel.shuffleA11y')}
          accessibilityRole="button"
          hitSlop={8}
          // Karıştırma sesi ve aksiyonu parmağın ekrana değdiği anda çalışır.
          onPressIn={shuffleNodes}
          style={({ pressed }) => [styles.controlButton, pressed && styles.controlPressed]}>
          <ExpoLinearGradient
            colors={['rgba(50,58,62,0.73)', 'rgba(28,36,41,0.75)']}
            end={{ x: 0, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.controlSurface}>
            <RNAnimated.View style={{ transform: [{ rotate: rotationStyle }] }}>
              <ShuffleIcon size={32} />
            </RNAnimated.View>
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
  operationGuide: {
    position: 'absolute',
    zIndex: 6,
    top: '50%',
    left: '50%',
    width: 70,
    height: 70,
    marginTop: -35,
    marginLeft: -35,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 35,
    borderWidth: 2,
    borderColor: 'rgba(255,246,205,0.96)',
    backgroundColor: 'rgba(132,218,207,0.94)',
    shadowColor: '#3A8E91',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 6,
  },
  operationGuideText: {
    color: '#1B6671',
    fontFamily: FONTS.black,
    fontSize: 34,
    lineHeight: 40,
  },
  webWheel: {
    touchAction: 'none',
    userSelect: 'none',
  },
  nodePosition: {
    position: 'absolute',
    zIndex: 3,
  },
  nodeDepartingLayer: {
    zIndex: 2,
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
    position: 'relative',
    top: -58,
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
