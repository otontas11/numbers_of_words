import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'react-native';
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { HintIcon, ShuffleIcon } from '@/components/common/game-icons';
import { FONTS } from '@/constants/fonts';
import type { GameSound } from '@/hooks/use-game-sounds';
import { useI18n } from '@/i18n';

type FreshGameTutorialModalProps = {
  visible: boolean;
  onDone: () => void;
  onEffect?: (sound: GameSound) => Promise<void> | void;
};

type TutorialPhase =
  | 'shuffleReady'
  | 'shuffleSound'
  | 'shuffleMove'
  | 'hintReady'
  | 'hintSound'
  | 'demo'
  | 'yourTurn'
  | 'practice'
  | 'celebrate';

type ConnectionTone = 'active' | 'success' | 'bonus' | 'invalid';

type Point = {
  x: number;
  y: number;
};

type PracticeLesson = {
  key: 'addition' | 'subtraction' | 'multiplication' | 'bonus' | 'division';
  operator: '+' | '−' | '×' | '÷';
  nodes: readonly string[];
  solution: readonly number[];
  target: string;
  eyebrow: string;
  instruction: string;
  equation: string;
  isBonus?: boolean;
};

const DEMO_FROM = 4;
const DEMO_TO = 1;
const IS_ANDROID = Platform.OS === 'android';
const DEMO_NODES = ['6', 'B', '8', '4', 'A'] as const;
const SHUFFLE_FROM = ['3', '7', '2', '9', '5'] as const;
const SHUFFLE_TO = ['2', '5', '9', '3', '7'] as const;
const SHUFFLE_TARGET_SLOT = [3, 4, 0, 2, 1] as const;

const PRACTICE_LESSONS: readonly PracticeLesson[] = [
  {
    key: 'addition',
    operator: '+',
    nodes: ['8', '3', '6', '9', '2'],
    solution: [4, 1],
    target: '5',
    eyebrow: 'TOPLAMA',
    instruction: '2 ile 3’ü bağla',
    equation: '2 + 3 = 5',
  },
  {
    key: 'subtraction',
    operator: '−',
    nodes: ['8', '2', '3', '9', '6'],
    solution: [0, 2],
    target: '5',
    eyebrow: 'ÇIKARMA',
    instruction: '8’den 3’e sürükle',
    equation: '8 − 3 = 5',
  },
  {
    key: 'multiplication',
    operator: '×',
    nodes: ['4', '8', '6', '3', '2'],
    solution: [3, 0],
    target: '12',
    eyebrow: 'ÇARPMA',
    instruction: '3 ile 4’ü bağla',
    equation: '3 × 4 = 12',
  },
  {
    key: 'bonus',
    operator: '+',
    nodes: ['3', '4', '7', '6', '2'],
    solution: [4, 0, 1],
    target: '9',
    eyebrow: '3 ADIM BONİSİ',
    instruction: '2, 3 ve 4’ü bağla',
    equation: '2 + 3 + 4 = 9',
    isBonus: true,
  },
  {
    key: 'division',
    operator: '÷',
    nodes: ['8', '2', '3', '9', '6'],
    solution: [0, 1],
    target: '4',
    eyebrow: 'BÖLME',
    instruction: '8’i 2’ye böl',
    equation: '8 ÷ 2 = 4',
  },
] as const;

const CONFETTI = Array.from({ length: 28 }, (_, index) => ({
  color: ['#FFE478', '#FFFFFF', '#78E4E8', '#FF9B88', '#79D5A8'][index % 5],
  delay: (index % 7) * 0.035,
  dx: ((index * 83) % 310) - 155,
  dy: 150 + ((index * 47) % 150),
  rise: 80 + ((index * 31) % 100),
  rotation: 180 + ((index * 97) % 420),
  size: 6 + (index % 4) * 2,
}));

const CONNECTION_COLORS: Record<ConnectionTone, { core: string; glow: string }> = {
  active: { core: '#D9FFFF', glow: 'rgba(67,196,211,0.38)' },
  success: { core: '#DDFFEE', glow: 'rgba(50,205,143,0.48)' },
  bonus: { core: '#FFF4A8', glow: 'rgba(245,188,58,0.52)' },
  invalid: { core: '#FFD7D2', glow: 'rgba(231,92,88,0.42)' },
};

function getNodePositions(size: number): Point[] {
  return [
    { x: size * 0.5, y: size * 0.14 },
    { x: size * 0.83, y: size * 0.39 },
    { x: size * 0.7, y: size * 0.79 },
    { x: size * 0.3, y: size * 0.79 },
    { x: size * 0.17, y: size * 0.39 },
  ];
}

function findNode(point: Point, positions: readonly Point[], radius: number): number {
  const radiusSquared = radius * radius;
  return positions.findIndex((position) => {
    const dx = position.x - point.x;
    const dy = position.y - point.y;
    return dx * dx + dy * dy <= radiusSquared;
  });
}

function findNodesAlongSegment(
  from: Point,
  to: Point,
  positions: readonly Point[],
  radius: number,
): number[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;

  return positions
    .map((position, index) => {
      const rawProgress =
        lengthSquared === 0
          ? 0
          : ((position.x - from.x) * dx + (position.y - from.y) * dy) /
            lengthSquared;
      const progress = Math.max(0, Math.min(1, rawProgress));
      const nearestX = from.x + dx * progress;
      const nearestY = from.y + dy * progress;
      const nodeDx = position.x - nearestX;
      const nodeDy = position.y - nearestY;
      return {
        distanceSquared: nodeDx * nodeDx + nodeDy * nodeDy,
        index,
        progress,
      };
    })
    .filter((candidate) => candidate.distanceSquared <= radius * radius)
    .sort((left, right) => left.progress - right.progress)
    .map((candidate) => candidate.index);
}

function pointFromEvent(
  event: GestureResponderEvent,
  boardSize: number,
  boardOrigin: Point,
): Point {
  const pageX = event.nativeEvent.pageX;
  const pageY = event.nativeEvent.pageY;
  const rawPoint = {
    // Android locationX/locationY can jump back when the finger crosses a
    // rounded parent boundary. Screen coordinates remain continuous there.
    x: Number.isFinite(pageX) ? pageX - boardOrigin.x : event.nativeEvent.locationX,
    y: Number.isFinite(pageY) ? pageY - boardOrigin.y : event.nativeEvent.locationY,
  };
  const center = boardSize / 2;
  const dx = rawPoint.x - center;
  const dy = rawPoint.y - center;
  const distance = Math.hypot(dx, dy);
  // Pointer board dışına çıktığında SVG yolunun daire dışına uzamasını
  // engelle. Böylece Android'de kenardan sekme/yansıma hissi oluşmaz.
  const maxDistance = Math.max(0, center - 3);
  if (distance <= maxDistance || distance === 0) return rawPoint;

  const scale = maxDistance / distance;
  return {
    x: center + dx * scale,
    y: center + dy * scale,
  };
}

function selectionSound(count: number): GameSound {
  const note = Math.max(1, Math.min(7, count));
  return `select${note}` as GameSound;
}

function selectionsUseSameNodes(left: readonly number[], right: readonly number[]): boolean {
  if (left.length !== right.length) return false;
  const remaining = [...right];
  return left.every((nodeIndex) => {
    const matchIndex = remaining.indexOf(nodeIndex);
    if (matchIndex < 0) return false;
    remaining.splice(matchIndex, 1);
    return true;
  });
}

function getPracticeResult(
  lesson: PracticeLesson,
  completedSelection: readonly number[],
): number | null {
  const operands = completedSelection.map((nodeIndex) => Number(lesson.nodes[nodeIndex]));
  if (operands.length === 0 || operands.some((operand) => !Number.isFinite(operand))) return null;

  const [firstOperand, ...remainingOperands] = operands;
  if (lesson.operator === '+') {
    return remainingOperands.reduce((result, operand) => result + operand, firstOperand);
  }
  if (lesson.operator === '×') {
    return remainingOperands.reduce((result, operand) => result * operand, firstOperand);
  }
  if (lesson.operator === '÷') {
    return remainingOperands.reduce((result, operand) => {
      if (operand === 0 || result % operand !== 0) return Number.NaN;
      return result / operand;
    }, firstOperand);
  }
  return remainingOperands.reduce((result, operand) => result - operand, firstOperand);
}

function isPracticeSelectionCorrect(
  lesson: PracticeLesson,
  completedSelection: readonly number[],
): boolean {
  if (!selectionsUseSameNodes(completedSelection, lesson.solution)) return false;
  return getPracticeResult(lesson, completedSelection) === Number(lesson.target);
}

function buildPath(
  selection: readonly number[],
  positions: readonly Point[],
  pointer: Point | null,
): string {
  if (selection.length === 0) return '';
  const first = positions[selection[0]];
  if (!first) return '';
  let path = `M ${first.x} ${first.y}`;
  selection.slice(1).forEach((nodeIndex) => {
    const position = positions[nodeIndex];
    if (position) path += ` L ${position.x} ${position.y}`;
  });
  if (pointer) path += ` L ${pointer.x} ${pointer.y}`;
  return path;
}

export function FreshGameTutorialModal({
  visible,
  onDone,
  onEffect,
}: FreshGameTutorialModalProps) {
  const { t } = useI18n();
  const { height, width } = useWindowDimensions();
  const boardSize = Math.max(238, Math.min(286, width - 76, height * 0.42));
  const nodeSize = Math.max(47, Math.min(56, boardSize * 0.195));
  const hitRadius = nodeSize * 0.72;
  const positions = useMemo(() => getNodePositions(boardSize), [boardSize]);

  const [phase, setPhase] = useState<TutorialPhase>('shuffleReady');
  const [lessonIndex, setLessonIndex] = useState(0);
  const [selection, setSelection] = useState<number[]>([]);
  const [pointer, setPointer] = useState<Point | null>(null);
  const [tone, setTone] = useState<ConnectionTone>('active');

  const phaseRef = useRef<TutorialPhase>('shuffleReady');
  const lessonIndexRef = useRef(0);
  const selectionRef = useRef<number[]>([]);
  const lastPointerRef = useRef<Point | null>(null);
  const boardRef = useRef<View>(null);
  const boardOriginRef = useRef<Point>({ x: 0, y: 0 });
  const visibleRef = useRef(false);
  const runRef = useRef(0);
  const actionLockedRef = useRef(false);
  const gestureLockedRef = useRef(true);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  const onEffectRef = useRef(onEffect);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const [shuffleProgress] = useState(() => new Animated.Value(0));
  const [demoProgress] = useState(() => new Animated.Value(0));
  const [yourTurnProgress] = useState(() => new Animated.Value(0));
  const [focusPulse] = useState(() => new Animated.Value(0));
  const [celebrationProgress] = useState(() => new Animated.Value(0));
  const shuffleAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const demoAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const yourTurnAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const focusAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const celebrationAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  const setCurrentPhase = useCallback((nextPhase: TutorialPhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);

  const setCurrentSelection = useCallback((nextSelection: number[]) => {
    selectionRef.current = nextSelection;
    setSelection(nextSelection);
  }, []);

  const stopAllWork = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
    shuffleAnimationRef.current?.stop();
    demoAnimationRef.current?.stop();
    yourTurnAnimationRef.current?.stop();
    focusAnimationRef.current?.stop();
    celebrationAnimationRef.current?.stop();
    shuffleAnimationRef.current = null;
    demoAnimationRef.current = null;
    yourTurnAnimationRef.current = null;
    focusAnimationRef.current = null;
    celebrationAnimationRef.current = null;
  }, []);

  const schedule = useCallback((callback: () => void, delay: number) => {
    const timer = setTimeout(() => {
      timersRef.current.delete(timer);
      callback();
    }, delay);
    timersRef.current.add(timer);
  }, []);

  const isRunActive = useCallback(
    (runId: number) => visibleRef.current && runRef.current === runId,
    [],
  );

  const playEffect = useCallback(async (sound: GameSound) => {
    try {
      await onEffectRef.current?.(sound);
    } catch {
      // Eğitim akışı, cihaz ses katmanı bir efekti reddetse bile ilerleyebilmelidir.
    }
  }, []);

  const enterPractice = useCallback(() => {
    lessonIndexRef.current = 0;
    setLessonIndex(0);
    setCurrentSelection([]);
    setPointer(null);
    lastPointerRef.current = null;
    setTone('active');
    actionLockedRef.current = false;
    gestureLockedRef.current = false;
    setCurrentPhase('practice');
  }, [setCurrentPhase, setCurrentSelection]);

  const startCelebration = useCallback(
    (runId: number) => {
      if (doneRef.current || !isRunActive(runId)) return;

      setCurrentSelection([]);
      setPointer(null);
      setCurrentPhase('celebrate');
      celebrationProgress.setValue(0);
      const animation = Animated.timing(celebrationProgress, {
        toValue: 1,
        duration: 1950,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      celebrationAnimationRef.current = animation;
      animation.start(({ finished }) => {
        if (celebrationAnimationRef.current === animation) {
          celebrationAnimationRef.current = null;
        }
        if (!finished || !isRunActive(runId) || doneRef.current) return;
      });

      void (async () => {
        if (doneRef.current || !isRunActive(runId)) return;
        await playEffect('levelComplete');
        if (doneRef.current || !isRunActive(runId)) return;

        schedule(() => {
          if (!isRunActive(runId) || doneRef.current) return;
          doneRef.current = true;
          onDoneRef.current();
        }, 2250);
      })();
    },
    [celebrationProgress, isRunActive, playEffect, schedule, setCurrentPhase, setCurrentSelection],
  );

  const handleSkip = useCallback(() => {
    if (doneRef.current || phaseRef.current === 'celebrate') return;
    doneRef.current = true;
    runRef.current += 1;
    visibleRef.current = false;
    stopAllWork();
    onDoneRef.current();
  }, [stopAllWork]);

  useEffect(() => {
    onDoneRef.current = onDone;
    onEffectRef.current = onEffect;
  }, [onDone, onEffect]);

  useEffect(() => {
    visibleRef.current = visible;
    runRef.current += 1;
    stopAllWork();

    if (!visible) {
      gestureLockedRef.current = true;
      return;
    }

    const runId = runRef.current;
    doneRef.current = false;
    actionLockedRef.current = false;
    gestureLockedRef.current = true;
    lessonIndexRef.current = 0;
    // Her yeni gösterimde state machine ilk deterministik karesine döner.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLessonIndex(0);
    setCurrentSelection([]);
    setPointer(null);
    lastPointerRef.current = null;
    setTone('active');
    shuffleProgress.setValue(0);
    demoProgress.setValue(0);
    yourTurnProgress.setValue(0);
    focusPulse.setValue(0);
    celebrationProgress.setValue(0);
    setCurrentPhase('shuffleReady');

    return () => {
      if (runRef.current === runId) runRef.current += 1;
      visibleRef.current = false;
      stopAllWork();
    };
  }, [
    celebrationProgress,
    demoProgress,
    focusPulse,
    setCurrentPhase,
    setCurrentSelection,
    shuffleProgress,
    stopAllWork,
    visible,
    yourTurnProgress,
  ]);

  useEffect(() => {
    focusAnimationRef.current?.stop();
    focusPulse.setValue(0);
    if (!visible || (phase !== 'shuffleReady' && phase !== 'hintReady')) return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(focusPulse, {
          toValue: 1,
          duration: 440,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(focusPulse, {
          toValue: 0,
          duration: 440,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    focusAnimationRef.current = animation;
    animation.start();
    return () => {
      animation.stop();
      if (focusAnimationRef.current === animation) focusAnimationRef.current = null;
    };
  }, [focusPulse, phase, visible]);

  const handleShufflePressIn = useCallback(() => {
    if (
      phaseRef.current !== 'shuffleReady' ||
      actionLockedRef.current ||
      !visibleRef.current
    ) {
      return;
    }

    actionLockedRef.current = true;
    gestureLockedRef.current = true;
    setCurrentPhase('shuffleSound');
    const runId = runRef.current;

    void (async () => {
      await playEffect('shuffle');
      if (!isRunActive(runId) || phaseRef.current !== 'shuffleSound') return;

      setCurrentPhase('shuffleMove');
      shuffleProgress.setValue(0);
      const animation = Animated.timing(shuffleProgress, {
        toValue: 1,
        duration: 760,
        easing: Easing.bezier(0.34, 1.15, 0.64, 1),
        useNativeDriver: true,
      });
      shuffleAnimationRef.current = animation;
      animation.start(({ finished }) => {
        if (shuffleAnimationRef.current === animation) shuffleAnimationRef.current = null;
        if (!finished || !isRunActive(runId)) return;
        setCurrentPhase('hintReady');
        actionLockedRef.current = false;
      });
    })();
  }, [isRunActive, playEffect, setCurrentPhase, shuffleProgress]);

  const handleHintPressIn = useCallback(() => {
    if (
      phaseRef.current !== 'hintReady' ||
      actionLockedRef.current ||
      !visibleRef.current
    ) {
      return;
    }

    actionLockedRef.current = true;
    setCurrentPhase('hintSound');
    const runId = runRef.current;

    void (async () => {
      await playEffect('hint');
      if (!isRunActive(runId) || phaseRef.current !== 'hintSound') return;

      setCurrentPhase('demo');

      function runDemoPass(passNumber: number) {
        if (!isRunActive(runId) || phaseRef.current !== 'demo') return;

        setTone('active');
        setCurrentSelection([DEMO_FROM]);
        demoProgress.setValue(0);

        void (async () => {
          await playEffect('select1');
          if (!isRunActive(runId) || phaseRef.current !== 'demo') return;

          const animation = Animated.timing(demoProgress, {
            toValue: 1,
            duration: 760,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          });
          demoAnimationRef.current = animation;
          animation.start(({ finished }) => {
            if (demoAnimationRef.current === animation) demoAnimationRef.current = null;
            if (!finished || !isRunActive(runId) || phaseRef.current !== 'demo') return;

            setCurrentSelection([DEMO_FROM, DEMO_TO]);
            void playEffect('select2');

            if (passNumber < 2) {
              // İlk çizgiyi kısa süre görünür bırak, sonra aynı hareketi ikinci
              // kez baştan oynat; kullanıcı bağlantı jestini netçe izlesin.
              schedule(() => runDemoPass(passNumber + 1), 180);
              return;
            }

            schedule(() => {
              if (!isRunActive(runId) || phaseRef.current !== 'demo') return;
              setTone('success');
              void playEffect('success');
              schedule(() => {
                if (!isRunActive(runId) || phaseRef.current !== 'demo') return;
                setCurrentSelection([]);
                setTone('active');
                yourTurnProgress.setValue(0);
                setCurrentPhase('yourTurn');
                const animation = Animated.timing(yourTurnProgress, {
                  toValue: 1,
                  duration: 1700,
                  easing: Easing.linear,
                  useNativeDriver: true,
                });
                yourTurnAnimationRef.current = animation;
                animation.start(({ finished }) => {
                  if (yourTurnAnimationRef.current === animation) {
                    yourTurnAnimationRef.current = null;
                  }
                  if (!finished || !isRunActive(runId) || phaseRef.current !== 'yourTurn') return;
                  enterPractice();
                });
              }, 520);
            }, 180);
          });
        })();
      }

      runDemoPass(1);
    })();
  }, [
    demoProgress,
    enterPractice,
    isRunActive,
    playEffect,
    schedule,
    setCurrentPhase,
    setCurrentSelection,
    yourTurnProgress,
  ]);

  const emitSelectionTone = useCallback(
    (count: number) => {
      void playEffect(selectionSound(count));
    },
    [playEffect],
  );

  const beginPracticeSelection = useCallback(
    (nodeIndex: number, point: Point) => {
      if (phaseRef.current !== 'practice' || gestureLockedRef.current) return;
      const nextSelection = [nodeIndex];
      setTone('active');
      setCurrentSelection(nextSelection);
      setPointer(point);
      lastPointerRef.current = point;
      emitSelectionTone(1);
    },
    [emitSelectionTone, setCurrentSelection],
  );

  const traversePracticeSelection = useCallback(
    (nodeIndices: readonly number[], point: Point) => {
      if (phaseRef.current !== 'practice' || gestureLockedRef.current) return;
      let current = [...selectionRef.current];

      nodeIndices.forEach((nodeIndex) => {
        const last = current[current.length - 1];
        if (nodeIndex === last) return;

        const previous = current[current.length - 2];
        if (current.length > 1 && nodeIndex === previous) {
          current = current.slice(0, -1);
          setCurrentSelection([...current]);
          emitSelectionTone(current.length);
          return;
        }

        if (current.includes(nodeIndex) || current.length >= 7) return;
        current = [...current, nodeIndex];
        setCurrentSelection([...current]);
        emitSelectionTone(current.length);
      });

      setPointer(point);
      lastPointerRef.current = point;
    },
    [emitSelectionTone, setCurrentSelection],
  );

  const clearPracticeSelection = useCallback(() => {
    setCurrentSelection([]);
    setPointer(null);
    lastPointerRef.current = null;
    setTone('active');
  }, [setCurrentSelection]);

  const finishPracticeSelection = useCallback(() => {
    if (phaseRef.current !== 'practice' || gestureLockedRef.current) return;
    const completedSelection = [...selectionRef.current];
    setPointer(null);
    lastPointerRef.current = null;

    if (completedSelection.length < 2) {
      clearPracticeSelection();
      return;
    }

    const lesson = PRACTICE_LESSONS[lessonIndexRef.current];
    if (!lesson || !isPracticeSelectionCorrect(lesson, completedSelection)) {
      gestureLockedRef.current = true;
      setTone('invalid');
      const runId = runRef.current;
      schedule(() => {
        if (!isRunActive(runId) || phaseRef.current !== 'practice') return;
        clearPracticeSelection();
        gestureLockedRef.current = false;
      }, 330);
      return;
    }

    gestureLockedRef.current = true;
    setTone(lesson.isBonus ? 'bonus' : 'success');
    // Sonuç sesi, başarılı eşleşmenin görsel state'i ile aynı release
    // olayında başlar; araya yapay bekleme girmez.
    void playEffect(lesson.isBonus ? 'bonus' : 'success');
    const runId = runRef.current;

    schedule(() => {
      if (!isRunActive(runId) || phaseRef.current !== 'practice') return;
      const isLastLesson = lessonIndexRef.current >= PRACTICE_LESSONS.length - 1;
      if (isLastLesson) {
        setCurrentSelection([]);
        startCelebration(runId);
        return;
      }

      const nextIndex = lessonIndexRef.current + 1;
      lessonIndexRef.current = nextIndex;
      setLessonIndex(nextIndex);
      clearPracticeSelection();
      gestureLockedRef.current = false;
    }, lesson.isBonus ? 850 : 720);
  }, [
    clearPracticeSelection,
    isRunActive,
    playEffect,
    schedule,
    setCurrentSelection,
    startCelebration,
  ]);

  /* RN PanResponder callback'leri güncel state-machine ref'lerini olay anında okur. */
  /* eslint-disable react-hooks/refs */
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (event) => {
          if (phaseRef.current !== 'practice' || gestureLockedRef.current) return false;
          return findNode(pointFromEvent(event, boardSize, boardOriginRef.current), positions, hitRadius) >= 0;
        },
        onStartShouldSetPanResponderCapture: (event) => {
          if (phaseRef.current !== 'practice' || gestureLockedRef.current) return false;
          return findNode(pointFromEvent(event, boardSize, boardOriginRef.current), positions, hitRadius) >= 0;
        },
        // Seçim yalnızca bir düğümün üzerindeki touch-down ile başlar.
        // Kabul edilmiş responder zaten sonraki move olaylarını almaya devam eder.
        onMoveShouldSetPanResponder: () => false,
        onPanResponderGrant: (event) => {
          const point = pointFromEvent(event, boardSize, boardOriginRef.current);
          const nodeIndex = findNode(point, positions, hitRadius);
          if (nodeIndex >= 0) beginPracticeSelection(nodeIndex, point);
        },
        onPanResponderMove: (event) => {
          const point = pointFromEvent(event, boardSize, boardOriginRef.current);
          const from = lastPointerRef.current ?? point;
          const traversedNodes = findNodesAlongSegment(from, point, positions, hitRadius);
          traversePracticeSelection(traversedNodes, point);
        },
        onPanResponderRelease: (event) => {
          // Çok hızlı sürüklemelerde hedef düğüm yalnız release olayında
          // görülebilir. Seçimi bitirmeden bu son segmenti de işle.
          const point = pointFromEvent(event, boardSize, boardOriginRef.current);
          const from = lastPointerRef.current ?? point;
          const traversedNodes = findNodesAlongSegment(from, point, positions, hitRadius);
          traversePracticeSelection(traversedNodes, point);
          finishPracticeSelection();
        },
        onPanResponderTerminate: clearPracticeSelection,
        onPanResponderTerminationRequest: () => false,
      }),
    [
      beginPracticeSelection,
      clearPracticeSelection,
      finishPracticeSelection,
      hitRadius,
      boardSize,
      positions,
      traversePracticeSelection,
    ],
  );
  /* eslint-enable react-hooks/refs */

  const lesson = PRACTICE_LESSONS[Math.min(lessonIndex, PRACTICE_LESSONS.length - 1)];
  const demoFrom = positions[DEMO_FROM];
  const demoTo = positions[DEMO_TO];
  const demoDeltaX = demoTo.x - demoFrom.x;
  const demoDeltaY = demoTo.y - demoFrom.y;
  const demoLineLength = Math.hypot(demoDeltaX, demoDeltaY);
  const demoLineAngle = `${(Math.atan2(demoDeltaY, demoDeltaX) * 180) / Math.PI}deg`;
  const displaySelection = phase === 'demo' ? selection : phase === 'practice' ? selection : [];
  const displayPointer = phase === 'practice' ? pointer : null;
  const connectionPath = buildPath(displaySelection, positions, displayPointer);
  const colors = CONNECTION_COLORS[tone];
  const showShuffleNodes =
    phase === 'shuffleReady' || phase === 'shuffleSound' || phase === 'shuffleMove';
  const showHintNodes = phase === 'hintReady' || phase === 'hintSound';
  const showPracticeSetup = phase === 'practice' || phase === 'yourTurn';
  const handBounce = focusPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 7],
  });
  const buttonScale = focusPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.045],
  });
  const yourTurnOpacity = yourTurnProgress.interpolate({
    inputRange: [0, 0.12, 0.78, 1],
    outputRange: [0, 1, 1, 0],
    extrapolate: 'clamp',
  });
  const yourTurnScale = yourTurnProgress.interpolate({
    inputRange: [0, 0.16, 0.3, 0.78, 1],
    outputRange: [0.72, 1.08, 1, 1, 0.92],
    extrapolate: 'clamp',
  });

  const title =
    phase === 'celebrate'
      ? t('tutorial.celebrateTitle')
      : phase === 'yourTurn'
        ? lesson.eyebrow
        : phase === 'practice'
          ? lesson.eyebrow
          : phase === 'hintReady' || phase === 'hintSound'
            ? 'İpucunu Kullan'
            : phase === 'demo'
              ? 'Düğümleri Bağla'
              : 'Tahtayı Karıştır';

  const subtitle =
    phase === 'celebrate'
      ? t('tutorial.celebrateSubtitle')
      : phase === 'yourTurn'
        ? lesson.instruction
        : phase === 'practice'
          ? lesson.instruction
          : phase === 'hintReady'
            ? 'Ampule dokun; doğru bağlantıyı gör.'
            : phase === 'hintSound'
              ? 'İpucu hazırlanıyor…'
              : phase === 'demo'
                ? 'A’dan B’ye bağlantıyı iki kez dikkatlice izle.'
                : phase === 'shuffleSound'
                  ? 'Karıştırma sesi hazırlanıyor…'
                  : phase === 'shuffleMove'
                    ? 'Düğümler yeni yerlerine geçiyor.'
                    : 'Karıştır düğmesine dokun.';

  return (
    <Modal
      animationType="fade"
      hardwareAccelerated
      onRequestClose={() => undefined}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent={!IS_ANDROID}
      visible={visible}>
      <View style={[styles.overlay, IS_ANDROID && styles.overlayAndroid]}>
        <View
          style={[
            styles.cardShadow,
            IS_ANDROID && styles.cardShadowAndroid,
            { maxHeight: height - 32 },
          ]}>
          <LinearGradient
            colors={['#087A8A', '#39AEB5', '#B9E2D3', '#F3D39A']}
            end={{ x: 0.78, y: 1 }}
            start={{ x: 0.18, y: 0 }}
            style={styles.card}>
            <View pointerEvents="none" style={styles.sunGlow} />
            <View pointerEvents="none" style={styles.bubbleOne} />
            <View pointerEvents="none" style={styles.bubbleTwo} />
            <View pointerEvents="none" style={styles.sandBank} />

            {phase !== 'celebrate' ? (
              <Pressable
                accessibilityLabel={t('tutorial.skipA11y')}
                accessibilityRole="button"
                hitSlop={8}
                onPress={handleSkip}
                style={({ pressed }) => [styles.skipButton, pressed && styles.skipButtonPressed]}>
                <Text style={styles.skipButtonText}>{t('tutorial.skip')}</Text>
              </Pressable>
            ) : null}
            {showPracticeSetup ? (
              <View style={styles.lessonProgress}>
                {PRACTICE_LESSONS.map((item, index) => (
                  <View
                    key={item.key}
                    style={[
                      styles.lessonProgressDot,
                      index <= lessonIndex && styles.lessonProgressDotActive,
                    ]}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.lessonProgressPlaceholder} />
            )}

            <View style={styles.tutorialBadge}>
              <Text style={styles.tutorialBadgeText}>OYUN EĞİTİMİ</Text>
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>

            {phase === 'celebrate' ? (
              <View style={[styles.celebrationStage, { height: boardSize + 66 }]}>
                <View style={styles.treasureGlow} />
                <View style={styles.treasureChest}>
                  <View style={styles.chestLid} />
                  <Text style={styles.treasureStar}>★</Text>
                </View>
                <Text style={styles.celebrationTitle}>{t('tutorial.celebrateDone')}</Text>
                <Text style={styles.celebrationCopy}>{t('tutorial.celebrateBody')}</Text>
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                  {CONFETTI.map((particle, index) => {
                    const localProgress = celebrationProgress.interpolate({
                      inputRange: [particle.delay, Math.min(1, particle.delay + 0.7), 1],
                      outputRange: [0, 0.72, 1],
                      extrapolate: 'clamp',
                    });
                    const opacity = celebrationProgress.interpolate({
                      inputRange: [0, particle.delay, Math.min(0.82, particle.delay + 0.16), 1],
                      outputRange: [0, 0, 1, 0],
                      extrapolate: 'clamp',
                    });
                    return (
                      <Animated.View
                        key={`confetti-${index}`}
                        style={[
                          styles.confetti,
                          {
                            backgroundColor: particle.color,
                            borderRadius: index % 3 === 0 ? particle.size / 2 : 2,
                            height: particle.size * 1.55,
                            opacity,
                            transform: [
                              { translateX: Animated.multiply(localProgress, particle.dx) },
                              {
                                translateY: celebrationProgress.interpolate({
                                  inputRange: [0, 0.38, 1],
                                  outputRange: [0, -particle.rise, particle.dy],
                                  extrapolate: 'clamp',
                                }),
                              },
                              {
                                rotate: celebrationProgress.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: ['0deg', `${particle.rotation}deg`],
                                }),
                              },
                            ],
                            width: particle.size,
                          },
                        ]}
                      />
                    );
                  })}
                </View>
              </View>
            ) : (
              <>
                <View
                  {...(phase === 'practice' ? panResponder.panHandlers : {})}
                  accessibilityLabel="Eğitim düğüm tahtası"
                  collapsable={false}
                  onLayout={() => {
                    boardRef.current?.measureInWindow((x, y) => {
                      boardOriginRef.current = { x, y };
                    });
                  }}
                  pointerEvents={phase === 'practice' ? 'box-only' : 'none'}
                  ref={boardRef}
                  style={[styles.board, { height: boardSize, width: boardSize }]}> 
                  <View style={styles.boardInnerRing} />
                  <View style={styles.boardCenterWash} />

                  {connectionPath ? (
                    <Svg
                      height="100%"
                      pointerEvents="none"
                      style={StyleSheet.absoluteFill}
                      width="100%">
                      <Path
                        d={connectionPath}
                        fill="none"
                        stroke={colors.glow}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={16}
                      />
                      <Path
                        d={connectionPath}
                        fill="none"
                        stroke={colors.core}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={6}
                      />
                      {displayPointer ? (
                        <Circle cx={displayPointer.x} cy={displayPointer.y} fill={colors.core} r={4} />
                      ) : null}
                    </Svg>
                  ) : null}

                  {phase === 'demo' && selection.length === 1 ? (
                    <View
                      pointerEvents="none"
                      style={[
                        styles.demoLineTrack,
                        {
                          left: (demoFrom.x + demoTo.x) / 2 - demoLineLength / 2,
                          top: (demoFrom.y + demoTo.y) / 2 - 8,
                          transform: [{ rotate: demoLineAngle }],
                          width: demoLineLength,
                        },
                      ]}>
                      <Animated.View
                        style={{
                          height: 16,
                          transform: [
                            {
                              translateX: demoProgress.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-demoLineLength / 2, 0],
                              }),
                            },
                          ],
                          width: demoLineLength,
                        }}>
                        <Animated.View
                          style={{
                            height: 16,
                            transform: [{ scaleX: demoProgress }],
                            width: demoLineLength,
                          }}>
                          <View
                            style={[styles.demoLineGlow, { backgroundColor: colors.glow }]}
                          />
                          <View
                            style={[styles.demoLineCore, { backgroundColor: colors.core }]}
                          />
                        </Animated.View>
                      </Animated.View>
                    </View>
                  ) : null}

                  {showPracticeSetup
                    ? lesson.solution.slice(1).map((nodeIndex, operatorIndex) => {
                        const from = positions[lesson.solution[operatorIndex]];
                        const to = positions[nodeIndex];
                        return (
                          <View
                            key={`operator-${operatorIndex}`}
                            pointerEvents="none"
                            style={[
                              styles.operatorBadge,
                              {
                                left: (from.x + to.x) / 2 - 16,
                                top: (from.y + to.y) / 2 - 16,
                              },
                            ]}>
                            <Text style={styles.operatorText}>{lesson.operator}</Text>
                          </View>
                        );
                      })
                    : null}

                  {showPracticeSetup ? (
                    <View pointerEvents="none" style={styles.targetBadge}>
                      <Text style={styles.targetLabel}>HEDEF</Text>
                      <Text style={styles.targetValue}>{lesson.target}</Text>
                    </View>
                  ) : null}

                  {showShuffleNodes
                    ? SHUFFLE_FROM.map((value, sourceSlot) => {
                        const from = positions[sourceSlot];
                        const target = positions[SHUFFLE_TARGET_SLOT[sourceSlot]];
                        return (
                          <Animated.View
                            key={`shuffle-${sourceSlot}`}
                            style={[
                              styles.node,
                              {
                                height: nodeSize,
                                left: from.x - nodeSize / 2,
                                top: from.y - nodeSize / 2,
                                transform: [
                                  {
                                    translateX: shuffleProgress.interpolate({
                                      inputRange: [0, 1],
                                      outputRange: [0, target.x - from.x],
                                    }),
                                  },
                                  {
                                    translateY: shuffleProgress.interpolate({
                                      inputRange: [0, 1],
                                      outputRange: [0, target.y - from.y],
                                    }),
                                  },
                                  {
                                    rotate: shuffleProgress.interpolate({
                                      inputRange: [0, 1],
                                      outputRange: ['0deg', `${sourceSlot % 2 === 0 ? 14 : -14}deg`],
                                    }),
                                  },
                                  {
                                    scale: shuffleProgress.interpolate({
                                      inputRange: [0, 0.5, 1],
                                      outputRange: [1, 0.84, 1],
                                    }),
                                  },
                                ],
                                width: nodeSize,
                              },
                            ]}>
                            <Text style={styles.nodeText}>{value}</Text>
                          </Animated.View>
                        );
                      })
                    : null}

                  {showHintNodes
                    ? SHUFFLE_TO.map((value, index) => {
                        const position = positions[index];
                        return (
                          <View
                            key={`hint-node-${index}`}
                            style={[
                              styles.node,
                              {
                                height: nodeSize,
                                left: position.x - nodeSize / 2,
                                top: position.y - nodeSize / 2,
                                width: nodeSize,
                              },
                            ]}>
                            <Text style={styles.nodeText}>{value}</Text>
                          </View>
                        );
                      })
                    : null}

                  {phase === 'demo' || showPracticeSetup
                    ? (phase === 'demo' ? DEMO_NODES : lesson.nodes).map((value, index) => {
                        const position = positions[index];
                        const selected = selection.includes(index);
                        const guideStep =
                          showPracticeSetup ? lesson.solution.indexOf(index) : -1;
                        return (
                          <View
                            key={`${phase}-node-${index}`}
                            pointerEvents="none"
                            style={[
                              styles.node,
                              selected && styles.nodeSelected,
                              tone === 'success' && selected && styles.nodeSuccess,
                              tone === 'bonus' && selected && styles.nodeBonus,
                              tone === 'invalid' && selected && styles.nodeInvalid,
                              {
                                height: nodeSize,
                                left: position.x - nodeSize / 2,
                                top: position.y - nodeSize / 2,
                                width: nodeSize,
                              },
                            ]}>
                            <Text style={styles.nodeText}>{value}</Text>
                            {guideStep >= 0 ? (
                              <View style={styles.stepBadge}>
                                <Text style={styles.stepBadgeText}>
                                  {lesson.operator === '−' ? guideStep + 1 : '✓'}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        );
                      })
                    : null}

                  {phase === 'demo' && selection.length === 1 ? (
                    <Animated.Image
                      resizeMode="contain"
                      source={require('../../../assets/images/img/hint_arrow.png')}
                      style={[
                        styles.demoHand,
                        {
                          left: demoFrom.x - 8,
                          top: demoFrom.y - 5,
                          transform: [
                            {
                              translateX: demoProgress.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, demoDeltaX],
                              }),
                            },
                            {
                              translateY: demoProgress.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, demoDeltaY],
                              }),
                            },
                          ],
                        },
                      ]}
                    />
                  ) : null}

                  {phase === 'yourTurn' ? (
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.yourTurnOverlay,
                        {
                          opacity: yourTurnOpacity,
                          transform: [{ scale: yourTurnScale }],
                        },
                      ]}>
                      <Text
                        allowFontScaling={false}
                        numberOfLines={1}
                        style={[
                          styles.yourTurnText,
                          {
                            fontSize: IS_ANDROID
                              ? Math.max(30, Math.min(40, boardSize * 0.14))
                              : Math.max(32, Math.min(38, boardSize * 0.132)),
                            lineHeight: IS_ANDROID ? 58 : 46,
                          },
                        ]}>
                        Sıra Sende!
                      </Text>
                    </Animated.View>
                  ) : null}
                </View>

                {showPracticeSetup ? (
                  <View style={styles.practiceFooter}>
                    <View style={styles.equationPill}>
                      <Text style={styles.equationText}>{lesson.equation}</Text>
                    </View>
                    <View style={styles.stepMeter}>
                      <Text style={styles.stepMeterLabel}>Adım Sayısı</Text>
                      <View style={styles.stepDots}>
                        {lesson.solution.map((_, dotIndex) => (
                          <View
                            key={`step-dot-${dotIndex}`}
                            style={[
                              styles.stepDot,
                              dotIndex < selection.length && styles.stepDotFilled,
                              lesson.isBonus &&
                                dotIndex < selection.length &&
                                styles.stepDotBonus,
                            ]}
                          />
                        ))}
                      </View>
                    </View>
                  </View>
                ) : phase === 'shuffleReady' ||
                  phase === 'shuffleSound' ||
                  phase === 'shuffleMove' ? (
                  <View style={styles.actionArea}>
                    <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                      <Pressable
                        accessibilityHint="Düğüm yerlerini değiştirir"
                        accessibilityLabel="Karıştır"
                        accessibilityRole="button"
                        disabled={phase !== 'shuffleReady'}
                        onPressIn={handleShufflePressIn}
                        style={({ pressed }) => [
                          styles.actionButton,
                          pressed && phase === 'shuffleReady' && styles.actionButtonPressed,
                          phase !== 'shuffleReady' && styles.actionButtonBusy,
                        ]}>
                        <ShuffleIcon color="#F7FFFF" size={28} />
                        <Text style={styles.actionButtonText}>
                          {phase === 'shuffleReady' ? 'KARIŞTIR' : 'KARIŞTIRILIYOR'}
                        </Text>
                      </Pressable>
                    </Animated.View>
                    {phase === 'shuffleReady' ? (
                      <Animated.View
                        pointerEvents="none"
                        style={[styles.controlHand, { transform: [{ translateY: handBounce }] }]}>
                        <Image
                          resizeMode="contain"
                          source={require('../../../assets/images/img/hint_arrow.png')}
                          style={styles.controlHandImage}
                        />
                      </Animated.View>
                    ) : null}
                  </View>
                ) : phase === 'hintReady' || phase === 'hintSound' ? (
                  <View style={styles.actionArea}>
                    <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                      <Pressable
                        accessibilityHint="Örnek bağlantıyı gösterir"
                        accessibilityLabel="İpucu"
                        accessibilityRole="button"
                        disabled={phase !== 'hintReady'}
                        onPressIn={handleHintPressIn}
                        style={({ pressed }) => [
                          styles.actionButton,
                          styles.hintButton,
                          pressed && phase === 'hintReady' && styles.actionButtonPressed,
                          phase !== 'hintReady' && styles.actionButtonBusy,
                        ]}>
                        <HintIcon color="#FFF3A8" size={27} />
                        <Text style={styles.actionButtonText}>
                          {phase === 'hintReady' ? 'İPUCUNU GÖSTER' : 'İPUCU AÇILIYOR'}
                        </Text>
                      </Pressable>
                    </Animated.View>
                    {phase === 'hintReady' ? (
                      <Animated.View
                        pointerEvents="none"
                        style={[styles.controlHand, { transform: [{ translateY: handBounce }] }]}>
                        <Image
                          resizeMode="contain"
                          source={require('../../../assets/images/img/hint_arrow.png')}
                          style={styles.controlHandImage}
                        />
                      </Animated.View>
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.demoFooter}>
                    <View style={styles.demoDot} />
                    <Text style={styles.demoFooterText}>Bağlantı gösteriliyor</Text>
                  </View>
                )}
              </>
            )}
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(2, 25, 37, 0.78)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  overlayAndroid: {
    // Android Modal ayrı ve opak bir surface kullanır. Böylece arkadaki oyun,
    // reklam ve ana ekran yüzlerce view ile her modal karesinde tekrar çizilmez.
    backgroundColor: '#238E9B',
  },
  cardShadow: {
    borderRadius: 32,
    elevation: 24,
    maxWidth: 390,
    shadowColor: '#00191F',
    shadowOffset: { height: 14, width: 0 },
    shadowOpacity: 0.48,
    shadowRadius: 24,
    width: '100%',
  },
  cardShadowAndroid: {
    elevation: 6,
    shadowOpacity: 0,
  },
  card: {
    alignItems: 'center',
    borderColor: 'rgba(235,255,250,0.68)',
    borderRadius: 32,
    borderWidth: 2,
    overflow: 'hidden',
    paddingBottom: 19,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  skipButton: {
    position: 'absolute',
    right: 14,
    top: 14,
    zIndex: 20,
    borderColor: 'rgba(255,255,255,0.55)',
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(8,70,82,0.42)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  skipButtonPressed: {
    opacity: 0.82,
  },
  skipButtonText: {
    color: '#F7FFFF',
    fontFamily: FONTS.extraBold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  sunGlow: {
    backgroundColor: 'rgba(255,244,184,0.18)',
    borderRadius: 110,
    height: 220,
    position: 'absolute',
    right: -78,
    top: -90,
    width: 220,
  },
  bubbleOne: {
    borderColor: 'rgba(221,255,255,0.28)',
    borderRadius: 14,
    borderWidth: 2,
    height: 28,
    left: 26,
    position: 'absolute',
    top: 82,
    width: 28,
  },
  bubbleTwo: {
    borderColor: 'rgba(221,255,255,0.2)',
    borderRadius: 8,
    borderWidth: 2,
    height: 16,
    position: 'absolute',
    right: 35,
    top: 148,
    width: 16,
  },
  sandBank: {
    backgroundColor: 'rgba(255,225,165,0.48)',
    borderRadius: 180,
    bottom: -118,
    height: 220,
    position: 'absolute',
    width: '125%',
  },
  lessonProgress: {
    flexDirection: 'row',
    gap: 7,
    height: 14,
    justifyContent: 'center',
  },
  lessonProgressPlaceholder: {
    height: 14,
  },
  tutorialBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 218, 111, 0.94)',
    borderColor: 'rgba(255, 250, 221, 0.9)',
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 5,
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  tutorialBadgeText: {
    color: '#145B68',
    fontFamily: FONTS.extraBold,
    fontSize: 12,
    letterSpacing: 1.2,
  },
  lessonProgressDot: {
    backgroundColor: 'rgba(228,255,251,0.32)',
    borderRadius: 4,
    height: 6,
    width: 22,
  },
  lessonProgressDotActive: {
    backgroundColor: '#FFF0A4',
  },
  title: {
    color: '#F8FFFF',
    fontFamily: FONTS.black,
    fontSize: 25,
    letterSpacing: 0.2,
    lineHeight: 31,
    marginTop: 1,
    textAlign: 'center',
    textShadowColor: 'rgba(0,65,75,0.34)',
    textShadowOffset: { height: 2, width: 0 },
    textShadowRadius: 2,
  },
  subtitle: {
    color: 'rgba(244,255,254,0.92)',
    fontFamily: FONTS.semibold,
    fontSize: 14,
    lineHeight: 19,
    marginBottom: 8,
    minHeight: 38,
    paddingHorizontal: 12,
    textAlign: 'center',
  },
  board: {
    backgroundColor: 'rgba(4,92,105,0.35)',
    borderColor: 'rgba(230,255,250,0.58)',
    borderRadius: 999,
    borderWidth: 2,
    overflow: 'visible',
    position: 'relative',
  },
  boardInnerRing: {
    bottom: 0,
    borderColor: 'rgba(205,252,244,0.2)',
    borderRadius: 999,
    borderWidth: 11,
    left: 0,
    margin: 12,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  boardCenterWash: {
    backgroundColor: 'rgba(216,250,235,0.1)',
    borderRadius: 999,
    bottom: '26%',
    left: '26%',
    position: 'absolute',
    right: '26%',
    top: '26%',
  },
  yourTurnOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(3,75,84,0.84)',
    bottom: 0,
    borderColor: 'rgba(255,241,164,0.82)',
    borderRadius: 999,
    borderWidth: 2,
    elevation: 18,
    justifyContent: 'center',
    left: 0,
    paddingHorizontal: 20,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 40,
  },
  yourTurnText: {
    color: '#FFF3A8',
    fontFamily: FONTS.black,
    letterSpacing: 0.4,
    lineHeight: 58,
    textAlign: 'center',
    textShadowColor: 'rgba(0,37,45,0.62)',
    textShadowOffset: { height: 3, width: 0 },
    textShadowRadius: 5,
    width: '100%',
  },
  node: {
    alignItems: 'center',
    backgroundColor: '#F8EDD2',
    borderColor: 'rgba(255,255,255,0.94)',
    borderRadius: 999,
    borderWidth: 3,
    elevation: 6,
    justifyContent: 'center',
    position: 'absolute',
    shadowColor: '#003F49',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
    zIndex: 12,
  },
  nodeSelected: {
    backgroundColor: '#77D9D5',
    borderColor: '#EFFFFF',
  },
  nodeSuccess: {
    backgroundColor: '#6ED3A4',
  },
  nodeBonus: {
    backgroundColor: '#F4C956',
  },
  nodeInvalid: {
    backgroundColor: '#E98C82',
  },
  nodeText: {
    color: '#145660',
    fontFamily: FONTS.black,
    fontSize: 22,
    lineHeight: 27,
  },
  stepBadge: {
    alignItems: 'center',
    backgroundColor: '#F4C653',
    borderColor: '#FFFFFF',
    borderRadius: 11,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    position: 'absolute',
    right: -6,
    top: -7,
    width: 22,
  },
  stepBadgeText: {
    color: '#5A3B0B',
    fontFamily: FONTS.black,
    fontSize: 11,
  },
  operatorBadge: {
    alignItems: 'center',
    backgroundColor: '#176F7A',
    borderColor: '#E8FFFF',
    borderRadius: 16,
    borderWidth: 2,
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    width: 32,
    zIndex: 9,
  },
  operatorText: {
    color: '#FFFFFF',
    fontFamily: FONTS.black,
    fontSize: 19,
  },
  targetBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(4,91,102,0.84)',
    borderColor: 'rgba(231,255,250,0.48)',
    borderRadius: 39,
    borderWidth: 2,
    height: 78,
    justifyContent: 'center',
    left: '50%',
    marginLeft: -39,
    marginTop: -39,
    position: 'absolute',
    top: '50%',
    width: 78,
    zIndex: 5,
  },
  targetLabel: {
    color: 'rgba(224,255,250,0.72)',
    fontFamily: FONTS.extraBold,
    fontSize: 9,
    letterSpacing: 1,
  },
  targetValue: {
    color: '#FFF2A4',
    fontFamily: FONTS.black,
    fontSize: 25,
    lineHeight: 28,
  },
  demoHand: {
    height: 42,
    position: 'absolute',
    width: 42,
    zIndex: 30,
  },
  demoLineTrack: {
    height: 16,
    overflow: 'visible',
    position: 'absolute',
    zIndex: 8,
  },
  demoLineGlow: {
    borderRadius: 8,
    height: 16,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  demoLineCore: {
    borderRadius: 3,
    height: 6,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 5,
  },
  actionArea: {
    alignItems: 'center',
    height: 96,
    justifyContent: 'flex-end',
    marginTop: 7,
    position: 'relative',
    width: '100%',
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#087887',
    borderColor: 'rgba(238,255,253,0.74)',
    borderRadius: 21,
    borderWidth: 2,
    elevation: 5,
    flexDirection: 'row',
    gap: 10,
    height: 50,
    justifyContent: 'center',
    minWidth: 208,
    paddingHorizontal: 21,
    shadowColor: '#003F48',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.26,
    shadowRadius: 4,
  },
  hintButton: {
    backgroundColor: '#176E7A',
  },
  actionButtonPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.97 }],
  },
  actionButtonBusy: {
    opacity: 0.76,
  },
  actionButtonText: {
    color: '#F7FFFF',
    fontFamily: FONTS.black,
    fontSize: 14,
    letterSpacing: 0.7,
  },
  controlHand: {
    // Keep the cue beside the action instead of floating above it. The hand
    // is vertically centered against the 50px button in the footer area.
    bottom: 0,
    height: 46,
    position: 'absolute',
    right: 48,
    width: 46,
    zIndex: 40,
  },
  controlHandImage: {
    height: 46,
    width: 46,
  },
  practiceFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginTop: 10,
    minHeight: 58,
    width: '100%',
  },
  equationPill: {
    backgroundColor: 'rgba(255,247,215,0.84)',
    borderColor: 'rgba(255,255,255,0.8)',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  equationText: {
    color: '#185964',
    fontFamily: FONTS.black,
    fontSize: 16,
  },
  stepMeter: {
    alignItems: 'center',
    backgroundColor: 'rgba(5,92,102,0.66)',
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  stepMeterLabel: {
    color: '#E9FFFF',
    fontFamily: FONTS.bold,
    fontSize: 10,
    marginBottom: 4,
  },
  stepDots: {
    flexDirection: 'row',
    gap: 5,
  },
  stepDot: {
    backgroundColor: 'rgba(225,255,251,0.25)',
    borderColor: 'rgba(232,255,252,0.66)',
    borderRadius: 5,
    borderWidth: 1,
    height: 10,
    width: 10,
  },
  stepDotFilled: {
    backgroundColor: '#87E5D1',
  },
  stepDotBonus: {
    backgroundColor: '#FFE16F',
  },
  demoFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    // Keep the same footer slot as the action button. When the hint is
    // consumed, its control is replaced by this status without changing
    // the modal's measured height or making the card jump.
    height: 96,
    justifyContent: 'center',
    marginTop: 7,
    width: '100%',
  },
  demoDot: {
    backgroundColor: '#FFF0A4',
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  demoFooterText: {
    color: '#155C65',
    fontFamily: FONTS.extraBold,
    fontSize: 13,
  },
  celebrationStage: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  treasureGlow: {
    backgroundColor: 'rgba(255,240,145,0.24)',
    borderRadius: 78,
    height: 156,
    position: 'absolute',
    top: 40,
    width: 156,
  },
  treasureChest: {
    alignItems: 'center',
    backgroundColor: '#B66F35',
    borderColor: '#FFE191',
    borderRadius: 15,
    borderWidth: 4,
    height: 82,
    justifyContent: 'center',
    marginBottom: 18,
    marginTop: -12,
    width: 112,
  },
  chestLid: {
    backgroundColor: '#D5893F',
    borderColor: '#FFE191',
    borderRadius: 28,
    borderWidth: 4,
    height: 49,
    left: -4,
    position: 'absolute',
    top: -27,
    width: 112,
  },
  treasureStar: {
    color: '#FFF1A2',
    fontFamily: FONTS.black,
    fontSize: 31,
    marginTop: 11,
  },
  celebrationTitle: {
    color: '#155864',
    fontFamily: FONTS.black,
    fontSize: 22,
  },
  celebrationCopy: {
    color: '#276872',
    fontFamily: FONTS.bold,
    fontSize: 14,
    marginTop: 5,
    textAlign: 'center',
  },
  confetti: {
    left: '50%',
    position: 'absolute',
    top: '40%',
  },
});
