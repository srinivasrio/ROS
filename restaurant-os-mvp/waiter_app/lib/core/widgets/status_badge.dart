import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';

class StatusBadge extends StatelessWidget {
  final String status;
  final bool compact;

  const StatusBadge({
    super.key,
    required this.status,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    Color fgColor;
    String label;

    switch (status.toLowerCase().replaceAll(' ', '_')) {
      case 'ready':
        fgColor = AppColors.tableAvailable;
        label = 'Ready';
        break;
      case 'cooking':
      case 'preparing':
      case 'placed':
        fgColor = AppColors.tableOccupied;
        label = 'Preparing';
        break;
      case 'eating':
      case 'occupied':
        fgColor = AppColors.tableOccupied;
        label = 'Occupied';
        break;
      case 'on_hold':
      case 'customer_present':
        fgColor = AppColors.tableOnHold;
        label = 'On Hold';
        break;
      case 'bill_requested':
      case 'need_bill':
      case 'billing':
        fgColor = AppColors.tableNeedBill;
        label = 'Need Bill';
        break;
      case 'dirty':
      case 'cleaning':
        fgColor = AppColors.tableDirty;
        label = 'Dirty';
        break;
      case 'served':
      case 'finished':
        fgColor = AppColors.tableAvailable;
        label = 'Served';
        break;
      case 'cancelled':
        fgColor = AppColors.error;
        label = 'Cancelled';
        break;
      case 'empty':
      case 'free':
      case 'available':
      default:
        fgColor = AppColors.tableAvailable;
        label = 'Available';
        break;
    }

    final bgColor = fgColor.withValues(alpha: 0.15);
    final borderColor = fgColor.withValues(alpha: 0.4);

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 8 : 10,
        vertical: compact ? 3 : 5,
      ),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: borderColor, width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: compact ? 6 : 7,
            height: compact ? 6 : 7,
            decoration: BoxDecoration(
              color: fgColor,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: AppTypography.labelSmall.copyWith(
              color: fgColor,
              fontWeight: FontWeight.w800,
              fontSize: compact ? 10 : 11,
            ),
          ),
        ],
      ),
    );
  }
}
