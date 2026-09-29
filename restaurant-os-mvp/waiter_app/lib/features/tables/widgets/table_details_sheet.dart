import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../../core/storage/secure_storage_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/feedback_utils.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_button.dart';
import '../../auth/auth_controller.dart';
import '../../cart/cart_controller.dart';
import '../../menu/menu_screen.dart';
import '../../orders/order_models.dart';
import '../../orders/orders_controller.dart';
import '../../requests/requests_controller.dart';
import '../table_models.dart';
import '../tables_controller.dart';
import 'give_table_access_sheet.dart';
import 'merge_tables_sheet.dart';
import 'table_bill_sheet.dart';

class TableDetailsSheet extends ConsumerStatefulWidget {
  final TableModel table;

  const TableDetailsSheet({
    super.key,
    required this.table,
  });

  @override
  ConsumerState<TableDetailsSheet> createState() => _TableDetailsSheetState();
}

class _TableDetailsSheetState extends ConsumerState<TableDetailsSheet> {
  bool _isActionLoading = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final session = ref.read(authControllerProvider).session;
      final restaurantId = session?.restaurantId ?? '202603180001';
      ref.read(ordersControllerProvider.notifier).loadOrders(silent: true, restaurantId: restaurantId);
    });
  }

  void _navigateToAddItems({TableModel? table, bool canManage = true}) {
    final targetTable = table ?? widget.table;
    if (!canManage) {
      FeedbackUtils.showToast(
        context,
        message: 'Only assigned waiter can manage Table ${targetTable.tableNumber}. Please send a table access request first.',
        isError: true,
      );
      return;
    }
    ref.read(selectedTableProvider.notifier).state = targetTable;
    ref.read(cartProviderFamily(targetTable.id).notifier).setTable(targetTable.id, targetTable.tableNumber);
    Navigator.of(context).pop();
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => MenuScreen(table: targetTable)),
    );
  }

  void _openMergeSheet() {
    FeedbackUtils.selectionHaptic();
    Navigator.of(context).pop();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => MergeTablesSheet(initialTable: widget.table),
    );
  }

  Future<void> _handleUnmerge() async {
    final mergeGroupId = widget.table.mergedGroupId;
    if (mergeGroupId == null) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(
          'Unmerge Tables?',
          style: AppTypography.headingSmall.copyWith(fontWeight: FontWeight.w800),
        ),
        content: Text(
          'This will split the merged table group back into separate individual tables.',
          style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text('Cancel', style: TextStyle(color: AppColors.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Unmerge', style: TextStyle(fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _isActionLoading = true);
    try {
      await ref.read(tablesControllerProvider.notifier).unmergeTables(mergeGroupId);
      FeedbackUtils.successHaptic();
      if (!mounted) return;
      FeedbackUtils.showToast(context, message: 'Table group unmerged successfully');
      Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      FeedbackUtils.showToast(context, message: 'Failed to unmerge tables', isError: true);
    } finally {
      if (mounted) setState(() => _isActionLoading = false);
    }
  }

  Future<void> _handleRequestBill({OrderModel? order}) async {
    final session = ref.read(authControllerProvider).session;
    if (session == null) return;

    final currentTable = ref.read(tablesControllerProvider).tables.firstWhere(
      (t) => t.id == widget.table.id,
      orElse: () => widget.table,
    );

    final activeOrder = order ?? ref.read(activeOrdersProvider).where((o) {
      final matchId = o.tableId == currentTable.id.toString();
      final matchNumber = o.tableNumber != null &&
          (o.tableNumber == currentTable.tableNumber ||
              o.tableNumber == currentTable.formattedName.replaceAll('Table ', ''));
      final matchGroup = currentTable.mergedGroupId != null &&
          (o.tableId == currentTable.mergedGroupId || currentTable.mergedGroupId == o.tableId);
      return matchId || matchNumber || matchGroup;
    }).firstOrNull;

    setState(() => _isActionLoading = true);
    try {
      await ref.read(tablesControllerProvider.notifier).updateTableStatus(
        widget.table.id,
        session.restaurantId,
        'need_bill',
      );
      FeedbackUtils.successHaptic();
      if (!mounted) return;

      Navigator.of(context).pop();
      TableBillSheet.show(
        context,
        table: currentTable,
        order: activeOrder,
      );
    } catch (e) {
      if (!mounted) return;
      FeedbackUtils.showToast(context, message: 'Failed to request bill: $e', isError: true);
    } finally {
      if (mounted) setState(() => _isActionLoading = false);
    }
  }

  Future<void> _handleClearTable() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(LucideIcons.trash2, color: AppColors.error, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Clear ${widget.table.formattedName}?',
                style: AppTypography.headingSmall.copyWith(
                  fontWeight: FontWeight.w800,
                  fontSize: 18,
                ),
              ),
            ),
          ],
        ),
        content: Text(
          'Are you sure you want to clear this table? This will complete all active orders and mark the table as Available.',
          style: AppTypography.bodyMedium.copyWith(
            color: AppColors.textSecondary,
          ),
        ),
        actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: Text(
              'Cancel',
              style: AppTypography.labelLarge.copyWith(
                color: AppColors.textSecondary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
              elevation: 0,
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: Text(
              'Clear Table',
              style: AppTypography.labelLarge.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    final session = ref.read(authControllerProvider).session;
    if (session == null) return;

    setState(() => _isActionLoading = true);
    try {
      await ref.read(tablesControllerProvider.notifier).updateTableStatus(
        widget.table.id,
        session.restaurantId,
        'empty',
      );
      ref.read(tablesControllerProvider.notifier).loadTables(session.restaurantId);
      ref.read(ordersControllerProvider.notifier).loadOrders(silent: true, restaurantId: session.restaurantId);
      FeedbackUtils.successHaptic();
      if (!mounted) return;
      FeedbackUtils.showToast(context, message: 'Table ${widget.table.tableNumber} is now marked Available');
      Navigator.of(context).pop();
    } catch (e) {
      debugPrint('[TableDetailsSheet] Error clearing table: $e');
      if (!mounted) return;
      FeedbackUtils.showToast(context, message: 'Failed to clear table: $e', isError: true);
    } finally {
      if (mounted) setState(() => _isActionLoading = false);
    }
  }

  Future<void> _handleRequestTableAccess(BuildContext context) async {
    final session = ref.read(authControllerProvider).session;
    if (session == null) return;

    final currentTable = ref.read(tablesControllerProvider).tables.firstWhere(
      (t) => t.id == widget.table.id,
      orElse: () => widget.table,
    );
    final activeOrders = ref.read(activeOrdersProvider);
    final activeOrder = activeOrders.where((o) {
      final matchId = o.tableId == currentTable.id.toString();
      final matchNumber = o.tableNumber != null && (o.tableNumber == currentTable.tableNumber || o.tableNumber == currentTable.formattedName.replaceAll('Table ', ''));
      final matchGroup = currentTable.mergedGroupId != null && (o.tableId == currentTable.mergedGroupId || currentTable.mergedGroupId == o.tableId);
      return matchId || matchNumber || matchGroup;
    }).firstOrNull;

    final waiterName = currentTable.assignedWaiterName ?? activeOrder?.waiterName ?? 'assigned waiter';
    FeedbackUtils.selectionHaptic();

    try {
      await ref.read(requestsControllerProvider.notifier).requestTableAccess(
        tableId: currentTable.id.toString(),
        requesterId: session.userId,
        requesterName: session.name,
        restaurantId: session.restaurantId,
      );
      if (mounted) {
        FeedbackUtils.showToast(
          context,
          message: 'Access request sent to $waiterName and Admin!',
        );
      }
    } catch (e) {
      debugPrint('[TableDetailsSheet] Error requesting table access: $e');
      if (mounted) {
        FeedbackUtils.showToast(
          context,
          message: 'Failed to send request: $e',
          isError: true,
        );
      }
    }
  }

  bool _isTableAssignedToMe(TableModel table, OrderModel? order, SessionData? session) {
    if (session == null) return false;

    // Direct identifier matches (UUID, employee code, mobile)
    final userIdentifiers = <String>{
      if (session.userId != null && session.userId!.trim().isNotEmpty)
        session.userId!.trim().toLowerCase(),
      if (session.employeeId != null && session.employeeId!.trim().isNotEmpty)
        session.employeeId!.trim().toLowerCase(),
      if (session.mobile != null && session.mobile!.trim().isNotEmpty)
        session.mobile!.trim().toLowerCase(),
    };

    final userName = session.name.trim().toLowerCase();

    // 1. Table assignment is authoritative
    final tableAssignedId = table.assignedWaiterId?.trim().toLowerCase();
    final tableName = table.assignedWaiterName?.trim().toLowerCase();

    if (tableAssignedId != null && tableAssignedId.isNotEmpty) {
      return userIdentifiers.contains(tableAssignedId);
    }
    if (tableName != null && tableName.isNotEmpty && userName.isNotEmpty) {
      return tableName == userName;
    }

    // 2. Only fallback to order waiter if table has no assigned waiter
    final orderAssignedId = order?.waiterId?.trim().toLowerCase();
    final orderName = order?.waiterName?.trim().toLowerCase();

    if (orderAssignedId != null && orderAssignedId.isNotEmpty) {
      return userIdentifiers.contains(orderAssignedId);
    }
    if (orderName != null && orderName.isNotEmpty && userName.isNotEmpty) {
      return orderName == userName;
    }

    return false;
  }

  Color _getStatusAccentColor() {
    switch (widget.table.normalizedStatus) {
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

  @override
  Widget build(BuildContext context) {
    final allTables = ref.watch(tablesControllerProvider).tables;
    final currentTable = allTables.firstWhere(
      (t) => t.id == widget.table.id,
      orElse: () => widget.table,
    );

    final orders = ref.watch(activeOrdersProvider);
    final activeOrder = orders.where((o) {
      final matchId = o.tableId == currentTable.id;
      final matchNumber = o.tableNumber != null && (o.tableNumber == currentTable.tableNumber || o.tableNumber == currentTable.formattedName.replaceAll('Table ', ''));
      final matchGroup = currentTable.mergedGroupId != null && (o.tableId == currentTable.mergedGroupId || currentTable.mergedGroupId == o.tableId);
      return matchId || matchNumber || matchGroup;
    }).firstOrNull;

    final isOccupied = currentTable.isOccupied;
    final isNeedBill = currentTable.isNeedBill;
    final isDirty = currentTable.isDirty;
    final isMerged = currentTable.isMerged;
    final statusColor = _getStatusAccentColor();

    final currentUser = ref.watch(authControllerProvider).session;
    final currentUserId = currentUser?.userId ?? currentUser?.employeeId;
    final role = currentUser?.role?.toLowerCase() ?? '';
    final isAdmin = role == 'admin' || role == 'supervisor' || role == 'restaurant_admin';
    final isAssignedToMe = _isTableAssignedToMe(currentTable, activeOrder, currentUser);
    final isCoWaiter = currentUserId != null && currentTable.coWaiterIds.any((cw) => cw.trim().toLowerCase() == currentUserId.trim().toLowerCase());

    final hasAssignedWaiter = (currentTable.assignedWaiterId != null && currentTable.assignedWaiterId!.trim().isNotEmpty) ||
        (currentTable.assignedWaiterName != null && currentTable.assignedWaiterName!.trim().isNotEmpty);

    final canManageTable = isAdmin || isAssignedToMe || isCoWaiter || (!hasAssignedWaiter && currentTable.isWaiterAuthorized(currentUserId));

    final hasOrderedItems = (activeOrder != null && activeOrder.items.isNotEmpty) ||
        currentTable.activeItemCount > 0 ||
        (currentTable.activeOrderTotal != null && currentTable.activeOrderTotal! > 0);

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(top: BorderSide(color: AppColors.border, width: 1.5)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Handle bar
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 12, bottom: 8),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.borderVariant,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),

            // Sheet Header
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
              child: Row(
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: statusColor.withValues(alpha: 0.4), width: 1.5),
                    ),
                    child: Center(
                      child: Text(
                        widget.table.tableNumber,
                        style: AppTypography.headingLarge.copyWith(
                          color: statusColor,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              widget.table.formattedName,
                              style: AppTypography.headingMedium.copyWith(
                                color: AppColors.textPrimary,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            if (widget.table.areaName != null) ...[
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: AppColors.surfaceContainerHigh,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  widget.table.areaName!,
                                  style: AppTypography.labelSmall.copyWith(
                                    color: AppColors.textSecondary,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${widget.table.capacity} Seats • Status: ${widget.table.statusLabel}',
                          style: AppTypography.bodySmall.copyWith(
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Status Pill
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: statusColor.withValues(alpha: 0.4), width: 1),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: statusColor,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          widget.table.statusLabel,
                          style: AppTypography.labelSmall.copyWith(
                            color: statusColor,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  InkWell(
                    onTap: () {
                      FeedbackUtils.selectionHaptic();
                      Navigator.of(context).pop();
                    },
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceContainerHigh,
                        shape: BoxShape.circle,
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Icon(LucideIcons.x, size: 16, color: AppColors.textSecondary),
                    ),
                  ),
                ],
              ),
            ),

            // Assigned Waiter Banner
            Builder(
              builder: (context) {
                final isTransferred = currentTable.isTransferred;
                final rawAssignedName = (currentTable.assignedWaiterName != null && currentTable.assignedWaiterName!.trim().isNotEmpty)
                    ? currentTable.assignedWaiterName!.trim()
                    : (activeOrder?.waiterName != null && activeOrder!.waiterName!.trim().isNotEmpty)
                        ? activeOrder!.waiterName!.trim()
                        : null;
                final assignedWaiterAvatar = currentTable.assignedWaiterAvatar;
                final currentUser = ref.watch(authControllerProvider).session;
                final currentUserId = currentUser?.userId ?? currentUser?.employeeId;
                final role = currentUser?.role?.toLowerCase() ?? '';
                final isAdmin = role == 'admin' || role == 'supervisor' || role == 'restaurant_admin';
                final isAssignedToMe = _isTableAssignedToMe(currentTable, activeOrder, currentUser);
                final isCoWaiter = currentUserId != null && currentTable.coWaiterIds.any((cw) => cw.trim().toLowerCase() == currentUserId.trim().toLowerCase());
                final hasAssignedWaiter = (currentTable.assignedWaiterId != null && currentTable.assignedWaiterId!.trim().isNotEmpty) ||
                    (currentTable.assignedWaiterName != null && currentTable.assignedWaiterName!.trim().isNotEmpty);

                final canManageTable = isAdmin || isAssignedToMe || isCoWaiter || (!hasAssignedWaiter && currentTable.isWaiterAuthorized(currentUserId));

                final requests = ref.watch(requestsControllerProvider).requests;
                final hasPendingAccessRequest = requests.any((r) =>
                  r.tableId == currentTable.id.toString() &&
                  r.requestType == 'table_access_request' &&
                  r.isPending
                );

                final hasOrderedItems = (activeOrder != null && activeOrder.items.isNotEmpty) ||
                    currentTable.activeItemCount > 0 ||
                    (currentTable.activeOrderTotal != null && currentTable.activeOrderTotal! > 0);

                // Clean Co-Waiter Names: filter out primary assigned waiter name so it's never duplicated
                List<String> distinctCoWaiters = [];
                if (currentTable.coWaiterNames != null && currentTable.coWaiterNames!.trim().isNotEmpty) {
                  final splitNames = currentTable.coWaiterNames!.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList();
                  for (final name in splitNames) {
                    if (rawAssignedName == null || name.toLowerCase() != rawAssignedName.toLowerCase()) {
                      if (!distinctCoWaiters.contains(name)) {
                        distinctCoWaiters.add(name);
                      }
                    }
                  }
                }
                final hasDistinctCoWaiters = currentTable.hasCoWaiters && distinctCoWaiters.isNotEmpty;
                final coWaitersDisplayName = distinctCoWaiters.join(', ');

                // 1. TRANSFERRED TABLE BANNER
                if (isTransferred) {
                  final fromName = currentTable.transferredFromWaiterName ?? 'Waiter';
                  final toName = currentTable.transferredToWaiterName ?? rawAssignedName ?? 'Waiter';

                  return Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: double.infinity,
                        margin: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFDF2F8),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: const Color(0xFFF472B6).withValues(alpha: 0.6),
                            width: 1.5,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFFDB2777).withValues(alpha: 0.08),
                              blurRadius: 10,
                              offset: const Offset(0, 3),
                            ),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFDB2777),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: const Text(
                                        'TABLE TRANSFERRED',
                                        style: TextStyle(
                                          color: Colors.white,
                                          fontWeight: FontWeight.w900,
                                          fontSize: 9.5,
                                          letterSpacing: 0.8,
                                        ),
                                      ),
                                    ),
                                    if (isAssignedToMe) ...[
                                      const SizedBox(width: 6),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2.5),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFBE185D).withValues(alpha: 0.15),
                                          borderRadius: BorderRadius.circular(6),
                                          border: Border.all(color: const Color(0xFFDB2777), width: 0.8),
                                        ),
                                        child: const Text(
                                          'YOU (NEW OWNER)',
                                          style: TextStyle(
                                            color: Color(0xFF831843),
                                            fontWeight: FontWeight.w900,
                                            fontSize: 8.5,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),

                            // Waiter breakdown
                            Row(
                              children: [
                                Expanded(
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(color: const Color(0xFFFBCFE8), width: 1),
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        const Text(
                                          'ORIGINAL ASSIGNED',
                                          style: TextStyle(
                                            color: Color(0xFFBE185D),
                                            fontSize: 8.5,
                                            fontWeight: FontWeight.w900,
                                            letterSpacing: 0.5,
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          fromName,
                                          style: const TextStyle(
                                            color: Color(0xFF831843),
                                            fontSize: 13,
                                            fontWeight: FontWeight.w900,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(color: const Color(0xFFFBCFE8), width: 1),
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        const Text(
                                          'TRANSFERRED TO',
                                          style: TextStyle(
                                            color: Color(0xFF9D174D),
                                            fontSize: 8.5,
                                            fontWeight: FontWeight.w900,
                                            letterSpacing: 0.5,
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          toName,
                                          style: const TextStyle(
                                            color: Color(0xFF500724),
                                            fontSize: 13,
                                            fontWeight: FontWeight.w900,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Only $toName or an Admin can manage Table ${currentTable.tableNumber}.',
                              style: const TextStyle(
                                color: Color(0xFF9D174D),
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (!canManageTable) ...[
                        Container(
                          width: double.infinity,
                          margin: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: const Color(0xFFCBD5E1), width: 1.2),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Icon(LucideIcons.lock, size: 16, color: Color(0xFF64748B)),
                                  const SizedBox(width: 8),
                                  Text(
                                    'TABLE LOCKED FOR OTHER WAITERS',
                                    style: AppTypography.labelSmall.copyWith(
                                      color: const Color(0xFF475569),
                                      fontWeight: FontWeight.w900,
                                      letterSpacing: 0.8,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(
                                'This table was transferred to $toName. Only $toName or an Admin can manage and place orders for Table ${widget.table.tableNumber}.',
                                style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B), height: 1.3),
                              ),
                              const SizedBox(height: 12),
                              SizedBox(
                                width: double.infinity,
                                child: AppButton(
                                  label: hasPendingAccessRequest ? 'Handover Request Pending...' : 'Request Table Access',
                                  icon: hasPendingAccessRequest ? LucideIcons.clock : LucideIcons.arrowRightLeft,
                                  variant: hasPendingAccessRequest ? ButtonVariant.secondary : ButtonVariant.primary,
                                  onPressed: hasPendingAccessRequest ? null : () => _handleRequestTableAccess(context),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  );
                }

                // 2. CO-MANAGED TABLE BANNER
                if (hasDistinctCoWaiters) {
                  final primaryName = rawAssignedName ?? 'Assigned Waiter';

                  return Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: double.infinity,
                        margin: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEEF2FF),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: const Color(0xFF818CF8).withValues(alpha: 0.6),
                            width: 1.5,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF4F46E5).withValues(alpha: 0.08),
                              blurRadius: 10,
                              offset: const Offset(0, 3),
                            ),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF4F46E5),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: const Text(
                                        'CO-MANAGED TABLE',
                                        style: TextStyle(
                                          color: Colors.white,
                                          fontWeight: FontWeight.w900,
                                          fontSize: 9.5,
                                          letterSpacing: 0.8,
                                        ),
                                      ),
                                    ),
                                    if (isAssignedToMe || isCoWaiter) ...[
                                      const SizedBox(width: 6),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2.5),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFF4338CA).withValues(alpha: 0.15),
                                          borderRadius: BorderRadius.circular(6),
                                          border: Border.all(color: const Color(0xFF4F46E5), width: 0.8),
                                        ),
                                        child: Text(
                                          isAssignedToMe ? 'YOU (ORIGINAL OWNER)' : 'YOU (CO-WAITER)',
                                          style: const TextStyle(
                                            color: Color(0xFF312E81),
                                            fontWeight: FontWeight.w900,
                                            fontSize: 8.5,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),

                            // Waiter breakdown
                            Row(
                              children: [
                                Expanded(
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(color: const Color(0xFFC7D2FE), width: 1),
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        const Text(
                                          'ORIGINAL ASSIGNED',
                                          style: TextStyle(
                                            color: Color(0xFF6366F1),
                                            fontSize: 8.5,
                                            fontWeight: FontWeight.w900,
                                            letterSpacing: 0.5,
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          primaryName,
                                          style: const TextStyle(
                                            color: Color(0xFF1E1B4B),
                                            fontSize: 13,
                                            fontWeight: FontWeight.w900,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(color: const Color(0xFFC7D2FE), width: 1),
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        const Text(
                                          'NEW ASSIGNED',
                                          style: TextStyle(
                                            color: Color(0xFF4F46E5),
                                            fontSize: 8.5,
                                            fontWeight: FontWeight.w900,
                                            letterSpacing: 0.5,
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          coWaitersDisplayName,
                                          style: const TextStyle(
                                            color: Color(0xFF312E81),
                                            fontSize: 13,
                                            fontWeight: FontWeight.w900,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              'Both waiters can add items, place orders, and manage this table.',
                              style: TextStyle(
                                color: Color(0xFF4338CA),
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (!canManageTable) ...[
                        Container(
                          width: double.infinity,
                          margin: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: const Color(0xFFCBD5E1), width: 1.2),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Icon(LucideIcons.lock, size: 16, color: Color(0xFF64748B)),
                                  const SizedBox(width: 8),
                                  Text(
                                    'TABLE LOCKED FOR OTHER WAITERS',
                                    style: AppTypography.labelSmall.copyWith(
                                      color: const Color(0xFF475569),
                                      fontWeight: FontWeight.w900,
                                      letterSpacing: 0.8,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(
                                'Only $primaryName, $coWaitersDisplayName, or an Admin can manage Table ${currentTable.tableNumber}.',
                                style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B), height: 1.3),
                              ),
                              const SizedBox(height: 12),
                              SizedBox(
                                width: double.infinity,
                                child: AppButton(
                                  label: hasPendingAccessRequest ? 'Handover Request Pending...' : 'Request Table Access',
                                  icon: hasPendingAccessRequest ? LucideIcons.clock : LucideIcons.arrowRightLeft,
                                  variant: hasPendingAccessRequest ? ButtonVariant.secondary : ButtonVariant.primary,
                                  onPressed: hasPendingAccessRequest ? null : () => _handleRequestTableAccess(context),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  );
                }

                // 3. SINGLE ASSIGNED WAITER BANNER
                if (rawAssignedName != null && rawAssignedName.trim().isNotEmpty) {
                  return Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: double.infinity,
                        margin: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        decoration: BoxDecoration(
                          color: isAssignedToMe ? const Color(0xFFECFDF5) : const Color(0xFFEFF6FF),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: isAssignedToMe ? const Color(0xFF10B981).withValues(alpha: 0.5) : const Color(0xFF3B82F6).withValues(alpha: 0.5),
                            width: 1.5,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: (isAssignedToMe ? const Color(0xFF10B981) : const Color(0xFF3B82F6)).withValues(alpha: 0.08),
                              blurRadius: 10,
                              offset: const Offset(0, 3),
                            ),
                          ],
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            if (assignedWaiterAvatar != null && assignedWaiterAvatar.isNotEmpty) ...[
                              ClipRRect(
                                borderRadius: BorderRadius.circular(12),
                                child: CachedNetworkImage(
                                  imageUrl: assignedWaiterAvatar,
                                  width: 38,
                                  height: 38,
                                  fit: BoxFit.cover,
                                  placeholder: (_, __) => Container(
                                    width: 38,
                                    height: 38,
                                    color: isAssignedToMe ? const Color(0xFF10B981) : const Color(0xFF3B82F6),
                                    child: Center(
                                      child: Text(
                                        rawAssignedName[0].toUpperCase(),
                                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                                      ),
                                    ),
                                  ),
                                  errorWidget: (_, __, ___) => Container(
                                    width: 38,
                                    height: 38,
                                    color: isAssignedToMe ? const Color(0xFF10B981) : const Color(0xFF3B82F6),
                                    child: Center(
                                      child: Text(
                                        rawAssignedName[0].toUpperCase(),
                                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                            ] else ...[
                              Container(
                                width: 38,
                                height: 38,
                                decoration: BoxDecoration(
                                  color: isAssignedToMe ? const Color(0xFF10B981) : const Color(0xFF3B82F6),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Center(
                                  child: Text(
                                    rawAssignedName[0].toUpperCase(),
                                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                            ],
                            Expanded(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Text(
                                        'ASSIGNED WAITER',
                                        style: AppTypography.labelSmall.copyWith(
                                          color: isAssignedToMe ? const Color(0xFF047857) : const Color(0xFF1D4ED8),
                                          fontWeight: FontWeight.w900,
                                          letterSpacing: 1.2,
                                          fontSize: 9.5,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    rawAssignedName,
                                    style: AppTypography.headingSmall.copyWith(
                                      color: isAssignedToMe ? const Color(0xFF065F46) : const Color(0xFF1E40AF),
                                      fontWeight: FontWeight.w900,
                                      fontSize: 16,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),

                      // Request Table Access Banner if assigned to someone else
                      if (!canManageTable) ...[
                        Container(
                          width: double.infinity,
                          margin: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: const Color(0xFFCBD5E1), width: 1.2),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Icon(LucideIcons.lock, size: 16, color: Color(0xFF64748B)),
                                  const SizedBox(width: 8),
                                  Text(
                                    'TABLE LOCKED FOR OTHER WAITERS',
                                    style: AppTypography.labelSmall.copyWith(
                                      color: const Color(0xFF475569),
                                      fontWeight: FontWeight.w900,
                                      letterSpacing: 0.8,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(
                                'Only $rawAssignedName or an Admin can manage and place orders for Table ${widget.table.tableNumber}.',
                                style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B), height: 1.3),
                              ),
                              const SizedBox(height: 12),
                              SizedBox(
                                width: double.infinity,
                                child: AppButton(
                                  label: hasPendingAccessRequest ? 'Handover Request Pending...' : 'Request Table Access',
                                  icon: hasPendingAccessRequest ? LucideIcons.clock : LucideIcons.arrowRightLeft,
                                  variant: hasPendingAccessRequest ? ButtonVariant.secondary : ButtonVariant.primary,
                                  onPressed: hasPendingAccessRequest ? null : () => _handleRequestTableAccess(context),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  );
                } else if (!canManageTable) {
                  final targetWaiter = rawAssignedName ?? currentTable.assignedWaiterName ?? activeOrder?.waiterName ?? 'Assigned Waiter';
                  return Container(
                    width: double.infinity,
                    margin: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFCBD5E1), width: 1.2),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(LucideIcons.lock, size: 16, color: Color(0xFF64748B)),
                            const SizedBox(width: 8),
                            Text(
                              'TABLE LOCKED FOR OTHER WAITERS',
                              style: AppTypography.labelSmall.copyWith(
                                color: const Color(0xFF475569),
                                fontWeight: FontWeight.w900,
                                letterSpacing: 0.8,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Only $targetWaiter or an Admin can manage and place orders for Table ${currentTable.tableNumber}.',
                          style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B), height: 1.3),
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          child: AppButton(
                            label: hasPendingAccessRequest ? 'Handover Request Pending...' : 'Request Table Access',
                            icon: hasPendingAccessRequest ? LucideIcons.clock : LucideIcons.arrowRightLeft,
                            variant: hasPendingAccessRequest ? ButtonVariant.secondary : ButtonVariant.primary,
                            onPressed: hasPendingAccessRequest ? null : () => _handleRequestTableAccess(context),
                          ),
                        ),
                      ],
                    ),
                  );
                } else if (currentTable.isOccupied) {
                  return Container(
                    width: double.infinity,
                    margin: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceContainerHigh,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppColors.border, width: 1),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(LucideIcons.userX, color: AppColors.textMuted, size: 16),
                        const SizedBox(width: 8),
                        Text(
                          'No Waiter Assigned Yet',
                          style: AppTypography.labelMedium.copyWith(
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  );
                }
                return const SizedBox.shrink();
              },
            ),

            const Divider(color: AppColors.border, height: 1),

            // Merged Table Banner (if table is merged)
            if (isMerged) ...[
              Container(
                margin: const EdgeInsets.fromLTRB(20, 14, 20, 0),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.primaryContainer.withValues(alpha: 0.5),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.primary.withValues(alpha: 0.3), width: 1),
                ),
                child: Row(
                  children: [
                    const Icon(LucideIcons.link2, color: AppColors.primary, size: 22),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Merged Table Group',
                            style: AppTypography.labelMedium.copyWith(
                              color: AppColors.primary,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          Text(
                            'This table is merged with other tables for a group.',
                            style: AppTypography.bodySmall.copyWith(
                              color: AppColors.textSecondary,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ),
                    TextButton.icon(
                      onPressed: _handleUnmerge,
                      icon: const Icon(LucideIcons.unlink, size: 16, color: AppColors.error),
                      label: const Text('Unmerge', style: TextStyle(color: AppColors.error, fontWeight: FontWeight.w800)),
                      style: TextButton.styleFrom(
                        backgroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            // Scrollable Content
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Quick Action Bento Grid
                    Text(
                      'QUICK ACTIONS',
                      style: AppTypography.labelSmall.copyWith(
                        color: AppColors.textSecondary,
                        letterSpacing: 1.1,
                      ),
                    ),
                    const SizedBox(height: 12),

                    Row(
                      children: [
                        if (isAssignedToMe) ...[
                          Expanded(
                            child: _buildBentoActionButton(
                              icon: LucideIcons.userPlus,
                              iconColor: const Color(0xFF4F46E5),
                              label: 'Give Access',
                              onTap: () => GiveTableAccessSheet.show(context, table: currentTable),
                            ),
                          ),
                          const SizedBox(width: 8),
                        ],
                        Expanded(
                          child: _buildBentoActionButton(
                            icon: isMerged ? LucideIcons.unlink : LucideIcons.link2,
                            iconColor: canManageTable ? (isMerged ? AppColors.error : AppColors.secondary) : AppColors.textMuted,
                            label: isMerged ? 'Unmerge' : 'Merge Table',
                            onTap: canManageTable
                                ? (isMerged ? _handleUnmerge : _openMergeSheet)
                                : () => FeedbackUtils.showToast(context, message: 'Only assigned waiter can merge tables', isError: true),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _buildBentoActionButton(
                            icon: LucideIcons.receipt,
                            iconColor: (canManageTable && (isOccupied || isNeedBill || hasOrderedItems))
                                ? (isNeedBill ? AppColors.tableNeedBill : AppColors.veg)
                                : AppColors.textMuted,
                            label: isNeedBill ? 'View Bill' : 'Request Bill',
                            onTap: (canManageTable && (isOccupied || isNeedBill || hasOrderedItems))
                                ? () => _handleRequestBill(order: activeOrder)
                                : () {
                                    if (!canManageTable) {
                                      FeedbackUtils.showToast(context, message: 'Only assigned waiter can request bill', isError: true);
                                    } else {
                                      FeedbackUtils.showToast(context, message: 'No active orders on this table');
                                    }
                                  },
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _buildBentoActionButton(
                            icon: LucideIcons.trash2,
                            iconColor: canManageTable ? AppColors.error : AppColors.textMuted,
                            label: 'Clear Table',
                            onTap: canManageTable
                                ? _handleClearTable
                                : () => FeedbackUtils.showToast(context, message: 'Only assigned waiter can clear table', isError: true),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 24),

                    // Running Order Details
                    if (activeOrder != null && activeOrder.items.isNotEmpty) ...[
                      // Order Items Section Header
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Text(
                                'ACTIVE ORDER ITEMS',
                                style: AppTypography.labelSmall.copyWith(
                                  color: AppColors.textSecondary,
                                  letterSpacing: 1.1,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: AppColors.primaryContainer,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  '${activeOrder.items.length} ${activeOrder.items.length == 1 ? 'item' : 'items'}',
                                  style: AppTypography.labelSmall.copyWith(
                                    color: AppColors.primary,
                                    fontWeight: FontWeight.w800,
                                    fontSize: 10,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          Text(
                            Formatters.formatCurrency(activeOrder.totalAmount),
                            style: AppTypography.headingMedium.copyWith(
                              color: AppColors.primary,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      // If any items are ready to serve, display Serve All button
                      if (activeOrder.items.any((i) => i.isReady)) ...[
                        InkWell(
                          onTap: () async {
                            final currentUser = ref.read(authControllerProvider).session;
                            final currentUserId = currentUser?.userId ?? currentUser?.employeeId;
                            final role = currentUser?.role?.toLowerCase() ?? '';
                            final isAdmin = role == 'admin' || role == 'supervisor' || role == 'restaurant_admin';
                            final assignedWaiterId = widget.table.assignedWaiterId ?? activeOrder.waiterId;
                            final isAssignedToMe = currentUserId != null && (
                              assignedWaiterId != null && assignedWaiterId.trim().isNotEmpty &&
                              assignedWaiterId.trim().toLowerCase() == currentUserId.trim().toLowerCase()
                            );
                            if (!isAssignedToMe && !isAdmin) {
                              FeedbackUtils.showToast(context, message: 'Only assigned waiter or Admin can serve items', isError: true);
                              return;
                            }
                            FeedbackUtils.successHaptic();
                            await ref.read(ordersControllerProvider.notifier).markServed(activeOrder.id, widget.table.id);
                            if (!mounted) return;
                            FeedbackUtils.showToast(context, message: 'All items marked as Served!');
                          },
                          borderRadius: BorderRadius.circular(14),
                          child: Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 14),
                            decoration: BoxDecoration(
                              color: const Color(0xFF10B981),
                              borderRadius: BorderRadius.circular(14),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFF10B981).withValues(alpha: 0.3),
                                  blurRadius: 8,
                                  offset: const Offset(0, 3),
                                ),
                              ],
                            ),
                            child: const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(LucideIcons.checkCheck, color: Colors.white, size: 18),
                                SizedBox(width: 8),
                                Text(
                                  'SERVE ALL READY ITEMS',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w900,
                                    fontSize: 12,
                                    letterSpacing: 0.8,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                      ],

                      // Items List
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: activeOrder.items.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (context, index) {
                          final item = activeOrder.items[index];
                          final isServed = item.isServed;
                          final isReady = item.isReady;

                          return Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: isServed ? AppColors.surfaceContainerHigh.withValues(alpha: 0.5) : AppColors.surfaceContainer,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: isReady
                                    ? const Color(0xFF10B981)
                                    : (isServed ? AppColors.borderVariant : AppColors.border),
                                width: isReady ? 1.5 : 1,
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    // Food Image with Quantity Badge Overlay
                                    Stack(
                                      clipBehavior: Clip.none,
                                      children: [
                                        ClipRRect(
                                          borderRadius: BorderRadius.circular(10),
                                          child: Container(
                                            width: 46,
                                            height: 46,
                                            decoration: BoxDecoration(
                                              color: isReady
                                                  ? const Color(0xFFECFDF5)
                                                  : (isServed ? AppColors.surfaceContainerHighest : AppColors.primaryContainer),
                                              borderRadius: BorderRadius.circular(10),
                                              border: Border.all(
                                                color: isReady ? const Color(0xFF10B981) : AppColors.border,
                                                width: 1,
                                              ),
                                            ),
                                            child: (item.imageUrl != null && item.imageUrl!.isNotEmpty)
                                                ? CachedNetworkImage(
                                                    imageUrl: item.imageUrl!,
                                                    fit: BoxFit.cover,
                                                    placeholder: (_, __) => Container(
                                                      color: AppColors.surfaceContainerHigh,
                                                      child: Center(
                                                        child: Icon(
                                                          LucideIcons.utensils,
                                                          size: 18,
                                                          color: isReady ? const Color(0xFF047857) : AppColors.textMuted,
                                                        ),
                                                      ),
                                                    ),
                                                    errorWidget: (_, __, ___) => Container(
                                                      color: AppColors.surfaceContainerHigh,
                                                      child: Center(
                                                        child: Icon(
                                                          LucideIcons.utensils,
                                                          size: 18,
                                                          color: isReady ? const Color(0xFF047857) : AppColors.textMuted,
                                                        ),
                                                      ),
                                                    ),
                                                  )
                                                : Center(
                                                    child: Icon(
                                                      LucideIcons.utensils,
                                                      size: 20,
                                                      color: isReady ? const Color(0xFF047857) : AppColors.primary,
                                                    ),
                                                  ),
                                          ),
                                        ),
                                        // Quantity Badge Overlay
                                        Positioned(
                                          left: -4,
                                          top: -4,
                                          child: Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                                            decoration: BoxDecoration(
                                              color: isReady
                                                  ? const Color(0xFF10B981)
                                                  : (isServed ? const Color(0xFF64748B) : AppColors.primary),
                                              borderRadius: BorderRadius.circular(6),
                                              border: Border.all(color: Colors.white, width: 1.2),
                                              boxShadow: [
                                                BoxShadow(
                                                  color: Colors.black.withValues(alpha: 0.18),
                                                  blurRadius: 4,
                                                  offset: const Offset(0, 1),
                                                ),
                                              ],
                                            ),
                                            child: Text(
                                              '${item.quantity}x',
                                              style: const TextStyle(
                                                color: Colors.white,
                                                fontWeight: FontWeight.w900,
                                                fontSize: 9.5,
                                                letterSpacing: 0.2,
                                              ),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(width: 12),

                                    // Item Details
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            item.itemName,
                                            style: AppTypography.headingSmall.copyWith(
                                              color: isServed ? AppColors.textSecondary : AppColors.textPrimary,
                                              fontSize: 14,
                                              fontWeight: isServed ? FontWeight.w600 : FontWeight.w800,
                                            ),
                                          ),
                                          const SizedBox(height: 3),
                                          if (isReady) ...[
                                            Row(
                                              children: [
                                                Container(
                                                  width: 6,
                                                  height: 6,
                                                  decoration: const BoxDecoration(
                                                    shape: BoxShape.circle,
                                                    color: Color(0xFF10B981),
                                                  ),
                                                ),
                                                const SizedBox(width: 4),
                                                const Text(
                                                  'Ready to Serve',
                                                  style: TextStyle(
                                                    color: Color(0xFF047857),
                                                    fontWeight: FontWeight.w900,
                                                    fontSize: 11,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ] else if (isServed) ...[
                                            Row(
                                              children: [
                                                const Icon(LucideIcons.check, size: 12, color: AppColors.textMuted),
                                                const SizedBox(width: 3),
                                                const Text(
                                                  'Served',
                                                  style: TextStyle(
                                                    color: AppColors.textMuted,
                                                    fontWeight: FontWeight.w700,
                                                    fontSize: 11,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ] else if (item.isCooking) ...[
                                            Row(
                                              children: [
                                                const Icon(LucideIcons.flame, size: 12, color: Color(0xFFF59E0B)),
                                                const SizedBox(width: 3),
                                                const Text(
                                                  'Preparing in Kitchen',
                                                  style: TextStyle(
                                                    color: Color(0xFFD97706),
                                                    fontWeight: FontWeight.w700,
                                                    fontSize: 11,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ] else ...[
                                            Row(
                                              children: [
                                                const Icon(LucideIcons.clock, size: 12, color: Color(0xFF6366F1)),
                                                const SizedBox(width: 3),
                                                const Text(
                                                  'Waiting to Cook',
                                                  style: TextStyle(
                                                    color: Color(0xFF4F46E5),
                                                    fontWeight: FontWeight.w700,
                                                    fontSize: 11,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ],
                                        ],
                                      ),
                                    ),

                                    const SizedBox(width: 8),

                                    // Price & Action Buttons
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        Text(
                                          Formatters.formatCurrency(item.price * item.quantity),
                                          style: AppTypography.labelLarge.copyWith(
                                            color: isServed ? AppColors.textMuted : AppColors.textPrimary,
                                            fontWeight: FontWeight.w800,
                                          ),
                                        ),
                                        // Cook button — for placed/queued items
                                        if (item.isPlaced) ...[
                                          const SizedBox(height: 6),
                                          ElevatedButton.icon(
                                            onPressed: () async {
                                              FeedbackUtils.successHaptic();
                                              await ref.read(ordersControllerProvider.notifier).markItemCooking(item.id);
                                              if (!mounted) return;
                                              FeedbackUtils.showToast(context, message: '${item.itemName} → Cooking');
                                            },
                                            icon: const Icon(LucideIcons.chefHat, size: 14),
                                            label: const Text('Cook'),
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: const Color(0xFFF97316),
                                              foregroundColor: Colors.white,
                                              elevation: 0,
                                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                              minimumSize: Size.zero,
                                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                              shape: RoundedRectangleBorder(
                                                borderRadius: BorderRadius.circular(8),
                                              ),
                                              textStyle: const TextStyle(fontWeight: FontWeight.w900, fontSize: 11),
                                            ),
                                          ),
                                        ],
                                        // Ready button — for preparing/cooking items
                                        if (item.isCooking) ...[
                                          const SizedBox(height: 6),
                                          ElevatedButton.icon(
                                            onPressed: () async {
                                              FeedbackUtils.successHaptic();
                                              await ref.read(ordersControllerProvider.notifier).markItemReady(item.id);
                                              if (!mounted) return;
                                              FeedbackUtils.showToast(context, message: '${item.itemName} → Ready');
                                            },
                                            icon: const Icon(LucideIcons.checkCircle, size: 14),
                                            label: const Text('Ready'),
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: const Color(0xFF10B981),
                                              foregroundColor: Colors.white,
                                              elevation: 0,
                                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                              minimumSize: Size.zero,
                                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                              shape: RoundedRectangleBorder(
                                                borderRadius: BorderRadius.circular(8),
                                              ),
                                              textStyle: const TextStyle(fontWeight: FontWeight.w900, fontSize: 11),
                                            ),
                                          ),
                                        ],
                                        // Serve button — for ready items
                                        if (isReady) ...[
                                          const SizedBox(height: 6),
                                          ElevatedButton.icon(
                                            onPressed: () async {
                                              final currentUser = ref.read(authControllerProvider).session;
                                              final currentUserId = currentUser?.userId ?? currentUser?.employeeId;
                                              final role = currentUser?.role?.toLowerCase() ?? '';
                                              final isAdmin = role == 'admin' || role == 'supervisor' || role == 'restaurant_admin';
                                              final assignedWaiterId = widget.table.assignedWaiterId ?? activeOrder.waiterId;
                                              final isAssignedToMe = currentUserId != null && (
                                                assignedWaiterId != null && assignedWaiterId.trim().isNotEmpty &&
                                                assignedWaiterId.trim().toLowerCase() == currentUserId.trim().toLowerCase()
                                              );
                                              if (!isAssignedToMe && !isAdmin) {
                                                FeedbackUtils.showToast(context, message: 'Only assigned waiter or Admin can serve items', isError: true);
                                                return;
                                              }
                                              FeedbackUtils.successHaptic();
                                              await ref.read(ordersControllerProvider.notifier).markItemServed(item.id);
                                              if (!mounted) return;
                                              FeedbackUtils.showToast(context, message: '${item.itemName} marked Served');
                                            },
                                            icon: const Icon(LucideIcons.check, size: 14),
                                            label: const Text('Serve'),
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: const Color(0xFF10B981),
                                              foregroundColor: Colors.white,
                                              elevation: 0,
                                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                              minimumSize: Size.zero,
                                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                              shape: RoundedRectangleBorder(
                                                borderRadius: BorderRadius.circular(8),
                                              ),
                                              textStyle: const TextStyle(fontWeight: FontWeight.w900, fontSize: 11),
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ],
                                ),
                                if (item.comboItems.isNotEmpty) ...[
                                  const SizedBox(height: 10),
                                  Container(
                                    width: double.infinity,
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                                    decoration: BoxDecoration(
                                      color: isServed 
                                          ? AppColors.surfaceContainerHighest.withValues(alpha: 0.4) 
                                          : Colors.white,
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(
                                        color: item.isCombo 
                                            ? const Color(0xFFF97316).withValues(alpha: 0.25)
                                            : AppColors.border,
                                        width: 1,
                                      ),
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: item.isCombo
                                                    ? const Color(0xFFFFF7ED)
                                                    : const Color(0xFFEFF6FF),
                                                borderRadius: BorderRadius.circular(5),
                                                border: Border.all(
                                                  color: item.isCombo
                                                      ? const Color(0xFFF97316).withValues(alpha: 0.4)
                                                      : const Color(0xFF3B82F6).withValues(alpha: 0.4),
                                                  width: 0.8,
                                                ),
                                              ),
                                              child: Text(
                                                item.isCombo ? 'COMBO INCLUDES' : 'SPECIAL INCLUDES',
                                                style: TextStyle(
                                                  color: item.isCombo ? const Color(0xFFEA580C) : const Color(0xFF2563EB),
                                                  fontWeight: FontWeight.w900,
                                                  fontSize: 9.5,
                                                  letterSpacing: 0.5,
                                                ),
                                              ),
                                            ),
                                            const SizedBox(width: 6),
                                            Text(
                                              '${item.comboItems.length} items',
                                              style: const TextStyle(
                                                color: AppColors.textMuted,
                                                fontSize: 11,
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 8),
                                        ...item.comboItems.map((sub) {
                                          final isVeg = (sub.itemType?.toLowerCase() == 'veg') ||
                                              (!sub.name.toLowerCase().contains('chicken') &&
                                               !sub.name.toLowerCase().contains('mutton') &&
                                               !sub.name.toLowerCase().contains('fish') &&
                                               !sub.name.toLowerCase().contains('prawn') &&
                                               !sub.name.toLowerCase().contains('egg') &&
                                               !sub.name.toLowerCase().contains('meat'));

                                          return Padding(
                                            padding: const EdgeInsets.symmetric(vertical: 3),
                                            child: Row(
                                              children: [
                                                if (sub.imageUrl != null && sub.imageUrl!.isNotEmpty) ...[
                                                  Container(
                                                    width: 24,
                                                    height: 24,
                                                    decoration: BoxDecoration(
                                                      borderRadius: BorderRadius.circular(5),
                                                      border: Border.all(color: AppColors.border, width: 0.8),
                                                    ),
                                                    clipBehavior: Clip.antiAlias,
                                                    child: CachedNetworkImage(
                                                      imageUrl: sub.imageUrl!,
                                                      fit: BoxFit.cover,
                                                      placeholder: (_, __) => Container(
                                                        color: AppColors.surfaceContainerHigh,
                                                        child: const Icon(LucideIcons.utensils, size: 11, color: AppColors.textMuted),
                                                      ),
                                                      errorWidget: (_, __, ___) => Container(
                                                        color: AppColors.surfaceContainerHigh,
                                                        child: const Icon(LucideIcons.utensils, size: 11, color: AppColors.textMuted),
                                                      ),
                                                    ),
                                                  ),
                                                  const SizedBox(width: 6),
                                                ],
                                                Container(
                                                  width: 10,
                                                  height: 10,
                                                  decoration: BoxDecoration(
                                                    color: Colors.transparent,
                                                    border: Border.all(
                                                      color: isVeg ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
                                                      width: 1.2,
                                                    ),
                                                    borderRadius: BorderRadius.circular(2.5),
                                                  ),
                                                  alignment: Alignment.center,
                                                  child: Container(
                                                    width: 4.5,
                                                    height: 4.5,
                                                    decoration: BoxDecoration(
                                                      shape: BoxShape.circle,
                                                      color: isVeg ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
                                                    ),
                                                  ),
                                                ),
                                                const SizedBox(width: 8),
                                                Expanded(
                                                  child: Text(
                                                    sub.name,
                                                    style: AppTypography.bodySmall.copyWith(
                                                      fontSize: 12.5,
                                                      fontWeight: FontWeight.w700,
                                                      color: isServed ? AppColors.textSecondary : AppColors.textPrimary,
                                                    ),
                                                  ),
                                                ),
                                                Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                                  decoration: BoxDecoration(
                                                    color: AppColors.surfaceContainerHigh,
                                                    borderRadius: BorderRadius.circular(4),
                                                  ),
                                                  child: Text(
                                                    'x${sub.quantity * item.quantity}',
                                                    style: const TextStyle(
                                                      fontSize: 11,
                                                      fontWeight: FontWeight.w900,
                                                      color: AppColors.textPrimary,
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          );
                                        }),
                                      ],
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          );
                        },
                      ),
                      const SizedBox(height: 14),

                      // Bill & Tax Breakdown: Amount, GST, Total Amount
                      Builder(
                        builder: (context) {
                          final total = activeOrder.totalAmount;
                          final itemsSubtotal = activeOrder.items.fold<num>(0, (sum, i) => sum + (i.price * i.quantity));
                          final subtotal = itemsSubtotal > 0 ? itemsSubtotal : (total > 0 ? (total / 1.05).round() : 0);
                          final gstAmount = (total - subtotal) > 0 ? (total - subtotal) : 0;

                          return Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Row(
                                      children: [
                                        const Icon(LucideIcons.receipt, size: 14, color: AppColors.textMuted),
                                        const SizedBox(width: 6),
                                        Text(
                                          'BILL & TAX BREAKDOWN',
                                          style: AppTypography.labelSmall.copyWith(
                                            color: AppColors.textSecondary,
                                            fontWeight: FontWeight.w800,
                                            letterSpacing: 0.8,
                                            fontSize: 10,
                                          ),
                                        ),
                                      ],
                                    ),
                                    Text(
                                      '${activeOrder.items.length} items',
                                      style: AppTypography.labelSmall.copyWith(
                                        color: AppColors.textMuted,
                                        fontSize: 11,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                // Subtotal
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      'Item Amount (Subtotal)',
                                      style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                                    ),
                                    Text(
                                      Formatters.formatCurrency(subtotal),
                                      style: AppTypography.labelLarge.copyWith(
                                        color: AppColors.textPrimary,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                // GST (5%)
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          'GST (5%)',
                                          style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                                        ),
                                        Text(
                                          'CGST 2.5% (${Formatters.formatCurrency(gstAmount / 2)}) + SGST 2.5% (${Formatters.formatCurrency(gstAmount / 2)})',
                                          style: AppTypography.bodySmall.copyWith(
                                            color: AppColors.textMuted,
                                            fontSize: 9.5,
                                          ),
                                        ),
                                      ],
                                    ),
                                    Text(
                                      '+ ${Formatters.formatCurrency(gstAmount)}',
                                      style: AppTypography.labelLarge.copyWith(
                                        color: const Color(0xFFD97706),
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                  ],
                                ),
                                const Padding(
                                  padding: EdgeInsets.symmetric(vertical: 8),
                                  child: Divider(color: AppColors.border, height: 1),
                                ),
                                // Total Amount
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          'TOTAL AMOUNT',
                                          style: AppTypography.labelMedium.copyWith(
                                            color: AppColors.textPrimary,
                                            fontWeight: FontWeight.w900,
                                            letterSpacing: 0.8,
                                          ),
                                        ),
                                        Text(
                                          'Inclusive of all taxes',
                                          style: AppTypography.bodySmall.copyWith(
                                            color: AppColors.textMuted,
                                            fontSize: 10,
                                          ),
                                        ),
                                      ],
                                    ),
                                    Text(
                                      Formatters.formatCurrency(total),
                                      style: AppTypography.headingMedium.copyWith(
                                        color: AppColors.primary,
                                        fontWeight: FontWeight.w900,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ] else ...[
                      Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceContainer,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppColors.border, width: 1),
                        ),
                        child: Center(
                          child: Column(
                            children: [
                              const Icon(LucideIcons.utensilsCrossed, size: 32, color: AppColors.textMuted),
                              const SizedBox(height: 8),
                              Text(
                                'No Active Order',
                                style: AppTypography.headingSmall.copyWith(
                                  color: AppColors.textPrimary,
                                  fontSize: 14,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Tap "Add Items" to create an order for this table',
                                style: AppTypography.bodySmall.copyWith(color: AppColors.textMuted),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),

            // Bottom Actions Bar
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: AppColors.surfaceContainerHigh,
                border: Border(top: BorderSide(color: AppColors.border, width: 1)),
              ),
              child: Builder(
                builder: (context) {
                  final requests = ref.watch(requestsControllerProvider).requests;
                  final hasPendingAccessRequest = requests.any((r) =>
                    r.tableId == currentTable.id.toString() &&
                    r.requestType == 'table_access_request' &&
                    r.isPending
                  );

                  return Row(
                    children: [
                      if (!canManageTable) ...[
                        Expanded(
                          child: AppButton(
                            label: hasPendingAccessRequest ? 'Handover Request Pending...' : 'Request Table Access',
                            icon: hasPendingAccessRequest ? LucideIcons.clock : LucideIcons.arrowRightLeft,
                            variant: hasPendingAccessRequest ? ButtonVariant.secondary : ButtonVariant.primary,
                            isLoading: _isActionLoading,
                            onPressed: hasPendingAccessRequest ? null : () => _handleRequestTableAccess(context),
                          ),
                        ),
                      ] else if (isNeedBill) ...[
                        Expanded(
                          flex: 3,
                          child: AppButton(
                            label: 'Settle Bill & Pay',
                            icon: LucideIcons.receipt,
                            variant: ButtonVariant.primary,
                            isLoading: _isActionLoading,
                            onPressed: () {
                              Navigator.of(context).pop();
                              TableBillSheet.show(
                                context,
                                table: currentTable,
                                order: activeOrder,
                              );
                            },
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          flex: 2,
                          child: AppButton(
                            label: 'Clear',
                            icon: LucideIcons.trash2,
                            variant: ButtonVariant.secondary,
                            isLoading: _isActionLoading,
                            onPressed: _handleClearTable,
                          ),
                        ),
                      ] else if (isDirty) ...[
                        Expanded(
                          child: AppButton(
                            label: 'Mark Available',
                            icon: LucideIcons.sparkles,
                            variant: ButtonVariant.primary,
                            isLoading: _isActionLoading,
                            onPressed: _handleClearTable,
                          ),
                        ),
                      ] else if (isOccupied || (activeOrder != null && activeOrder.items.isNotEmpty)) ...[
                        Expanded(
                          child: AppButton(
                            label: 'Add Items',
                            icon: LucideIcons.plusCircle,
                            variant: ButtonVariant.primary,
                            isLoading: _isActionLoading,
                            onPressed: () => _navigateToAddItems(table: currentTable, canManage: canManageTable),
                          ),
                        ),
                      ] else ...[
                        Expanded(
                          child: AppButton(
                            label: 'Take New Order',
                            icon: LucideIcons.plus,
                            variant: ButtonVariant.primary,
                            isLoading: _isActionLoading,
                            onPressed: () => _navigateToAddItems(table: currentTable, canManage: canManageTable),
                          ),
                        ),
                      ],
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBentoActionButton({
    required IconData icon,
    required Color iconColor,
    required String label,
    VoidCallback? onTap,
  }) {
    final isEnabled = onTap != null;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
          decoration: BoxDecoration(
            color: AppColors.surfaceContainer,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: isEnabled ? AppColors.borderVariant : AppColors.border,
              width: 1,
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 20,
                color: isEnabled ? iconColor : AppColors.textMuted,
              ),
              const SizedBox(height: 6),
              SizedBox(
                height: 26,
                child: Center(
                  child: Text(
                    label,
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.labelSmall.copyWith(
                      color: isEnabled ? AppColors.textPrimary : AppColors.textMuted,
                      fontWeight: FontWeight.w800,
                      fontSize: 10.5,
                      height: 1.15,
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
