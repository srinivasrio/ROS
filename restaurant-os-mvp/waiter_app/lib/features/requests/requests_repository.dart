import 'package:flutter/foundation.dart';
import '../../core/realtime/supabase_service.dart';
import 'service_request_model.dart';

class RequestsRepository {
  Future<List<ServiceRequestModel>> fetchRequests(String restaurantId) async {
    try {
      final response = await SupabaseService.client.rpc(
        'get_service_requests_by_restaurant',
        params: {'p_restaurant_id': restaurantId},
      );

      final List<dynamic> data = response as List<dynamic>;
      return data
          .map((json) => ServiceRequestModel.fromJson(json as Map<String, dynamic>))
          .where((req) => req.status != 'completed')
          .toList();
    } catch (e) {
      debugPrint('[RequestsRepository] Error fetching requests: $e');
      return [];
    }
  }

  Future<void> acceptRequest(String requestId, [String? waiterId]) async {
    try {
      final reqId = int.tryParse(requestId) ?? requestId;
      final updateData = <String, dynamic>{
        'request_status': 'accepted',
        'accepted_at': DateTime.now().toIso8601String(),
      };

      final uuidRegex = RegExp(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$');
      if (waiterId != null && uuidRegex.hasMatch(waiterId)) {
        updateData['assigned_waiter_id'] = waiterId;
        updateData['accepted_by'] = waiterId;
      }

      await SupabaseService.client
          .from('service_requests')
          .update(updateData)
          .eq('id', reqId);
    } catch (e) {
      debugPrint('[RequestsRepository] Error accepting request: $e');
      rethrow;
    }
  }

  Future<void> completeRequest(String requestId) async {
    try {
      final reqId = int.tryParse(requestId) ?? requestId;
      await SupabaseService.client
          .from('service_requests')
          .update({
            'request_status': 'completed',
            'completed_at': DateTime.now().toIso8601String(),
          })
          .eq('id', reqId);
    } catch (e) {
      debugPrint('[RequestsRepository] Error completing request: $e');
      rethrow;
    }
  }

  Future<void> requestTableAccess({
    required String tableId,
    required String requesterId,
    required String requesterName,
    required String restaurantId,
  }) async {
    try {
      final tId = int.tryParse(tableId) ?? 0;
      final res = await SupabaseService.client.rpc(
        'request_table_access',
        params: {
          'p_table_id': tId,
          'p_requester_id': requesterId,
          'p_requester_name': requesterName,
          'p_restaurant_id': restaurantId,
        },
      );
      debugPrint('[RequestsRepository] requestTableAccess response: $res');
    } catch (e) {
      debugPrint('[RequestsRepository] Error requesting table access: $e');
      rethrow;
    }
  }

  Future<Map<String, dynamic>?> approveTableAccess({
    required String requestId,
    required String approverId,
    String transferType = 'share',
  }) async {
    try {
      final reqId = int.tryParse(requestId) ?? 0;
      final res = await SupabaseService.client.rpc(
        'approve_table_access',
        params: {
          'p_request_id': reqId,
          'p_approver_id': approverId,
          'p_transfer_type': transferType,
        },
      );
      debugPrint('[RequestsRepository] approveTableAccess response: $res');
      return res is Map<String, dynamic> ? res : null;
    } catch (e) {
      debugPrint('[RequestsRepository] Error approving table access: $e');
      rethrow;
    }
  }

  Future<void> declineTableAccess({
    required String requestId,
    required String declinerId,
  }) async {
    try {
      final reqId = int.tryParse(requestId) ?? 0;
      final res = await SupabaseService.client.rpc(
        'decline_table_access',
        params: {
          'p_request_id': reqId,
          'p_decliner_id': declinerId,
        },
      );
      debugPrint('[RequestsRepository] declineTableAccess response: $res');
    } catch (e) {
      debugPrint('[RequestsRepository] Error declining table access: $e');
      rethrow;
    }
  }
}
