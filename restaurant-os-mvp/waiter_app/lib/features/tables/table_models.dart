enum TableStatus {
  available,
  occupied,
  needBill,
  dirty,
  onHold,
  reserved,
}

class TableModel {
  final String id;
  final String tableNumber;
  final String status;
  final int capacity;
  final String? areaId;
  final String? areaName;
  final String? assignedWaiterId;
  final String? assignedWaiterName;
  final String? assignedWaiterAvatar;
  final String? alertStatus;
  final bool isMerged;
  final String? mergedGroupId;
  final String? displayName;
  final num? activeOrderTotal;
  final DateTime? customerPresentAt;
  final DateTime? lastActivityAt;
  final int activeItemCount;
  final List<String> mergedTableIds;
  final List<String> coWaiterIds;
  final String? coWaiterNames;
  final String? transferredFromWaiterId;
  final String? transferredFromWaiterName;
  final String? transferredToWaiterId;
  final String? transferredToWaiterName;

  TableModel({
    required this.id,
    required this.tableNumber,
    required this.status,
    required this.capacity,
    this.areaId,
    this.areaName,
    this.assignedWaiterId,
    this.assignedWaiterName,
    this.assignedWaiterAvatar,
    this.alertStatus,
    this.isMerged = false,
    this.mergedGroupId,
    this.displayName,
    this.activeOrderTotal,
    this.customerPresentAt,
    this.lastActivityAt,
    this.activeItemCount = 0,
    this.mergedTableIds = const [],
    this.coWaiterIds = const [],
    this.coWaiterNames,
    this.transferredFromWaiterId,
    this.transferredFromWaiterName,
    this.transferredToWaiterId,
    this.transferredToWaiterName,
  });

  factory TableModel.fromJson(Map<String, dynamic> json) {
    final rawDisplayName = json['display_name'] ?? json['table_merge_groups']?['display_name'];
    List<String> parsedCoWaiters = [];
    if (json['co_waiter_ids'] != null) {
      if (json['co_waiter_ids'] is List) {
        parsedCoWaiters = (json['co_waiter_ids'] as List).map((e) => e.toString()).toList();
      }
    }

    return TableModel(
      id: json['id'].toString(),
      tableNumber: (json['table_number'] ?? json['id']).toString(),
      status: (json['status'] ?? 'empty').toString(),
      capacity: json['capacity'] is int ? json['capacity'] : int.tryParse(json['capacity']?.toString() ?? '4') ?? 4,
      areaId: json['area_id']?.toString(),
      areaName: json['area_name'] ?? json['restaurant_areas']?['name'],
      assignedWaiterId: json['assigned_waiter_id']?.toString(),
      assignedWaiterName: json['assigned_waiter_name'],
      assignedWaiterAvatar: json['assigned_waiter_avatar'] ?? json['avatar_url'] ?? json['employees']?['avatar_url'],
      alertStatus: json['alert_status']?.toString(),
      isMerged: json['is_merged'] == true,
      mergedGroupId: json['merged_group_id']?.toString(),
      displayName: rawDisplayName?.toString(),
      activeOrderTotal: json['active_order_total'] != null ? (json['active_order_total'] as num) : null,
      customerPresentAt: json['customer_present_at'] != null ? DateTime.tryParse(json['customer_present_at']) : null,
      lastActivityAt: json['last_activity_at'] != null ? DateTime.tryParse(json['last_activity_at']) : null,
      activeItemCount: json['active_item_count'] ?? 0,
      mergedTableIds: (json['merged_table_ids'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      coWaiterIds: parsedCoWaiters,
      coWaiterNames: json['co_waiter_names']?.toString(),
      transferredFromWaiterId: json['transferred_from_waiter_id']?.toString(),
      transferredFromWaiterName: json['transferred_from_waiter_name']?.toString(),
      transferredToWaiterId: json['transferred_to_waiter_id']?.toString(),
      transferredToWaiterName: json['transferred_to_waiter_name']?.toString(),
    );
  }

  bool get isTransferred => transferredFromWaiterName != null && transferredFromWaiterName!.trim().isNotEmpty;
  bool get hasCoWaiters => (coWaiterNames != null && coWaiterNames!.trim().isNotEmpty) || coWaiterIds.isNotEmpty;

  bool isWaiterAuthorized(String? currentUserId, {bool isAdmin = false}) {
    if (isAdmin) return true;
    if (currentUserId == null || currentUserId.trim().isEmpty) return true;
    final uid = currentUserId.trim().toLowerCase();

    // 1. If table has an assigned waiter
    if (assignedWaiterId != null && assignedWaiterId!.trim().isNotEmpty) {
      if (assignedWaiterId!.trim().toLowerCase() == uid) return true;
      for (final cw in coWaiterIds) {
        if (cw.trim().toLowerCase() == uid) return true;
      }
      return false; // Table belongs to another waiter
    }

    // 2. If table is unassigned, any waiter can claim / manage it
    return true;
  }

  String get formattedName {
    if (displayName != null && displayName!.trim().isNotEmpty) {
      return displayName!.replaceAll(' + ', '+').trim();
    }
    final raw = tableNumber.trim();
    if (raw.toLowerCase().startsWith('table')) {
      return raw;
    }
    return 'Table $raw';
  }

  TableStatus get normalizedStatus {
    final s = status.toLowerCase();
    if (s == 'need_bill' || s == 'billing' || s == 'bill_requested') {
      return TableStatus.needBill;
    }
    if (s == 'dirty' || s == 'cleaning' || s == 'to_clean') {
      return TableStatus.dirty;
    }
    if (s == 'on_hold' || s == 'hold') {
      return TableStatus.onHold;
    }
    if (s == 'reserved') {
      return TableStatus.reserved;
    }
    if (s == 'occupied' || s == 'eating' || s == 'cooking' || s == 'seated') {
      return TableStatus.occupied;
    }
    return TableStatus.available;
  }

  bool get isAvailable => normalizedStatus == TableStatus.available;
  bool get isOccupied => normalizedStatus == TableStatus.occupied;
  bool get isNeedBill => normalizedStatus == TableStatus.needBill;
  bool get isDirty => normalizedStatus == TableStatus.dirty;
  bool get isOnHold => normalizedStatus == TableStatus.onHold;
  bool get isReserved => normalizedStatus == TableStatus.reserved;

  // Backward compatibility aliases
  bool get isEating => isOccupied;
  bool get isCooking => isOccupied;
  bool get isReady => isOccupied;

  String get statusLabel {
    switch (normalizedStatus) {
      case TableStatus.available:
        return 'Available';
      case TableStatus.occupied:
        return 'Occupied';
      case TableStatus.needBill:
        return 'Need Bill';
      case TableStatus.dirty:
        return 'Needs Cleaning';
      case TableStatus.onHold:
        return 'On Hold';
      case TableStatus.reserved:
        return 'Reserved';
    }
  }

  /// Consolidates physical tables sharing a mergedGroupId into a single unified table entry
  static List<TableModel> consolidateMergedTables(List<TableModel> rawTables) {
    final List<TableModel> result = [];
    final Map<String, List<TableModel>> mergeGroups = {};

    for (final table in rawTables) {
      if (table.isMerged && table.mergedGroupId != null && table.mergedGroupId!.isNotEmpty) {
        mergeGroups.putIfAbsent(table.mergedGroupId!, () => []).add(table);
      } else {
        result.add(table);
      }
    }

    for (final entry in mergeGroups.entries) {
      final groupTables = entry.value;
      if (groupTables.isEmpty) continue;

      final tableNumbers = groupTables.map((t) => t.tableNumber).toList();
      tableNumbers.sort((a, b) => (int.tryParse(a) ?? 0).compareTo(int.tryParse(b) ?? 0));

      final totalCapacity = groupTables.fold<int>(0, (sum, t) => sum + t.capacity);
      final displayName = 'Table ${tableNumbers.join("+")}';
      final activeItemCount = groupTables.fold<int>(0, (sum, t) => sum + t.activeItemCount);
      final activeOrderTotal = groupTables.fold<num>(0, (sum, t) => sum + (t.activeOrderTotal ?? 0));
      final hasActiveOrder = activeItemCount > 0 || activeOrderTotal > 0;

      // Determine consolidated status: only occupied if at least one item is ordered
      String consolidatedStatus = 'available';
      if (groupTables.any((t) => t.isNeedBill)) {
        consolidatedStatus = 'need_bill';
      } else if (hasActiveOrder || groupTables.any((t) => t.isOccupied && (t.activeItemCount > 0 || (t.activeOrderTotal ?? 0) > 0))) {
        consolidatedStatus = 'occupied';
      } else if (groupTables.any((t) => t.isDirty)) {
        consolidatedStatus = 'dirty';
      } else if (groupTables.any((t) => t.isOnHold)) {
        consolidatedStatus = 'on_hold';
      } else if (groupTables.any((t) => t.isReserved)) {
        consolidatedStatus = 'reserved';
      } else {
        consolidatedStatus = 'available';
      }

      final primaryTable = groupTables.first;
      result.add(
        TableModel(
          id: primaryTable.id,
          tableNumber: tableNumbers.join('+'),
          status: consolidatedStatus,
          capacity: totalCapacity,
          areaId: primaryTable.areaId,
          areaName: primaryTable.areaName,
          assignedWaiterId: primaryTable.assignedWaiterId,
          assignedWaiterName: primaryTable.assignedWaiterName,
          alertStatus: primaryTable.alertStatus,
          isMerged: true,
          mergedGroupId: entry.key,
          displayName: displayName,
          mergedTableIds: groupTables.map((t) => t.id).toList(),
          coWaiterIds: groupTables.expand((t) => t.coWaiterIds).toSet().toList(),
          activeOrderTotal: groupTables.fold<num>(0, (sum, t) => sum + (t.activeOrderTotal ?? 0)),
          customerPresentAt: primaryTable.customerPresentAt,
          lastActivityAt: primaryTable.lastActivityAt,
          activeItemCount: groupTables.fold<int>(0, (sum, t) => sum + t.activeItemCount),
        ),
      );
    }

    // Sort naturally by first table number
    result.sort((a, b) {
      final aNum = int.tryParse(a.tableNumber.split('+').first) ?? 9999;
      final bNum = int.tryParse(b.tableNumber.split('+').first) ?? 9999;
      if (aNum != bNum) return aNum.compareTo(bNum);
      return a.tableNumber.compareTo(b.tableNumber);
    });

    return result;
  }
}

class AreaModel {
  final String id;
  final String name;
  final int displayOrder;

  AreaModel({
    required this.id,
    required this.name,
    required this.displayOrder,
  });

  factory AreaModel.fromJson(Map<String, dynamic> json) {
    return AreaModel(
      id: json['id'].toString(),
      name: json['name'] ?? 'Main Area',
      displayOrder: json['display_order'] is int ? json['display_order'] : int.tryParse(json['display_order']?.toString() ?? '0') ?? 0,
    );
  }
}

class TableMetrics {
  final int total;
  final int available;
  final int occupied;
  final int preparing;
  final int ready;
  final int requests;

  const TableMetrics({
    this.total = 0,
    this.available = 0,
    this.occupied = 0,
    this.preparing = 0,
    this.ready = 0,
    this.requests = 0,
  });
}

class WaiterModel {
  final String id;
  final String employeeId;
  final String name;
  final String role;
  final String availabilityStatus;
  final String? avatarUrl;
  final int activeTablesCount;

  const WaiterModel({
    required this.id,
    required this.employeeId,
    required this.name,
    required this.role,
    this.availabilityStatus = 'available',
    this.avatarUrl,
    this.activeTablesCount = 0,
  });

  factory WaiterModel.fromJson(Map<String, dynamic> json) {
    return WaiterModel(
      id: json['id']?.toString() ?? '',
      employeeId: json['employee_id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Waiter',
      role: json['role']?.toString() ?? 'waiter',
      availabilityStatus: json['availability_status']?.toString() ?? 'available',
      avatarUrl: json['avatar_url']?.toString(),
      activeTablesCount: (json['active_tables_count'] as num?)?.toInt() ?? 0,
    );
  }
}
