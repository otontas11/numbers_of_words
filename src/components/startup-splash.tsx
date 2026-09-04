import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const HOME_BACKGROUND = require('../../assets/images/img/bg.png');
const HOME_LOGO = require('../../assets/images/img/number_of_wonders.png');
const BIRD = require('../../assets/images/flying-bird/image_0.png');

export function StartupSplash({
  onReadyToDisplay,
  onExitComplete,
  progress,
  exiting = false,
}: {
  onReadyToDisplay?: () => void;
  onExitComplete?: () => void;
  progress: number;
  exiting?: boolean;
}) {
  const [animatedProgress] = useState(() => new Animated.Value(progress));
  const [exitOpacity] = useState(() => new Animated.Value(1));
  const [backgroundLoaded, setBackgroundLoaded] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const { height } = useWindowDimensions();
  const compact = height < 760;

  useEffect(() => {
    const animation = Animated.timing(animatedProgress, {
      toValue: progress,
      duration: 520,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [animatedProgress, progress]);

  useEffect(() => {
    if (backgroundLoaded && logoLoaded) onReadyToDisplay?.();
  }, [backgroundLoaded, logoLoaded, onReadyToDisplay]);

  useEffect(() => {
    if (!exiting) return;
    const animation = Animated.timing(exitOpacity, {
      toValue: 0,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) onExitComplete?.();
    });
    return () => animation.stop();
  }, [exitOpacity, exiting, onExitComplete]);

  const progressWidth = animatedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View style={[styles.screen, { opacity: exitOpacity }]}>
      <Image
        cachePolicy="memory-disk"
        contentFit="cover"
        onLoad={() => setBackgroundLoaded(true)}
        source={HOME_BACKGROUND}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)', 'rgba(255,248,235,0.78)']}
        locations={[0, 0.64, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={[styles.brandArea, compact && styles.brandAreaCompact]}>
          <View pointerEvents="none" style={styles.brandBlock}>
            <Image
              cachePolicy="memory-disk"
              contentFit="contain"
              onLoad={() => setLogoLoaded(true)}
              source={HOME_LOGO}
              style={[styles.logo, compact && styles.logoCompact]}
            />
            <Image contentFit="contain" source={BIRD} style={[styles.bird, styles.birdOne]} />
            <Image contentFit="contain" source={BIRD} style={[styles.bird, styles.birdTwo]} />
            <Image contentFit="contain" source={BIRD} style={[styles.bird, styles.birdThree]} />
          </View>
        </View>

        <View
          accessibilityLabel="İçerik hazırlanıyor"
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
          style={styles.progressSection}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]}>
              <LinearGradient
                colors={['#8DE7F0', '#168DA8', '#0B6684']}
                end={{ x: 1, y: 0 }}
                start={{ x: 0, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 100,
    backgroundColor: '#7FCFF3',
  },
  safeArea: { flex: 1 },
  brandArea: { flex: 1, justifyContent: 'flex-start', paddingTop: 82 },
  brandAreaCompact: { paddingTop: 48 },
  brandBlock: {
    width: '100%',
    height: 250,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: '78%', maxWidth: 410, aspectRatio: 2.04 },
  logoCompact: { width: '70%', maxWidth: 330 },
  bird: { position: 'absolute' },
  birdOne: { top: 12, right: '12%', width: 62, height: 43 },
  birdTwo: { top: 166, left: '13%', width: 48, height: 33, opacity: 0.9 },
  birdThree: { top: 188, right: '18%', width: 36, height: 25, opacity: 0.82 },
  progressSection: {
    width: '100%',
    paddingHorizontal: 42,
    paddingBottom: 38,
  },
  progressTrack: {
    width: '100%',
    height: 13,
    overflow: 'hidden',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(87,66,34,0.24)',
    backgroundColor: 'rgba(226,248,251,0.62)',
  },
  progressFill: { height: '100%', overflow: 'hidden', borderRadius: 7 },
});
