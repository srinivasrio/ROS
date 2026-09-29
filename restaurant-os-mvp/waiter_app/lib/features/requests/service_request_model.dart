import 'dart:convert';

class ServiceRequestModel {
  final String id;
  final String tableId;
  final String? tableNumber;
  final String requestType; // 'call_waiter' | 'water_requested' | 'cutlery_requested' | 'bill_requested'
  final String requestStatus; // 'pending' | 'accepted' | 'completed'
  final int quantity;
  final String? additionalNotes;
  final DateTime? createdAt;
  final String? serviceLabel;
  final String? imageUrl;
  final String? assignedWaiterId;

  ServiceRequestModel({
    required this.id,
    required this.tableId,
    this.tableNumber,
    required this.requestType,
    required this.requestStatus,
    this.quantity = 1,
    this.additionalNotes,
    this.createdAt,
    this.serviceLabel,
    this.imageUrl,
    this.assignedWaiterId,
  });

  factory ServiceRequestModel.fromJson(Map<String, dynamic> json) {
    return ServiceRequestModel(
      id: json['id'].toString(),
      tableId: json['table_id']?.toString() ?? '',
      tableNumber: json['table_number']?.toString() ?? json['tables']?['table_number']?.toString(),
      requestType: json['request_type'] ?? 'call_waiter',
      requestStatus: json['request_status'] ?? json['status'] ?? 'pending',
      quantity: json['quantity'] is int ? json['quantity'] : (int.tryParse(json['quantity']?.toString() ?? '1') ?? 1),
      additionalNotes: json['additional_notes'] ?? json['notes'],
      createdAt: json['created_at'] != null ? DateTime.tryParse(json['created_at']) : null,
      serviceLabel: json['service_label'] ?? json['label'],
      imageUrl: json['image_url'],
      assignedWaiterId: json['assigned_waiter_id']?.toString() ?? json['waiter_id']?.toString(),
    );
  }

  String get status => requestStatus;

  String get formattedTableName {
    final num = tableNumber ?? tableId;
    if (num.isEmpty) return 'Table';
    if (num.toLowerCase().startsWith('table')) return num;
    return 'Table $num';
  }

  bool get isPending => requestStatus.toLowerCase() == 'pending';
  bool get isAccepted => requestStatus.toLowerCase() == 'accepted';
  bool get isCompleted => requestStatus.toLowerCase() == 'completed';
  bool get isTableAccessRequest => requestType.toLowerCase() == 'table_access_request';

  String? get requesterName {
    if (additionalNotes == null || additionalNotes!.isEmpty) return null;
    try {
      final data = jsonDecode(additionalNotes!);
      if (data is Map && data['requester_name'] != null) {
        return data['requester_name'].toString();
      }
    } catch (_) {}
    return null;
  }

  String? get requesterAvatar {
    if (additionalNotes == null || additionalNotes!.isEmpty) return null;
    try {
      final data = jsonDecode(additionalNotes!);
      if (data is Map && data['requester_avatar'] != null) {
        return data['requester_avatar'].toString();
      }
    } catch (_) {}
    return null;
  }

  String? get requesterId {
    if (additionalNotes == null || additionalNotes!.isEmpty) return null;
    try {
      final data = jsonDecode(additionalNotes!);
      if (data is Map && data['requester_id'] != null) {
        return data['requester_id'].toString();
      }
    } catch (_) {}
    return null;
  }

  String? get requesterMobile {
    if (additionalNotes == null || additionalNotes!.isEmpty) return null;
    try {
      final data = jsonDecode(additionalNotes!);
      if (data is Map && data['requester_mobile'] != null) {
        return data['requester_mobile'].toString();
      }
    } catch (_) {}
    return null;
  }

  String? get displayNotes {
    if (additionalNotes == null) return null;
    final trimmed = additionalNotes!.trim();
    if (trimmed.isEmpty) return null;

    // Filter out raw JSON objects and arrays
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        final data = jsonDecode(trimmed);
        if (data is Map) {
          if (data['note'] != null && data['note'].toString().trim().isNotEmpty) {
            return data['note'].toString().trim();
          }
          if (data['custom_note'] != null && data['custom_note'].toString().trim().isNotEmpty) {
            return data['custom_note'].toString().trim();
          }
          if (data['special_instructions'] != null && data['special_instructions'].toString().trim().isNotEmpty) {
            return data['special_instructions'].toString().trim();
          }
        }
      } catch (_) {}
      return null;
    }

    return trimmed;
  }

  bool isVisibleToUser({
    String? currentUserId,
    String? currentEmployeeId,
    String? currentMobile,
    String? userRole,
    List<String>? coWaiterIds,
  }) {
    final role = (userRole ?? '').toLowerCase();
    final isAdmin = role == 'admin' || role == 'supervisor' || role == 'restaurant_admin';
    if (isAdmin) return true;

    final userIds = [
      if (currentUserId != null && currentUserId.isNotEmpty) currentUserId.trim().toLowerCase(),
      if (currentEmployeeId != null && currentEmployeeId.isNotEmpty) currentEmployeeId.trim().toLowerCase(),
      if (currentMobile != null && currentMobile.isNotEmpty) currentMobile.trim().toLowerCase(),
    ];

    if (isTableAccessRequest) {
      // 1. The requester is NOT the approver/receiver
      final reqId = requesterId?.trim().toLowerCase();
      final reqMob = requesterMobile?.trim().toLowerCase();
      if (reqId != null && userIds.contains(reqId)) return false;
      if (reqMob != null && userIds.contains(reqMob)) return false;

      // 2. Only the assigned waiter (receiver) can see and approve
      final assigned = assignedWaiterId?.trim().toLowerCase();
      if (assigned != null && assigned.isNotEmpty) {
        return userIds.contains(assigned);
      }
      return false;
    }

    // Customer service requests
    final assigned = assignedWaiterId?.trim().toLowerCase();
    if (assigned != null && assigned.isNotEmpty) {
      if (userIds.contains(assigned)) return true;
      if (coWaiterIds != null && coWaiterIds.any((cw) => userIds.contains(cw.trim().toLowerCase()))) {
        return true;
      }
      return false;
    }

    // Unassigned table requests must not be visible to any waiter
    return false;
  }

  String get formattedTitle {
    if (isTableAccessRequest) {
      final name = requesterName;
      return name != null ? 'Table Access ($name)' : 'Table Access Request';
    }
    if (serviceLabel != null && serviceLabel!.trim().isNotEmpty) {
      return serviceLabel!;
    }
    switch (requestType.toLowerCase()) {
      case 'order_ready':
        return (serviceLabel != null && serviceLabel!.trim().isNotEmpty)
            ? serviceLabel!
            : 'Ready to Serve';
      case 'water_requested':
      case 'water':
        return 'Water';
      case 'cutlery_requested':
      case 'cutlery':
        return 'Cutlery';
      case 'bill_requested':
      case 'bill':
        return 'Bill Request';
      case 'call_waiter':
        return 'Call Waiter';
      case 'tissue_requested':
      case 'tissue':
        return 'Tissue';
      case 'glass_requested':
        return 'Extra Glass';
      case 'plate_requested':
        return 'Extra Plate';
      case 'straw_requested':
        return 'Straw';
      case 'salt_requested':
        return 'Salt';
      case 'pepper_requested':
        return 'Pepper';
      case 'bowl_requested':
      case 'bowl':
        return 'Finger Bowl';
      case 'sauce_requested':
        return 'Ketchup';
      default:
        final clean = requestType.replaceAll('_requested', '').replaceAll('_', ' ');
        return clean.isEmpty ? 'Service Request' : clean[0].toUpperCase() + clean.substring(1);
    }
  }
}
