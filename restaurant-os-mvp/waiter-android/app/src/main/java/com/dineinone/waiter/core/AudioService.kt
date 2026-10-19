package com.dineinone.waiter.core

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import com.dineinone.waiter.R

object AudioService {
    private var player: MediaPlayer? = null
    private var lastPlayTime: Long = 0L

    @Synchronized
    fun playAlert(context: Context) {
        val now = System.currentTimeMillis()
        if (now - lastPlayTime < 2200L) {
            // Suppress duplicate alert sound within 2.2 seconds
            return
        }
        lastPlayTime = now

        try {
            stop()
            val mp = MediaPlayer.create(context.applicationContext, R.raw.alert)
            player = mp
            mp?.setAudioAttributes(
                AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .build()
            )
            mp?.setOnCompletionListener {
                runCatching {
                    it.release()
                    if (player === it) player = null
                }
            }
            mp?.start()

            // Vibrate
            vibrate(context)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun stop() {
        try {
            player?.stop()
            player?.release()
            player = null
        } catch (_: Exception) {}
    }

    private fun vibrate(context: Context) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vm?.defaultVibrator?.vibrate(
                    VibrationEffect.createWaveform(longArrayOf(0, 250, 150, 250), -1)
                )
            } else {
                @Suppress("DEPRECATION")
                val v = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    v?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 250, 150, 250), -1))
                } else {
                    @Suppress("DEPRECATION")
                    v?.vibrate(longArrayOf(0, 250, 150, 250), -1)
                }
            }
        } catch (_: Exception) {}
    }
}
