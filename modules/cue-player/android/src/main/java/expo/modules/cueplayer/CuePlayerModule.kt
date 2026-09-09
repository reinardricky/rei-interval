package expo.modules.cueplayer

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Low-latency playback for the interval timer's cues.
 *
 * `SoundPool` is Android's equivalent of the Web Audio API: short clips are
 * decoded into memory once and fired from there, so a play costs on the order
 * of tens of milliseconds and is repeatable, overlappable and stateless.
 *
 * The alternative — and what this replaces — is `expo-audio`, which wraps
 * ExoPlayer. ExoPlayer is a *media* player built for streaming: it carries a
 * playback position that has to be rewound, it takes hundreds of milliseconds
 * to start, and a player that is cold or has sat idle is slower still or
 * silent outright. Driving a metronome with it meant compensating by firing
 * cues 600ms early and playing every player once at startup to warm it up.
 * None of that is necessary here.
 *
 * Cues live in `res/raw` rather than arriving as JS assets, so they resolve
 * identically in debug and release and never depend on the bundler.
 */
class CuePlayerModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private var soundPool: SoundPool? = null

  /** Cue name to the sample id `SoundPool` gave us for it. */
  private val sampleIds = mutableMapOf<String, Int>()

  override fun definition() = ModuleDefinition {
    Name("CuePlayer")

    OnCreate {
      soundPool = SoundPool.Builder()
        .setMaxStreams(MAX_STREAMS)
        .setAudioAttributes(
          AudioAttributes.Builder()
            // Sonification on the media stream: a training cue has to be heard
            // over the music the athlete is already playing, and must not be
            // silenced by the ringer switch.
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        )
        .build()
    }

    OnDestroy {
      soundPool?.release()
      soundPool = null
      sampleIds.clear()
    }

    /**
     * Decodes `res/raw/<name>.wav` into the pool. Safe to call again for a name
     * already loaded; the newer sample id simply replaces the old one.
     */
    Function("load") { name: String ->
      val pool = soundPool ?: return@Function false
      val resourceId = context.resources.getIdentifier(name, "raw", context.packageName)
      if (resourceId == 0) return@Function false
      sampleIds[name] = pool.load(context, resourceId, PRIORITY)
      true
    }

    /**
     * Fires a cue. Synchronous on purpose — a JSI call costs microseconds,
     * where a bridged async hop would put back some of the latency this module
     * exists to remove.
     *
     * Deliberately never blocks on readiness: `play` returns a stream id of 0
     * if the sample is still decoding, and reporting that is all this can
     * usefully do. Refusing to play until a readiness flag flips is how the
     * previous implementation deadlocked itself into permanent silence.
     */
    Function("play") { name: String ->
      val pool = soundPool ?: return@Function false
      val sampleId = sampleIds[name] ?: return@Function false
      pool.play(sampleId, VOLUME, VOLUME, PRIORITY, NO_LOOP, NORMAL_RATE) != 0
    }
  }

  private companion object {
    /** A phase cue can land on the tail of a countdown tick; four is headroom. */
    const val MAX_STREAMS = 4
    const val PRIORITY = 1
    const val VOLUME = 1f
    const val NO_LOOP = 0
    const val NORMAL_RATE = 1f
  }
}
