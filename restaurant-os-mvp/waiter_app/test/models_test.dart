import 'package:flutter_test/flutter_test.dart';
import 'package:waiter_app/features/cart/cart_models.dart';
import 'package:waiter_app/features/menu/menu_models.dart';
import 'package:waiter_app/features/tables/table_models.dart';
import 'package:waiter_app/features/requests/service_request_model.dart';

void main() {
  group('TableModel Tests', () {
    test('Correctly parses json and determines available status', () {
      final table = TableModel.fromJson({
        'id': 't-1',
        'table_number': '1',
        'status': 'empty',
        'capacity': 4,
      });

      expect(table.id, 't-1');
      expect(table.tableNumber, '1');
      expect(table.isAvailable, true);
      expect(table.isCooking, false);
      expect(table.formattedName, 'Table 1');
    });

    test('Correctly identifies on_hold status', () {
      final table = TableModel.fromJson({
        'id': 't-2',
        'table_number': '2',
        'status': 'on_hold',
        'capacity': 6,
      });

      expect(table.isOnHold, true);
      expect(table.isAvailable, false);
    });

    test('Consolidates merged physical tables into a single unified table with combined capacity', () {
      final t1 = TableModel(
        id: '1',
        tableNumber: '1',
        status: 'occupied',
        capacity: 4,
        isMerged: true,
        mergedGroupId: 'grp-12',
      );
      final t2 = TableModel(
        id: '2',
        tableNumber: '2',
        status: 'occupied',
        capacity: 6,
        isMerged: true,
        mergedGroupId: 'grp-12',
      );
      final t3 = TableModel(
        id: '3',
        tableNumber: '3',
        status: 'available',
        capacity: 4,
        isMerged: false,
      );

      final consolidated = TableModel.consolidateMergedTables([t1, t2, t3]);
      expect(consolidated.length, 2); // 1 merged table + 1 normal table
      
      final merged = consolidated.firstWhere((t) => t.isMerged);
      expect(merged.formattedName, 'Table 1+2');
      expect(merged.capacity, 10); // 4 + 6 = 10
      expect(merged.mergedTableIds, ['1', '2']);
      // Without any ordered items/active order total, merged table is available
      expect(merged.isAvailable, isTrue);
      expect(merged.isOccupied, isFalse);

      // When items are ordered on the merged table
      final t1WithOrder = TableModel(
        id: '1',
        tableNumber: '1',
        status: 'available',
        capacity: 4,
        isMerged: true,
        mergedGroupId: 'grp-12',
        activeItemCount: 2,
        activeOrderTotal: 500,
      );
      final consolidatedWithOrder = TableModel.consolidateMergedTables([t1WithOrder, t2, t3]);
      final mergedWithOrder = consolidatedWithOrder.firstWhere((t) => t.isMerged);
      expect(mergedWithOrder.isOccupied, isTrue);
      expect(mergedWithOrder.activeItemCount, 2);
    });
  });

  group('Cart Calculation Tests', () {
    test('Calculates subtotal, 5% GST tax and grand total accurately', () {
      final item1 = MenuItemModel(
        id: 'm-1',
        name: 'Butter Chicken',
        price: 350,
        categoryId: 'c-1',
      );

      final item2 = MenuItemModel(
        id: 'm-2',
        name: 'Garlic Naan',
        price: 50,
        categoryId: 'c-2',
      );

      final cartState = CartState(
        tableId: 't-1',
        tableNumber: '1',
        items: {
          'm-1': CartItem(item: item1, quantity: 2), // 700
          'm-2': CartItem(item: item2, quantity: 3), // 150
        },
      );

      expect(cartState.totalItemCount, 5);
      expect(cartState.subtotal, 850);
      expect(cartState.taxAmount, 42.5); // 5% of 850
      expect(cartState.grandTotal, 892.5);
    });
  });

  group('ServiceRequestModel Tests', () {
    test('Formats request title appropriately', () {
      final req = ServiceRequestModel(
        id: 'r-1',
        tableId: 't-1',
        tableNumber: '4',
        requestType: 'water_requested',
        requestStatus: 'pending',
        serviceLabel: 'Water',
        imageUrl: '/services/Water.png',
      );

      expect(req.formattedTitle, 'Water');
      expect(req.formattedTableName, 'Table 4');
      expect(req.imageUrl, '/services/Water.png');
      expect(req.isPending, true);
    });

    test('Table access request is ONLY visible to receiver (assigned waiter) and admin, NOT to requester or other waiters', () {
      final tableAccessReq = ServiceRequestModel(
        id: 'r-10',
        tableId: '3',
        tableNumber: '3',
        requestType: 'table_access_request',
        requestStatus: 'pending',
        assignedWaiterId: 'waiter-assigned-2',
        additionalNotes: '{"requester_id": "waiter-requester-1", "requester_name": "Srinivas", "requester_mobile": "8247005501"}',
      );

      // 1. Requester (waiter-requester-1) should NOT see it as an incoming alert/request to approve
      expect(tableAccessReq.isVisibleToUser(currentUserId: 'waiter-requester-1', userRole: 'waiter'), false);

      // 2. Assigned Waiter / Receiver (waiter-assigned-2) MUST see it
      expect(tableAccessReq.isVisibleToUser(currentUserId: 'waiter-assigned-2', userRole: 'waiter'), true);

      // 3. Any third waiter (waiter-other-3) should NOT see it
      expect(tableAccessReq.isVisibleToUser(currentUserId: 'waiter-other-3', userRole: 'waiter'), false);

      // 4. Admin CAN see it
      expect(tableAccessReq.isVisibleToUser(currentUserId: 'admin-user', userRole: 'admin'), true);
    });

    test('Customer service request is visible to assigned waiter or all waiters if unassigned', () {
      final assignedReq = ServiceRequestModel(
        id: 'r-11',
        tableId: '5',
        tableNumber: '5',
        requestType: 'water_requested',
        requestStatus: 'pending',
        assignedWaiterId: 'waiter-assigned-2',
      );

      expect(assignedReq.isVisibleToUser(currentUserId: 'waiter-assigned-2', userRole: 'waiter'), true);
      expect(assignedReq.isVisibleToUser(currentUserId: 'waiter-other-3', userRole: 'waiter'), false);
      expect(assignedReq.isVisibleToUser(currentUserId: 'admin-user', userRole: 'admin'), true);

      final unassignedReq = ServiceRequestModel(
        id: 'r-12',
        tableId: '6',
        tableNumber: '6',
        requestType: 'call_waiter',
        requestStatus: 'pending',
        assignedWaiterId: null,
      );

      expect(unassignedReq.isVisibleToUser(currentUserId: 'waiter-1', userRole: 'waiter'), false);
      expect(unassignedReq.isVisibleToUser(currentUserId: 'waiter-2', userRole: 'waiter'), false);
      expect(unassignedReq.isVisibleToUser(currentUserId: 'admin-1', userRole: 'admin'), true);
    });

    test('Co-waiters can view customer requests and manage co-managed tables', () {
      final table = TableModel(
        id: '10',
        tableNumber: '10',
        status: 'occupied',
        capacity: 4,
        assignedWaiterId: 'waiter-primary',
        coWaiterIds: ['waiter-shared-1', 'waiter-shared-2'],
      );

      // Primary waiter is authorized
      expect(table.isWaiterAuthorized('waiter-primary'), true);
      // Co-waiters are authorized
      expect(table.isWaiterAuthorized('waiter-shared-1'), true);
      expect(table.isWaiterAuthorized('waiter-shared-2'), true);
      // Unrelated waiter is NOT authorized
      expect(table.isWaiterAuthorized('waiter-stranger'), false);
      // Admin is authorized
      expect(table.isWaiterAuthorized('admin-user', isAdmin: true), true);

      final req = ServiceRequestModel(
        id: 'r-15',
        tableId: '10',
        tableNumber: '10',
        requestType: 'need_bill',
        requestStatus: 'pending',
        assignedWaiterId: 'waiter-primary',
      );

      // Co-waiter can see request when coWaiterIds is provided
      expect(req.isVisibleToUser(currentUserId: 'waiter-shared-1', userRole: 'waiter', coWaiterIds: table.coWaiterIds), true);
      expect(req.isVisibleToUser(currentUserId: 'waiter-stranger', userRole: 'waiter', coWaiterIds: table.coWaiterIds), false);
    });
  });
}
