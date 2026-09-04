import {
  setAudioModeAsync,
  setIsAudioActiveAsync,
  type AudioPlayer,
} from 'expo-audio';
import { useEffect } from 'react';
import { AppState } from 'react-native';

let audioModeConfigured = false;
let desiredAudioSessionActive = false;
let nativeAudioSessionActive = false;
let audioSessionQueue: Promise<void> = Promise.resolve();
const playerOperationQueues = new WeakMap<AudioPlayer, Promise<void>>();
const playerLoadPromises = new WeakMap<AudioPlayer, Promise<void>>();
const usedPlayers = new WeakSet<AudioPlayer>();
const preparedPlayerStarts = new WeakMap<AudioPlayer, number>();
const POSITION_TOLERANCE = 0.004;
const PLAYER_LOAD_TIMEOUT = 3000;

async function reconcileAudioSession() {
  while (desiredAudioSessionActive !== nativeAudioSessionActive) {
    const shouldBeActive = desiredAudioSessionActive;

    if (shouldBeActive && !audioModeConfigured) {
      await setAudioModeAsync({
        interruptionMode: 'mixWithOthers',
        playsInSilentMode: true,
        shouldPlayInBackground: false,
      });
      audioModeConfigured = true;

      // AppState, ses modu hazırlanırken değişmiş olabilir. Eski hedefle
      // devam etmek yerine kuyruğun en güncel hedefini uygula.
      if (!desiredAudioSessionActive) continue;
    }

    await setIsAudioActiveAsync(shouldBeActive);
    // Native çağrı gerçekten tamamlanmadan JS tarafını güncel sayma.
    nativeAudioSessionActive = shouldBeActive;
  }
}

function requestAudioSessionState(active: boolean) {
  desiredAudioSessionActive = active;
  const reconciliation = audioSessionQueue
    .catch(() => undefined)
    .then(reconcileAudioSession);

  // Kuyruk hata sonrasında da kullanılabilir kalır; çağıran ise kendi
  // reconciliation hatasını görerek playback'i başlatmaz.
  audioSessionQueue = reconciliation.catch(() => undefined);
  return reconciliation;
}

export function ensureAudioSessionActive() {
  if (AppState.currentState === 'background') {
    return requestAudioSessionState(false).then(() => {
      throw new Error('Audio session cannot be activated while the app is in the background.');
    });
  }

  return requestAudioSessionState(true).then(() => {
    // Hedef reconciliation sırasında background'a döndüyse çağıranın
    // kapalı session üzerinde play göndermesine izin verme.
    if (!nativeAudioSessionActive) {
      throw new Error('Audio session activation was superseded.');
    }
  });
}

function enqueuePlayerOperation(player: AudioPlayer, operation: () => Promise<void>) {
  const previousOperation = playerOperationQueues.get(player) ?? Promise.resolve();
  const queuedOperation = previousOperation
    .catch(() => undefined)
    .then(operation)
    .catch(() => {
      // Ses altyapısı etkileşimi veya oyun akışını hiçbir zaman kesmemeli.
    });

  playerOperationQueues.set(player, queuedOperation);
  void queuedOperation.finally(() => {
    if (playerOperationQueues.get(player) === queuedOperation) {
      playerOperationQueues.delete(player);
    }
  });

  return queuedOperation;
}

function waitForAudioPlayerLoaded(player: AudioPlayer) {
  if (player.isLoaded) return Promise.resolve();
  const pendingLoad = playerLoadPromises.get(player);
  if (pendingLoad) return pendingLoad;

  let subscription: { remove: () => void } | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const load = new Promise<void>((resolve) => {
    const finish = () => {
      subscription?.remove();
      if (timeout) clearTimeout(timeout);
      resolve();
    };

    subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (status.isLoaded) finish();
    });
    timeout = setTimeout(finish, PLAYER_LOAD_TIMEOUT);
    // Listener eklenirken gerçekleşen yüklemeyi kaçırma.
    if (player.isLoaded) finish();
  });

  playerLoadPromises.set(player, load);
  void load.finally(() => {
    if (playerLoadPromises.get(player) === load) playerLoadPromises.delete(player);
  });
  return load;
}

/**
 * Kısa efekt player'ını sıfırdan yeniden başlatır.
 *
 * Her player için komutları tek kuyruğa alır. Özellikle iOS'ta seekTo
 * tamamlanmadan gönderilen play komutu eski konumda (çoğunlukla dosyanın
 * sonunda) çalışıp sessiz kalabiliyor. Bu nedenle ses oturumunu, seek'i ve
 * play'i kesin sırayla yürütür; aynı kanala hızlı çağrılar da yarışmaz.
 */
export function replayAudioPlayer(player: AudioPlayer, volume = 1, startTime = 0) {
  const wasUsed = usedPlayers.has(player);
  // Hazırlama işlemi henüz kuyruktaysa bile yeni bir dokunma talebinden
  // sonra player'a müdahale edememesi için isteği senkron olarak işaretle.
  usedPlayers.add(player);

  const preparedStart = preparedPlayerStarts.get(player);
  const isPrepared =
    preparedStart !== undefined &&
    Math.abs(preparedStart - startTime) <= POSITION_TOLERANCE;
  const canPlayImmediately =
    isPrepared &&
    player.isLoaded &&
    nativeAudioSessionActive &&
    desiredAudioSessionActive &&
    AppState.currentState !== 'background' &&
    !playerOperationQueues.has(player);

  if (canPlayImmediately) {
    try {
      player.volume = volume;
      preparedPlayerStarts.delete(player);
      player.play();
      return Promise.resolve();
    } catch {
      // Native player hazır durumunu yarış sırasında kaybettiyse
      // aşağıdaki sıralı ve yeniden deneyen yola geç.
    }
  }

  return enqueuePlayerOperation(player, async () => {
    await ensureAudioSessionActive();
    await waitForAudioPlayerLoaded(player);

    player.volume = volume;
    const queuedPreparedStart = preparedPlayerStarts.get(player);
    const isQueuedPlaybackPrepared =
      queuedPreparedStart !== undefined &&
      Math.abs(queuedPreparedStart - startTime) <= POSITION_TOLERANCE;

    if (!isQueuedPlaybackPrepared && wasUsed) {
      player.pause();
      // Kaynak ilk kez decode edilirken bazı cihazlar seek'i reddedebilir.
      // Bu durumda dokunmayı tamamen sessiz bırakmak yerine play komutunu
      // yine gönder; player dosya hazır olduğunda başlar.
      await player.seekTo(startTime, 0, 0).catch(() => undefined);
    } else if (
      !isQueuedPlaybackPrepared &&
      Math.abs(player.currentTime - startTime) > POSITION_TOLERANCE
    ) {
      await player.seekTo(startTime, 0, 0).catch(() => undefined);
    }

    preparedPlayerStarts.delete(player);
    player.play();
  });
}

/** Kısa efekt kanalını kullanıcı dokunmadan önce başlangıç noktasına hazırlar. */
export function prepareAudioPlayer(player: AudioPlayer, startTime = 0) {
  return enqueuePlayerOperation(player, async () => {
    await ensureAudioSessionActive();

    // Bu kontrol kuyruğa eklenirken değil, işlem gerçekten çalışırken yapılır.
    // Böylece geç ulaşan eski bir finish olayı yeni playback'i başa sarmaz.
    if (usedPlayers.has(player) || player.playing) return;

    // Android'de dosya bittiğinde `playing` false olsa da native
    // `playWhenReady` açık kalabilir. Pause etmeden seek yapmak sesi yeniden
    // başlatıp sonsuz bir finish/seek döngüsü oluşturur.
    player.pause();
    if (Math.abs(player.currentTime - startTime) > POSITION_TOLERANCE) {
      await player.seekTo(startTime, 0, 0);
    }
    preparedPlayerStarts.set(player, startTime);
  });
}

export function useAudioSessionLifecycle() {
  useEffect(() => {
    void ensureAudioSessionActive().catch(() => undefined);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void requestAudioSessionState(true).catch(() => undefined);
        return;
      }

      // iOS 'inactive' durumu (bildirim merkezi, izin pencereleri) oturumu
      // kapatmaz; yalnızca gerçek arka plana geçişte serbest bırakılır.
      if (state === 'background') {
        void requestAudioSessionState(false).catch(() => undefined);
      }
    });

    return () => subscription.remove();
  }, []);
}
