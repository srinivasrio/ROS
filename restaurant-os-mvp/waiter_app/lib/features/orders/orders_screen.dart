import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/utils/feedback_utils.dart';
import '../../core/widgets/empty_state_view.dart';
import '../../core/widgets/loading_skeleton.dart';
import '../../core/widgets/sliding_segmented_bar.dart';
import '../auth/auth_controller.dart';
import '../requests/requests_controller.dart';
import '../tables/table_models.dart';
import '../tables/tables_controller.dart';
import 'order_models.dart';
import 'orders_controller.dart';
import 'widgets/order_card.dart';

class OrdersScreen extends ConsumerWidget {
  const OrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ordersState = ref.watch(ordersControllerProvider);
    final ordersNotifier = ref.read(ordersControllerProvider.notifier);
    final session = ref.watch(authControllerProvider).session;
    final currentUserId = session?.userId ?? session?.employeeId;
    final isAdmin = session?.role != null &&
        ['admin', 'supervisor', 'restaurant_admin'].contains(session!.role.toLowerCase());
    final tables = ref.watch(tablesControllerProvider).tables;

    bool checkCanManage(OrderModel order) {
      if (isAdmin) return true;
      if (currentUserId == null || currentUserId.isEmpty) return true;

      TableModel? table;
      try {
        table = tables.firstWhere(
          (t) =>
              t.id.toString() == order.tableId ||
              (order.tableNumber != null &&
                  (t.tableNumber == order.tableNumber ||
                      t.formattedName.replaceAll('Table ', '') == order.tableNumber)),
        );
      } catch (_) {}

      if (table != null) {
        return table.isWaiterAuthorized(currentUserId, isAdmin: isAdmin);
      }
      return order.waiterId == null || order.waiterId == currentUserId;
    }

    Future<void> handleRequestAccess(OrderModel order) async {
      if (session == null) return;
      TableModel? currentTable;
      try {
        currentTable = tables.firstWhere(
          (t) =>
              t.id.toString() == order.tableId ||
              (order.tableNumber != null &&
                  (t.tableNumber == order.tableNumber ||
                      t.formattedName.replaceAll('Table ', '') == order.tableNumber)),
        );
      } catch (_) {}

      final tId = currentTable?.id.toString() ?? order.tableId;
      final waiterName = currentTable?.assignedWaiterName ?? order.waiterName ?? 'assigned waiter';

      try {
        await ref.read(requestsControllerProvider.notifier).requestTableAccess(
          tableId: tId,
          requesterId: session.userId,
          requesterName: session.name,
          restaurantId: session.restaurantId,
        );
        if (context.mounted) {
          FeedbackUtils.showToast(context, message: 'Access request sent to $waiterName!');
        }
      } catch (e) {
        if (context.mounted) {
          FeedbackUtils.showToast(context, message: 'Failed to send request: $e', isError: true);
        }
      }
    }

    final allOrders = ordersState.orders;
    final preparingCount = allOrders.where((o) => o.isPreparing && !o.isReady).length;
    final readyCount = allOrders.where((o) => o.isReady && checkCanManage(o)).length;
    final servedCount = allOrders.where((o) => o.isServed).length;

    // In READY tab, only show actionable ready orders for the current waiter
    final displayedOrders = ordersState.selectedStatus == 'READY'
        ? ordersState.filteredOrders.where((o) => checkCanManage(o)).toList()
        : ordersState.filteredOrders;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        title: Text(
          'Live Orders',
          style: AppTypography.headingLarge.copyWith(
            color: AppColors.primary,
            fontWeight: FontWeight.w800,
          ),
        ),
        actions: [
          IconButton(
            onPressed: () => ordersNotifier.loadOrders(),
            icon: const Icon(LucideIcons.rotateCw, size: 20, color: AppColors.primary),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Smooth Traveling Segmented Tab Bar (All, Preparing, Ready, Served)
            SlidingSegmentedBar(
              selectedKey: ordersState.selectedStatus,
              onSelected: (key) => ordersNotifier.selectStatus(key),
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              items: [
                SlidingTabItem(
                  keyId: 'ALL',
                  label: 'All',
                  count: allOrders.isNotEmpty ? allOrders.length : null,
                ),
                SlidingTabItem(
                  keyId: 'PREPARING',
                  label: 'Preparing',
                  count: preparingCount > 0 ? preparingCount : null,
                ),
                SlidingTabItem(
                  keyId: 'READY',
                  label: 'Ready 🔔',
                  count: readyCount > 0 ? readyCount : null,
                ),
                SlidingTabItem(
                  keyId: 'SERVED',
                  label: 'Served',
                  count: servedCount > 0 ? servedCount : null,
                ),
              ],
            ),

            const SizedBox(height: 4),

            // Orders list
            Expanded(
              child: ordersState.isLoading
                  ? ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: 4,
                      itemBuilder: (_, __) => const Padding(
                        padding: EdgeInsets.only(bottom: 14),
                        child: LoadingSkeleton(width: double.infinity, height: 160, borderRadius: 20),
                      ),
                    )
                  : displayedOrders.isEmpty
                      ? const EmptyStateView(
                          icon: LucideIcons.chefHat,
                          title: 'No Active Orders',
                          description: 'Orders will appear here as soon as they are placed.',
                        )
                      : RefreshIndicator(
                          onRefresh: () => ordersNotifier.loadOrders(),
                          color: AppColors.primary,
                          child: ListView.builder(
                            padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                            itemCount: displayedOrders.length,
                            itemBuilder: (context, index) {
                              final order = displayedOrders[index];
                              final canManage = checkCanManage(order);
                              return OrderCard(
                                order: order,
                                canManage: canManage,
                                onMarkServed: () => ordersNotifier.markServed(order.id, order.tableId),
                                onRequestAccess: () => handleRequestAccess(order),
                              );
                            },
                          ),
                        ),
            ),
          ],
        ),
      ),
    );
  }
}
