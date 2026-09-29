import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';
import '../utils/feedback_utils.dart';

enum ButtonVariant { primary, secondary, outline, danger, success }
typedef AppButtonType = ButtonVariant;

class AppButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool isLoading;
  final ButtonVariant variant;
  final IconData? icon;
  final double? width;
  final double height;
  final double borderRadius;

  const AppButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.isLoading = false,
    this.variant = ButtonVariant.primary,
    this.icon,
    this.width,
    this.height = 52,
    this.borderRadius = 14,
  });

  @override
  Widget build(BuildContext context) {
    Color bgColor;
    Color fgColor;
    BorderSide? border;

    switch (variant) {
      case ButtonVariant.primary:
        bgColor = AppColors.primary;
        fgColor = AppColors.onPrimary;
        border = null;
        break;
      case ButtonVariant.secondary:
        bgColor = AppColors.surfaceContainerHighest;
        fgColor = AppColors.textPrimary;
        border = const BorderSide(color: AppColors.borderVariant, width: 1);
        break;
      case ButtonVariant.outline:
        bgColor = Colors.transparent;
        fgColor = AppColors.primary;
        border = const BorderSide(color: AppColors.primary, width: 1.5);
        break;
      case ButtonVariant.danger:
        bgColor = AppColors.error;
        fgColor = Colors.white;
        border = null;
        break;
      case ButtonVariant.success:
        bgColor = AppColors.tableAvailable;
        fgColor = Colors.white;
        border = null;
        break;
    }

    final isEnabled = onPressed != null && !isLoading;

    return SizedBox(
      width: width ?? double.infinity,
      height: height,
      child: ElevatedButton(
        style: ElevatedButton.styleFrom(
          backgroundColor: isEnabled ? bgColor : AppColors.surfaceContainerHighest.withValues(alpha: 0.5),
          foregroundColor: isEnabled ? fgColor : AppColors.textMuted,
          elevation: variant == ButtonVariant.primary ? 3 : 0,
          side: isEnabled ? border : const BorderSide(color: AppColors.border),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(borderRadius),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 10),
        ),
        onPressed: isEnabled
            ? () {
                FeedbackUtils.lightHaptic();
                onPressed!();
              }
            : null,
        child: isLoading
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                ),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (icon != null) ...[
                    Icon(icon, size: 18, color: isEnabled ? fgColor : AppColors.textMuted),
                    const SizedBox(width: 6),
                  ],
                  Flexible(
                    child: Text(
                      label,
                      style: AppTypography.labelLarge.copyWith(
                        color: isEnabled ? fgColor : AppColors.textMuted,
                        fontWeight: FontWeight.w800,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}
