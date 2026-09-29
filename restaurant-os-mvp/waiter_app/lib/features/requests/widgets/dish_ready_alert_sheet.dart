import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../../core/notifications/notification_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/audio_service.dart';
import '../../../core/utils/feedback_utils.dart';
import '../../../core/widgets/app_button.dart';

class DishReadyAlertSheet extends StatelessWidget {
  final ReadyDishEvent event;
  final VoidCallback onPickUp;
  final VoidCallback onDismiss;

  const DishReadyAlertSheet({
    super.key,
    required this.event,
    required this.onPickUp,
    required this.onDismiss,
  });

  static Future<void> show(
    BuildContext context, {
    required ReadyDishEvent event,
    required VoidCallback onPickUp,
    required VoidCallback onDismiss,
  }) async {
    AudioService.playAlertSound();
    FeedbackUtils.heavyHaptic();

    return showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => DishReadyAlertSheet(
        event: event,
        onPickUp: () {
          AudioService.stop();
          Navigator.of(ctx).pop();
          onPickUp();
        },
        onDismiss: () {
          AudioService.stop();
          Navigator.of(ctx).pop();
          onDismiss();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: Container(
        padding: const EdgeInsets.all(22),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(28),
          border: Border.all(color: const Color(0xFF10B981), width: 2.5),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF10B981).withValues(alpha: 0.35),
              blurRadius: 28,
              spreadRadius: 3,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Top Badge: "DISH READY TO SERVE"
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: const Color(0xFFECFDF5),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.3)),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(LucideIcons.chefHat, size: 14, color: Color(0xFF059669)),
                      SizedBox(width: 6),
                      Text(
                        'KITCHEN ALERT',
                        style: TextStyle(
                          color: Color(0xFF059669),
                          fontWeight: FontWeight.w900,
                          fontSize: 11,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFF10B981),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text(
                    'READY',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 10,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 18),

            // Icon and Table highlight
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFECFDF5),
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.2), width: 3),
              ),
              child: const Icon(
                LucideIcons.utensils,
                size: 40,
                color: Color(0xFF059669),
              ),
            ),

            const SizedBox(height: 14),

            // Table Number Badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.background,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.border),
              ),
              child: Text(
                'Table ${event.tableNumber}',
                style: AppTypography.headingLarge.copyWith(
                  fontWeight: FontWeight.w900,
                  color: AppColors.textPrimary,
                ),
              ),
            ),

            const SizedBox(height: 12),

            // Dish Details Card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFFF9FAFB),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                children: [
                  Text(
                    '${event.quantity}x ${event.itemName}',
                    style: AppTypography.headingMedium.copyWith(
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Prepared and ready at the kitchen counter',
                    style: TextStyle(
                      fontSize: 12,
                      color: Color(0xFF6B7280),
                      fontWeight: FontWeight.w500,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // Action Buttons
            Row(
              children: [
                Expanded(
                  child: AppButton(
                    label: 'Dismiss',
                    variant: ButtonVariant.secondary,
                    onPressed: onDismiss,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: AppButton(
                    label: 'Pick Up & Serve',
                    variant: ButtonVariant.primary,
                    icon: LucideIcons.checkCheck,
                    onPressed: onPickUp,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
