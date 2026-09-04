import {
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
  useFonts,
} from '@expo-google-fonts/nunito';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { StartupSplash } from '@/components/startup-splash';
import { useAudioSessionLifecycle } from '@/hooks/audio-session';
import { useContentImageCache } from '@/hooks/use-content-image-cache';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useAudioSessionLifecycle();
  const contentBootstrap = useContentImageCache();
  const [showStartupSplash, setShowStartupSplash] = useState(true);

  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });

  const hideNativeSplash = useCallback(() => {
    void SplashScreen.hideAsync();
  }, []);
  const appShellReady = (fontsLoaded || Boolean(fontError)) && contentBootstrap.ready;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={DarkTheme}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            animation: 'none',
            contentStyle: { backgroundColor: '#020617' },
            headerShown: false,
          }}>
          <Stack.Screen name="index" />
        </Stack>
      </ThemeProvider>
      {showStartupSplash ? (
        <StartupSplash
          onReadyToDisplay={hideNativeSplash}
          onExitComplete={() => setShowStartupSplash(false)}
          progress={contentBootstrap.progress}
          exiting={appShellReady}
        />
      ) : null}
    </GestureHandlerRootView>
  );
}
