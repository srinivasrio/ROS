import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/realtime/supabase_service.dart';
import '../../core/storage/secure_storage_service.dart';
import '../menu/menu_models.dart';
import 'cart_models.dart';

final cartProviderFamily = StateNotifierProvider.family<CartController, CartState, String>((ref, tableId) {
  return CartController(tableId: tableId);
});

final cartControllerProvider = Provider((ref) => null);

class CartController extends StateNotifier<CartState> {
  String tableId;

  CartController({required this.tableId})
      : super(CartState(tableId: tableId, tableNumber: '')) {
    _loadDraft();
  }

  Future<void> _loadDraft() async {
    final draft = await SecureStorageService.getDraftOrder(tableId);
    if (draft != null) {
      // restore if needed
    }
  }

  void setTable(String id, String number) {
    tableId = id;
    state = state.copyWith(tableId: id, tableNumber: number);
  }

  void setTableNumber(String number) {
    state = state.copyWith(tableNumber: number);
  }

  void addItem(MenuItemModel item, {String? specialInstructions, List<String>? addons}) {
    final currentItems = Map<String, CartItem>.from(state.items);

    if (currentItems.containsKey(item.id)) {
      currentItems[item.id]!.quantity += 1;
      if (specialInstructions != null) currentItems[item.id]!.specialInstructions = specialInstructions;
    } else {
      currentItems[item.id] = CartItem(
        item: item,
        quantity: 1,
        specialInstructions: specialInstructions,
        selectedAddons: addons ?? [],
      );
    }

    state = state.copyWith(items: currentItems);
    _saveDraft();
  }

  void incrementQuantity(String itemId) {
    final currentItems = Map<String, CartItem>.from(state.items);
    if (currentItems.containsKey(itemId)) {
      currentItems[itemId]!.quantity += 1;
      state = state.copyWith(items: currentItems);
      _saveDraft();
    }
  }

  void decrementQuantity(String itemId) {
    final currentItems = Map<String, CartItem>.from(state.items);
    if (currentItems.containsKey(itemId)) {
      if (currentItems[itemId]!.quantity > 1) {
        currentItems[itemId]!.quantity -= 1;
      } else {
        currentItems.remove(itemId);
      }
      state = state.copyWith(items: currentItems);
      _saveDraft();
    }
  }

  void updateInstructions(String itemId, String instructions) {
    final currentItems = Map<String, CartItem>.from(state.items);
    if (currentItems.containsKey(itemId)) {
      currentItems[itemId]!.specialInstructions = instructions;
      state = state.copyWith(items: currentItems);
      _saveDraft();
    }
  }

  void clearCart() {
    state = state.copyWith(items: {});
    SecureStorageService.clearDraftOrder(tableId);
  }

  void _saveDraft() {
    // save draft locally
  }

  Future<bool> submitOrder(String waiterId, [String? restaurantId]) async {
    return await sendToKitchen(
      restaurantId: restaurantId ?? '202603180001',
      waiterId: waiterId,
      waiterName: 'Staff',
    );
  }

  /// Send order to kitchen with idempotency protection and append support
  Future<bool> sendToKitchen({
    required String restaurantId,
    required String waiterId,
    required String waiterName,
  }) async {
    if (state.items.isEmpty || state.isSubmitting) return false;

    state = state.copyWith(isSubmitting: true, errorMessage: null);

    try {
      final parsedTableId = int.tryParse(tableId);
      final dynamic tableIdentifier = parsedTableId ?? tableId;

      // Validate waiterId in employees table to prevent FK violations
      String? checkedWaiterId;
      if (waiterId.isNotEmpty) {
        final isUuid = RegExp(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$').hasMatch(waiterId);
        if (isUuid) {
          try {
            final check = await SupabaseService.client
                .from('employees')
                .select('id')
                .eq('id', waiterId)
                .maybeSingle();
            if (check != null) {
              checkedWaiterId = waiterId;
            }
          } catch (_) {}
        }
      }

      // Validate table ownership: only assigned waiter, co-waiter, Admin, or unassigned table
      if (parsedTableId != null) {
        try {
          final tableData = await SupabaseService.client
              .from('tables')
              .select('id, table_number, assigned_waiter_id, co_waiter_ids, status')
              .eq('id', parsedTableId)
              .eq('restaurant_id', restaurantId)
              .maybeSingle();

          if (tableData != null) {
            final tableAssignedId = tableData['assigned_waiter_id']?.toString();
            final coWaitersList = (tableData['co_waiter_ids'] as List<dynamic>?)?.map((e) => e.toString().toLowerCase()).toList() ?? [];

            final isDirectAssigned = tableAssignedId != null &&
                checkedWaiterId != null &&
                tableAssignedId.toLowerCase() == checkedWaiterId.toLowerCase();
            final isCoWaiter = checkedWaiterId != null && coWaitersList.contains(checkedWaiterId.toLowerCase());

            if (tableAssignedId != null &&
                tableAssignedId.isNotEmpty &&
                !isDirectAssigned &&
                !isCoWaiter) {
              final emp = await SupabaseService.client
                  .from('employees')
                  .select('role')
                  .eq('id', checkedWaiterId ?? '')
                  .maybeSingle();
              final role = (emp?['role'] ?? '').toString().toLowerCase();
              final isAdmin = role == 'admin' || role == 'supervisor';

              if (!isAdmin) {
                throw Exception('This table is assigned to another waiter. Please request table access first.');
              }
            }
          }
        } catch (e) {
          if (e.toString().contains('assigned to another waiter')) {
            rethrow;
          }
        }
      }

      // Check if there is already an active order for this table
      var existingOrderQuery = SupabaseService.client
          .from('orders')
          .select('id, total_amount')
          .eq('restaurant_id', restaurantId)
          .eq('is_completed', false)
          .inFilter('status', ['placed', 'preparing', 'ready', 'served']);

      if (parsedTableId != null) {
        existingOrderQuery = existingOrderQuery.eq('table_id', parsedTableId);
      }

      final existingOrderList = await existingOrderQuery.order('created_at', ascending: false).limit(1);
      final existingOrder = existingOrderList.isNotEmpty ? existingOrderList.first : null;

      String orderId;

      if (existingOrder != null) {
        // Append to existing active order
        orderId = existingOrder['id'].toString();
        final currentTotal = (existingOrder['total_amount'] as num?)?.toDouble() ?? 0.0;
        final newTotal = currentTotal + state.grandTotal;

        final updatePayload = <String, dynamic>{
          'total_amount': newTotal,
        };
        if (checkedWaiterId != null) {
          updatePayload['waiter_id'] = checkedWaiterId;
        }

        await SupabaseService.client
            .from('orders')
            .update(updatePayload)
            .eq('id', orderId);
      } else {
        // Create brand-new order record
        final orderPayload = <String, dynamic>{
          'restaurant_id': restaurantId,
          'status': 'placed',
          'total_amount': state.grandTotal,
          'gst_amount': state.taxAmount,
          'is_completed': false,
          'created_at': DateTime.now().toIso8601String(),
        };
        if (parsedTableId != null) {
          orderPayload['table_id'] = parsedTableId;
        }
        if (checkedWaiterId != null) {
          orderPayload['waiter_id'] = checkedWaiterId;
        }

        final orderResponse = await SupabaseService.client
            .from('orders')
            .insert(orderPayload)
            .select('id')
            .single();

        orderId = orderResponse['id'].toString();
      }

      // 2. Create order items records
      final itemsToInsert = state.items.values.map((cartItem) {
        final parsedMenuId = int.tryParse(cartItem.item.id);
        final itemMap = <String, dynamic>{
          'order_id': orderId,
          'restaurant_id': restaurantId,
          'quantity': cartItem.quantity,
          'price_at_time': cartItem.item.effectivePrice,
          'status': 'placed',
          'notes': cartItem.specialInstructions ?? '',
          'created_at': DateTime.now().toIso8601String(),
        };
        if (parsedMenuId != null) {
          itemMap['menu_item_id'] = parsedMenuId;
        }
        return itemMap;
      }).toList();

      await SupabaseService.client.from('order_items').insert(itemsToInsert);

      // 3. Update table status to 'occupied'
      final tableUpdatePayload = <String, dynamic>{
        'status': 'occupied',
        'last_activity_at': DateTime.now().toIso8601String(),
      };
      if (checkedWaiterId != null) {
        tableUpdatePayload['assigned_waiter_id'] = checkedWaiterId;
      }

      await SupabaseService.client
          .from('tables')
          .update(tableUpdatePayload)
          .eq('id', tableIdentifier)
          .eq('restaurant_id', restaurantId);

      // 4. Clear cart & draft
      clearCart();

      state = state.copyWith(isSubmitting: false);
      return true;
    } catch (e) {
      debugPrint('[CartController] Order submission error: $e');
      state = state.copyWith(
        isSubmitting: false,
        errorMessage: 'Failed to send order to kitchen: $e',
      );
      return false;
    }
  }
}
