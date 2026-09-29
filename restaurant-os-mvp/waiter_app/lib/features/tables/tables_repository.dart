import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';
import '../../core/realtime/supabase_service.dart';
import 'table_models.dart';

class TablesRepository {
  Future<List<TableModel>> fetchTables(String restaurantId) async {
    try {
      debugPrint('[TablesRepository] Fetching tables for restaurant: $restaurantId via RPC');
      final response = await SupabaseService.client.rpc(
        'get_tables_by_restaurant',
        params: {'p_restaurant_id': restaurantId},
      );

      final List<dynamic> data = response as List<dynamic>;
      if (data.isNotEmpty) {
        return data.map((json) => TableModel.fromJson(json as Map<String, dynamic>)).toList();
      }

      // Direct query fallback if RPC returns empty
      final directResponse = await SupabaseService.client
          .from('tables')
          .select('*, restaurant_areas(name), table_merge_groups(id, display_name)')
          .eq('restaurant_id', restaurantId)
          .order('table_number', ascending: true);

      return (directResponse as List<dynamic>)
          .map((json) => TableModel.fromJson(json as Map<String, dynamic>))
          .toList();
    } catch (e) {
      debugPrint('[TablesRepository] RPC failed, trying direct query: $e');
      try {
        final directResponse = await SupabaseService.client
            .from('tables')
            .select('*, restaurant_areas(name), table_merge_groups(id, display_name)')
            .eq('restaurant_id', restaurantId)
            .order('table_number', ascending: true);

        return (directResponse as List<dynamic>)
            .map((json) => TableModel.fromJson(json as Map<String, dynamic>))
            .toList();
      } catch (err) {
        debugPrint('[TablesRepository] Direct query also failed: $err');
        throw Exception('Failed to load tables: $err');
      }
    }
  }

  Future<List<AreaModel>> fetchAreas(String restaurantId) async {
    try {
      final response = await SupabaseService.client.rpc(
        'get_areas_by_restaurant',
        params: {'p_restaurant_id': restaurantId},
      );

      final List<dynamic> data = response as List<dynamic>;
      if (data.isNotEmpty) {
        return data.map((json) => AreaModel.fromJson(json as Map<String, dynamic>)).toList();
      }

      // Direct query fallback
      final directResponse = await SupabaseService.client
          .from('restaurant_areas')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .order('display_order', ascending: true);

      return (directResponse as List<dynamic>)
          .map((json) => AreaModel.fromJson(json as Map<String, dynamic>))
          .toList();
    } catch (e) {
      debugPrint('[TablesRepository] Fetch areas fallback: $e');
      try {
        final directResponse = await SupabaseService.client
            .from('restaurant_areas')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .order('display_order', ascending: true);

        return (directResponse as List<dynamic>)
            .map((json) => AreaModel.fromJson(json as Map<String, dynamic>))
            .toList();
      } catch (_) {
        return [];
      }
    }
  }

  Future<void> holdTable(String tableId, String restaurantId) async {
    try {
      await SupabaseService.client
          .from('tables')
          .update({
            'status': 'on_hold',
            'last_activity_at': DateTime.now().toIso8601String(),
          })
          .eq('id', tableId)
          .eq('restaurant_id', restaurantId);
    } catch (e) {
      debugPrint('[TablesRepository] Error holding table: $e');
    }
  }

  Future<void> releaseTableHold(String tableId, String restaurantId) async {
    try {
      await SupabaseService.client
          .from('tables')
          .update({
            'status': 'empty',
            'last_activity_at': DateTime.now().toIso8601String(),
          })
          .eq('id', tableId)
          .eq('status', 'on_hold')
          .eq('restaurant_id', restaurantId);
    } catch (e) {
      debugPrint('[TablesRepository] Error releasing table hold: $e');
    }
  }

  Future<void> updateTableStatus(String tableId, String restaurantId, String newStatus) async {
    try {
      final updateData = <String, dynamic>{
        'status': newStatus,
        'last_activity_at': DateTime.now().toIso8601String(),
      };

      final numTableId = int.tryParse(tableId);

      if (newStatus == 'empty' || newStatus == 'free') {
        updateData['assigned_waiter_id'] = null;
        updateData['customer_present_at'] = null;

        // Complete any active order linked to this table or merge group (using valid enum status 'paid')
        if (numTableId != null) {
          await SupabaseService.client
              .from('orders')
              .update({'is_completed': true, 'status': 'paid'})
              .eq('table_id', numTableId)
              .eq('restaurant_id', restaurantId)
              .eq('is_completed', false);
        } else {
          await SupabaseService.client
              .from('orders')
              .update({'is_completed': true, 'status': 'paid'})
              .eq('merge_group_id', tableId)
              .eq('restaurant_id', restaurantId)
              .eq('is_completed', false);
        }
      }

      if (numTableId != null) {
        await SupabaseService.client
            .from('tables')
            .update(updateData)
            .eq('id', numTableId)
            .eq('restaurant_id', restaurantId);
      } else {
        await SupabaseService.client
            .from('table_merge_groups')
            .update(updateData)
            .eq('id', tableId)
            .eq('restaurant_id', restaurantId);

        final memberTablesResponse = await SupabaseService.client
            .from('tables')
            .select('id')
            .eq('merged_group_id', tableId);

        if (memberTablesResponse is List && memberTablesResponse.isNotEmpty) {
          final memberIds = memberTablesResponse.map((t) => t['id']).toList();
          await SupabaseService.client
              .from('tables')
              .update(updateData)
              .inFilter('id', memberIds);
        }
      }
    } catch (e) {
      debugPrint('[TablesRepository] Error updating table status: $e');
      throw Exception('Failed to update table status: $e');
    }
  }

  Future<void> mergeTables({
    required List<String> tableIds,
    required String restaurantId,
  }) async {
    if (tableIds.length < 2) {
      throw Exception('Select at least 2 tables to merge');
    }

    try {
      final tablesResponse = await SupabaseService.client
          .from('tables')
          .select('id, table_number, capacity')
          .inFilter('id', tableIds)
          .eq('restaurant_id', restaurantId);

      final List<dynamic> tablesList = tablesResponse as List<dynamic>;
      int totalCapacity = 0;
      final List<String> tableNumbers = [];
      for (final t in tablesList) {
        totalCapacity += (t['capacity'] as int?) ?? 4;
        tableNumbers.add(t['table_number'].toString());
      }
      tableNumbers.sort((a, b) => int.tryParse(a)?.compareTo(int.tryParse(b) ?? 0) ?? a.compareTo(b));

      final displayName = 'Table ${tableNumbers.join("+")}';
      final mergeGroupId = const Uuid().v4();

      // 1. Insert into table_merge_groups
      await SupabaseService.client.from('table_merge_groups').insert({
        'id': mergeGroupId,
        'display_name': displayName,
        'total_capacity': totalCapacity,
        'status': 'available',
        'restaurant_id': restaurantId,
      });

      // 2. Update physical tables
      await SupabaseService.client
          .from('tables')
          .update({
            'status': 'empty',
            'is_merged': true,
            'merged_group_id': mergeGroupId,
            'last_activity_at': DateTime.now().toIso8601String(),
          })
          .inFilter('id', tableIds)
          .eq('restaurant_id', restaurantId);
    } catch (e) {
      debugPrint('[TablesRepository] Error merging tables: $e');
      throw Exception('Failed to merge tables: $e');
    }
  }

  Future<void> unmergeTables({
    required String mergeGroupId,
    required String restaurantId,
  }) async {
    try {
      // 1. Update physical tables back to empty & unmerged
      await SupabaseService.client
          .from('tables')
          .update({
            'status': 'empty',
            'is_merged': false,
            'merged_group_id': null,
            'last_activity_at': DateTime.now().toIso8601String(),
          })
          .eq('merged_group_id', mergeGroupId)
          .eq('restaurant_id', restaurantId);

      // 2. Delete merge group
      await SupabaseService.client
          .from('table_merge_groups')
          .delete()
          .eq('id', mergeGroupId)
          .eq('restaurant_id', restaurantId);
    } catch (e) {
      debugPrint('[TablesRepository] Error unmerging tables: $e');
      throw Exception('Failed to unmerge tables: $e');
    }
  }

  Future<void> moveTablesToArea({
    required List<String> tableIds,
    required String? areaId,
    required String restaurantId,
  }) async {
    try {
      await SupabaseService.client
          .from('tables')
          .update({'area_id': areaId})
          .inFilter('id', tableIds)
          .eq('restaurant_id', restaurantId);
    } catch (e) {
      debugPrint('[TablesRepository] Error moving tables: $e');
      throw Exception('Failed to move tables: $e');
    }
  }

  Future<void> togglePinTables({
    required List<String> tableIds,
    required bool isPinned,
    required String restaurantId,
  }) async {
    try {
      await SupabaseService.client
          .from('tables')
          .update({'is_pinned': isPinned})
          .inFilter('id', tableIds)
          .eq('restaurant_id', restaurantId);
    } catch (e) {
      debugPrint('[TablesRepository] Error pinning tables: $e');
      throw Exception('Failed to update pin status: $e');
    }
  }

  Future<List<WaiterModel>> fetchAvailableWaiters({
    required String restaurantId,
    String? excludeEmployeeId,
  }) async {
    try {
      final response = await SupabaseService.client.rpc(
        'get_available_waiters',
        params: {
          'p_restaurant_id': restaurantId,
          if (excludeEmployeeId != null && excludeEmployeeId.isNotEmpty)
            'p_exclude_employee_id': excludeEmployeeId,
        },
      );

      final List<dynamic> data = response as List<dynamic>;
      return data.map((json) => WaiterModel.fromJson(json as Map<String, dynamic>)).toList();
    } catch (e) {
      debugPrint('[TablesRepository] Error fetching available waiters: $e');
      return [];
    }
  }

  Future<Map<String, dynamic>> grantTableAccess({
    required int tableId,
    required String ownerId,
    required String targetWaiterId,
    required String grantType, // 'share' or 'transfer'
  }) async {
    try {
      final response = await SupabaseService.client.rpc(
        'grant_table_access',
        params: {
          'p_table_id': tableId,
          'p_owner_id': ownerId,
          'p_target_waiter_id': targetWaiterId,
          'p_grant_type': grantType,
        },
      );

      return response as Map<String, dynamic>;
    } catch (e) {
      debugPrint('[TablesRepository] Error granting table access: $e');
      throw Exception('Failed to grant table access: $e');
    }
  }

  Future<void> deleteTables({
    required List<String> tableIds,
    required String restaurantId,
  }) async {
    try {
      await SupabaseService.client
          .from('tables')
          .delete()
          .inFilter('id', tableIds)
          .eq('restaurant_id', restaurantId);
    } catch (e) {
      debugPrint('[TablesRepository] Error deleting tables: $e');
      throw Exception('Failed to delete tables: $e');
    }
  }
}
