import 'dart:async';
import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/realtime/supabase_service.dart';
import '../auth/auth_controller.dart';
import '../orders/orders_controller.dart';
import '../tables/tables_controller.dart';
import 'requests_repository.dart';
import 'service_request_model.dart';

class RequestsState {
  final bool isLoading;
  final List<ServiceRequestModel> requests;
  final String? errorMessage;

  const RequestsState({
    this.isLoading = false,
    this.requests = const [],
    this.errorMessage,
  });

  int get pendingCount => requests.where((r) => r.isPending).length;

  RequestsState copyWith({
    bool? isLoading,
    List<ServiceRequestModel>? requests,
    String? errorMessage,
  }) {
    return RequestsState(
      isLoading: isLoading ?? this.isLoading,
      requests: requests ?? this.requests,
      errorMessage: errorMessage,
    );
  }
}

final requestsRepositoryProvider = Provider<RequestsRepository>((ref) => RequestsRepository());

final requestsControllerProvider = StateNotifierProvider<RequestsController, RequestsState>((ref) {
  final repository = ref.watch(requestsRepositoryProvider);
  final authState = ref.watch(authControllerProvider);
  final restaurantId = authState.session?.restaurantId ?? '202603180001';

  return RequestsController(repository, restaurantId);
});

final visibleRequestsProvider = Provider<List<ServiceRequestModel>>((ref) {
  final requestsState = ref.watch(requestsControllerProvider);
  final authState = ref.watch(authControllerProvider);
  final session = authState.session;
  final tables = ref.watch(tablesControllerProvider).tables;
  final orders = ref.watch(ordersControllerProvider).orders;

  final filteredServiceRequests = requestsState.requests.where((r) {
    if (r.requestType == 'order_ready') return false; // Dynamically handled from active orders
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

  // Synthesize Ready-to-Serve items dynamically from active orders
  final List<ServiceRequestModel> readyItemRequests = [];

  final role = session?.role?.toLowerCase() ?? '';
  final isAdmin = role == 'admin' || role == 'supervisor' || role == 'restaurant_admin';
  final currentUserId = session?.userId?.trim().toLowerCase();
  final currentEmployeeId = session?.employeeId?.trim().toLowerCase();
  final currentMobile = session?.mobile?.trim().toLowerCase();

  for (final order in orders) {
    final table = tables.where((t) =>
      t.id.toString() == order.tableId ||
      t.tableNumber == order.tableNumber ||
      (t.mergedGroupId != null && t.mergedGroupId == order.tableId)
    ).firstOrNull;

    final assignedWaiterId = table?.assignedWaiterId ?? order.waiterId;
    final coWaiters = table?.coWaiterIds;

    final isAuthorized = isAdmin ||
        (assignedWaiterId == null || assignedWaiterId.isEmpty) ||
        (currentUserId != null && assignedWaiterId.toLowerCase() == currentUserId) ||
        (currentEmployeeId != null && assignedWaiterId.toLowerCase() == currentEmployeeId) ||
        (currentMobile != null && assignedWaiterId.toLowerCase() == currentMobile) ||
        (coWaiters != null && coWaiters.any((cw) =>
            (currentUserId != null && cw.toLowerCase() == currentUserId) ||
            (currentEmployeeId != null && cw.toLowerCase() == currentEmployeeId) ||
            (currentMobile != null && cw.toLowerCase() == currentMobile)
        ));

    if (!isAuthorized) continue;

    for (final item in order.items) {
      if (item.isReady) {
        readyItemRequests.add(ServiceRequestModel(
          id: 'ready_${item.id}',
          tableId: order.tableId,
          tableNumber: order.tableNumber ?? table?.tableNumber,
          requestType: 'order_ready',
          requestStatus: 'pending',
          quantity: item.quantity,
          serviceLabel: item.itemName,
          imageUrl: item.imageUrl,
          assignedWaiterId: assignedWaiterId,
          createdAt: order.createdAt,
          additionalNotes: jsonEncode({
            'item_id': item.id,
            'order_id': order.id,
            'item_name': item.itemName,
            'table_id': order.tableId,
          }),
        ));
      }
    }
  }

  return [...readyItemRequests, ...filteredServiceRequests];
});

final pendingRequestsCountProvider = Provider<int>((ref) {
  final visible = ref.watch(visibleRequestsProvider);
  return visible.where((r) => r.isPending).length;
});

class RequestsController extends StateNotifier<RequestsState> {
  final RequestsRepository _repository;
  String? _restaurantId;
  RealtimeChannel? _realtimeChannel;
  Timer? _pollingTimer;

  RequestsController(this._repository, this._restaurantId) : super(const RequestsState()) {
    if (_restaurantId != null) {
      loadRequests();
      _subscribeToRealtime();
      _startPolling();
    }
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    _realtimeChannel?.unsubscribe();
    super.dispose();
  }

  void _startPolling() {
    _pollingTimer?.cancel();
    _pollingTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (_restaurantId != null) {
        loadRequests(silent: true);
      }
    });
  }

  void _subscribeToRealtime() {
    if (_restaurantId == null) return;
    _realtimeChannel = SupabaseService.subscribeToServiceRequests(
      restaurantId: _restaurantId!,
      onRequestChange: (payload) {
        loadRequests(silent: true);
      },
    );
  }

  Future<void> loadRequests({bool silent = false, String? restaurantId}) async {
    if (restaurantId != null) {
      _restaurantId = restaurantId;
      _subscribeToRealtime();
      _startPolling();
    }
    final restId = _restaurantId ?? '202603180001';
    if (!silent) state = state.copyWith(isLoading: true, errorMessage: null);

    try {
      final requests = await _repository.fetchRequests(restId);
      state = state.copyWith(isLoading: false, requests: requests);
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString().replaceAll('Exception: ', ''),
      );
    }
  }

  Future<void> acceptRequest(String requestId, [String waiterId = '']) async {
    try {
      await _repository.acceptRequest(requestId, waiterId);
      await loadRequests(silent: true);
    } catch (e) {
      state = state.copyWith(errorMessage: 'Failed to accept request: $e');
    }
  }

  Future<void> completeRequest(String requestId) async {
    try {
      await _repository.completeRequest(requestId);
      await loadRequests(silent: true);
    } catch (e) {
      state = state.copyWith(errorMessage: 'Failed to complete request: $e');
    }
  }

  Future<void> markDone(String requestId) async {
    await completeRequest(requestId);
  }

  Future<void> requestTableAccess({
    required String tableId,
    required String requesterId,
    required String requesterName,
    required String restaurantId,
  }) async {
    try {
      await _repository.requestTableAccess(
        tableId: tableId,
        requesterId: requesterId,
        requesterName: requesterName,
        restaurantId: restaurantId,
      );
      await loadRequests(silent: true);
    } catch (e) {
      state = state.copyWith(errorMessage: 'Failed to request table access: $e');
      rethrow;
    }
  }

  Future<Map<String, dynamic>?> approveTableAccess({
    required String requestId,
    required String approverId,
    String transferType = 'share',
  }) async {
    try {
      final res = await _repository.approveTableAccess(
        requestId: requestId,
        approverId: approverId,
        transferType: transferType,
      );
      await loadRequests(silent: true);
      return res;
    } catch (e) {
      state = state.copyWith(errorMessage: 'Failed to approve table access: $e');
      rethrow;
    }
  }

  Future<void> declineTableAccess({
    required String requestId,
    required String declinerId,
  }) async {
    try {
      await _repository.declineTableAccess(
        requestId: requestId,
        declinerId: declinerId,
      );
      await loadRequests(silent: true);
    } catch (e) {
      state = state.copyWith(errorMessage: 'Failed to decline table access: $e');
      rethrow;
    }
  }
}
