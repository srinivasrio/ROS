import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class ReadyDishEvent {
  final String tableId;
  final String tableNumber;
  final String itemName;
  final int quantity;
  final String? waiterName;
  final DateTime timestamp;

  ReadyDishEvent({
    required this.tableId,
    required this.tableNumber,
    required this.itemName,
    required this.quantity,
    this.waiterName,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now();
}

class NotificationService {
  static final FlutterLocalNotificationsPlugin _notificationsPlugin =
      FlutterLocalNotificationsPlugin();
  static final AudioPlayer _audioPlayer = AudioPlayer();

  static final ValueNotifier<ReadyDishEvent?> readyAlertNotifier =
      ValueNotifier<ReadyDishEvent?>(null);

  static final ValueNotifier<String?> notificationPayloadNotifier =
      ValueNotifier<String?>(null);

  static bool _isInitialized = false;
  static bool isAppInForeground = true;

  static Future<void> initialize() async {
    if (_isInitialized) return;

    try {
      const androidSettings =
          AndroidInitializationSettings('@mipmap/ic_launcher');
      const iosSettings = DarwinInitializationSettings(
        requestAlertPermission: true,
        requestBadgePermission: true,
        requestSoundPermission: true,
      );

      const initSettings = InitializationSettings(
        android: androidSettings,
        iOS: iosSettings,
      );

      await _notificationsPlugin.initialize(
        settings: initSettings,
        onDidReceiveNotificationResponse: (response) {
          debugPrint('[NotificationService] Notification tapped: ${response.payload}');
          if (response.payload != null && response.payload!.isNotEmpty) {
            notificationPayloadNotifier.value = response.payload;
          }
        },
      );

      // Check if app was launched directly by tapping a notification
      final launchDetails =
          await _notificationsPlugin.getNotificationAppLaunchDetails();
      if (launchDetails != null && launchDetails.didNotificationLaunchApp) {
        final payload = launchDetails.notificationResponse?.payload;
        if (payload != null && payload.isNotEmpty) {
          notificationPayloadNotifier.value = payload;
        }
      }

      // Create Android Notification Channel with Max Importance for Heads-up popups
      final androidPlatform = _notificationsPlugin
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>();

      if (androidPlatform != null) {
        await androidPlatform.requestNotificationsPermission();
        await androidPlatform.createNotificationChannel(
          const AndroidNotificationChannel(
            'waiter_dish_ready_channel',
            'Kitchen Dish Ready Alerts',
            description: 'Instant notification when kitchen completes dish preparation',
            importance: Importance.max,
            playSound: true,
            enableVibration: true,
            showBadge: true,
          ),
        );
        await androidPlatform.createNotificationChannel(
          const AndroidNotificationChannel(
            'waiter_service_requests_channel',
            'Customer Service Requests',
            description: 'Instant notification for customer table requests',
            importance: Importance.max,
            playSound: true,
            enableVibration: true,
            showBadge: true,
          ),
        );
      }

      _isInitialized = true;
      debugPrint('[NotificationService] Initialized successfully.');
    } catch (e) {
      debugPrint('[NotificationService] Initialization error: $e');
    }
  }

  /// Trigger dish ready alert:
  /// - When app is open (foreground): Shows in-app popup modal + sound (no system notification bar duplicate)
  /// - When app is closed (background): Shows system heads-up push notification
  static Future<void> triggerDishReadyAlert({
    required String tableId,
    required String tableNumber,
    required String itemName,
    required int quantity,
    String? waiterName,
  }) async {
    final event = ReadyDishEvent(
      tableId: tableId,
      tableNumber: tableNumber,
      itemName: itemName,
      quantity: quantity,
      waiterName: waiterName,
    );

    // 1. In-App broadcast for real-time popup
    readyAlertNotifier.value = event;

    // 2. If app is open in foreground: play chime sound and display in-app popup ONLY (no duplicate system notification)
    if (isAppInForeground) {
      try {
        await _audioPlayer.stop();
        await _audioPlayer.play(AssetSource('sounds/notification.mp3'), volume: 1.0);
      } catch (_) {
        try {
          await _audioPlayer.play(
              UrlSource('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'),
              volume: 1.0);
        } catch (audioErr) {
          debugPrint('[NotificationService] Audio play error: $audioErr');
        }
      }
      return;
    }

    // 3. If app is closed/background: Show System Notification (Heads-up alert / Lock screen / Status bar)
    try {
      const androidDetails = AndroidNotificationDetails(
        'waiter_dish_ready_channel',
        'Kitchen Dish Ready Alerts',
        channelDescription: 'Instant notification when kitchen completes dish preparation',
        importance: Importance.max,
        priority: Priority.high,
        ticker: 'Dish Ready!',
        playSound: true,
        enableVibration: true,
        category: AndroidNotificationCategory.call,
        fullScreenIntent: true,
      );

      const iosDetails = DarwinNotificationDetails(
        presentAlert: true,
        presentBadge: true,
        presentSound: true,
        interruptionLevel: InterruptionLevel.timeSensitive,
      );

      const notificationDetails = NotificationDetails(
        android: androidDetails,
        iOS: iosDetails,
      );

      final notificationId = DateTime.now().millisecondsSinceEpoch ~/ 1000;

      await _notificationsPlugin.show(
        id: notificationId,
        title: '🍽️ Table $tableNumber — Dish Ready!',
        body: '${quantity}x $itemName is ready at the kitchen counter.',
        notificationDetails: notificationDetails,
        payload: 'dish_ready:$tableId:$tableNumber',
      );
    } catch (e) {
      debugPrint('[NotificationService] System notification error: $e');
    }
  }

  /// Trigger service request notification when app is in background
  static Future<void> triggerServiceRequestNotification({
    required String tableId,
    required String tableNumber,
    required String title,
    required String description,
    required String requestId,
  }) async {
    // If app is in foreground, in-app modal handles it directly without duplicate notification
    if (isAppInForeground) return;

    try {
      const androidDetails = AndroidNotificationDetails(
        'waiter_service_requests_channel',
        'Customer Service Requests',
        channelDescription: 'Instant notification for customer table requests',
        importance: Importance.max,
        priority: Priority.high,
        ticker: 'New Service Request',
        playSound: true,
        enableVibration: true,
        category: AndroidNotificationCategory.call,
      );

      const iosDetails = DarwinNotificationDetails(
        presentAlert: true,
        presentBadge: true,
        presentSound: true,
        interruptionLevel: InterruptionLevel.timeSensitive,
      );

      const notificationDetails = NotificationDetails(
        android: androidDetails,
        iOS: iosDetails,
      );

      final notificationId = (DateTime.now().millisecondsSinceEpoch ~/ 1000) + 1;

      await _notificationsPlugin.show(
        id: notificationId,
        title: '🛎️ Table $tableNumber — $title',
        body: description,
        notificationDetails: notificationDetails,
        payload: 'service_request:$requestId:$tableId',
      );
    } catch (e) {
      debugPrint('[NotificationService] Request system notification error: $e');
    }
  }
}
