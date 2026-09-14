import { Image } from 'expo-image';
import { memo, useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';

const BIRD_FRAMES = [
  require('../../../assets/images/flying-bird/image_0.png'),
  require('../../../assets/images/flying-bird/image_1.png'),
  require('../../../assets/images/flying-bird/image_2.png'),
  require('../../../assets/images/flying-bird/image_3.png'),
  require('../../../assets/images/flying-bird/image_4.png'),
  require('../../../assets/images/flying-bird/image_5.png'),
  require('../../../assets/images/flying-bird/image_6.png'),
  require('../../../assets/images/flying-bird/image_7.png'),
  require('../../../assets/images/flying-bird/image_8.png'),
  require('../../../assets/images/flying-bird/image_9.png'),
  require('../../../assets/images/flying-bird/image_10.png'),
  require('../../../assets/images/flying-bird/image_11.png'),
  require('../../../assets/images/flying-bird/image_12.png'),
  require('../../../assets/images/flying-bird/image_13.png'),
  require('../../../assets/images/flying-bird/image_14.png'),
  require('../../../assets/images/flying-bird/image_15.png'),
] as const;

const FRAME_COUNT = BIRD_FRAMES.length;
const GLIDE_FRAME = 0;
const NEAR_FLIGHT_MS = 28000;
const FAR_SPEED_SCALE = 0.5;
const FLOCK_FLIGHT_MS = NEAR_FLIGHT_MS / FAR_SPEED_SCALE;
const FLOCK_PAUSE_MS = 14000;
const FLOCK_CYCLE = FLOCK_FLIGHT_MS + FLOCK_PAUSE_MS;
const TRAVEL_MARGIN = 280;
const FADE_MS = 260;
const SPEED_COUPLING = 0.16;
const TWO_PI = Math.PI * 2;
const RAD_TO_DEG = 180 / Math.PI;

const BIRD_FORMATION = [
  {
    id: 'lead',
    frameOffset: 0,
    height: 27,
    centerX: 0,
    opacity: 1,
    top: '39%',
    width: 40,
    speedScale: 1,
    phaseMs: 0,
    phugoidCycles: 2.25,
    phugoidPhase: 0.35,
    phugoidAmp: 6.5,
    weaveCycles: 1.35,
    weavePhase: 1.1,
    weaveAmp: 5,
    windPhase: 0.4,
    windAmp: 2.4,
    bankAmp: 7.5,
    frameMs: 41,
    cruiseFlaps: 3,
  },
  {
    id: 'inner-up',
    frameOffset: 3,
    height: 22,
    centerX: -39,
    opacity: 0.84,
    top: '24%',
    width: 32,
    speedScale: 0.72,
    phaseMs: 110,
    phugoidCycles: 2.55,
    phugoidPhase: 1.9,
    phugoidAmp: 4.2,
    weaveCycles: 1.15,
    weavePhase: 2.6,
    weaveAmp: 3.4,
    windPhase: 1.7,
    windAmp: 1.6,
    bankAmp: 5.5,
    frameMs: 44,
    cruiseFlaps: 2,
  },
  {
    id: 'inner-down',
    frameOffset: 6,
    height: 19,
    centerX: -34,
    opacity: 0.82,
    top: '55%',
    width: 28,
    speedScale: 0.72,
    phaseMs: 175,
    phugoidCycles: 2.1,
    phugoidPhase: 3.4,
    phugoidAmp: 4,
    weaveCycles: 1.5,
    weavePhase: 0.4,
    weaveAmp: 3.2,
    windPhase: 2.9,
    windAmp: 1.55,
    bankAmp: 5.5,
    frameMs: 39,
    cruiseFlaps: 4,
  },
  {
    id: 'outer-up',
    frameOffset: 9,
    height: 14,
    centerX: -64,
    opacity: 0.7,
    top: '17%',
    width: 20,
    speedScale: 0.5,
    phaseMs: 90,
    phugoidCycles: 2.7,
    phugoidPhase: 4.8,
    phugoidAmp: 2.4,
    weaveCycles: 1.22,
    weavePhase: 3.8,
    weaveAmp: 2.2,
    windPhase: 0.9,
    windAmp: 1.1,
    bankAmp: 4,
    frameMs: 46,
    cruiseFlaps: 3,
  },
  {
    id: 'outer-down',
    frameOffset: 12,
    height: 12,
    centerX: -58,
    opacity: 0.66,
    top: '67%',
    width: 18,
    speedScale: 0.5,
    phaseMs: 195,
    phugoidCycles: 2.4,
    phugoidPhase: 2.5,
    phugoidAmp: 2.2,
    weaveCycles: 1.42,
    weavePhase: 5.1,
    weaveAmp: 2,
    windPhase: 3.5,
    windAmp: 1,
    bankAmp: 4,
    frameMs: 42,
    cruiseFlaps: 2,
  },
] as const;

type BirdSpec = (typeof BIRD_FORMATION)[number];

type BirdMotion = {
  bankAmp: number;
  centerX: number;
  cruiseFlaps: number;
  frameMs: number;
  frameOffset: number;
  opacity: number;
  phaseMs: number;
  phugoidAmp: number;
  phugoidCycles: number;
  phugoidPhase: number;
  speedScale: number;
  weaveAmp: number;
  weaveCycles: number;
  weavePhase: number;
  width: number;
  windAmp: number;
  windPhase: number;
};

type BirdPose = {
  x: number;
  y: number;
  rotate: number;
  opacity: number;
  frame: number;
};

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

function smoothstep(edge0: number, edge1: number, value: number) {
  'worklet';
  const span = edge1 - edge0;
  if (span === 0) {
    return value < edge0 ? 0 : 1;
  }
  const t = clamp((value - edge0) / span, 0, 1);
  return t * t * (3 - 2 * t);
}

function computeBirdPose(clockMs: number, running: number, width: number, bird: BirdMotion): BirdPose {
  'worklet';
  const flightMs = NEAR_FLIGHT_MS / bird.speedScale;
  const travel = width + TRAVEL_MARGIN;
  const startX = width * 0.5 + bird.centerX - bird.width * 0.5 - bird.speedScale * travel * 0.5;
  if (running < 1 || width <= 0) {
    return { x: startX, y: 0, rotate: 0, opacity: 0, frame: GLIDE_FRAME };
  }

  const cycleT = clockMs % FLOCK_CYCLE;
  if (cycleT >= flightMs) {
    return { x: startX, y: 0, rotate: 0, opacity: 0, frame: GLIDE_FRAME };
  }

  const motionT = cycleT + bird.phaseMs;
  const u = cycleT / flightMs;
  const theta = TWO_PI * bird.phugoidCycles * u + bird.phugoidPhase;
  const psi = TWO_PI * bird.weaveCycles * u + bird.weavePhase;
  const climb = Math.cos(theta);
  const turnRate = Math.cos(psi);
  const warp = SPEED_COUPLING / (TWO_PI * bird.phugoidCycles);
  const progress = clamp(u - warp * (Math.sin(theta) - Math.sin(bird.phugoidPhase)), 0, 1);

  const seconds = motionT * 0.001;
  const windX =
    bird.windAmp * Math.sin(seconds * 1.12 + bird.windPhase) +
    bird.windAmp * 0.38 * Math.sin(seconds * 0.61 + bird.windPhase * 1.3);
  const windY = bird.windAmp * 0.52 * Math.sin(seconds * 0.84 + bird.windPhase + 0.7);
  const altitude = bird.phugoidAmp * Math.sin(theta);
  const weave = bird.weaveAmp * Math.sin(psi);
  const x = startX + travel * progress + windX;
  const y = altitude + weave + windY;

  const dx = Math.max(0.42, 1 - SPEED_COUPLING * climb) * travel;
  const dy = bird.phugoidAmp * TWO_PI * bird.phugoidCycles * climb + bird.weaveAmp * TWO_PI * bird.weaveCycles * turnRate;
  const heading = Math.atan2(dy, dx) * RAD_TO_DEG;
  const bank = -turnRate * bird.bankAmp;
  const rotate = clamp(heading * 0.48 + bank * 0.82, -12, 12);

  const timeFade = Math.min(cycleT / FADE_MS, (flightMs - cycleT) / FADE_MS, 1);
  const edgeFade = Math.min(smoothstep(-36, 8, x), 1 - smoothstep(width - 18, width + 48, x));
  const opacity = bird.opacity * smoothstep(0, 1, Math.min(timeFade, edgeFade));

  const beatMs = bird.frameMs * FRAME_COUNT;
  const descending = Math.max(0, -climb);
  const turning = Math.abs(turnRate);
  const effort = Math.min(1, descending * 0.9 + turning * 0.45);
  const flapMs = (bird.cruiseFlaps + effort * 2) * beatMs;
  const glideMs = 1720 - effort * 1280;
  const period = flapMs + glideMs;
  const wingT = (motionT + bird.frameOffset * 52) % period;
  const frame = wingT < flapMs ? Math.floor(wingT / bird.frameMs) % FRAME_COUNT : GLIDE_FRAME;

  return { x, y, rotate, opacity, frame };
}

const FlyingBird = memo(function FlyingBird({
  bird,
  clock,
  running,
  widthSv,
}: {
  bird: BirdSpec;
  clock: SharedValue<number>;
  running: SharedValue<number>;
  widthSv: SharedValue<number>;
}) {
  const {
    bankAmp,
    centerX,
    cruiseFlaps,
    frameMs,
    frameOffset,
    opacity,
    phaseMs,
    phugoidAmp,
    phugoidCycles,
    phugoidPhase,
    speedScale,
    weaveAmp,
    weaveCycles,
    weavePhase,
    width: birdWidth,
    windAmp,
    windPhase,
  } = bird;
  const pose = useDerivedValue(() =>
    computeBirdPose(clock.value, running.value, widthSv.value, {
      bankAmp,
      centerX,
      cruiseFlaps,
      frameMs,
      frameOffset,
      opacity,
      phaseMs,
      phugoidAmp,
      phugoidCycles,
      phugoidPhase,
      speedScale,
      weaveAmp,
      weaveCycles,
      weavePhase,
      width: birdWidth,
      windAmp,
      windPhase,
    }),
  );

  const poseStyle = useAnimatedStyle(() => ({
    opacity: pose.value.opacity,
    transform: [
      { translateX: pose.value.x },
      { translateY: pose.value.y },
      { rotate: `${pose.value.rotate}deg` },
    ],
  }));

  const stripStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -pose.value.frame * birdWidth }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.flyingBird,
        { width: bird.width, height: bird.height, top: bird.top },
        poseStyle,
      ]}>
      <View collapsable={false} style={styles.birdClip}>
        <Animated.View style={[styles.birdStrip, { height: bird.height }, stripStyle]}>
          {BIRD_FRAMES.map((source, frameIndex) => (
            <Image
              cachePolicy="memory"
              contentFit="contain"
              key={frameIndex}
              source={source}
              style={{ width: bird.width, height: bird.height }}
            />
          ))}
        </Animated.View>
      </View>
    </Animated.View>
  );
});

export function FlyingBirds({ active }: { active: boolean }) {
  const { width } = useWindowDimensions();
  const clock = useSharedValue(0);
  const running = useSharedValue(active ? 1 : 0);
  const widthSv = useSharedValue(width);

  useEffect(() => {
    widthSv.value = width;
  }, [width, widthSv]);

  useEffect(() => {
    running.value = active ? 1 : 0;
    if (active) {
      clock.value = 0;
    }
  }, [active, clock, running]);

  useFrameCallback((info) => {
    if (running.value < 1) {
      return;
    }
    const dt = info.timeSincePreviousFrame ?? 16;
    clock.value += Math.min(dt, 34);
  }, active);

  return (
    <View pointerEvents="none" style={styles.birdFlightLayer}>
      {BIRD_FORMATION.map((bird) => (
        <FlyingBird bird={bird} clock={clock} key={bird.id} running={running} widthSv={widthSv} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  birdFlightLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'visible',
  },
  flyingBird: {
    position: 'absolute',
  },
  birdClip: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  birdStrip: {
    flexDirection: 'row',
  },
});
