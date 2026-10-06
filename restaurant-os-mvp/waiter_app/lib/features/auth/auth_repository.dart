import 'package:flutter/foundation.dart';
import '../../core/realtime/supabase_service.dart';
import '../../core/storage/secure_storage_service.dart';

class AuthRepository {
  Future<SessionData> loginWithMobile(String mobile) async {
    try {
      final cleanMobile = mobile.replaceAll(RegExp(r'[^0-9]'), '');
      final searchMobile = cleanMobile.length >= 10 
          ? cleanMobile.substring(cleanMobile.length - 10) 
          : cleanMobile;

      List<dynamic> employees = [];
      if (searchMobile.length >= 10) {
        debugPrint('[AuthRepository] Querying RPC get_employee_by_mobile for: $searchMobile');
        try {
          final response = await SupabaseService.client.rpc(
            'get_employee_by_mobile',
            params: {'phone_input': searchMobile},
          );
          if (response is List) {
            employees = response;
          }
        } catch (e) {
          debugPrint('[AuthRepository] RPC error: $e');
        }
      }

      // Fallback: search by employee_id or mobile directly in employees table
      if (employees.isEmpty) {
        final trimmed = mobile.trim();
        final direct = await SupabaseService.client
            .from('employees')
            .select()
            .or('employee_id.eq.$trimmed,id.eq.$trimmed,mobile.ilike.%$trimmed%')
            .limit(5);
        if (direct is List && direct.isNotEmpty) {
          employees = direct;
        }
      }

      if (employees.isEmpty) {
        throw Exception('No employee account found with mobile or employee ID "$mobile". Please check the number or contact your manager.');
      }

      // 2. Select valid active waiter / employee (prioritizing 202603180001)
      final employee = employees.firstWhere(
        (emp) {
          final status = (emp['status'] ?? '').toString().toLowerCase();
          final approval = (emp['approval_status'] ?? '').toString().toLowerCase();
          final role = (emp['role'] ?? '').toString().toLowerCase();
          final isRole = role == 'waiter' || role == 'admin' || role == 'supervisor';
          return isRole && (status == 'active' || approval == 'approved');
        },
        orElse: () => employees.first,
      ) as Map<String, dynamic>;

      final String empId = employee['id'].toString();
      final String employeeId = employee['employee_id']?.toString() ?? empId;
      final String name = employee['name']?.toString() ?? 'Waiter';
      final String empMobile = employee['mobile']?.toString() ?? searchMobile;
      final String role = employee['role']?.toString() ?? 'waiter';
      final String restaurantId = employee['restaurant_id']?.toString() ?? '202603180001';
      final String? avatarUrl = employee['avatar_url']?.toString();

      debugPrint('[AuthRepository] Logged in successfully: $name ($role) - Restaurant: $restaurantId - Avatar: $avatarUrl');

      final session = SessionData(
        userId: empId,
        employeeId: employeeId,
        name: name,
        mobile: empMobile,
        role: role,
        restaurantId: restaurantId,
        restaurantName: 'Minerva',
        restaurantSlug: restaurantId,
        avatarUrl: avatarUrl,
        branchId: employee['branch_id']?.toString(),
        permissions: const [
          'view_tables',
          'create_orders',
          'modify_orders',
          'mark_served',
          'view_requests',
          'request_bill',
          'merge_tables',
        ],
      );

      // 3. Persist session to secure storage
      await SecureStorageService.saveSession(
        token: 'token_$empId',
        session: session,
      );

      return session;
    } catch (e) {
      debugPrint('[AuthRepository] Login error: $e');
      final msg = e.toString().replaceAll('Exception: ', '');
      throw Exception(msg);
    }
  }

  Future<SessionData?> getExistingSession() async {
    final existing = await SecureStorageService.getSession();
    if (existing != null && existing.mobile.isNotEmpty) {
      try {
        // Refresh session with active restaurant from server
        return await loginWithMobile(existing.mobile);
      } catch (_) {
        return existing;
      }
    }
    return existing;
  }

  Future<void> logout() async {
    await SecureStorageService.clearSession();
  }
}
