import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/feedback_utils.dart';
import '../auth/auth_controller.dart';
import '../menu/menu_screen.dart';
import '../profile/profile_screen.dart';
import '../requests/requests_controller.dart';
import '../requests/requests_screen.dart';
import '../requests/widgets/incoming_request_alert_sheet.dart';
import '../requests/widgets/table_access_request_sheet.dart';
import '../tables/tables_controller.dart';
import '../tables/tables_screen.dart';
import 'widgets/animated_travel_bottom_bar.dart';

import '../../core/notifications/notification_service.dart';
import '../../core/realtime/supabase_service.dart';
import '../requests/widgets/dish_ready_alert_sheet.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class MainNavigationScreen extends ConsumerStatefulWidget {
  const MainNavigationScreen({super.key});

  @override
  ConsumerState<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends ConsumerState<MainNavigationScreen>
    with WidgetsBindingObserver {
  int _currentIndex = 0;
  final Set<String> _handledAlertIds = {};
  bool _isModalOpen = false;
  RealtimeChannel? _readyChannel;

  final List<Widget> _screens = const [
    TablesScreen(),
    MenuScreen(),
    RequestsScreen(),
    ProfileScreen(),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    NotificationService.isAppInForeground = true;
    _setupKitchenReadySubscription();
    NotificationService.readyAlertNotifier.addListener(_onReadyAlertReceived);
    NotificationService.notificationPayloadNotifier.addListener(_onNotificationPayloadReceived);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkInitialNotification();
    });
  }

  void _checkInitialNotification() {
    if (NotificationService.notificationPayloadNotifier.value != null) {
      _onNotificationPayloadReceived();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final isForeground = state == AppLifecycleState.resumed;
    NotificationService.isAppInForeground = isForeground;
    debugPrint('[MainNavigationScreen] App lifecycle state changed: $state (isForeground: $isForeground)');

    if (isForeground) {
      _checkInitialNotification();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    NotificationService.notificationPayloadNotifier.removeListener(_onNotificationPayloadReceived);
    NotificationService.readyAlertNotifier.removeListener(_onReadyAlertReceived);
    _readyChannel?.unsubscribe();
    super.dispose();
  }

  void _onNotificationPayloadReceived() {
    final payload = NotificationService.notificationPayloadNotifier.value;
    if (payload == null || !mounted) return;
    NotificationService.notificationPayloadNotifier.value = null;

    debugPrint('[MainNavigationScreen] Processing notification tap payload: $payload');

    // 1. Redirect to Requests tab
    setState(() => _currentIndex = 2);

    // 2. Open corresponding popup alert
    if (NotificationService.readyAlertNotifier.value != null) {
      _onReadyAlertReceived();
    } else {
      final requestsState = ref.read(requestsControllerProvider);
      _checkAndShowNewAlerts(requestsState);
    }
  }

  void _setupKitchenReadySubscription() {
    final session = ref.read(authControllerProvider).session;
    final restaurantId = session?.restaurantId ?? '202603180001';

    _readyChannel = SupabaseService.subscribeToKitchenReadyAlerts(
      restaurantId: restaurantId,
      onDishReady: (record) async {
        try {
          final session = ref.read(authControllerProvider).session;
          final currentUserId = session?.userId?.trim().toLowerCase();
          final currentEmployeeId = session?.employeeId?.trim().toLowerCase();
          final currentMobile = session?.mobile?.trim().toLowerCase();
          final role = session?.role?.toLowerCase() ?? '';
          final isAdmin = role == 'admin' || role == 'supervisor' || role == 'restaurant_admin';

          String tableNumber = 'Unknown';
          String tableId = '';
          String itemName = 'Dish';
          int quantity = 1;

          String? assignedWaiterId;
          List<String> coWaiters = [];

          if (record['is_service_request'] == true) {
            tableId = record['table_id']?.toString() ?? '1';
            // Fetch table details including co-waiters
            final tRes = await SupabaseService.client
                .from('tables')
                .select('table_number, assigned_waiter_id, co_waiter_ids')
                .eq('id', int.tryParse(tableId) ?? tableId)
                .maybeSingle();
            if (tRes != null) {
              tableNumber = tRes['table_number']?.toString() ?? tableId;
              assignedWaiterId = tRes['assigned_waiter_id']?.toString();
              if (tRes['co_waiter_ids'] != null && tRes['co_waiter_ids'] is List) {
                coWaiters = (tRes['co_waiter_ids'] as List).map((e) => e.toString().trim().toLowerCase()).toList();
              }
            }
            itemName = 'Order items are ready';
          } else {
            // From order_items
            quantity = (record['quantity'] as num?)?.toInt() ?? 1;
            final orderId = record['order_id']?.toString();
            final menuItemId = record['menu_item_id'];

            if (menuItemId != null) {
              final mRes = await SupabaseService.client
                  .from('menu_items')
                  .select('name')
                  .eq('id', menuItemId)
                  .maybeSingle();
              if (mRes != null && mRes['name'] != null) {
                itemName = mRes['name'].toString();
              }
            } else if (record['combo_name'] != null && record['combo_name'].toString().isNotEmpty) {
              itemName = record['combo_name'].toString();
            } else if (record['notes'] != null && record['notes'].toString().isNotEmpty) {
              itemName = record['notes'].toString();
            }

            if (orderId != null) {
              final oRes = await SupabaseService.client
                  .from('orders')
                  .select('table_id, waiter_id')
                  .eq('id', orderId)
                  .maybeSingle();
              if (oRes != null) {
                tableId = oRes['table_id']?.toString() ?? '';
                final orderWaiterId = oRes['waiter_id']?.toString();

                if (tableId.isNotEmpty) {
                  final tRes = await SupabaseService.client
                      .from('tables')
                      .select('table_number, assigned_waiter_id, co_waiter_ids')
                      .eq('id', int.tryParse(tableId) ?? tableId)
                      .maybeSingle();
                  if (tRes != null) {
                    tableNumber = tRes['table_number']?.toString() ?? tableId;
                    assignedWaiterId = tRes['assigned_waiter_id']?.toString() ?? orderWaiterId;
                    if (tRes['co_waiter_ids'] != null && tRes['co_waiter_ids'] is List) {
                      coWaiters = (tRes['co_waiter_ids'] as List).map((e) => e.toString().trim().toLowerCase()).toList();
                    }
                  } else {
                    assignedWaiterId = orderWaiterId;
                  }
                } else {
                  assignedWaiterId = orderWaiterId;
                }
              }
            }
          }

          // Multi-waiter authorization:
          // 1. Admins/supervisors receive all alerts
          // 2. Unassigned tables (no assigned waiter and no co-waiters) are received by all waiters
          // 3. Primary assigned waiter receives alert
          // 4. ALL co-waiters assigned to that table receive alert
          final assignedIdLower = assignedWaiterId?.trim().toLowerCase();
          final isAssignedWaiter = assignedIdLower != null && assignedIdLower.isNotEmpty && (
            (currentUserId != null && assignedIdLower == currentUserId) ||
            (currentEmployeeId != null && assignedIdLower == currentEmployeeId) ||
            (currentMobile != null && assignedIdLower == currentMobile)
          );

          final isCoWaiter = (currentUserId != null && coWaiters.contains(currentUserId)) ||
              (currentEmployeeId != null && coWaiters.contains(currentEmployeeId)) ||
              (currentMobile != null && coWaiters.contains(currentMobile));

          final isUnassigned = (assignedIdLower == null || assignedIdLower.isEmpty) && coWaiters.isEmpty;

          final isAuthorized = isAdmin || isUnassigned || isAssignedWaiter || isCoWaiter;

          if (!isAuthorized) {
            debugPrint('[MainNavigationScreen] Dish ready alert ignored - table not assigned/co-assigned to current waiter ($assignedWaiterId, coWaiters: $coWaiters vs $currentUserId)');
            return;
          }

          NotificationService.triggerDishReadyAlert(
            tableId: tableId,
            tableNumber: tableNumber,
            itemName: itemName,
            quantity: quantity,
          );
        } catch (e) {
          debugPrint('[MainNavigationScreen] Error processing dish ready alert: $e');
        }
      },
    );
  }

  void _onReadyAlertReceived() {
    final event = NotificationService.readyAlertNotifier.value;
    if (event == null || _isModalOpen || !mounted) return;

    _isModalOpen = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      DishReadyAlertSheet.show(
        context,
        event: event,
        onPickUp: () {
          _isModalOpen = false;
          NotificationService.readyAlertNotifier.value = null;
          setState(() => _currentIndex = 0); // Switch to Tables
          FeedbackUtils.showToast(context, message: 'Serving Table ${event.tableNumber}');
        },
        onDismiss: () {
          _isModalOpen = false;
          NotificationService.readyAlertNotifier.value = null;
        },
      );
    });
  }

  void _checkAndShowNewAlerts(RequestsState requestsState) {
    final session = ref.read(authControllerProvider).session;
    final currentUserId = session?.userId ?? session?.employeeId;
    final tables = ref.read(tablesControllerProvider).tables;

    final pendingRequests = requestsState.requests.where((r) {
      if (!r.isPending) return false;
      // Do NOT show order_ready as a generic alert (it is handled by DishReadyAlertSheet)
      if (r.requestType == 'order_ready') return false;

      List<String>? coWaiters;
      try {
        final table = tables.firstWhere((t) => t.id.toString() == r.tableId);
        coWaiters = table.coWaiterIds;
      } catch (_) {}

      return r.isVisibleToUser(
        currentUserId: session?.userId,
        currentEmployeeId: session?.employeeId,
        currentMobile: session?.mobile,
        userRole: session?.role,
        coWaiterIds: coWaiters,
      );
    }).toList();

    for (final req in pendingRequests) {
      if (!_handledAlertIds.contains(req.id)) {
        _handledAlertIds.add(req.id);

        // If app is in background/closed, trigger OS system notification
        if (!NotificationService.isAppInForeground) {
          NotificationService.triggerServiceRequestNotification(
            tableId: req.tableId,
            tableNumber: req.formattedTableName.replaceAll('Table ', ''),
            title: req.formattedTitle,
            description: req.displayNotes ?? 'Customer requested service at ${req.formattedTableName}',
            requestId: req.id,
          );
        }

        if (_isModalOpen || !mounted) continue;
        _isModalOpen = true;

        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;

          if (req.requestType == 'table_access_request') {
            TableAccessRequestSheet.show(
              context,
              request: req,
              onApprove: (transferType) async {
                _isModalOpen = false;
                final approverId = currentUserId ?? '5b3a8b19-8682-4194-bd28-9a1886f4da67';
                try {
                  await ref.read(requestsControllerProvider.notifier).approveTableAccess(
                    requestId: req.id,
                    approverId: approverId,
                    transferType: transferType,
                  );
                  ref.read(tablesControllerProvider.notifier).loadData(silent: true);
                  if (context.mounted) {
                    final msg = transferType == 'transfer'
                        ? 'Table ${req.formattedTableName} transferred completely'
                        : 'Shared access granted for ${req.formattedTableName} (Both can manage)';
                    FeedbackUtils.showToast(context, message: msg);
                  }
                } catch (e) {
                  if (context.mounted) {
                    FeedbackUtils.showToast(context, message: 'Failed to approve request: $e', isError: true);
                  }
                }
              },
              onDecline: () async {
                _isModalOpen = false;
                final declinerId = currentUserId ?? '5b3a8b19-8682-4194-bd28-9a1886f4da67';
                try {
                  await ref.read(requestsControllerProvider.notifier).declineTableAccess(
                    requestId: req.id,
                    declinerId: declinerId,
                  );
                  if (context.mounted) {
                    FeedbackUtils.showToast(context, message: 'Handover request declined');
                  }
                } catch (_) {}
              },
            );
          } else {
            IncomingRequestAlertSheet.show(
              context,
              request: req,
              onAccept: () {
                _isModalOpen = false;
                final waiterId = currentUserId ?? '5b3a8b19-8682-4194-bd28-9a1886f4da67';
                ref.read(requestsControllerProvider.notifier).acceptRequest(req.id, waiterId);
                FeedbackUtils.showToast(context, message: 'Accepted request from ${req.formattedTableName}');
              },
              onDismiss: () {
                _isModalOpen = false;
              },
            );
          }
        });
        break;
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // Listen for new incoming service requests
    ref.listen<RequestsState>(requestsControllerProvider, (prev, next) {
      _checkAndShowNewAlerts(next);
    });

    final pendingRequestsCount = ref.watch(requestsControllerProvider).pendingCount;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: AnimatedTravelBottomBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) {
          setState(() => _currentIndex = index);
        },
        destinations: [
          const NavDestinationItem(
            icon: LucideIcons.layoutGrid,
            selectedIcon: LucideIcons.layoutGrid,
            label: 'Tables',
          ),
          const NavDestinationItem(
            icon: LucideIcons.utensilsCrossed,
            selectedIcon: LucideIcons.utensilsCrossed,
            label: 'Menu',
          ),
          NavDestinationItem(
            icon: LucideIcons.bellRing,
            selectedIcon: LucideIcons.bellRing,
            label: 'Requests',
            badgeCount: pendingRequestsCount,
          ),
          const NavDestinationItem(
            icon: LucideIcons.user,
            selectedIcon: LucideIcons.userCheck,
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}
