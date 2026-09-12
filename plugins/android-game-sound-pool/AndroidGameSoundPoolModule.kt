package __ANDROID_PACKAGE__

import android.media.AudioAttributes
import android.media.SoundPool
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import java.util.concurrent.atomic.AtomicBoolean

@ReactModule(name = AndroidGameSoundPoolModule.NAME)
class AndroidGameSoundPoolModule(
  private val applicationContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(applicationContext), LifecycleEventListener {
  private data class SoundAsset(
    val fileName: String,
    val soundNames: List<String>,
  )

  private data class PendingPlay(
    val soundName: String,
    val volume: Float,
    val promise: Promise,
    val settled: AtomicBoolean = AtomicBoolean(false),
  )

  private val stateLock = Any()
  private val retryHandler = Handler(Looper.getMainLooper())
  private val pendingPlays = mutableListOf<PendingPlay>()
  private val preloadPromises = mutableListOf<Promise>()
  private val retryRequests = mutableMapOf<Runnable, PendingPlay>()
  private val sampleIdsBySoundName = mutableMapOf<String, Int>()
  private val expectedSampleIds = mutableSetOf<Int>()
  private val loadedSampleIds = mutableSetOf<Int>()
  private val failedSampleIds = mutableSetOf<Int>()

  private var soundPool: SoundPool? = null
  private var poolGeneration = 0
  private var warmupStarted = false
  private var warmupRetry: Runnable? = null
  private var lifecycleListenerRegistered = false
  private var moduleInvalidated = false

  override fun getName(): String = NAME

  override fun initialize() {
    super.initialize()
    synchronized(stateLock) {
      if (moduleInvalidated) return
      if (!lifecycleListenerRegistered) {
        applicationContext.addLifecycleEventListener(this)
        lifecycleListenerRegistered = true
      }
      ensureSoundPoolLocked()
    }
  }

  @ReactMethod
  fun preload(promise: Promise) {
    var resolveImmediately = false
    var rejection: Pair<String, String>? = null

    synchronized(stateLock) {
      if (moduleInvalidated) {
        rejection = ERROR_RELEASED to "Android game sound module is no longer active."
      } else {
        ensureSoundPoolLocked()
        when {
          soundPool == null ->
            rejection = ERROR_INITIALIZATION to "Android game SoundPool could not be created."
          failedSampleIds.isNotEmpty() ->
            rejection = ERROR_LOAD to "One or more Android game sounds failed to load."
          allSamplesLoadedLocked() -> resolveImmediately = true
          else -> preloadPromises += promise
        }
      }
    }

    when {
      rejection != null -> promise.reject(rejection!!.first, rejection!!.second)
      resolveImmediately -> promise.resolve(true)
    }
  }

  @ReactMethod
  fun play(soundName: String, volume: Double, promise: Promise) {
    enqueuePlay(soundName, volume, promise)
  }

  /**
   * Replay deliberately starts another SoundPool stream instead of stopping the previous one.
   * This keeps fast node-selection notes polyphonic and prevents a new note from clipping one
   * that is already playing.
   */
  @ReactMethod
  fun replay(soundName: String, volume: Double, promise: Promise) {
    enqueuePlay(soundName, volume, promise)
  }

  @ReactMethod
  fun release() {
    releaseSoundPool(ERROR_RELEASED, "Android game SoundPool was released.")
  }

  override fun onHostResume() {
    synchronized(stateLock) {
      if (!moduleInvalidated) ensureSoundPoolLocked()
    }
  }

  override fun onHostPause() = Unit

  override fun onHostDestroy() {
    releaseSoundPool(ERROR_RELEASED, "Android host was destroyed before the sound could play.")
  }

  override fun invalidate() {
    synchronized(stateLock) {
      moduleInvalidated = true
      if (lifecycleListenerRegistered) {
        applicationContext.removeLifecycleEventListener(this)
        lifecycleListenerRegistered = false
      }
    }
    releaseSoundPool(ERROR_RELEASED, "Android game sound module was invalidated.")
    super.invalidate()
  }

  private fun enqueuePlay(soundName: String, rawVolume: Double, promise: Promise) {
    val request = PendingPlay(soundName, audiblePlaybackVolume(rawVolume), promise)
    var poolToPlay: SoundPool? = null
    var generationToPlay = 0
    var sampleIdToPlay = 0
    var rejection: Pair<String, String>? = null

    synchronized(stateLock) {
      if (moduleInvalidated) {
        rejection = ERROR_RELEASED to "Android game sound module is no longer active."
      } else if (SOUND_NAMES.none { it == soundName }) {
        rejection = ERROR_UNKNOWN_SOUND to "Unknown game sound: $soundName"
      } else {
        ensureSoundPoolLocked()
        val currentPool = soundPool
        val sampleId = sampleIdsBySoundName[soundName]
        when {
          currentPool == null || sampleId == null ->
            rejection = ERROR_INITIALIZATION to "Android game SoundPool could not be created."
          sampleId in failedSampleIds ->
            rejection = ERROR_LOAD to "Game sound failed to load: $soundName"
          sampleId in loadedSampleIds -> {
            poolToPlay = currentPool
            generationToPlay = poolGeneration
            sampleIdToPlay = sampleId
          }
          else -> pendingPlays += request
        }
      }
    }

    if (rejection != null) {
      rejectRequest(request, rejection!!.first, rejection!!.second)
    } else if (poolToPlay != null) {
      playLoadedRequest(request, poolToPlay!!, generationToPlay, sampleIdToPlay, true)
    }
  }

  private fun audiblePlaybackVolume(rawVolume: Double): Float {
    if (rawVolume <= 0.0) return 0f
    return rawVolume.coerceIn(AUDIBLE_VOLUME_FLOOR.toDouble(), 1.0).toFloat()
  }

  private fun ensureSoundPoolLocked() {
    if (soundPool != null || moduleInvalidated) return

    val attributes =
      AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_GAME)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()
    val newPool =
      SoundPool.Builder()
        .setMaxStreams(MAX_STREAMS)
        .setAudioAttributes(attributes)
        .build()
    val generation = ++poolGeneration

    soundPool = newPool
    sampleIdsBySoundName.clear()
    expectedSampleIds.clear()
    loadedSampleIds.clear()
    failedSampleIds.clear()
    warmupStarted = false
    warmupRetry?.let(retryHandler::removeCallbacks)
    warmupRetry = null

    newPool.setOnLoadCompleteListener { callbackPool, sampleId, status ->
      handleLoadComplete(callbackPool, generation, sampleId, status)
    }

    try {
      SOUND_ASSETS.forEach { asset ->
        val sampleId =
          applicationContext.assets.openFd("sounds/${asset.fileName}").use { descriptor ->
            newPool.load(descriptor, LOAD_PRIORITY)
          }
        check(sampleId != 0) { "SoundPool rejected ${asset.fileName}" }
        expectedSampleIds += sampleId
        asset.soundNames.forEach { soundName -> sampleIdsBySoundName[soundName] = sampleId }
      }
    } catch (error: Exception) {
      soundPool = null
      sampleIdsBySoundName.clear()
      expectedSampleIds.clear()
      loadedSampleIds.clear()
      failedSampleIds.clear()
      newPool.setOnLoadCompleteListener(null)
      newPool.release()
      rejectWaitingLocked(
        ERROR_INITIALIZATION,
        "Unable to preload Android game sounds: ${error.message ?: error.javaClass.simpleName}",
      )
    }
  }

  private fun handleLoadComplete(
    callbackPool: SoundPool,
    generation: Int,
    sampleId: Int,
    status: Int,
  ) {
    val readyRequests = mutableListOf<PendingPlay>()
    val failedRequests = mutableListOf<PendingPlay>()
    val readyPreloads = mutableListOf<Promise>()
    val failedPreloads = mutableListOf<Promise>()
    var warmupSampleId = 0

    synchronized(stateLock) {
      if (callbackPool !== soundPool || generation != poolGeneration) return

      if (status == 0) {
        loadedSampleIds += sampleId
        if (!warmupStarted) {
          warmupStarted = true
          warmupSampleId = sampleId
        }
        val iterator = pendingPlays.iterator()
        while (iterator.hasNext()) {
          val request = iterator.next()
          if (sampleIdsBySoundName[request.soundName] == sampleId) {
            iterator.remove()
            readyRequests += request
          }
        }
        if (allSamplesLoadedLocked()) {
          readyPreloads += preloadPromises
          preloadPromises.clear()
        }
      } else {
        failedSampleIds += sampleId
        val iterator = pendingPlays.iterator()
        while (iterator.hasNext()) {
          val request = iterator.next()
          if (sampleIdsBySoundName[request.soundName] == sampleId) {
            iterator.remove()
            failedRequests += request
          }
        }
        failedPreloads += preloadPromises
        preloadPromises.clear()
      }
    }

    if (warmupSampleId != 0) {
      warmUpSoundPool(callbackPool, generation, warmupSampleId, WARMUP_RETRY_COUNT)
    }
    readyRequests.forEach { request ->
      playLoadedRequest(request, callbackPool, generation, sampleId, true)
    }
    failedRequests.forEach { request ->
      rejectRequest(request, ERROR_LOAD, "Game sound failed to load: ${request.soundName}")
    }
    readyPreloads.forEach { it.resolve(true) }
    failedPreloads.forEach { it.reject(ERROR_LOAD, "One or more Android game sounds failed to load.") }
  }

  /**
   * Xiaomi and some other Android devices create SoundPool's fast AudioTrack lazily on the first
   * play call. Starting one already-loaded sample at zero volume moves that device-only cost to
   * app startup, so the user's first shuffle, hint, or node tap stays synchronized with the UI.
   */
  private fun warmUpSoundPool(
    expectedPool: SoundPool,
    generation: Int,
    sampleId: Int,
    retriesRemaining: Int,
  ) {
    val streamId =
      synchronized(stateLock) {
        if (
          moduleInvalidated ||
            expectedPool !== soundPool ||
            generation != poolGeneration ||
            sampleId !in loadedSampleIds
        ) {
          -1
        } else {
          expectedPool.play(
            sampleId,
            SILENT_VOLUME,
            SILENT_VOLUME,
            PLAY_PRIORITY,
            NO_LOOP,
            NORMAL_RATE,
          )
        }
      }

    if (streamId != 0 || retriesRemaining <= 0) return

    lateinit var retry: Runnable
    retry = Runnable {
      synchronized(stateLock) {
        if (warmupRetry === retry) warmupRetry = null
      }
      warmUpSoundPool(expectedPool, generation, sampleId, retriesRemaining - 1)
    }

    synchronized(stateLock) {
      if (moduleInvalidated || expectedPool !== soundPool || generation != poolGeneration) return
      warmupRetry?.let(retryHandler::removeCallbacks)
      warmupRetry = retry
      retryHandler.postDelayed(retry, WARMUP_RETRY_DELAY_MS)
    }
  }

  private fun playLoadedRequest(
    request: PendingPlay,
    expectedPool: SoundPool,
    generation: Int,
    sampleId: Int,
    canRetry: Boolean,
  ) {
    val streamId =
      synchronized(stateLock) {
        if (
          moduleInvalidated ||
            expectedPool !== soundPool ||
            generation != poolGeneration ||
            sampleId !in loadedSampleIds
        ) {
          -1
        } else {
          expectedPool.play(
            sampleId,
            request.volume,
            request.volume,
            PLAY_PRIORITY,
            NO_LOOP,
            NORMAL_RATE,
          )
        }
      }

    when {
      streamId > 0 -> resolveRequest(request)
      streamId < 0 -> rejectRequest(request, ERROR_RELEASED, "SoundPool changed before playback.")
      canRetry -> schedulePlayRetry(request, expectedPool, generation, sampleId)
      else -> rejectRequest(request, ERROR_PLAY, "SoundPool could not start: ${request.soundName}")
    }
  }

  private fun schedulePlayRetry(
    request: PendingPlay,
    expectedPool: SoundPool,
    generation: Int,
    sampleId: Int,
  ) {
    lateinit var retry: Runnable
    retry = Runnable {
      synchronized(stateLock) { retryRequests.remove(retry) }
      if (!request.settled.get()) {
        playLoadedRequest(request, expectedPool, generation, sampleId, false)
      }
    }

    synchronized(stateLock) {
      if (moduleInvalidated || expectedPool !== soundPool || generation != poolGeneration) {
        rejectRequest(request, ERROR_RELEASED, "SoundPool changed before playback retry.")
        return
      }
      retryRequests[retry] = request
      retryHandler.postDelayed(retry, PLAY_RETRY_DELAY_MS)
    }
  }

  private fun allSamplesLoadedLocked(): Boolean =
    expectedSampleIds.size == SOUND_ASSETS.size && loadedSampleIds.containsAll(expectedSampleIds)

  private fun releaseSoundPool(errorCode: String, message: String) {
    val requestsToReject: List<PendingPlay>
    val preloadsToReject: List<Promise>
    val retriesToCancel: List<Pair<Runnable, PendingPlay>>
    val poolToRelease: SoundPool?

    synchronized(stateLock) {
      poolGeneration += 1
      poolToRelease = soundPool
      soundPool = null
      poolToRelease?.setOnLoadCompleteListener(null)
      sampleIdsBySoundName.clear()
      expectedSampleIds.clear()
      loadedSampleIds.clear()
      failedSampleIds.clear()
      warmupStarted = false
      warmupRetry?.let(retryHandler::removeCallbacks)
      warmupRetry = null

      requestsToReject = pendingPlays.toList()
      pendingPlays.clear()
      preloadsToReject = preloadPromises.toList()
      preloadPromises.clear()
      retriesToCancel = retryRequests.toList()
      retryRequests.clear()
    }

    retriesToCancel.forEach { (runnable, _) -> retryHandler.removeCallbacks(runnable) }
    poolToRelease?.release()
    requestsToReject.forEach { rejectRequest(it, errorCode, message) }
    retriesToCancel.forEach { (_, request) -> rejectRequest(request, errorCode, message) }
    preloadsToReject.forEach { it.reject(errorCode, message) }
  }

  private fun rejectWaitingLocked(errorCode: String, message: String) {
    val waitingRequests = pendingPlays.toList()
    val waitingPreloads = preloadPromises.toList()
    pendingPlays.clear()
    preloadPromises.clear()
    waitingRequests.forEach { rejectRequest(it, errorCode, message) }
    waitingPreloads.forEach { it.reject(errorCode, message) }
  }

  private fun resolveRequest(request: PendingPlay) {
    if (request.settled.compareAndSet(false, true)) request.promise.resolve(true)
  }

  private fun rejectRequest(request: PendingPlay, code: String, message: String) {
    if (request.settled.compareAndSet(false, true)) request.promise.reject(code, message)
  }

  companion object {
    const val NAME = "AndroidGameSoundPool"

    private const val MAX_STREAMS = 10
    private const val LOAD_PRIORITY = 1
    private const val PLAY_PRIORITY = 1
    private const val NO_LOOP = 0
    private const val NORMAL_RATE = 1.0f
    private const val PLAY_RETRY_DELAY_MS = 16L
    private const val SILENT_VOLUME = 0.0f
    private const val AUDIBLE_VOLUME_FLOOR = 0.12f
    private const val WARMUP_RETRY_COUNT = 3
    private const val WARMUP_RETRY_DELAY_MS = 16L

    private const val ERROR_INITIALIZATION = "E_SOUND_POOL_INIT"
    private const val ERROR_LOAD = "E_SOUND_POOL_LOAD"
    private const val ERROR_PLAY = "E_SOUND_POOL_PLAY"
    private const val ERROR_RELEASED = "E_SOUND_POOL_RELEASED"
    private const val ERROR_UNKNOWN_SOUND = "E_UNKNOWN_GAME_SOUND"

    private val SOUND_ASSETS =
      listOf(
        SoundAsset("select.wav", listOf("select1")),
        SoundAsset("select-2.wav", listOf("select2")),
        SoundAsset("select-3.wav", listOf("select3")),
        SoundAsset("select-4.wav", listOf("select4")),
        SoundAsset("select-5.wav", listOf("select5")),
        SoundAsset("select-6.wav", listOf("select6")),
        SoundAsset("select-7.wav", listOf("select7")),
        SoundAsset("hint.wav", listOf("hint")),
        SoundAsset("success.wav", listOf("success")),
        SoundAsset("bonus.wav", listOf("bonus")),
        SoundAsset("dimaond.mp3", listOf("diamond")),
        SoundAsset("game-treasure.wav", listOf("levelComplete")),
        SoundAsset("points.wav", listOf("points")),
        SoundAsset("points-rising-coin.wav", listOf("pointsRising")),
        SoundAsset("shuffle.wav", listOf("shuffle")),
      )

    private val SOUND_NAMES = SOUND_ASSETS.flatMap(SoundAsset::soundNames).toSet()
  }
}

class AndroidGameSoundPoolPackage : com.facebook.react.ReactPackage {
  override fun createNativeModules(
    reactContext: com.facebook.react.bridge.ReactApplicationContext,
  ): List<com.facebook.react.bridge.NativeModule> =
    listOf(AndroidGameSoundPoolModule(reactContext))

  override fun createViewManagers(
    reactContext: com.facebook.react.bridge.ReactApplicationContext,
  ): List<com.facebook.react.uimanager.ViewManager<*, *>> = emptyList()
}
