import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SessionData {
  final String userId;
  final String employeeId;
  final String name;
  final String mobile;
  final String role;
  final String restaurantId;
  final String restaurantName;
  final String restaurantSlug;
  final List<String> permissions;
  final String? avatarUrl;

  SessionData({
    required this.userId,
    required this.employeeId,
    required this.name,
    required this.mobile,
    required this.role,
    required this.restaurantId,
    required this.restaurantName,
    required this.restaurantSlug,
    required this.permissions,
    this.avatarUrl,
  });

  SessionData copyWith({
    String? userId,
    String? employeeId,
    String? name,
    String? mobile,
    String? role,
    String? restaurantId,
    String? restaurantName,
    String? restaurantSlug,
    List<String>? permissions,
    String? avatarUrl,
  }) {
    return SessionData(
      userId: userId ?? this.userId,
      employeeId: employeeId ?? this.employeeId,
      name: name ?? this.name,
      mobile: mobile ?? this.mobile,
      role: role ?? this.role,
      restaurantId: restaurantId ?? this.restaurantId,
      restaurantName: restaurantName ?? this.restaurantName,
      restaurantSlug: restaurantSlug ?? this.restaurantSlug,
      permissions: permissions ?? this.permissions,
      avatarUrl: avatarUrl ?? this.avatarUrl,
    );
  }

  factory SessionData.fromJson(Map<String, dynamic> json, List<String> permissions) {
    return SessionData(
      userId: json['userId'] ?? json['id'] ?? '',
      employeeId: json['employeeId'] ?? json['employee_id'] ?? '',
      name: json['name'] ?? 'Waiter',
      mobile: json['mobile'] ?? '',
      role: json['role'] ?? 'waiter',
      restaurantId: json['restaurantId'] ?? json['restaurant_id'] ?? '',
      restaurantName: json['restaurantName'] ?? 'Dine in One Partner',
      restaurantSlug: json['restaurantSlug'] ?? json['slug'] ?? '',
      permissions: permissions,
      avatarUrl: json['avatarUrl'] ?? json['avatar_url'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'userId': userId,
      'employeeId': employeeId,
      'name': name,
      'mobile': mobile,
      'role': role,
      'restaurantId': restaurantId,
      'restaurantName': restaurantName,
      'restaurantSlug': restaurantSlug,
      'permissions': permissions,
      'avatarUrl': avatarUrl,
    };
  }
}

class SecureStorageService {
  static const FlutterSecureStorage _secureStorage = FlutterSecureStorage();
  
  static const String _keyToken = 'waiter_auth_token';
  static const String _keySession = 'waiter_session_data';
  static const String _keyDraftOrder = 'waiter_draft_order_';

  static Future<void> saveSession({
    required String token,
    required SessionData session,
  }) async {
    await _secureStorage.write(key: _keyToken, value: token);
    await _secureStorage.write(key: _keySession, value: jsonEncode(session.toJson()));
  }

  static Future<String?> getToken() async {
    return await _secureStorage.read(key: _keyToken);
  }

  static Future<SessionData?> getSession() async {
    try {
      final sessionString = await _secureStorage.read(key: _keySession);
      if (sessionString == null) return null;
      final Map<String, dynamic> json = jsonDecode(sessionString);
      final List<String> perms = (json['permissions'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [];
      return SessionData.fromJson(json, perms);
    } catch (e) {
      return null;
    }
  }

  static Future<void> clearSession() async {
    await _secureStorage.delete(key: _keyToken);
    await _secureStorage.delete(key: _keySession);
  }

  // Offline Draft Caching using SharedPreferences
  static Future<void> saveDraftOrder(String tableId, Map<String, dynamic> cartJson) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('$_keyDraftOrder$tableId', jsonEncode(cartJson));
  }

  static Future<Map<String, dynamic>?> getDraftOrder(String tableId) async {
    final prefs = await SharedPreferences.getInstance();
    final data = prefs.getString('$_keyDraftOrder$tableId');
    if (data == null) return null;
    try {
      return jsonDecode(data) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  static Future<void> clearDraftOrder(String tableId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('$_keyDraftOrder$tableId');
  }
}
