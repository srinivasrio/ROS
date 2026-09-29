import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/utils/feedback_utils.dart';
import '../../core/widgets/app_button.dart';
import 'auth_controller.dart';
import '../navigation/main_navigation_screen.dart';

class OtpVerificationScreen extends ConsumerStatefulWidget {
  const OtpVerificationScreen({super.key});

  @override
  ConsumerState<OtpVerificationScreen> createState() => _OtpVerificationScreenState();
}

class _OtpVerificationScreenState extends ConsumerState<OtpVerificationScreen> {
  final List<TextEditingController> _controllers = List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _focusNodes = List.generate(6, (_) => FocusNode());
  int _secondsLeft = 30;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  void _startTimer() {
    _timer?.cancel();
    setState(() => _secondsLeft = 30);
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_secondsLeft > 0) {
        setState(() => _secondsLeft--);
      } else {
        timer.cancel();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    for (var c in _controllers) {
      c.dispose();
    }
    for (var f in _focusNodes) {
      f.dispose();
    }
    super.dispose();
  }

  String _getOtp() {
    return _controllers.map((c) => c.text).join();
  }

  Future<void> _handleVerify() async {
    final otp = _getOtp();
    if (otp.length != 6) {
      FeedbackUtils.showToast(context, message: 'Please enter all 6 digits of the OTP', isError: true);
      return;
    }

    final success = await ref.read(authControllerProvider.notifier).verifyOtp(otp);
    if (!mounted) return;

    if (success) {
      FeedbackUtils.successHaptic();
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const MainNavigationScreen()),
        (route) => false,
      );
    } else {
      final error = ref.read(authControllerProvider).errorMessage ?? 'Verification failed';
      FeedbackUtils.showToast(context, message: error, isError: true);
      // Clear fields
      for (var c in _controllers) {
        c.clear();
      }
      _focusNodes[0].requestFocus();
    }
  }

  Future<void> _handleResend() async {
    if (_secondsLeft > 0) return;
    final mobile = ref.read(authControllerProvider).mobile;
    if (mobile == null) return;

    final success = await ref.read(authControllerProvider.notifier).sendOtp(mobile);
    if (!mounted) return;
    if (success) {
      FeedbackUtils.showToast(context, message: 'New code sent!', isSuccess: true);
      _startTimer();
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authControllerProvider);
    final isLoading = authState.status == AuthStatus.loading;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(LucideIcons.arrowLeft, color: AppColors.textPrimary),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Enter 6-Digit Code',
                style: AppTypography.displayMedium,
              ),
              const SizedBox(height: 8),
              RichText(
                text: TextSpan(
                  style: AppTypography.bodyMedium,
                  children: [
                    const TextSpan(text: 'Code sent to '),
                    TextSpan(
                      text: authState.maskedMobile.isNotEmpty ? authState.maskedMobile : '+91 XXXXX XXXXX',
                      style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 36),

              // 6 PIN Input Boxes
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: List.generate(6, (index) {
                  return SizedBox(
                    width: 48,
                    height: 58,
                    child: TextField(
                      controller: _controllers[index],
                      focusNode: _focusNodes[index],
                      keyboardType: TextInputType.number,
                      textAlign: TextAlign.center,
                      maxLength: 1,
                      style: AppTypography.headingLarge.copyWith(fontWeight: FontWeight.w800),
                      decoration: InputDecoration(
                        counterText: '',
                        filled: true,
                        fillColor: Colors.white,
                        contentPadding: EdgeInsets.zero,
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: AppColors.border, width: 1.5),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: AppColors.primary, width: 2),
                        ),
                      ),
                      onChanged: (value) {
                        if (value.isNotEmpty) {
                          FeedbackUtils.lightHaptic();
                          if (index < 5) {
                            _focusNodes[index + 1].requestFocus();
                          } else {
                            _focusNodes[index].unfocus();
                            _handleVerify();
                          }
                        } else {
                          if (index > 0) {
                            _focusNodes[index - 1].requestFocus();
                          }
                        }
                      },
                    ),
                  );
                }),
              ),

              const SizedBox(height: 36),

              AppButton(
                label: 'Verify & Enter',
                isLoading: isLoading,
                onPressed: isLoading ? null : _handleVerify,
              ),

              const SizedBox(height: 24),

              Center(
                child: _secondsLeft > 0
                    ? Text(
                        'Resend code in ${_secondsLeft}s',
                        style: AppTypography.bodyMedium.copyWith(color: AppColors.textMuted),
                      )
                    : TextButton(
                        onPressed: _handleResend,
                        child: Text(
                          'Resend Code',
                          style: AppTypography.labelLarge.copyWith(
                            color: AppColors.secondary,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
