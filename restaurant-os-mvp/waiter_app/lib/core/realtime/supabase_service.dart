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
  static RealtimeChannel subscribeToTables({
    required String restaurantId,
    required void Function(PostgresChangePayload payload) onTableChange,
  }) {
    final channel = client.channel('waiter-tables-channel-$restaurantId');

    channel.onPostgresChanges(
      event: PostgresChangeEvent.all,
      schema: 'public',
      table: 'tables',
      callback: (payload) {
        final newRecord = payload.newRecord;
        final oldRecord = payload.oldRecord;
        final rowRestId = newRecord['restaurant_id'] ?? oldRecord['restaurant_id'];

        if (rowRestId == null || rowRestId.toString() == restaurantId) {
          debugPrint('[Realtime] Table changed for $restaurantId: ${payload.eventType}');
          onTableChange(payload);
        }
      },
    ).subscribe((status, [error]) {
      debugPrint('[Realtime] Tables channel status: $status ${error ?? ""}');
    });

    return channel;
  }

  // Subscribe to live orders & kitchen status changes
  static RealtimeChannel subscribeToOrders({
    required String restaurantId,
    required void Function(PostgresChangePayload payload) onOrderChange,
  }) {
    final channel = client.channel('waiter-orders-channel-$restaurantId');

    channel.onPostgresChanges(
      event: PostgresChangeEvent.all,
      schema: 'public',
      table: 'orders',
      callback: (payload) {
        final newRecord = payload.newRecord;
        final oldRecord = payload.oldRecord;
        final rowRestId = newRecord['restaurant_id'] ?? oldRecord['restaurant_id'];

        if (rowRestId == null || rowRestId.toString() == restaurantId) {
          debugPrint('[Realtime] Order changed for $restaurantId: ${payload.eventType}');
          onOrderChange(payload);
        }
      },
    ).subscribe((status, [error]) {
      debugPrint('[Realtime] Orders channel status: $status ${error ?? ""}');
    });

    return channel;
  }

  // Subscribe to service requests
  static RealtimeChannel subscribeToServiceRequests({
    required String restaurantId,
    required void Function(PostgresChangePayload payload) onRequestChange,
  }) {
    final channel = client.channel('waiter-requests-channel-$restaurantId');

    channel.onPostgresChanges(
      event: PostgresChangeEvent.all,
      schema: 'public',
      table: 'service_requests',
      callback: (payload) {
        final newRecord = payload.newRecord;
        final oldRecord = payload.oldRecord;
        final rowRestId = newRecord['restaurant_id'] ?? oldRecord['restaurant_id'];

        if (rowRestId == null || rowRestId.toString() == restaurantId) {
          debugPrint('[Realtime] Service request changed for $restaurantId: ${payload.eventType}');
          onRequestChange(payload);
        }
      },
    ).subscribe((status, [error]) {
      debugPrint('[Realtime] Requests channel status: $status ${error ?? ""}');
    });

    return channel;
  }

  // Subscribe to real-time dish ready alerts from order_items & service_requests
  static RealtimeChannel subscribeToKitchenReadyAlerts({
    required String restaurantId,
    required void Function(Map<String, dynamic> itemRecord) onDishReady,
  }) {
    final channel = client.channel('waiter-kitchen-ready-channel-$restaurantId');

    // 1. Listen to order_items updates
    channel.onPostgresChanges(
      event: PostgresChangeEvent.update,
      schema: 'public',
      table: 'order_items',
      callback: (payload) {
        final newRecord = payload.newRecord;
        final oldRecord = payload.oldRecord;
        final rowRestId = newRecord['restaurant_id'] ?? oldRecord['restaurant_id'];

        if (rowRestId != null && rowRestId.toString() != restaurantId) return;

        final newStatus = newRecord['status']?.toString().toLowerCase();
        final oldStatus = oldRecord['status']?.toString().toLowerCase();

        if (newStatus == 'ready' && oldStatus != 'ready') {
          debugPrint('[Realtime] Dish ready event detected for item: ${newRecord['id']}');
          onDishReady(newRecord);
        }
      },
    );

    // 2. Listen to service_requests where request_type == 'order_ready'
    channel.onPostgresChanges(
      event: PostgresChangeEvent.all,
      schema: 'public',
      table: 'service_requests',
      callback: (payload) {
        final newRecord = payload.newRecord;
        final rowRestId = newRecord['restaurant_id'];

        if (rowRestId != null && rowRestId.toString() != restaurantId) return;

        if (newRecord['request_type'] == 'order_ready' && newRecord['request_status'] == 'pending') {
          debugPrint('[Realtime] Service request order_ready detected for table: ${newRecord['table_id']}');
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
