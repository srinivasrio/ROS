import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app.dart';
import 'core/notifications/notification_service.dart';
import 'core/realtime/supabase_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Set system status bar overlay styling
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ),
  );

  // Initialize Supabase client and notifications
  await SupabaseService.initialize();
  await NotificationService.initialize();

  runApp(
    const ProviderScope(
      child: DineInOneWaiterApp(),
    ),
  );
}
