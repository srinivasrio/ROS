import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/feedback_utils.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/status_badge.dart';
import '../order_models.dart';

class OrderCard extends StatelessWidget {
  final OrderModel order;
  final VoidCallback onMarkServed;
  final bool canManage;
  final VoidCallback? onRequestAccess;

  const OrderCard({
    super.key,
    required this.order,
    required this.onMarkServed,
    this.canManage = true,
    this.onRequestAccess,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceContainer,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: (order.isReady && canManage) ? AppColors.tableAvailable : AppColors.border,
          width: (order.isReady && canManage) ? 2 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.2),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Row: Table, Time, Status
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      'T${order.tableNumber ?? '?' }',
                      style: AppTypography.headingSmall.copyWith(
                        color: AppColors.onPrimary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Order #${order.orderNumber ?? order.id.substring(0, 4)}',
                        style: AppTypography.labelLarge.copyWith(
                          color: AppColors.textPrimary,
                        ),
                      ),
                      if (!canManage && (order.waiterName != null || order.waiterId != null))
                        Text(
                          'Assigned: ${order.waiterName ?? "Another Waiter"}',
                          style: AppTypography.bodySmall.copyWith(
                            color: AppColors.textMuted,
                            fontSize: 11,
                          ),
                        ),
                    ],
                  ),
                ],
              ),
              StatusBadge(status: order.status),
            ],
          ),

          const SizedBox(height: 12),

          // Elapsed Time & Total Amount
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(LucideIcons.clock, size: 14, color: AppColors.textMuted),
                  const SizedBox(width: 4),
                  Text(
                    Formatters.formatElapsed(order.createdAt),
                    style: AppTypography.bodySmall.copyWith(
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              Text(
                Formatters.formatCurrency(order.totalAmount),
                style: AppTypography.labelLarge.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),
          const Divider(color: AppColors.border, height: 1),
          const SizedBox(height: 12),

          // Order Items Preview
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: order.items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 6),
            itemBuilder: (context, idx) {
              final item = order.items[idx];
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 24,
                        height: 24,
                        decoration: BoxDecoration(
                          color: AppColors.surfaceContainerHighest,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: AppColors.borderVariant, width: 1),
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          '${item.quantity}',
                          style: AppTypography.bodySmall.copyWith(
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          item.itemName,
                          style: AppTypography.bodyLarge.copyWith(
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                      if (item.isReady)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: canManage
                                ? AppColors.tableAvailable.withValues(alpha: 0.2)
                                : AppColors.surfaceContainerHighest,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            canManage ? 'READY' : 'LOCKED',
                            style: AppTypography.bodySmall.copyWith(
                              color: canManage ? AppColors.tableAvailable : AppColors.textMuted,
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                    ],
                  ),
                  if (item.comboItems.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(left: 34, top: 3, bottom: 4),
                      child: Text(
                        item.comboItems.map((c) => '${c.quantity * item.quantity}x ${c.name}').join(' • '),
                        style: AppTypography.bodySmall.copyWith(
                          fontSize: 11,
                          color: const Color(0xFFEA580C),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                ],
              );
            },
          ),

          // Action Button: If order is ready, mark served only if canManage
          if (order.isReady) ...[
            const SizedBox(height: 16),
            if (canManage)
              AppButton(
                label: 'Mark as Served',
                icon: LucideIcons.checkCheck,
                variant: ButtonVariant.primary,
                onPressed: () {
                  FeedbackUtils.successHaptic();
                  onMarkServed();
                },
              )
            else
              AppButton(
                label: 'Request Table Access',
                icon: LucideIcons.lock,
                variant: ButtonVariant.outline,
                onPressed: onRequestAccess != null
                    ? () {
                        FeedbackUtils.selectionHaptic();
                        onRequestAccess!();
                      }
                    : null,
              ),
          ] else if (order.isPreparing) ...[
            const SizedBox(height: 16),
            AppButton(
              label: 'Check Kitchen Status',
              icon: LucideIcons.chefHat,
              variant: ButtonVariant.outline,
              onPressed: () {
                FeedbackUtils.successHaptic();
                onMarkServed();
              },
            ),
          ],
        ],
      ),
    );
  }
}
