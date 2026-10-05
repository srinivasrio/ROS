import 'package:flutter/foundation.dart';
import '../../core/realtime/supabase_service.dart';
import 'order_models.dart';

class OrdersRepository {
  Future<List<OrderModel>> fetchOrders(String restaurantId) async {
    try {
      final response = await SupabaseService.client.rpc(
        'get_active_orders_by_restaurant',
        params: {'p_restaurant_id': restaurantId},
      );

      final List<dynamic> data = response as List<dynamic>;

      return data.map((orderJson) {
        final List<dynamic> itemsRaw = orderJson['items'] ?? [];
        final items = itemsRaw.map((i) => OrderItemModel.fromJson(i as Map<String, dynamic>)).toList();
        return OrderModel.fromJson(orderJson as Map<String, dynamic>, items);
      }).toList();
    } catch (e) {
      debugPrint('[OrdersRepository] Error fetching orders: $e');
      throw Exception('Failed to load orders: $e');
    }
  }

  Future<void> markOrderServed(String orderId, String tableId, String restaurantId) async {
    try {
      // 1. Update order items to 'served'
      await SupabaseService.client
          .from('order_items')
          .update({'status': 'served'})
          .eq('order_id', orderId);

      // 2. Update order to 'served'
      await SupabaseService.client
          .from('orders')
          .update({'status': 'served'})
          .eq('id', orderId);

      // 3. Update table to 'occupied'
      await SupabaseService.client
          .from('tables')
          .update({
            'status': 'occupied',
            'last_activity_at': DateTime.now().toIso8601String(),
          })
          .eq('id', tableId)
          .eq('restaurant_id', restaurantId);
    } catch (e) {
      debugPrint('[OrdersRepository] Error marking order served: $e');
      throw Exception('Failed to update order status');
    }
  }

  Future<void> markItemServed(String itemId) async {
    try {
      await SupabaseService.client
          .from('order_items')
          .update({'status': 'served'})
          .eq('id', itemId);
    } catch (e) {
      debugPrint('[OrdersRepository] Error marking item served: $e');
      throw Exception('Failed to update item status');
    }
  }

  Future<void> updateItemStatus(String itemId, String status) async {
    try {
      await SupabaseService.client
          .from('order_items')
          .update({'status': status})
          .eq('id', itemId);
    } catch (e) {
      debugPrint('[OrdersRepository] Error updating item status to $status: $e');
      throw Exception('Failed to update item status');
    }
  }

  Future<void> settleOrderBill({
    required String orderId,
    required String tableId,
    required String restaurantId,
    required String paymentMethod,
    required num amountPaid,
    required String paidBy,
    String? transactionId,
  }) async {
    try {
      debugPrint('[OrdersRepository] Settling order $orderId with $paymentMethod, amount: $amountPaid, paidBy: $paidBy');

      // 1. Settle the order in Supabase
      await SupabaseService.client
          .from('orders')
          .update({
            'status': 'paid',
            'amount_paid': amountPaid,
            'payment_method': paymentMethod,
            'paid_by': paidBy,
            'transaction_id': transactionId,
            'completed_at': DateTime.now().toIso8601String(),
          })
          .eq('id', orderId)
          .eq('restaurant_id', restaurantId);

      // 2. Mark order_items as served if not already
      await SupabaseService.client
          .from('order_items')
          .update({'status': 'served'})
          .eq('order_id', orderId);

      // 3. Update table status to 'cleaning' (awaiting staff clearance)
      final numTableId = int.tryParse(tableId);
      final tableUpdate = {
        'status': 'cleaning',
        'last_activity_at': DateTime.now().toIso8601String(),
      };
      if (numTableId != null) {
        await SupabaseService.client
            .from('tables')
            .update(tableUpdate)
            .eq('id', numTableId)
            .eq('restaurant_id', restaurantId);
      } else {
        await SupabaseService.client
            .from('table_merge_groups')
            .update(tableUpdate)
            .eq('id', tableId)
            .eq('restaurant_id', restaurantId);
      }
    } catch (e) {
      debugPrint('[OrdersRepository] Error settling bill: $e');
      throw Exception('Failed to settle bill: $e');
    }
  }
}
