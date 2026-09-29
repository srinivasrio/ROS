import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/realtime/supabase_service.dart';
import '../auth/auth_controller.dart';
import '../orders/orders_controller.dart';
import 'table_models.dart';
import 'tables_repository.dart';

class TablesState {
  final bool isLoading;
  final List<TableModel> allTables;
  final List<AreaModel> areas;
  final String? selectedAreaId;
  final String selectedStatusFilter; // 'ALL' | 'READY' | 'PREPARING' | 'AVAILABLE' | 'EMPTY'
  final String searchQuery;
  final String? errorMessage;
  final TableMetrics metrics;

  const TablesState({
    this.isLoading = false,
    this.allTables = const [],
    this.areas = const [],
    this.selectedAreaId,
    this.selectedStatusFilter = 'ALL',
    this.searchQuery = '',
    this.errorMessage,
    this.metrics = const TableMetrics(),
  });

  List<TableModel> get tables => allTables;

  List<TableModel> get filteredTables {
    return allTables.where((table) {
      // Area Filter
      if (selectedAreaId != null && selectedAreaId!.isNotEmpty && selectedAreaId != 'ALL') {
        if (table.areaId != selectedAreaId && table.areaName != selectedAreaId) {
          return false;
        }
      }

      // Status Filter (ALL, READY, PREPARING, AVAILABLE, EMPTY)
      if (selectedStatusFilter != 'ALL') {
        final st = table.status.toLowerCase();
        switch (selectedStatusFilter) {
          case 'READY':
            if (!table.isNeedBill && st != 'ready') return false;
            break;
          case 'PREPARING':
            if (st != 'cooking' && st != 'preparing' && st != 'placed') return false;
            break;
          case 'AVAILABLE':
            if (!table.isAvailable && !table.isOnHold) return false;
            break;
          case 'EMPTY':
            if (st != 'empty' && st != 'free') return false;
            break;
        }
      }

      // Search Query
      if (searchQuery.isNotEmpty) {
        final query = searchQuery.toLowerCase();
        final matchNum = table.tableNumber.toLowerCase().contains(query);
        final matchArea = (table.areaName ?? '').toLowerCase().contains(query);
        if (!matchNum && !matchArea) return false;
      }

      return true;
    }).toList();
  }

  TablesState copyWith({
    bool? isLoading,
    List<TableModel>? allTables,
    List<AreaModel>? areas,
    String? selectedAreaId,
    bool clearSelectedArea = false,
    String? selectedStatusFilter,
    String? searchQuery,
    String? errorMessage,
    TableMetrics? metrics,
  }) {
    return TablesState(
      isLoading: isLoading ?? this.isLoading,
      allTables: allTables ?? this.allTables,
      areas: areas ?? this.areas,
      selectedAreaId: clearSelectedArea ? null : (selectedAreaId ?? this.selectedAreaId),
      selectedStatusFilter: selectedStatusFilter ?? this.selectedStatusFilter,
      searchQuery: searchQuery ?? this.searchQuery,
      errorMessage: errorMessage,
      metrics: metrics ?? this.metrics,
    );
  }
}

final tablesRepositoryProvider = Provider<TablesRepository>((ref) => TablesRepository());

final selectedTableProvider = StateProvider<TableModel?>((ref) => null);

final tablesControllerProvider = StateNotifierProvider<TablesController, TablesState>((ref) {
  final repository = ref.watch(tablesRepositoryProvider);
  final authState = ref.watch(authControllerProvider);
  final restaurantId = authState.session?.restaurantId ?? '202603180001';

  return TablesController(repository, restaurantId);
});

final filteredTablesProvider = Provider<List<TableModel>>((ref) {
  final tablesState = ref.watch(tablesControllerProvider);
  final orders = ref.watch(ordersControllerProvider).orders;

  bool tableHasReadyItems(TableModel table) {
    final tNum = table.tableNumber.trim().toLowerCase();
    final tName = table.formattedName.replaceAll('Table ', '').trim().toLowerCase();
    final dispName = (table.displayName ?? '').replaceAll('Table ', '').trim().toLowerCase();

    return orders.any((o) {
      final oTableId = o.tableId.trim();
      final oTableNum = (o.tableNumber ?? '').trim().toLowerCase();

      final matchesTable = oTableId == table.id ||
          (oTableNum.isNotEmpty && (oTableNum == tNum || oTableNum == tName || oTableNum == dispName)) ||
          (table.mergedGroupId != null && (oTableId == table.mergedGroupId || oTableNum == dispName)) ||
          table.mergedTableIds.contains(oTableId);

      if (!matchesTable) return false;

      // Table is ready if order status is ready or any item is ready
      return o.status.toLowerCase() == 'ready' || o.items.any((i) => i.isReady);
    });
  }

  bool tableHasPreparingItems(TableModel table) {
    final tNum = table.tableNumber.trim().toLowerCase();
    final tName = table.formattedName.replaceAll('Table ', '').trim().toLowerCase();
    final dispName = (table.displayName ?? '').replaceAll('Table ', '').trim().toLowerCase();

    return orders.any((o) {
      final oTableId = o.tableId.trim();
      final oTableNum = (o.tableNumber ?? '').trim().toLowerCase();

      final matchesTable = oTableId == table.id ||
          (oTableNum.isNotEmpty && (oTableNum == tNum || oTableNum == tName || oTableNum == dispName)) ||
          (table.mergedGroupId != null && (oTableId == table.mergedGroupId || oTableNum == dispName)) ||
          table.mergedTableIds.contains(oTableId);

      if (!matchesTable) return false;

      final st = o.status.toLowerCase();
      // Table is preparing if order status is preparing/cooking/placed or any item is preparing
      return st == 'preparing' || st == 'cooking' || st == 'placed' || o.items.any((i) => i.isPreparing);
    });
  }

  return tablesState.allTables.where((table) {
    // Area Filter
    if (tablesState.selectedAreaId != null && tablesState.selectedAreaId!.isNotEmpty && tablesState.selectedAreaId != 'ALL') {
      if (table.areaId != tablesState.selectedAreaId && table.areaName != tablesState.selectedAreaId) {
        return false;
      }
    }

    // Status Filter (ALL, READY, PREPARING, AVAILABLE, EMPTY)
    switch (tablesState.selectedStatusFilter) {
      case 'READY':
        if (!tableHasReadyItems(table)) return false;
        break;
      case 'PREPARING':
        if (!tableHasPreparingItems(table)) return false;
        break;
      case 'AVAILABLE':
        if (!table.isAvailable && !table.isOnHold) return false;
        break;
      case 'EMPTY':
        final st = table.status.toLowerCase();
        if (st != 'empty' && st != 'free') return false;
        break;
      default:
        break;
    }

    // Search Query
    if (tablesState.searchQuery.isNotEmpty) {
      final query = tablesState.searchQuery.toLowerCase();
      final matchNum = table.tableNumber.toLowerCase().contains(query);
      final matchArea = (table.areaName ?? '').toLowerCase().contains(query);
      if (!matchNum && !matchArea) return false;
    }

    return true;
  }).toList();
});

class TablesController extends StateNotifier<TablesState> {
  final TablesRepository _repository;
  String? _restaurantId;
  RealtimeChannel? _realtimeChannel;
  Timer? _pollingTimer;

  TablesController(this._repository, this._restaurantId) : super(const TablesState()) {
    if (_restaurantId != null) {
      loadData();
      _subscribeToRealtime();
      _startPolling();
    }
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    _realtimeChannel?.unsubscribe();
    super.dispose();
  }

  void _startPolling() {
    _pollingTimer?.cancel();
    _pollingTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (_restaurantId != null) {
        loadData(silent: true);
      }
    });
  }

  void _subscribeToRealtime() {
    if (_restaurantId == null) return;
    _realtimeChannel = SupabaseService.subscribeToTables(
      restaurantId: _restaurantId!,
      onTableChange: (payload) {
        debugPrint('[TablesController] Realtime table change received');
        loadData(silent: true);
      },
    );
  }

  Future<void> loadTables([String? restaurantId]) async {
    if (restaurantId != null) {
      _restaurantId = restaurantId;
      _subscribeToRealtime();
      _startPolling();
    }
    await loadData();
  }

  Future<void> loadData({bool silent = false}) async {
    final restId = _restaurantId ?? '202603180001';
    if (!silent) state = state.copyWith(isLoading: true, errorMessage: null);

    try {
      final results = await Future.wait([
        _repository.fetchTables(restId),
        _repository.fetchAreas(restId),
      ]);

      final rawTables = results[0] as List<TableModel>;
      final areas = results[1] as List<AreaModel>;
      final tables = TableModel.consolidateMergedTables(rawTables);

      int available = 0;
      int occupied = 0;
      int preparing = 0;
      int ready = 0;
      int requests = 0;

      for (final t in tables) {
        final st = t.status.toLowerCase();
        if (t.isAvailable || t.isOnHold) available++;
        if (t.isOccupied || st == 'served' || st == 'eating') occupied++;
        if (t.isNeedBill) ready++;
        if (st == 'cooking' || st == 'preparing' || st == 'placed') preparing++;
        if (t.alertStatus != null) requests++;
      }

      final metrics = TableMetrics(
        total: tables.length,
        available: available,
        occupied: occupied,
        preparing: preparing,
        ready: ready,
        requests: requests,
      );

      state = state.copyWith(
        isLoading: false,
        allTables: tables,
        areas: areas,
        metrics: metrics,
      );
    } catch (e) {
      debugPrint('[TablesController] Error in loadData: $e');
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString().replaceAll('Exception: ', ''),
      );
    }
  }

  void selectArea(String? areaId) {
    if (areaId == null) {
      state = state.copyWith(clearSelectedArea: true);
    } else {
      state = state.copyWith(selectedAreaId: areaId);
    }
  }

  void selectStatusFilter(String filter) {
    state = state.copyWith(selectedStatusFilter: filter);
  }

  void search(String query) {
    state = state.copyWith(searchQuery: query);
  }

  Future<void> holdTable(String tableId) async {
    final restId = _restaurantId ?? '202603180001';
    await _repository.holdTable(tableId, restId);
    loadData(silent: true);
  }

  Future<void> releaseHold(String tableId) async {
    final restId = _restaurantId ?? '202603180001';
    await _repository.releaseTableHold(tableId, restId);
    loadData(silent: true);
  }

  Future<void> updateTableStatus(String tableId, String restaurantId, String newStatus) async {
    await _repository.updateTableStatus(tableId, restaurantId, newStatus);
    loadData(silent: true);
  }

  Future<void> clearTable(String tableId) async {
    final restId = _restaurantId ?? '202603180001';
    await _repository.updateTableStatus(tableId, restId, 'empty');
    loadData(silent: true);
  }

  Future<void> mergeTables(List<String> tableIds) async {
    final restId = _restaurantId ?? '202603180001';
    await _repository.mergeTables(tableIds: tableIds, restaurantId: restId);
    await loadData(silent: true);
  }

  Future<void> unmergeTables(String mergeGroupId) async {
    final restId = _restaurantId ?? '202603180001';
    await _repository.unmergeTables(mergeGroupId: mergeGroupId, restaurantId: restId);
    await loadData(silent: true);
  }

  Future<void> moveTablesToArea(List<String> tableIds, String? areaId) async {
    final restId = _restaurantId ?? '202603180001';
    await _repository.moveTablesToArea(tableIds: tableIds, areaId: areaId, restaurantId: restId);
    await loadData(silent: true);
  }

  Future<void> togglePinTables(List<String> tableIds, bool isPinned) async {
    final restId = _restaurantId ?? '202603180001';
    await _repository.togglePinTables(tableIds: tableIds, isPinned: isPinned, restaurantId: restId);
    await loadData(silent: true);
  }

  Future<void> deleteTables(List<String> tableIds) async {
    final restId = _restaurantId ?? '202603180001';
    await _repository.deleteTables(tableIds: tableIds, restaurantId: restId);
    await loadData(silent: true);
  }

  Future<List<WaiterModel>> fetchAvailableWaiters({String? excludeEmployeeId}) async {
    final restId = _restaurantId ?? '202603180001';
    return await _repository.fetchAvailableWaiters(
      restaurantId: restId,
      excludeEmployeeId: excludeEmployeeId,
    );
  }

  Future<Map<String, dynamic>> grantTableAccess({
    required int tableId,
    required String ownerId,
    required String targetWaiterId,
    required String grantType, // 'share' or 'transfer'
  }) async {
    final result = await _repository.grantTableAccess(
      tableId: tableId,
      ownerId: ownerId,
      targetWaiterId: targetWaiterId,
      grantType: grantType,
    );
    await loadData(silent: true);
    return result;
  }
}
