import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/realtime/supabase_service.dart';
import '../auth/auth_controller.dart';
import 'order_models.dart';
import 'orders_repository.dart';

class OrdersState {
  final bool isLoading;
  final List<OrderModel> orders;
  final String selectedStatus; // ALL | PREPARING | READY | SERVED
  final String? errorMessage;

  const OrdersState({
    this.isLoading = false,
    this.orders = const [],
    this.selectedStatus = 'ALL',
    this.errorMessage,
  });

  List<OrderModel> get filteredOrders {
    if (selectedStatus == 'ALL') return orders;
    return orders.where((order) {
      switch (selectedStatus) {
        case 'PREPARING':
        case 'COOKING':
          return order.isPreparing && !order.isReady;
        case 'READY':
          return order.isReady;
        case 'SERVED':
          return order.isServed;
        default:
          return true;
      }
    }).toList();
  }

  OrdersState copyWith({
    bool? isLoading,
    List<OrderModel>? orders,
    String? selectedStatus,
    String? errorMessage,
  }) {
    return OrdersState(
      isLoading: isLoading ?? this.isLoading,
      orders: orders ?? this.orders,
      selectedStatus: selectedStatus ?? this.selectedStatus,
      errorMessage: errorMessage,
    );
  }
}

final ordersRepositoryProvider = Provider<OrdersRepository>((ref) => OrdersRepository());

final ordersControllerProvider = StateNotifierProvider<OrdersController, OrdersState>((ref) {
  final repository = ref.watch(ordersRepositoryProvider);
  final authState = ref.watch(authControllerProvider);
  final restaurantId = authState.session?.restaurantId;

  return OrdersController(repository, restaurantId);
});

final activeOrdersProvider = Provider<List<OrderModel>>((ref) {
  return ref.watch(ordersControllerProvider).orders;
});

class OrdersController extends StateNotifier<OrdersState> {
  final OrdersRepository _repository;
  String? _restaurantId;
  RealtimeChannel? _realtimeChannel;

  OrdersController(this._repository, this._restaurantId) : super(const OrdersState()) {
    if (_restaurantId != null && _restaurantId!.trim().isNotEmpty) {
      loadOrders();
      _subscribeToRealtime();
    }
  }

  @override
  void dispose() {
    _realtimeChannel?.unsubscribe();
    super.dispose();
  }

  void _subscribeToRealtime() {
    if (_restaurantId == null || _restaurantId!.trim().isEmpty) return;
    _realtimeChannel?.unsubscribe();
    _realtimeChannel = SupabaseService.subscribeToOrders(
      restaurantId: _restaurantId!.trim(),
      onOrderChange: (payload) {
        loadOrders(silent: true);
      },
    );
  }

  Future<void> loadOrders({bool silent = false, String? restaurantId}) async {
    if (restaurantId != null && restaurantId.trim().isNotEmpty) {
      _restaurantId = restaurantId.trim();
      _subscribeToRealtime();
    }
    final restId = _restaurantId;
    if (restId == null || restId.trim().isEmpty) {
      state = state.copyWith(isLoading: false, orders: []);
      return;
    }
    if (!silent) state = state.copyWith(isLoading: true, errorMessage: null);

    try {
      final orders = await _repository.fetchOrders(restId);
      state = state.copyWith(isLoading: false, orders: orders);
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString().replaceAll('Exception: ', ''),
      );
    }
  }

  void selectStatus(String status) {
    state = state.copyWith(selectedStatus: status);
  }

  Future<void> markServed(String orderId, String tableId) async {
    final restId = _restaurantId ?? '202603180001';
    try {
      await _repository.markOrderServed(orderId, tableId, restId);
      await loadOrders(silent: true);
    } catch (e) {
      state = state.copyWith(errorMessage: 'Failed to mark order as served: $e');
    }
  }

  Future<void> markItemServed(String itemId) async {
    try {
      await _repository.markItemServed(itemId);
      await loadOrders(silent: true);
    } catch (e) {
      state = state.copyWith(errorMessage: 'Failed to mark item as served: $e');
    }
  }

  Future<void> markItemCooking(String itemId) async {
    try {
      await _repository.updateItemStatus(itemId, 'preparing');
      await loadOrders(silent: true);
    } catch (e) {
      state = state.copyWith(errorMessage: 'Failed to mark item as cooking: $e');
    }
  }

  Future<void> markItemReady(String itemId) async {
    try {
      await _repository.updateItemStatus(itemId, 'ready');
      await loadOrders(silent: true);
    } catch (e) {
      state = state.copyWith(errorMessage: 'Failed to mark item as ready: $e');
    }
  }

  Future<void> settleOrderBill({
    required String orderId,
    required String tableId,
    required String paymentMethod,
    required num amountPaid,
    required String paidBy,
    String? transactionId,
  }) async {
    final restId = _restaurantId ?? '202603180001';
    try {
      await _repository.settleOrderBill(
        orderId: orderId,
        tableId: tableId,
        restaurantId: restId,
        paymentMethod: paymentMethod,
        amountPaid: amountPaid,
        paidBy: paidBy,
        transactionId: transactionId,
      );
      await loadOrders(silent: true);
    } catch (e) {
      state = state.copyWith(errorMessage: 'Failed to settle bill: $e');
      rethrow;
    }
  }
}
