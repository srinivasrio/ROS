import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';

class FeedbackUtils {
  static void lightHaptic() {
    HapticFeedback.lightImpact();
  }

  static void selectionHaptic() {
    HapticFeedback.selectionClick();
  }

  static void mediumHaptic() {
    HapticFeedback.mediumImpact();
  }

  static void heavyHaptic() {
    HapticFeedback.heavyImpact();
  }

  static void successHaptic() {
    HapticFeedback.vibrate();
  }

  static void showToast(
    BuildContext context, {
    required String message,
    bool isError = false,
    bool isSuccess = false,
    Duration duration = const Duration(seconds: 3),
  }) {
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        elevation: 6,
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        backgroundColor: isError
            ? AppColors.errorContainer
            : isSuccess
                ? AppColors.tableAvailable
                : AppColors.surfaceContainerHigh,
        content: Text(
          message,
          style: AppTypography.labelMedium.copyWith(color: AppColors.textPrimary),
        ),
        duration: duration,
      ),
    );
  }
}
