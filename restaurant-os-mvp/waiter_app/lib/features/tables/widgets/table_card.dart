import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../orders/orders_controller.dart';
import '../table_models.dart';

class TableCard extends ConsumerWidget {
  final TableModel table;
  final VoidCallback onTap;
  final VoidCallback? onLongPress;
  final bool isSelected;

  const TableCard({
    super.key,
    required this.table,
    required this.onTap,
    this.onLongPress,
    this.isSelected = false,
  });

  Color get _statusColor {
    switch (table.normalizedStatus) {
      case TableStatus.available:
        return AppColors.tableAvailable;
      case TableStatus.occupied:
        return AppColors.tableOccupied;
      case TableStatus.needBill:
        return AppColors.tableNeedBill;
      case TableStatus.dirty:
        return AppColors.tableDirty;
      case TableStatus.onHold:
        return AppColors.tableOnHold;
      case TableStatus.reserved:
        return AppColors.tableReserved;
    }
  }

  String get _formattedDuration {
    final start = table.customerPresentAt ?? table.lastActivityAt;
    if (start == null) return '';
    final diff = DateTime.now().difference(start);
    if (diff.inMinutes < 60) {
      return '${diff.inMinutes.clamp(1, 59)}m';
    } else {
      final hours = diff.inHours;
      final mins = diff.inMinutes % 60;
      return '${hours}h ${mins}m';
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statusColor = _statusColor;
    final isAvailable = table.isAvailable;
    final isNeedBill = table.isNeedBill;
    final isDirty = table.isDirty;
    final duration = _formattedDuration;

    final activeOrders = ref.watch(activeOrdersProvider);
    final orderForTable = activeOrders.where((o) {
      final tNum = table.tableNumber.trim().toLowerCase();
      final tName = table.formattedName.replaceAll('Table ', '').trim().toLowerCase();
      final dispName = (table.displayName ?? '').replaceAll('Table ', '').trim().toLowerCase();
      final oTableId = o.tableId.trim();
      final oTableNum = (o.tableNumber ?? '').trim().toLowerCase();

      return oTableId == table.id ||
          (oTableNum.isNotEmpty && (oTableNum == tNum || oTableNum == tName || oTableNum == dispName)) ||
          (table.mergedGroupId != null && (oTableId == table.mergedGroupId || oTableNum == dispName)) ||
          table.mergedTableIds.contains(oTableId);
    }).firstOrNull;
    final readyItemsCount = orderForTable?.items.where((i) => i.isReady).length ?? 0;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        onLongPress: onLongPress,
        borderRadius: BorderRadius.circular(26),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          decoration: BoxDecoration(
            // Smartphone Outer Chassis
            color: const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(26),
            border: Border.all(
              color: isSelected
                  ? AppColors.primary
                  : (isNeedBill ? AppColors.tableNeedBill : const Color(0xFF334155)),
              width: isSelected ? 2.5 : 1.8,
            ),
          ),
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              // Smartphone Hardware Side Buttons: Left Volume Buttons
              Positioned(
                left: -2.5,
                top: 42,
                child: Container(
                  width: 2.5,
                  height: 14,
                  decoration: BoxDecoration(
                    color: const Color(0xFF475569),
                    borderRadius: BorderRadius.circular(1),
                  ),
                ),
              ),
              Positioned(
                left: -2.5,
                top: 60,
                child: Container(
                  width: 2.5,
                  height: 14,
                  decoration: BoxDecoration(
                    color: const Color(0xFF475569),
                    borderRadius: BorderRadius.circular(1),
                  ),
                ),
              ),
              // Smartphone Hardware Side Button: Right Power Button
              Positioned(
                right: -2.5,
                top: 50,
                child: Container(
                  width: 2.5,
                  height: 18,
                  decoration: BoxDecoration(
                    color: const Color(0xFF475569),
                    borderRadius: BorderRadius.circular(1),
                  ),
                ),
              ),

              // Smartphone Inner Screen Display
              Container(
                margin: const EdgeInsets.all(4.5),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(21),
                  color: AppColors.surface,
                  border: Border.all(
                    color: statusColor.withValues(alpha: 0.3),
                    width: 1,
                  ),
                ),
                child: Column(
                  children: [
                    // 1. Top Dynamic Island Notch
                    Container(
                      padding: const EdgeInsets.only(top: 5, bottom: 4),
                      child: Center(
                        child: Container(
                          width: 46,
                          height: 8,
                          padding: const EdgeInsets.symmetric(horizontal: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFF020617),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: const Color(0xFF1E293B), width: 0.8),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              // Mini Camera Lens
                              Container(
                                width: 3.5,
                                height: 3.5,
                                decoration: const BoxDecoration(
                                  color: Color(0xFF334155),
                                  shape: BoxShape.circle,
                                ),
                              ),
                              // Live Table Status Dot inside Dynamic Island
                              Container(
                                width: 4,
                                height: 4,
                                decoration: BoxDecoration(
                                  color: statusColor,
                                  shape: BoxShape.circle,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),

                    // 2. Screen Content Body
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(10, 2, 10, 6),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            // Top Row: Table Name + Capacity Pill / Selection
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              crossAxisAlignment: CrossAxisAlignment.center,
                              children: [
                                Expanded(
                                  child: Row(
                                    children: [
                                      Flexible(
                                        child: Text(
                                          table.formattedName,
                                          style: AppTypography.headingMedium.copyWith(
                                            color: isSelected ? AppColors.primary : AppColors.textPrimary,
                                            fontWeight: FontWeight.w900,
                                            fontSize: table.formattedName.length > 9 ? 13.5 : 15.5,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      if (table.displayName?.contains('Pinned') == true) ...[
                                        const SizedBox(width: 3),
                                        const Icon(LucideIcons.pin, size: 10, color: AppColors.primary),
                                      ],
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 4),
                                if (isSelected) ...[
                                  Container(
                                    padding: const EdgeInsets.all(3.5),
                                    decoration: const BoxDecoration(
                                      color: AppColors.primary,
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(
                                      Icons.check_rounded,
                                      size: 11,
                                      color: Colors.white,
                                    ),
                                  ),
                                ] else ...[
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: AppColors.surfaceContainerHighest,
                                      borderRadius: BorderRadius.circular(6),
                                      border: Border.all(color: AppColors.borderVariant, width: 0.8),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        const Icon(LucideIcons.users, size: 10, color: AppColors.textSecondary),
                                        const SizedBox(width: 2.5),
                                        Text(
                                          '${table.capacity}',
                                          style: AppTypography.bodySmall.copyWith(
                                            color: AppColors.textSecondary,
                                            fontWeight: FontWeight.w800,
                                            fontSize: 10,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ],
                            ),

                            // Ready Dishes Indicator
                            if (readyItemsCount > 0) ...[
                              Align(
                                alignment: Alignment.centerLeft,
                                child: Container(
                                  margin: const EdgeInsets.only(top: 2),
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    gradient: const LinearGradient(
                                      colors: [Color(0xFF10B981), Color(0xFF059669)],
                                    ),
                                    borderRadius: BorderRadius.circular(6),
                                    boxShadow: [
                                      BoxShadow(
                                        color: const Color(0xFF10B981).withValues(alpha: 0.35),
                                        blurRadius: 6,
                                        offset: const Offset(0, 2),
                                      ),
                                    ],
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Icon(LucideIcons.chefHat, size: 9, color: Colors.white),
                                      const SizedBox(width: 3),
                                      Text(
                                        '$readyItemsCount Ready to Serve',
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 9,
                                          fontWeight: FontWeight.w900,
                                          letterSpacing: 0.2,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],

                            // Merged Indicator if merged
                            if (table.isMerged) ...[
                              Align(
                                alignment: Alignment.centerLeft,
                                child: Container(
                                  margin: const EdgeInsets.only(top: 2),
                                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                                  decoration: BoxDecoration(
                                    color: AppColors.primaryContainer,
                                    borderRadius: BorderRadius.circular(4),
                                    border: Border.all(
                                      color: AppColors.primary.withValues(alpha: 0.3),
                                      width: 0.8,
                                    ),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Icon(LucideIcons.link2, size: 9, color: AppColors.primary),
                                      const SizedBox(width: 2),
                                      Text(
                                        'Merged',
                                        style: TextStyle(
                                          color: AppColors.primary,
                                          fontSize: 9,
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],

                            // Middle: Live Activity / Waiter Assignment Card
                            Center(
                              child: Builder(
                                builder: (context) {
                                  final isTransferred = table.isTransferred;
                                  final hasCoWaiters = table.hasCoWaiters && table.coWaiterNames != null && table.coWaiterNames!.trim().isNotEmpty;
                                  final hasAssigned = table.assignedWaiterName != null && table.assignedWaiterName!.trim().isNotEmpty;

                                  String waiterText;
                                  IconData waiterIcon;
                                  if (isTransferred) {
                                    final fromName = table.transferredFromWaiterName ?? 'Waiter';
                                    final toName = table.transferredToWaiterName ?? table.assignedWaiterName ?? 'Waiter';
                                    waiterText = '$fromName ➔ $toName';
                                    waiterIcon = LucideIcons.arrowRightLeft;
                                  } else if (hasCoWaiters) {
                                    waiterText = '$hasAssigned ? "${table.assignedWaiterName} & ${table.coWaiterNames}" : table.coWaiterNames!';
                                    if (hasAssigned) {
                                      waiterText = '${table.assignedWaiterName} & ${table.coWaiterNames}';
                                    } else {
                                      waiterText = table.coWaiterNames!;
                                    }
                                    waiterIcon = LucideIcons.users;
                                  } else if (hasAssigned) {
                                    waiterText = table.assignedWaiterName!;
                                    waiterIcon = LucideIcons.userCheck;
                                  } else {
                                    waiterText = isAvailable ? 'Scan Ready' : 'In Service';
                                    waiterIcon = isAvailable ? LucideIcons.qrCode : LucideIcons.utensils;
                                  }

                                  final hasCustomWaiter = isTransferred || hasCoWaiters || hasAssigned;

                                  return Container(
                                    margin: const EdgeInsets.symmetric(vertical: 2),
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: hasCustomWaiter
                                          ? (isTransferred
                                              ? const Color(0xFFFDF2F8)
                                              : (hasCoWaiters ? const Color(0xFFEEF2FF) : AppColors.primaryContainer.withValues(alpha: 0.85)))
                                          : statusColor.withValues(alpha: 0.08),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(
                                        color: hasCustomWaiter
                                            ? (isTransferred
                                                ? const Color(0xFFF472B6)
                                                : (hasCoWaiters ? const Color(0xFF818CF8) : AppColors.primary.withValues(alpha: 0.35)))
                                            : statusColor.withValues(alpha: 0.25),
                                        width: 0.8,
                                      ),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        if (table.assignedWaiterAvatar != null && table.assignedWaiterAvatar!.isNotEmpty && !isTransferred && !hasCoWaiters) ...[
                                          ClipRRect(
                                            borderRadius: BorderRadius.circular(10),
                                            child: CachedNetworkImage(
                                              imageUrl: table.assignedWaiterAvatar!,
                                              width: 14,
                                              height: 14,
                                              fit: BoxFit.cover,
                                              placeholder: (_, __) => const Icon(LucideIcons.userCheck, size: 11, color: AppColors.primary),
                                              errorWidget: (_, __, ___) => const Icon(LucideIcons.userCheck, size: 11, color: AppColors.primary),
                                            ),
                                          ),
                                          const SizedBox(width: 4),
                                        ] else ...[
                                          Icon(
                                            waiterIcon,
                                            size: 11,
                                            color: hasCustomWaiter
                                                ? (isTransferred ? const Color(0xFFDB2777) : (hasCoWaiters ? const Color(0xFF4F46E5) : AppColors.primary))
                                                : statusColor,
                                          ),
                                          const SizedBox(width: 4),
                                        ],
                                        Flexible(
                                          child: Text(
                                            waiterText,
                                            style: AppTypography.labelSmall.copyWith(
                                              color: hasCustomWaiter
                                                  ? (isTransferred ? const Color(0xFF9D174D) : (hasCoWaiters ? const Color(0xFF312E81) : AppColors.primary))
                                                  : statusColor,
                                              fontWeight: FontWeight.w800,
                                              fontSize: 10,
                                            ),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                      ],
                                    ),
                                  );
                                },
                              ),
                            ),

                            // Bottom Row: Duration + Status Badge
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                              decoration: BoxDecoration(
                                color: statusColor.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                  color: statusColor.withValues(alpha: 0.3),
                                  width: 0.8,
                                ),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Container(
                                        width: 6,
                                        height: 6,
                                        decoration: BoxDecoration(
                                          color: statusColor,
                                          shape: BoxShape.circle,
                                        ),
                                      ),
                                      const SizedBox(width: 4),
                                      Text(
                                        isAvailable
                                            ? 'Available'
                                            : isNeedBill
                                                ? 'Need Bill'
                                                : isDirty
                                                    ? 'Dirty'
                                                    : table.statusLabel,
                                        style: TextStyle(
                                          color: statusColor,
                                          fontWeight: FontWeight.w800,
                                          fontSize: 11,
                                        ),
                                      ),
                                    ],
                                  ),
                                  if (duration.isNotEmpty && !isAvailable)
                                    Text(
                                      duration,
                                      style: TextStyle(
                                        color: statusColor,
                                        fontWeight: FontWeight.w900,
                                        fontSize: 11,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                    // 3. Bottom Smartphone Home Indicator Bar
                    Container(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Center(
                        child: Container(
                          width: 32,
                          height: 3,
                          decoration: BoxDecoration(
                            color: const Color(0xFF64748B),
                            borderRadius: BorderRadius.circular(2),
                          ),
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
