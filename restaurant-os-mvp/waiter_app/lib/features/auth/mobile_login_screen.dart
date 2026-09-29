import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/utils/feedback_utils.dart';
import '../../core/widgets/app_button.dart';
import '../navigation/main_navigation_screen.dart';
import 'auth_controller.dart';

class MobileLoginScreen extends ConsumerStatefulWidget {
  const MobileLoginScreen({super.key});

  @override
  ConsumerState<MobileLoginScreen> createState() => _MobileLoginScreenState();
}

class _MobileLoginScreenState extends ConsumerState<MobileLoginScreen> {
  final TextEditingController _mobileController = TextEditingController();
  final FocusNode _focusNode = FocusNode();

  @override
  void dispose() {
    _mobileController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    final mobile = _mobileController.text.trim();
    if (mobile.length != 10) {
      FeedbackUtils.showToast(
        context,
        message: 'Please enter your 10-digit mobile number',
        isError: true,
      );
      return;
    }

    final success = await ref.read(authControllerProvider.notifier).loginWithMobile(mobile);
    if (!mounted) return;

    if (success) {
      FeedbackUtils.successHaptic();
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const MainNavigationScreen()),
        (route) => false,
      );
    } else {
      final error = ref.read(authControllerProvider).errorMessage ?? 'Login failed. Please check your mobile number.';
      FeedbackUtils.showToast(context, message: error, isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authControllerProvider);
    final isLoading = authState.status == AuthStatus.loading;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 20),

              // Logo Box
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.3),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.restaurant_menu_rounded,
                  size: 32,
                  color: AppColors.onPrimary,
                ),
              ),

              const SizedBox(height: 32),

              Text(
                'Waiter Sign In',
                style: AppTypography.displayMedium.copyWith(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Enter your registered staff mobile number to access your shift.',
                style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
              ),

              const SizedBox(height: 40),

              // Mobile Input
              Text(
                'STAFF MOBILE NUMBER',
                style: AppTypography.labelSmall.copyWith(
                  color: AppColors.textSecondary,
                  letterSpacing: 1.2,
                ),
              ),
              const SizedBox(height: 10),

              Container(
                decoration: BoxDecoration(
                  color: AppColors.surfaceContainer,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: AppColors.border, width: 1.5),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.2),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
                      decoration: const BoxDecoration(
                        border: Border(
                          right: BorderSide(color: AppColors.border, width: 1.5),
                        ),
                      ),
                      child: Row(
                        children: [
                          const Text('🇮🇳', style: TextStyle(fontSize: 18)),
                          const SizedBox(width: 8),
                          Text(
                            '+91',
                            style: AppTypography.headingSmall.copyWith(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: TextField(
                        controller: _mobileController,
                        focusNode: _focusNode,
                        keyboardType: TextInputType.phone,
                        maxLength: 10,
                        style: AppTypography.headingSmall.copyWith(
                          color: AppColors.textPrimary,
                          letterSpacing: 1.5,
                          fontWeight: FontWeight.w800,
                        ),
                        decoration: InputDecoration(
                          counterText: '',
                          hintText: '82470 05501',
                          hintStyle: AppTypography.headingSmall.copyWith(
                            color: AppColors.textMuted,
                            letterSpacing: 1.5,
                          ),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 18),
                          border: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          focusedBorder: InputBorder.none,
                          fillColor: Colors.transparent,
                        ),
                        onSubmitted: (_) => _handleLogin(),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 32),

              AppButton(
                label: 'Enter Waiter Panel',
                icon: LucideIcons.arrowRight,
                isLoading: isLoading,
                onPressed: isLoading ? null : _handleLogin,
              ),

              const SizedBox(height: 48),

              // Quick Hint Banner
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surfaceContainer,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.border, width: 1),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(LucideIcons.shieldCheck, size: 20, color: AppColors.primary),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Direct Staff Sign In: Active waiters can sign in directly using their 10-digit registered staff mobile number.',
                        style: AppTypography.bodySmall.copyWith(
                          color: AppColors.textSecondary,
                          height: 1.4,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
