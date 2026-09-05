import {
  setAudioModeAsync,
  setIsAudioActiveAsync,
  type AudioPlayer,
} from 'expo-audio';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

let audioModeConfigured = false;
let desiredAudioSessionActive = false;
let nativeAudioSessionActive = false;
let audioSessionQueue: Promise<void> = Promise.resolve();
const playerOperationQueues = new WeakMap<AudioPlayer, Promise<void>>();
const playerLoadPromises = new WeakMap<AudioPlayer, Promise<void>>();
const usedPlayers = new WeakSet<AudioPlayer>();
const preparedPlayerStarts = new WeakMap<AudioPlayer, number>();
const playerPlaybackRuns = new WeakMap<AudioPlayer, number>();
const playerStartingRuns = new WeakMap<AudioPlayer, number>();
const playerRearmOperations = new WeakMap<
  AudioPlayer,
  { playbackRun: number; promise: Promise<boolean> }
>();
const POSITION_TOLERANCE = 0.004;
const PLAYER_LOAD_TIMEOUT = 3000;
const PLAYER_START_ACK_TIMEOUT = 80;

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

function isPreparedAt(player: AudioPlayer, startTime: number) {
  const preparedStart = preparedPlayerStarts.get(player);
  return (
    preparedStart !== undefined &&
    Math.abs(preparedStart - startTime) <= POSITION_TOLERANCE
  );
}

function beginPlaybackRun(player: AudioPlayer) {
  const run = (playerPlaybackRuns.get(player) ?? 0) + 1;
  playerPlaybackRuns.set(player, run);
  return run;
}

/** Son oynatma isteğinin kimliği; finish olayını doğru run ile eşler. */
export function getAudioPlayerPlaybackRun(player: AudioPlayer) {
  return playerPlaybackRuns.get(player) ?? 0;
}

/** Player yeni sesi seek/load beklemeden başlatabilecek durumda mı? */
export function isAudioPlayerReady(player: AudioPlayer, startTime = 0) {
  return (
    isPreparedAt(player, startTime) &&
    player.isLoaded &&
    nativeAudioSessionActive &&
    desiredAudioSessionActive &&
    AppState.currentState !== 'background' &&
    (Platform.OS !== 'android' ||
      (!player.playing && !playerStartingRuns.has(player))) &&
    !playerOperationQueues.has(player)
  );
}

/** Hazır kanal yoksa başka bir işlem taşımayan boş kanalı seçmeye yarar. */
export function isAudioPlayerIdle(player: AudioPlayer) {
  return (
    player.isLoaded &&
    !player.playing &&
    !playerStartingRuns.has(player) &&
    !playerOperationQueues.has(player)
  );
}

/**
 * play() yalnız native komutu gönderir. Promise mümkün olduğunda gerçek
 * `playing` status kenarında, status gelmezse kısa güvenlik süresinde çözülür.
 */
function playAndWaitForStart(player: AudioPlayer, playbackRun: number) {
  let settled = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let subscription: { remove: () => void } | undefined;
  let resolveStarted: (() => void) | undefined;
  const started = new Promise<void>((resolve) => {
    resolveStarted = resolve;
  });
  const finish = () => {
    if (settled) return;
    settled = true;
    if (playerStartingRuns.get(player) === playbackRun) {
      playerStartingRuns.delete(player);
    }
    subscription?.remove();
    if (timeout) clearTimeout(timeout);
    resolveStarted?.();
  };

  playerStartingRuns.set(player, playbackRun);
  try {
    timeout = setTimeout(finish, PLAYER_START_ACK_TIMEOUT);
    const nextSubscription = player.addListener('playbackStatusUpdate', (status) => {
      if (getAudioPlayerPlaybackRun(player) !== playbackRun || status.playing) finish();
    });
    subscription = nextSubscription;
    if (settled) nextSubscription.remove();
    player.play();
  } catch (error) {
    finish();
    throw error;
  }

  // Bazı platformlarda property native event'ten önce senkron güncellenir.
  if (player.playing) finish();
  return started;
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

  const canPlayImmediately = isAudioPlayerReady(player, startTime);

  if (canPlayImmediately) {
    try {
      player.volume = volume;
      preparedPlayerStarts.delete(player);
      const playbackRun = beginPlaybackRun(player);
      if (Platform.OS !== 'android') {
        player.play();
        return Promise.resolve();
      }
      return playAndWaitForStart(player, playbackRun);
    } catch {
      // Native player hazır durumunu yarış sırasında kaybettiyse
      // aşağıdaki sıralı ve yeniden deneyen yola geç.
    }
  }

  return enqueuePlayerOperation(player, async () => {
    await ensureAudioSessionActive();
    await waitForAudioPlayerLoaded(player);

    player.volume = volume;
    const isQueuedPlaybackPrepared = isPreparedAt(player, startTime);

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
    const playbackRun = beginPlaybackRun(player);
    if (Platform.OS === 'android') {
      await playAndWaitForStart(player, playbackRun);
    } else {
      player.play();
    }
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

/**
 * Oynatımı biten kısa efekt kanalını bir sonraki dokunma için yeniden kurar.
 * Finish sonrasında Android'in playWhenReady durumunu temizlemek için seek'ten
 * önce pause gönderilir; bir sonraki replay böylece senkron hızlı yolu kullanır.
 */
export function rearmAudioPlayer(
  player: AudioPlayer,
  startTime = 0,
  expectedPlaybackRun = getAudioPlayerPlaybackRun(player),
) {
  if (Platform.OS !== 'android') {
    return enqueuePlayerOperation(player, async () => {
      await ensureAudioSessionActive();
      if (!player.isLoaded) return;

      player.pause();
      try {
        await player.seekTo(startTime, 0, 0);
        preparedPlayerStarts.set(player, startTime);
      } catch {
        preparedPlayerStarts.delete(player);
      }
    });
  }

  if (isPreparedAt(player, startTime)) return Promise.resolve(true);
  const pending = playerRearmOperations.get(player);
  if (pending?.playbackRun === expectedPlaybackRun) return pending.promise;

  let rearmed = false;
  const operation = enqueuePlayerOperation(player, async () => {
    await ensureAudioSessionActive();
    if (
      getAudioPlayerPlaybackRun(player) !== expectedPlaybackRun ||
      !player.isLoaded
    ) {
      return;
    }

    player.pause();
    try {
      await player.seekTo(startTime, 0, 0);
      if (getAudioPlayerPlaybackRun(player) !== expectedPlaybackRun) {
        return;
      }
      preparedPlayerStarts.set(player, startTime);
      rearmed = true;
    } catch {
      // Hazırlanmış işaretleme; yalnız native seek gerçekten tamamlandıysa
      // yapılır. Aksi durumda sonraki replay güvenli yavaş yolu tekrar dener.
      preparedPlayerStarts.delete(player);
    }
  }).then(() => rearmed);

  const rearmOperation = { playbackRun: expectedPlaybackRun, promise: operation };
  playerRearmOperations.set(player, rearmOperation);
  void operation.finally(() => {
    if (playerRearmOperations.get(player) === rearmOperation) {
      playerRearmOperations.delete(player);
    }
  });
  return operation;
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
