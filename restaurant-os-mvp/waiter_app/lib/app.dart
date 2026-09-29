import 'package:flutter/material.dart';
import 'core/config/app_config.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/splash_screen.dart';

class DineInOneWaiterApp extends StatelessWidget {
  const DineInOneWaiterApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: AppConfig.appName,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.lightTheme,
      themeMode: ThemeMode.light,
      home: const SplashScreen(),
    );
  }
}
