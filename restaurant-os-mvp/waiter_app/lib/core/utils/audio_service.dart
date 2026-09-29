import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';

class AudioService {
  static final AudioPlayer _player = AudioPlayer();
  static bool _isPlaying = false;

  static Future<void> playAlertSound() async {
    try {
      if (_isPlaying) {
        await _player.stop();
      }
      _isPlaying = true;
      await _player.setVolume(1.0);
      await _player.setReleaseMode(ReleaseMode.release);
      await _player.play(AssetSource('sounds/alert.mp3'));
      _isPlaying = false;
    } catch (e) {
      debugPrint('[AudioService] Could not play alert sound: $e');
      _isPlaying = false;
    }
  }

  static Future<void> stop() async {
    try {
      await _player.stop();
      _isPlaying = false;
    } catch (e) {
      debugPrint('[AudioService] Error stopping audio: $e');
    }
  }
}
