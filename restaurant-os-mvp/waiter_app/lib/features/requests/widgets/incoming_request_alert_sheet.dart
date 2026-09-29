import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/audio_service.dart';
import '../../../core/utils/feedback_utils.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_network_image.dart';
import '../service_request_model.dart';

class IncomingRequestAlertSheet extends StatelessWidget {
  final ServiceRequestModel request;
  final VoidCallback onAccept;
  final VoidCallback onDismiss;

  const IncomingRequestAlertSheet({
    super.key,
    required this.request,
    required this.onAccept,
    required this.onDismiss,
  });

  static Future<void> show(
    BuildContext context, {
    required ServiceRequestModel request,
    required VoidCallback onAccept,
    required VoidCallback onDismiss,
  }) async {
    // Play alert audio and vibration
    AudioService.playAlertSound();
    FeedbackUtils.heavyHaptic();

    return showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => IncomingRequestAlertSheet(
        request: request,
        onAccept: () {
          AudioService.stop();
          Navigator.of(ctx).pop();
          onAccept();
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
          border: Border.all(color: AppColors.primary, width: 2),
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withValues(alpha: 0.25),
              blurRadius: 24,
              spreadRadius: 2,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Top Badge: "New Service Request"
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: AppColors.primaryContainer,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(LucideIcons.bellRing, size: 14, color: AppColors.primary),
                      const SizedBox(width: 6),
                      Text(
                        'NEW SERVICE REQUEST',
                        style: TextStyle(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w900,
                          fontSize: 11,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: onDismiss,
                  icon: const Icon(Icons.close_rounded, color: AppColors.textMuted),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Service Image & Table Details
            Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: Container(
                    width: 72,
                    height: 72,
                    color: AppColors.surfaceContainerHigh,
                    child: AppNetworkImage(
                      imageUrl: request.imageUrl,
                      name: request.serviceLabel ?? request.formattedTitle,
                      width: 72,
                      height: 72,
                      fit: BoxFit.cover,
                      fallbackIcon: LucideIcons.bell,
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceContainerHighest,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          request.formattedTableName,
                          style: AppTypography.headingSmall.copyWith(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.w800,
                            fontSize: 14,
                          ),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        request.formattedTitle,
                        style: AppTypography.headingLarge.copyWith(
                          color: AppColors.textPrimary,
                          fontWeight: FontWeight.w900,
                          fontSize: 20,
                          height: 1.15,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (request.quantity > 1) ...[
                        const SizedBox(height: 4),
                        Text(
                          'Quantity: ${request.quantity}',
                          style: const TextStyle(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w800,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),

            if (request.displayNotes != null && request.displayNotes!.trim().isNotEmpty) ...[
              const SizedBox(height: 14),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.surfaceContainerHigh,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border),
                ),
                child: Text(
                  'Note: ${request.displayNotes}',
                  style: AppTypography.bodySmall.copyWith(
                    color: AppColors.textSecondary,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ),
            ],

            const SizedBox(height: 24),

            // Action Buttons (Dismiss vs Accept)
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      side: const BorderSide(color: AppColors.borderVariant, width: 1.5),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    onPressed: onDismiss,
                    child: Text(
                      'Dismiss',
                      style: AppTypography.labelLarge.copyWith(
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: AppButton(
                    label: 'Accept Request',
                    icon: LucideIcons.check,
                    height: 48,
                    onPressed: onAccept,
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
