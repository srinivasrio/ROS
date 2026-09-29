import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/audio_service.dart';
import '../../../core/utils/feedback_utils.dart';
import '../../../core/widgets/app_button.dart';
import '../service_request_model.dart';

class TableAccessRequestSheet extends StatelessWidget {
  final ServiceRequestModel request;
  final Function(String transferType) onApprove;
  final VoidCallback onDecline;

  const TableAccessRequestSheet({
    super.key,
    required this.request,
    required this.onApprove,
    required this.onDecline,
  });

  String get _requesterName {
    if (request.additionalNotes != null && request.additionalNotes!.isNotEmpty) {
      try {
        final data = jsonDecode(request.additionalNotes!);
        if (data is Map && data['requester_name'] != null) {
          return data['requester_name'].toString();
        }
      } catch (_) {
        return request.additionalNotes!;
      }
    }
    return 'Another Waiter';
  }

  static Future<void> show(
    BuildContext context, {
    required ServiceRequestModel request,
    required Function(String transferType) onApprove,
    required VoidCallback onDecline,
  }) async {
    AudioService.playAlertSound();
    FeedbackUtils.heavyHaptic();

    return showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => TableAccessRequestSheet(
        request: request,
        onApprove: (transferType) {
          AudioService.stop();
          Navigator.of(ctx).pop();
          onApprove(transferType);
        },
        onDecline: () {
          AudioService.stop();
          Navigator.of(ctx).pop();
          onDecline();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final requester = request.requesterName ?? _requesterName;
    final requesterMobile = request.requesterMobile;
    final requesterAvatar = request.requesterAvatar;
    final tableName = request.formattedTableName;

    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: const Color(0xFF6366F1), width: 2),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF6366F1).withValues(alpha: 0.25),
              blurRadius: 28,
              spreadRadius: 2,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Top Header: Icon + Title + Status Pill
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEEF2FF),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      LucideIcons.arrowRightLeft,
                      size: 18,
                      color: Color(0xFF4F46E5),
                    ),
                  ),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: Text(
                      'Table Access Request',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF1E1B4B),
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFFDE68A)),
                    ),
                    child: const Text(
                      'PENDING',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFFB45309),
                        letterSpacing: 0.4,
                      ),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 16),

              // Requester Card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFEEF2FF),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: const Color(0xFFC7D2FE), width: 1.2),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: const Color(0xFF4F46E5),
                        borderRadius: BorderRadius.circular(14),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF4F46E5).withValues(alpha: 0.2),
                            blurRadius: 6,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: requesterAvatar != null && requesterAvatar.isNotEmpty
                          ? Image.network(
                              requesterAvatar,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => Center(
                                child: Text(
                                  requester.isNotEmpty ? requester[0].toUpperCase() : 'W',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w900,
                                    fontSize: 20,
                                  ),
                                ),
                              ),
                            )
                          : Center(
                              child: Text(
                                requester.isNotEmpty ? requester[0].toUpperCase() : 'W',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w900,
                                  fontSize: 20,
                                ),
                              ),
                            ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFF4F46E5),
                              borderRadius: BorderRadius.circular(5),
                            ),
                            child: const Text(
                              'REQUESTING WAITER',
                              style: TextStyle(
                                fontSize: 8.5,
                                fontWeight: FontWeight.w900,
                                color: Colors.white,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            requester,
                            style: AppTypography.headingSmall.copyWith(
                              fontWeight: FontWeight.w900,
                              color: const Color(0xFF312E81),
                              fontSize: 16,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (requesterMobile != null && requesterMobile.isNotEmpty) ...[
                            const SizedBox(height: 2),
                            Row(
                              children: [
                                const Icon(LucideIcons.phone, size: 11, color: Color(0xFF6366F1)),
                                const SizedBox(width: 4),
                                Flexible(
                                  child: Text(
                                    requesterMobile,
                                    style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFF4F46E5),
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 12),

              // Target Table Badge
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.background,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(LucideIcons.layoutGrid, size: 16, color: AppColors.primary),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(
                        'Target Table: $tableName',
                        style: AppTypography.headingSmall.copyWith(
                          fontWeight: FontWeight.w900,
                          color: AppColors.textPrimary,
                          fontSize: 15,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 18),

              // BUTTON 1: Approve
              SizedBox(
                width: double.infinity,
                child: AppButton(
                  label: 'Approve',
                  icon: LucideIcons.checkCheck,
                  onPressed: () => onApprove('share'),
                ),
              ),

              const SizedBox(height: 10),

              // BUTTON 2: Approve and Transfer
              SizedBox(
                width: double.infinity,
                child: AppButton(
                  label: 'Approve and Transfer',
                  icon: LucideIcons.arrowRightLeft,
                  onPressed: () => onApprove('transfer'),
                ),
              ),

              const SizedBox(height: 10),

              // BUTTON 3: Decline
              SizedBox(
                width: double.infinity,
                child: AppButton(
                  label: 'Decline',
                  variant: ButtonVariant.secondary,
                  icon: LucideIcons.x,
                  onPressed: onDecline,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
