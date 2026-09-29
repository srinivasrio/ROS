import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import 'auth_controller.dart';
import 'mobile_login_screen.dart';
import '../navigation/main_navigation_screen.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    await Future.delayed(const Duration(milliseconds: 1000));
    if (!mounted) return;

    await ref.read(authControllerProvider.notifier).checkExistingSession();
    final authState = ref.read(authControllerProvider);

    if (!mounted) return;

    if (authState.status == AuthStatus.authenticated) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const MainNavigationScreen()),
      );
    } else {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const MobileLoginScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // App Icon / Logo
            Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(26),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.3),
                    blurRadius: 30,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: const Icon(
                Icons.restaurant_menu_rounded,
                size: 48,
                color: AppColors.onPrimary,
              ),
            ),
            const SizedBox(height: 28),
            Text(
              'DINE IN ONE',
              style: AppTypography.displayLarge.copyWith(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w900,
                letterSpacing: 2,
              ),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.surfaceContainerHigh,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.borderVariant, width: 1),
              ),
              child: Text(
                'WAITER OPERATIONS',
                style: AppTypography.labelSmall.copyWith(
                  color: AppColors.primary,
                  letterSpacing: 1.5,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            const SizedBox(height: 60),
            const SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(
                strokeWidth: 2.5,
                valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
