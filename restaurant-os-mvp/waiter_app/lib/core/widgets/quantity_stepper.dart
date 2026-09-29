import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';
import '../utils/feedback_utils.dart';

class QuantityStepper extends StatelessWidget {
  final int quantity;
  final VoidCallback? onAdd;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;
  final bool compact;

  const QuantityStepper({
    super.key,
    required this.quantity,
    this.onAdd,
    required this.onIncrement,
    required this.onDecrement,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    // Fixed dimensions that NEVER change whether quantity is 0, 1, or 10+
    final double totalWidth = compact ? 74.0 : 80.0;
    final double totalHeight = compact ? 28.0 : 32.0;
    final double buttonWidth = compact ? 24.0 : 26.0;
    final double borderRadius = compact ? 8.0 : 10.0;

    if (quantity == 0) {
      return SizedBox(
        width: totalWidth,
        height: totalHeight,
        child: Material(
          color: AppColors.primary,
          borderRadius: BorderRadius.circular(borderRadius),
          child: InkWell(
            onTap: () {
              FeedbackUtils.lightHaptic();
              if (onAdd != null) {
                onAdd!();
              } else {
                onIncrement();
              }
            },
            borderRadius: BorderRadius.circular(borderRadius),
            child: Center(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(LucideIcons.plus, size: 13, color: AppColors.onPrimary),
                  const SizedBox(width: 3),
                  Text(
                    'ADD',
                    style: AppTypography.labelSmall.copyWith(
                      color: AppColors.onPrimary,
                      fontWeight: FontWeight.w900,
                      fontSize: compact ? 10.5 : 11.5,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return SizedBox(
      width: totalWidth,
      height: totalHeight,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surfaceContainerHigh,
          borderRadius: BorderRadius.circular(borderRadius),
          border: Border.all(color: AppColors.borderVariant, width: 1),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // Fixed-size Decrease Button (-)
            SizedBox(
              width: buttonWidth,
              height: totalHeight,
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () {
                    FeedbackUtils.lightHaptic();
                    onDecrement();
                  },
                  borderRadius: BorderRadius.horizontal(left: Radius.circular(borderRadius)),
                  child: const Center(
                    child: Icon(LucideIcons.minus, size: 13, color: AppColors.textPrimary),
                  ),
                ),
              ),
            ),

            // Centered Quantity Count (fixed width area so it never resizes container or buttons)
            Expanded(
              child: Center(
                child: Text(
                  quantity.toString(),
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  style: (compact ? AppTypography.labelMedium : AppTypography.labelLarge).copyWith(
                    fontWeight: FontWeight.w900,
                    color: AppColors.textPrimary,
                    fontSize: compact ? 11.5 : 13,
                  ),
                ),
              ),
            ),

            // Fixed-size Increase Button (+) - EXACT SAME SIZE AS (-)
            SizedBox(
              width: buttonWidth,
              height: totalHeight,
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () {
                    FeedbackUtils.lightHaptic();
                    onIncrement();
                  },
                  borderRadius: BorderRadius.horizontal(right: Radius.circular(borderRadius)),
                  child: const Center(
                    child: Icon(LucideIcons.plus, size: 13, color: AppColors.textPrimary),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
