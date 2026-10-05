import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../config/app_config.dart';

class SupabaseService {
  static SupabaseClient get client => Supabase.instance.client;

  static Future<void> initialize() async {
    await Supabase.initialize(
      url: AppConfig.supabaseUrl,
      anonKey: AppConfig.supabaseAnonKey,
      realtimeClientOptions: const RealtimeClientOptions(
        eventsPerSecond: 10,
      ),
    );
    debugPrint('[SupabaseService] Initialized successfully.');
  }

  // Subscribe to table changes scoped by restaurant_id
  // Subscribe to table changes scoped by restaurant_id
  static RealtimeChannel? subscribeToTables({
    required String restaurantId,
    required void Function(PostgresChangePayload payload) onTableChange,
  }) {
    if (restaurantId.trim().isEmpty) {
      debugPrint('[Realtime] Cannot subscribe to tables: restaurantId is empty.');
      return null;
    }
    final sanitizedRestId = restaurantId.trim();
    final channel = client.channel('waiter-tables-channel-$sanitizedRestId');

    channel.onPostgresChanges(
      event: PostgresChangeEvent.all,
      schema: 'public',
      table: 'tables',
      filter: PostgresChangeFilter(
        type: PostgresChangeFilterType.eq,
        column: 'restaurant_id',
        value: sanitizedRestId,
      ),
      callback: (payload) {
        final newRecord = payload.newRecord;
        final oldRecord = payload.oldRecord;
        final rowRestId = newRecord['restaurant_id'] ?? oldRecord['restaurant_id'];

        if (rowRestId != null && rowRestId.toString() == sanitizedRestId) {
          debugPrint('[Realtime] Table changed for $sanitizedRestId: ${payload.eventType}');
          onTableChange(payload);
        }
      },
    ).subscribe((status, [error]) {
      debugPrint('[Realtime] Tables channel status: $status ${error ?? ""}');
    });

    return channel;
  }

  // Subscribe to live orders & kitchen status changes
  static RealtimeChannel? subscribeToOrders({
    required String restaurantId,
    required void Function(PostgresChangePayload payload) onOrderChange,
  }) {
    if (restaurantId.trim().isEmpty) {
      debugPrint('[Realtime] Cannot subscribe to orders: restaurantId is empty.');
      return null;
    }
    final sanitizedRestId = restaurantId.trim();
    final channel = client.channel('waiter-orders-channel-$sanitizedRestId');

    channel.onPostgresChanges(
      event: PostgresChangeEvent.all,
      schema: 'public',
      table: 'orders',
      filter: PostgresChangeFilter(
        type: PostgresChangeFilterType.eq,
        column: 'restaurant_id',
        value: sanitizedRestId,
      ),
      callback: (payload) {
        final newRecord = payload.newRecord;
        final oldRecord = payload.oldRecord;
        final rowRestId = newRecord['restaurant_id'] ?? oldRecord['restaurant_id'];

        if (rowRestId != null && rowRestId.toString() == sanitizedRestId) {
          debugPrint('[Realtime] Order changed for $sanitizedRestId: ${payload.eventType}');
          onOrderChange(payload);
        }
      },
    ).subscribe((status, [error]) {
      debugPrint('[Realtime] Orders channel status: $status ${error ?? ""}');
    });

    return channel;
  }

  // Subscribe to service requests
  static RealtimeChannel? subscribeToServiceRequests({
    required String restaurantId,
    required void Function(PostgresChangePayload payload) onRequestChange,
  }) {
    if (restaurantId.trim().isEmpty) {
      debugPrint('[Realtime] Cannot subscribe to service requests: restaurantId is empty.');
      return null;
    }
    final sanitizedRestId = restaurantId.trim();
    final channel = client.channel('waiter-requests-channel-$sanitizedRestId');

    channel.onPostgresChanges(
      event: PostgresChangeEvent.all,
      schema: 'public',
      table: 'service_requests',
      filter: PostgresChangeFilter(
        type: PostgresChangeFilterType.eq,
        column: 'restaurant_id',
        value: sanitizedRestId,
      ),
      callback: (payload) {
        final newRecord = payload.newRecord;
        final oldRecord = payload.oldRecord;
        final rowRestId = newRecord['restaurant_id'] ?? oldRecord['restaurant_id'];

        if (rowRestId != null && rowRestId.toString() == sanitizedRestId) {
          debugPrint('[Realtime] Service request changed for $sanitizedRestId: ${payload.eventType}');
          onRequestChange(payload);
        }
      },
    ).subscribe((status, [error]) {
      debugPrint('[Realtime] Requests channel status: $status ${error ?? ""}');
    });

    return channel;
  }

  // Subscribe to real-time dish ready alerts from order_items & service_requests
  static RealtimeChannel? subscribeToKitchenReadyAlerts({
    required String restaurantId,
    String? branchId,
    required void Function(Map<String, dynamic> itemRecord) onDishReady,
  }) {
    if (restaurantId.trim().isEmpty) {
      debugPrint('[Realtime] Cannot subscribe to kitchen ready alerts: restaurantId is empty.');
      return null;
    }

    final sanitizedRestId = restaurantId.trim();
    final channelName = 'waiter-kitchen-ready-channel-$sanitizedRestId${branchId != null && branchId.isNotEmpty ? "-$branchId" : ""}';
    final channel = client.channel(channelName);

    // 1. Listen to order_items updates with server-side tenant filter (P1-01)
    channel.onPostgresChanges(
      event: PostgresChangeEvent.update,
      schema: 'public',
      table: 'order_items',
      filter: PostgresChangeFilter(
        type: PostgresChangeFilterType.eq,
        column: 'restaurant_id',
        value: sanitizedRestId,
      ),
      callback: (payload) {
        final newRecord = payload.newRecord;
        final oldRecord = payload.oldRecord;
        final rowRestId = newRecord['restaurant_id'] ?? oldRecord['restaurant_id'];

        // Strict cross-tenant defense-in-depth
        if (rowRestId == null || rowRestId.toString() != sanitizedRestId) return;

        // Branch-level isolation if branchId is provided
        if (branchId != null && branchId.isNotEmpty) {
          final rowBranchId = newRecord['branch_id'] ?? oldRecord['branch_id'];
          if (rowBranchId != null && rowBranchId.toString() != branchId) return;
        }

        final newStatus = newRecord['status']?.toString().toLowerCase();
        final oldStatus = oldRecord['status']?.toString().toLowerCase();

        if (newStatus == 'ready' && oldStatus != 'ready') {
          debugPrint('[Realtime] Dish ready event detected for item: ${newRecord['id']} (restaurant: $sanitizedRestId)');
          onDishReady(newRecord);
        }
      },
    );

    // 2. Listen to service_requests with server-side tenant filter (P1-01)
    channel.onPostgresChanges(
      event: PostgresChangeEvent.all,
      schema: 'public',
      table: 'service_requests',
      filter: PostgresChangeFilter(
        type: PostgresChangeFilterType.eq,
        column: 'restaurant_id',
        value: sanitizedRestId,
      ),
      callback: (payload) {
        final newRecord = payload.newRecord;
        final rowRestId = newRecord['restaurant_id'];

        // Strict cross-tenant defense-in-depth
        if (rowRestId == null || rowRestId.toString() != sanitizedRestId) return;

        // Branch-level isolation if branchId is provided
        if (branchId != null && branchId.isNotEmpty) {
          final rowBranchId = newRecord['branch_id'];
          if (rowBranchId != null && rowBranchId.toString() != branchId) return;
        }

        if (newRecord['request_type'] == 'order_ready' && newRecord['request_status'] == 'pending') {
          debugPrint('[Realtime] Service request order_ready detected for table: ${newRecord['table_id']} (restaurant: $sanitizedRestId)');
          onDishReady({
            'is_service_request': true,
            'table_id': newRecord['table_id'],
            'notes': newRecord['notes'] ?? 'Order is ready for pick up',
          });
        }
      },
    ).subscribe((status, [error]) {
      debugPrint('[Realtime] Kitchen ready channel status: $status ${error ?? ""}');
    });

    return channel;
  }
}
