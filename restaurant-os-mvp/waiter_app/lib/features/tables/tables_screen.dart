import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/utils/feedback_utils.dart';
import '../../core/widgets/empty_state_view.dart';
import '../../core/widgets/loading_skeleton.dart';
import '../auth/auth_controller.dart';
import '../orders/orders_controller.dart';
import '../requests/requests_controller.dart';
import 'table_models.dart';
import 'tables_controller.dart';
import 'widgets/table_card.dart';
import 'widgets/table_details_sheet.dart';

class TablesScreen extends ConsumerStatefulWidget {
  const TablesScreen({super.key});

  @override
  ConsumerState<TablesScreen> createState() => _TablesScreenState();
}

class _TablesScreenState extends ConsumerState<TablesScreen> {
  final Set<String> _selectedTableIds = {};
  bool _isActionInProgress = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final session = ref.read(authControllerProvider).session;
      final restaurantId = session?.restaurantId ?? '202603180001';
      ref.read(tablesControllerProvider.notifier).loadTables(restaurantId);
      ref.read(requestsControllerProvider.notifier).loadRequests(restaurantId: restaurantId);
      ref.read(ordersControllerProvider.notifier).loadOrders(restaurantId: restaurantId);
    });
  }

  void _openTableDetails(TableModel table) {
    FeedbackUtils.selectionHaptic();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => TableDetailsSheet(table: table),
    );
  }

  void _toggleTableSelection(String tableId) {
    FeedbackUtils.selectionHaptic();
    setState(() {
      if (_selectedTableIds.contains(tableId)) {
        _selectedTableIds.remove(tableId);
      } else {
        _selectedTableIds.add(tableId);
      }
    });
  }

  void _clearSelection() {
    FeedbackUtils.selectionHaptic();
    setState(() {
      _selectedTableIds.clear();
    });
  }

  // Action 1: Merge Selected Tables
  Future<void> _handleMergeSelected() async {
    if (_selectedTableIds.length < 2) {
      FeedbackUtils.showToast(context, message: 'Select at least 2 tables to merge', isError: true);
      return;
    }

    setState(() => _isActionInProgress = true);
    try {
      await ref.read(tablesControllerProvider.notifier).mergeTables(_selectedTableIds.toList());
      FeedbackUtils.successHaptic();
      if (!mounted) return;
      FeedbackUtils.showToast(context, message: 'Tables merged successfully!');
      _clearSelection();
    } catch (e) {
      if (!mounted) return;
      FeedbackUtils.showToast(context, message: 'Failed to merge tables: $e', isError: true);
    } finally {
      if (mounted) setState(() => _isActionInProgress = false);
    }
  }

  // Action 2: Move Selected Tables to Another Area
  Future<void> _handleMoveArea() async {
    final areas = ref.read(tablesControllerProvider).areas;
    if (areas.isEmpty) {
      FeedbackUtils.showToast(context, message: 'No areas available to move tables to', isError: true);
      return;
    }

    final selectedArea = await showModalBottomSheet<AreaModel>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) {
        return Container(
          decoration: const BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.borderVariant,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Move to Area',
                style: AppTypography.headingMedium.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 4),
              Text(
                'Select the destination area for ${_selectedTableIds.length} tables',
                style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 16),
              ...areas.map(
                (area) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceContainerHigh,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(LucideIcons.mapPin, size: 18, color: AppColors.primary),
                  ),
                  title: Text(
                    area.name,
                    style: AppTypography.labelLarge.copyWith(fontWeight: FontWeight.w700),
                  ),
                  trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: AppColors.textSecondary),
                  onTap: () => Navigator.of(ctx).pop(area),
                ),
              ),
            ],
          ),
        );
      },
    );

    if (selectedArea == null) return;

    setState(() => _isActionInProgress = true);
    try {
      await ref.read(tablesControllerProvider.notifier).moveTablesToArea(
            _selectedTableIds.toList(),
            selectedArea.id,
          );
      FeedbackUtils.successHaptic();
      if (!mounted) return;
      FeedbackUtils.showToast(context, message: 'Moved tables to ${selectedArea.name}');
      _clearSelection();
    } catch (e) {
      if (!mounted) return;
      FeedbackUtils.showToast(context, message: 'Failed to move tables: $e', isError: true);
    } finally {
      if (mounted) setState(() => _isActionInProgress = false);
    }
  }

  // Action 3: Pin / Unpin Selected Tables
  Future<void> _handlePinSelected() async {
    setState(() => _isActionInProgress = true);
    try {
      await ref.read(tablesControllerProvider.notifier).togglePinTables(
            _selectedTableIds.toList(),
            true,
          );
      FeedbackUtils.successHaptic();
      if (!mounted) return;
      FeedbackUtils.showToast(context, message: 'Pinned selected tables to the top');
      _clearSelection();
    } catch (e) {
      if (!mounted) return;
      FeedbackUtils.showToast(context, message: 'Failed to pin tables: $e', isError: true);
    } finally {
      if (mounted) setState(() => _isActionInProgress = false);
    }
  }

  // Action 4: Delete Selected Tables
  Future<void> _handleDeleteSelected() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(
          'Delete ${_selectedTableIds.length} Table${_selectedTableIds.length > 1 ? 's' : ''}?',
          style: AppTypography.headingSmall.copyWith(fontWeight: FontWeight.w800),
        ),
        content: Text(
          'Are you sure you want to delete the selected table(s)? This action cannot be undone.',
          style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text('Cancel', style: TextStyle(color: AppColors.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Delete', style: TextStyle(fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _isActionInProgress = true);
    try {
      await ref.read(tablesControllerProvider.notifier).deleteTables(_selectedTableIds.toList());
      FeedbackUtils.successHaptic();
      if (!mounted) return;
      FeedbackUtils.showToast(context, message: 'Deleted table(s) successfully');
      _clearSelection();
    } catch (e) {
      if (!mounted) return;
      FeedbackUtils.showToast(context, message: 'Failed to delete tables: $e', isError: true);
    } finally {
      if (mounted) setState(() => _isActionInProgress = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(authControllerProvider).session;
    final tablesState = ref.watch(tablesControllerProvider);
    final tablesNotifier = ref.read(tablesControllerProvider.notifier);
    final pendingRequests = ref.watch(pendingRequestsCountProvider);

    final allTables = tablesState.allTables;
    final filteredTables = ref.watch(filteredTablesProvider);
    final activeOrders = ref.watch(activeOrdersProvider);

    bool tableHasReadyItems(TableModel table) {
      final tNum = table.tableNumber.trim().toLowerCase();
      final tName = table.formattedName.replaceAll('Table ', '').trim().toLowerCase();
      final dispName = (table.displayName ?? '').replaceAll('Table ', '').trim().toLowerCase();

      return activeOrders.any((o) {
        final oTableId = o.tableId.trim();
        final oTableNum = (o.tableNumber ?? '').trim().toLowerCase();

        final matchesTable = oTableId == table.id ||
            (oTableNum.isNotEmpty && (oTableNum == tNum || oTableNum == tName || oTableNum == dispName)) ||
            (table.mergedGroupId != null && (oTableId == table.mergedGroupId || oTableNum == dispName)) ||
            table.mergedTableIds.contains(oTableId);

        if (!matchesTable) return false;
        return o.status.toLowerCase() == 'ready' || o.items.any((i) => i.isReady);
      });
    }

    bool tableHasPreparingItems(TableModel table) {
      final tNum = table.tableNumber.trim().toLowerCase();
      final tName = table.formattedName.replaceAll('Table ', '').trim().toLowerCase();
      final dispName = (table.displayName ?? '').replaceAll('Table ', '').trim().toLowerCase();

      return activeOrders.any((o) {
        final oTableId = o.tableId.trim();
        final oTableNum = (o.tableNumber ?? '').trim().toLowerCase();

        final matchesTable = oTableId == table.id ||
            (oTableNum.isNotEmpty && (oTableNum == tNum || oTableNum == tName || oTableNum == dispName)) ||
            (table.mergedGroupId != null && (oTableId == table.mergedGroupId || oTableNum == dispName)) ||
            table.mergedTableIds.contains(oTableId);

        if (!matchesTable) return false;
        final st = o.status.toLowerCase();
        return st == 'preparing' || st == 'cooking' || st == 'placed' || o.items.any((i) => i.isPreparing);
      });
    }

    final readyCount = allTables.where(tableHasReadyItems).length;
    final preparingCount = allTables.where(tableHasPreparingItems).length;
    final emptyCount = allTables.where((t) => t.isAvailable || t.isOnHold).length;

    final isOnline = ref.watch(waiterOnlineStatusProvider);
    final isSelectionMode = _selectedTableIds.isNotEmpty;

    // Filter categories
    final myTables = <TableModel>[];
    final readyTables = <TableModel>[];
    final prepTables = <TableModel>[];
    final availTables = <TableModel>[];
    final otherTables = <TableModel>[];

    final currentUserId = session?.userId;
    for (final t in allTables) {
      final isMine = currentUserId != null && (t.assignedWaiterId == currentUserId || t.coWaiterIds.contains(currentUserId));
      final hasReady = tableHasReadyItems(t);
      final hasPrep = tableHasPreparingItems(t);
      final isAvail = t.isAvailable || t.status.toLowerCase() == 'empty' || t.status.toLowerCase() == 'free';

      if (isMine) {
        myTables.add(t);
      } else if (isAvail) {
        availTables.add(t);
      } else {
        otherTables.add(t);
      }

      if (hasReady) {
        readyTables.add(t);
      } else if (hasPrep) {
        prepTables.add(t);
      }
    }

    return Scaffold(
      backgroundColor: const Color(0xFFEEF2F6),
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(56),
        child: Container(
          decoration: BoxDecoration(
            color: const Color(0xFFEEF2F6),
            border: const Border(
              bottom: BorderSide(color: Color(0xB3FFFFFF), width: 1),
            ),
            boxShadow: const [
              BoxShadow(
                color: Color(0x38A6B4C8),
                blurRadius: 14,
                offset: Offset(0, 4),
              ),
            ],
          ),
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: isSelectionMode
                  ? Row(
                      children: [
                        InkWell(
                          onTap: _clearSelection,
                          borderRadius: BorderRadius.circular(12),
                          child: Container(
                            width: 36,
                            height: 36,
                            decoration: BoxDecoration(
                              color: const Color(0xFFEEF2F6),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: Colors.white.withValues(alpha: 0.7), width: 1),
                              boxShadow: const [
                                BoxShadow(color: Color(0x66A6B4C8), offset: Offset(2.5, 2.5), blurRadius: 6),
                                BoxShadow(color: Color(0xF2FFFFFF), offset: Offset(-2.5, -2.5), blurRadius: 6),
                              ],
                            ),
                            child: const Center(
                              child: Icon(LucideIcons.x, size: 18, color: Color(0xFFFF6B35)),
                            ),
                          ),
                        ),
                        Expanded(
                          child: Text(
                            '${_selectedTableIds.length} Table${_selectedTableIds.length > 1 ? 's' : ''} Selected',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontFamily: 'Outfit',
                              fontSize: 15,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFFFF6B35),
                            ),
                          ),
                        ),
                        TextButton(
                          onPressed: () {
                            setState(() {
                              _selectedTableIds.addAll(allTables.map((t) => t.id));
                            });
                          },
                          style: TextButton.styleFrom(
                            backgroundColor: const Color(0xFFEEF2F6),
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                          child: const Text(
                            'Select All',
                            style: TextStyle(
                              color: Color(0xFFFF6B35),
                              fontWeight: FontWeight.w800,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ],
                    )
                  : Row(
                      children: [
                        // Left: Store tile matching Web
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: const Color(0xFFEEF2F6),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.white.withValues(alpha: 0.7), width: 1),
                            boxShadow: const [
                              BoxShadow(color: Color(0x66A6B4C8), offset: Offset(2.5, 2.5), blurRadius: 6),
                              BoxShadow(color: Color(0xF2FFFFFF), offset: Offset(-2.5, -2.5), blurRadius: 6),
                            ],
                          ),
                          child: const Center(
                            child: Icon(LucideIcons.store, size: 18, color: Color(0xFFFF6B35)),
                          ),
                        ),
                        const SizedBox(width: 8),

                        // Center: Restaurant Title
                        Expanded(
                          child: Text(
                            session?.restaurantName ?? 'Dine in One',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontFamily: 'Outfit',
                              fontSize: 17,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF1E293B),
                              letterSpacing: -0.3,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),

                        // Right: Areas dropdown
                        _AreasButton(
                          areas: tablesState.areas,
                          selectedAreaId: tablesState.selectedAreaId,
                          onAreaSelected: (areaId) {
                            ref.read(tablesControllerProvider.notifier).selectArea(areaId);
                          },
                        ),
                      ],
                    ),
            ),
          ),
        ),
      ),
      body: Stack(
        children: [
          RefreshIndicator(
            color: const Color(0xFFFF6B35),
            backgroundColor: Colors.white,
            onRefresh: () async {
              final restaurantId = session?.restaurantId ?? '202603180001';
              await ref.read(tablesControllerProvider.notifier).loadTables(restaurantId);
            },
            child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
              slivers: [
                // 1. Offline guidance banner matching Web
                if (!isOnline)
                  SliverToBoxAdapter(
                    child: Container(
                      margin: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEEF2F6),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFFDE68A), width: 1),
                        boxShadow: const [
                          BoxShadow(color: Color(0x33F59E0B), blurRadius: 6, offset: Offset(0, 2)),
                        ],
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 8,
                                height: 8,
                                decoration: const BoxDecoration(
                                  color: Color(0xFFF59E0B),
                                  shape: BoxShape.circle,
                                  boxShadow: [
                                    BoxShadow(color: Color(0x99F59E0B), blurRadius: 6, spreadRadius: 1),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 8),
                              const Text(
                                'You are Offline. Turn online to take tables.',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF78350F),
                                ),
                              ),
                            ],
                          ),
                          ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFD97706),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              elevation: 0,
                            ),
                            onPressed: () => ref.read(waiterOnlineStatusProvider.notifier).toggleOnline(true),
                            child: const Text('Go Online', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900)),
                          ),
                        ],
                      ),
                    ),
                  ),

                // 2. Status filter chips matching Web: ALL, PREPARING, READY, AVAILABLE
                SliverToBoxAdapter(
                  child: Container(
                    padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
                    decoration: const BoxDecoration(
                      border: Border(
                        bottom: BorderSide(color: Color(0x33CBD5E1), width: 1),
                      ),
                    ),
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      physics: const BouncingScrollPhysics(),
                      child: Row(
                        children: [
                          _buildStatusFilterChip(
                            keyId: 'ALL',
                            label: 'All',
                            count: allTables.length,
                            activeColor: const Color(0xFFFF6B35),
                            isLightText: false,
                            isSelected: tablesState.selectedStatusFilter == 'ALL',
                            onTap: () => tablesNotifier.selectStatusFilter('ALL'),
                          ),
                          const SizedBox(width: 8),
                          _buildStatusFilterChip(
                            keyId: 'PREPARING',
                            label: 'Preparing',
                            count: prepTables.length,
                            activeColor: const Color(0xFFFFDE63),
                            isLightText: true,
                            isSelected: tablesState.selectedStatusFilter == 'PREPARING',
                            onTap: () => tablesNotifier.selectStatusFilter('PREPARING'),
                          ),
                          const SizedBox(width: 8),
                          _buildStatusFilterChip(
                            keyId: 'READY',
                            label: 'Ready',
                            count: readyTables.length,
                            activeColor: const Color(0xFF8F87F1),
                            isLightText: false,
                            isSelected: tablesState.selectedStatusFilter == 'READY',
                            onTap: () => tablesNotifier.selectStatusFilter('READY'),
                          ),
                          const SizedBox(width: 8),
                          _buildStatusFilterChip(
                            keyId: 'AVAILABLE',
                            label: 'Available',
                            count: availTables.length,
                            activeColor: const Color(0xFFABE7B2),
                            isLightText: true,
                            isSelected: tablesState.selectedStatusFilter == 'AVAILABLE',
                            onTap: () => tablesNotifier.selectStatusFilter('AVAILABLE'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),

                // 3. Main Content: Sections (when ALL) or Filtered Grid
                if (tablesState.isLoading && allTables.isEmpty)
                  const SliverFillRemaining(
                    child: Center(child: GridSkeleton(itemCount: 6)),
                  )
                else if (tablesState.errorMessage != null && allTables.isEmpty)
                  SliverFillRemaining(
                    child: Center(
                      child: EmptyStateView(
                        title: 'Unable to Load Tables',
                        subtitle: tablesState.errorMessage!,
                        icon: LucideIcons.alertCircle,
                        actionLabel: 'Retry',
                        onAction: () {
                          final restaurantId = session?.restaurantId ?? '202603180001';
                          ref.read(tablesControllerProvider.notifier).loadTables(restaurantId);
                        },
                      ),
                    ),
                  )
                else if (tablesState.selectedStatusFilter == 'ALL') ...[
                  // ── Section 1: My Tables ──
                  if (myTables.isNotEmpty) ...[
                    _buildSectionHeader(
                      title: 'My Tables',
                      count: myTables.length,
                      icon: LucideIcons.userCheck,
                      iconColor: const Color(0xFFFF6B35),
                      badgeBg: const Color(0xFF8CA9FF),
                      badgeFg: const Color(0xFF0F172A),
                    ),
                    _buildTableSliverGrid(myTables, isSelectionMode),
                  ],

                  // ── Section 2: Ready to Serve ──
                  if (readyTables.isNotEmpty) ...[
                    _buildSectionHeader(
                      title: 'Ready to Serve',
                      count: readyTables.length,
                      icon: LucideIcons.chefHat,
                      iconColor: const Color(0xFF7E22CE),
                      badgeBg: const Color(0xFF8F87F1),
                      badgeFg: Colors.white,
                    ),
                    _buildTableSliverGrid(readyTables, isSelectionMode),
                  ],

                  // ── Section 3: In Kitchen / Preparing ──
                  if (prepTables.isNotEmpty) ...[
                    _buildSectionHeader(
                      title: 'In Kitchen / Preparing',
                      count: prepTables.length,
                      icon: LucideIcons.utensils,
                      iconColor: const Color(0xFFB45309),
                      badgeBg: const Color(0xFFFFDE63),
                      badgeFg: const Color(0xFF0F172A),
                    ),
                    _buildTableSliverGrid(prepTables, isSelectionMode),
                  ],

                  // ── Section 4: Available Tables ──
                  if (availTables.isNotEmpty) ...[
                    _buildSectionHeader(
                      title: 'Available Tables',
                      count: availTables.length,
                      icon: LucideIcons.sparkles,
                      iconColor: const Color(0xFF059669),
                      badgeBg: const Color(0xFFABE7B2),
                      badgeFg: const Color(0xFF0F172A),
                    ),
                    _buildTableSliverGrid(availTables, isSelectionMode),
                  ],

                  // ── Section 5: Other Assigned Tables ──
                  if (otherTables.isNotEmpty) ...[
                    _buildSectionHeader(
                      title: 'Other Assigned Tables',
                      count: otherTables.length,
                      icon: LucideIcons.users,
                      iconColor: const Color(0xFF64748B),
                      badgeBg: const Color(0xFFCBD5E1),
                      badgeFg: const Color(0xFF334155),
                    ),
                    _buildTableSliverGrid(otherTables, isSelectionMode),
                  ],

                  const SliverPadding(padding: EdgeInsets.only(bottom: 120)),
                ] else ...[
                  // Single filter grid (PREPARING, READY, AVAILABLE)
                  Builder(
                    builder: (context) {
                      final filtered = filteredTables;
                      if (filtered.isEmpty) {
                        return const SliverFillRemaining(
                          child: Center(
                            child: EmptyStateView(
                              title: 'No Tables Found',
                              subtitle: 'No tables found in this filter.',
                              icon: LucideIcons.layoutGrid,
                            ),
                          ),
                        );
                      }
                      return _buildTableSliverGrid(filtered, isSelectionMode);
                    },
                  ),
                  const SliverPadding(padding: EdgeInsets.only(bottom: 120)),
                ],
              ],
            ),
          ),

          // Floating Action Bar for Selected Tables (Merge, Move, Pin, Delete)
          if (isSelectionMode)
            Positioned(
              left: 16,
              right: 16,
              bottom: 20,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.primary, width: 1.5),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.15),
                      blurRadius: 18,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    // 1. Merge Option
                    _buildPopupActionButton(
                      icon: LucideIcons.link2,
                      label: 'Merge',
                      color: AppColors.primary,
                      isEnabled: _selectedTableIds.length >= 2 && !_isActionInProgress,
                      onTap: _handleMergeSelected,
                    ),

                    // 2. Move (Another Area) Option
                    _buildPopupActionButton(
                      icon: LucideIcons.move,
                      label: 'Move Area',
                      color: const Color(0xFF0284C7),
                      isEnabled: !_isActionInProgress,
                      onTap: _handleMoveArea,
                    ),

                    // 3. Pin Option
                    _buildPopupActionButton(
                      icon: LucideIcons.pin,
                      label: 'Pin',
                      color: const Color(0xFFD97706),
                      isEnabled: !_isActionInProgress,
                      onTap: _handlePinSelected,
                    ),

                    // 4. Delete Option
                    _buildPopupActionButton(
                      icon: LucideIcons.trash2,
                      label: 'Delete',
                      color: AppColors.error,
                      isEnabled: !_isActionInProgress,
                      onTap: _handleDeleteSelected,
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildPopupActionButton({
    required IconData icon,
    required String label,
    required Color color,
    required bool isEnabled,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: isEnabled ? onTap : null,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: isEnabled ? color.withValues(alpha: 0.12) : AppColors.surfaceContainerHigh,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  icon,
                  size: 20,
                  color: isEnabled ? color : AppColors.textMuted,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                label,
                style: AppTypography.labelSmall.copyWith(
                  color: isEnabled ? AppColors.textPrimary : AppColors.textMuted,
                  fontWeight: FontWeight.w700,
                  fontSize: 11,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionHeader({
    required String title,
    required int count,
    required IconData icon,
    required Color iconColor,
    required Color badgeBg,
    required Color badgeFg,
  }) {
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 10),
        child: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: const Color(0xFFEEF2F6),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.white.withValues(alpha: 0.7), width: 1),
                boxShadow: const [
                  BoxShadow(color: Color(0x66A6B4C8), offset: Offset(2.5, 2.5), blurRadius: 6),
                  BoxShadow(color: Color(0xF2FFFFFF), offset: Offset(-2.5, -2.5), blurRadius: 6),
                ],
              ),
              child: Center(
                child: Icon(icon, size: 16, color: iconColor),
              ),
            ),
            const SizedBox(width: 10),
            Text(
              title,
              style: const TextStyle(
                fontFamily: 'Outfit',
                fontSize: 14,
                fontWeight: FontWeight.w900,
                color: Color(0xFF1E293B),
                letterSpacing: -0.2,
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: badgeBg,
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(color: badgeBg.withValues(alpha: 0.35), blurRadius: 4, offset: const Offset(0, 1)),
                ],
              ),
              child: Text(
                '$count',
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w900,
                  color: badgeFg,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTableSliverGrid(List<TableModel> tables, bool isSelectionMode) {
    return SliverPadding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      sliver: SliverGrid(
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 1 / 1.05,
        ),
        delegate: SliverChildBuilderDelegate(
          (context, index) {
            final table = tables[index];
            final isSelected = _selectedTableIds.contains(table.id);

            return TableCard(
              table: table,
              isSelected: isSelected,
              isSelecting: isSelectionMode,
              onTap: () {
                if (isSelectionMode) {
                  _toggleTableSelection(table.id);
                } else {
                  _openTableDetails(table);
                }
              },
              onLongPress: () {
                FeedbackUtils.heavyHaptic();
                _toggleTableSelection(table.id);
              },
            );
          },
          childCount: tables.length,
        ),
      ),
    );
  }

  Widget _buildStatusFilterChip({
    required String keyId,
    required String label,
    required int count,
    required Color activeColor,
    required bool isLightText,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    final fgColor = isSelected ? (isLightText ? const Color(0xFF0F172A) : Colors.white) : const Color(0xFF334155);
    final dotColor = isSelected ? (isLightText ? const Color(0xFF0F172A) : Colors.white) : activeColor;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          FeedbackUtils.selectionHaptic();
          onTap();
        },
        borderRadius: BorderRadius.circular(20),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
          decoration: BoxDecoration(
            color: isSelected ? activeColor : const Color(0xFFEEF2F6),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isSelected ? Colors.black.withValues(alpha: 0.15) : Colors.white.withValues(alpha: 0.7),
              width: isSelected ? 1.5 : 1,
            ),
            boxShadow: isSelected
                ? [
                    BoxShadow(
                      color: activeColor.withValues(alpha: 0.4),
                      blurRadius: 10,
                      offset: const Offset(0, 3),
                    ),
                  ]
                : const [
                    BoxShadow(
                      color: Color(0x59A6B4C8),
                      offset: Offset(3, 3),
                      blurRadius: 7,
                    ),
                    BoxShadow(
                      color: Color(0xF2FFFFFF),
                      offset: Offset(-3, -3),
                      blurRadius: 7,
                    ),
                  ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: dotColor,
                  shape: BoxShape.circle,
                  boxShadow: isSelected
                      ? null
                      : [
                          BoxShadow(color: activeColor.withValues(alpha: 0.8), blurRadius: 5),
                        ],
                ),
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  color: fgColor,
                  fontWeight: isSelected ? FontWeight.w900 : FontWeight.w700,
                  fontSize: 12,
                ),
              ),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                decoration: BoxDecoration(
                  color: isSelected
                      ? (isLightText ? Colors.black.withValues(alpha: 0.12) : Colors.white.withValues(alpha: 0.25))
                      : const Color(0x8CCBD5E1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '$count',
                  style: TextStyle(
                    color: fgColor,
                    fontSize: 10.5,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAreaPill({
    required String label,
    required int count,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(24),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.primary : AppColors.surfaceContainerHigh,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(
              color: isSelected ? AppColors.primary : AppColors.borderVariant,
              width: 1,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: AppTypography.labelLarge.copyWith(
                  color: isSelected ? AppColors.onPrimary : AppColors.textSecondary,
                  fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                  fontSize: 13,
                ),
              ),
              if (count > 0) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: isSelected 
                        ? Colors.black.withValues(alpha: 0.15) 
                        : AppColors.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    '$count',
                    style: TextStyle(
                      color: isSelected ? AppColors.onPrimary : AppColors.textMuted,
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ----- Areas Button Widget with Animated Dropdown -----
class _AreasButton extends StatefulWidget {
  final List<AreaModel> areas;
  final String? selectedAreaId;
  final ValueChanged<String?> onAreaSelected;

  const _AreasButton({
    required this.areas,
    required this.selectedAreaId,
    required this.onAreaSelected,
  });

  @override
  State<_AreasButton> createState() => _AreasButtonState();
}

class _AreasButtonState extends State<_AreasButton> with SingleTickerProviderStateMixin {
  final GlobalKey _buttonKey = GlobalKey();
  OverlayEntry? _overlayEntry;
  late AnimationController _animController;
  late Animation<double> _scaleAnimation;
  late Animation<double> _fadeAnimation;
  bool _isOpen = false;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      duration: const Duration(milliseconds: 250),
      reverseDuration: const Duration(milliseconds: 180),
      vsync: this,
    );
    _scaleAnimation = CurvedAnimation(
      parent: _animController,
      curve: Curves.easeOutBack,
      reverseCurve: Curves.easeInQuad,
    );
    _fadeAnimation = CurvedAnimation(
      parent: _animController,
      curve: Curves.easeOut,
      reverseCurve: Curves.easeIn,
    );
  }

  @override
  void dispose() {
    _removeOverlay();
    _animController.dispose();
    super.dispose();
  }

  void _toggleDropdown() {
    FeedbackUtils.selectionHaptic();
    if (_isOpen) {
      _closeDropdown();
    } else {
      _openDropdown();
    }
  }

  void _openDropdown() {
    final renderBox = _buttonKey.currentContext?.findRenderObject() as RenderBox?;
    if (renderBox == null) return;

    final buttonPos = renderBox.localToGlobal(Offset.zero);
    final buttonSize = renderBox.size;

    _overlayEntry = OverlayEntry(
      builder: (context) => _AnimatedAreasDropdown(
        buttonRect: Rect.fromLTWH(
          buttonPos.dx,
          buttonPos.dy,
          buttonSize.width,
          buttonSize.height,
        ),
        scaleAnimation: _scaleAnimation,
        fadeAnimation: _fadeAnimation,
        areas: widget.areas,
        selectedAreaId: widget.selectedAreaId,
        onAreaSelected: (areaId) {
          widget.onAreaSelected(areaId);
          _closeDropdown();
        },
        onDismiss: _closeDropdown,
      ),
    );

    Overlay.of(context).insert(_overlayEntry!);
    _animController.forward();
    setState(() => _isOpen = true);
  }

  Future<void> _closeDropdown() async {
    if (!_isOpen) return;
    await _animController.reverse();
    _removeOverlay();
    if (mounted) setState(() => _isOpen = false);
  }

  void _removeOverlay() {
    _overlayEntry?.remove();
    _overlayEntry = null;
  }

  IconData _getAreaIcon(String name) {
    final lower = name.toLowerCase();
    if (lower.contains('outdoor') || lower.contains('garden') || lower.contains('terrace')) {
      return LucideIcons.trees;
    } else if (lower.contains('vip') || lower.contains('private') || lower.contains('premium')) {
      return LucideIcons.crown;
    } else if (lower.contains('bar') || lower.contains('lounge')) {
      return LucideIcons.wine;
    } else if (lower.contains('rooftop') || lower.contains('top')) {
      return LucideIcons.sun;
    } else if (lower.contains('family') || lower.contains('hall')) {
      return LucideIcons.users;
    }
    return LucideIcons.mapPin;
  }

  @override
  Widget build(BuildContext context) {
    final hasFilter = widget.selectedAreaId != null &&
        widget.selectedAreaId!.isNotEmpty &&
        widget.selectedAreaId != 'ALL';
    final selectedArea = hasFilter
        ? widget.areas.firstWhere(
            (a) => a.id == widget.selectedAreaId || a.name == widget.selectedAreaId,
            orElse: () => AreaModel(id: '', name: widget.selectedAreaId!, displayOrder: 0),
          )
        : null;

    return GestureDetector(
      key: _buttonKey,
      onTap: _toggleDropdown,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: _isOpen
              ? AppColors.primary.withValues(alpha: 0.12)
              : hasFilter
                  ? AppColors.primaryContainer
                  : AppColors.surfaceContainerHigh,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: _isOpen || hasFilter
                ? AppColors.primary.withValues(alpha: 0.4)
                : AppColors.border,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              LucideIcons.mapPin,
              size: 14,
              color: _isOpen || hasFilter ? AppColors.primary : AppColors.textSecondary,
            ),
            const SizedBox(width: 5),
            Text(
              hasFilter ? (selectedArea?.name ?? 'Area') : 'Areas',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w800,
                color: _isOpen || hasFilter ? AppColors.primary : AppColors.textPrimary,
              ),
            ),
            const SizedBox(width: 3),
            AnimatedRotation(
              turns: _isOpen ? 0.5 : 0,
              duration: const Duration(milliseconds: 250),
              child: Icon(
                LucideIcons.chevronDown,
                size: 14,
                color: _isOpen || hasFilter ? AppColors.primary : AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ----- Animated Dropdown Overlay -----
class _AnimatedAreasDropdown extends StatelessWidget {
  final Rect buttonRect;
  final Animation<double> scaleAnimation;
  final Animation<double> fadeAnimation;
  final List<AreaModel> areas;
  final String? selectedAreaId;
  final ValueChanged<String?> onAreaSelected;
  final VoidCallback onDismiss;

  const _AnimatedAreasDropdown({
    required this.buttonRect,
    required this.scaleAnimation,
    required this.fadeAnimation,
    required this.areas,
    required this.selectedAreaId,
    required this.onAreaSelected,
    required this.onDismiss,
  });

  IconData _getAreaIcon(String name) {
    final lower = name.toLowerCase();
    if (lower.contains('outdoor') || lower.contains('garden') || lower.contains('terrace')) {
      return LucideIcons.trees;
    } else if (lower.contains('vip') || lower.contains('private') || lower.contains('premium')) {
      return LucideIcons.crown;
    } else if (lower.contains('bar') || lower.contains('lounge')) {
      return LucideIcons.wine;
    } else if (lower.contains('rooftop') || lower.contains('top')) {
      return LucideIcons.sun;
    } else if (lower.contains('family') || lower.contains('hall')) {
      return LucideIcons.users;
    }
    return LucideIcons.mapPin;
  }

  @override
  Widget build(BuildContext context) {
    final isAllSelected = selectedAreaId == null || selectedAreaId!.isEmpty || selectedAreaId == 'ALL';
    final dropdownRight = MediaQuery.of(context).size.width - buttonRect.right;
    final dropdownTop = buttonRect.bottom + 8;

    return Stack(
      children: [
        // Dismiss backdrop
        Positioned.fill(
          child: GestureDetector(
            onTap: onDismiss,
            behavior: HitTestBehavior.opaque,
            child: FadeTransition(
              opacity: fadeAnimation,
              child: Container(color: Colors.black.withValues(alpha: 0.15)),
            ),
          ),
        ),

        // Dropdown card
        Positioned(
          top: dropdownTop,
          right: dropdownRight,
          child: AnimatedBuilder(
            animation: scaleAnimation,
            builder: (context, child) {
              return Transform.scale(
                scale: scaleAnimation.value,
                alignment: Alignment.topRight,
                child: Opacity(
                  opacity: fadeAnimation.value,
                  child: child,
                ),
              );
            },
            child: Material(
              color: Colors.transparent,
              child: Container(
                width: 240,
                constraints: const BoxConstraints(maxHeight: 400),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.12),
                      blurRadius: 24,
                      offset: const Offset(0, 8),
                      spreadRadius: 2,
                    ),
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.06),
                      blurRadius: 12,
                      offset: const Offset(0, 2),
                    ),
                  ],
                  border: Border.all(
                    color: AppColors.border.withValues(alpha: 0.5),
                  ),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(20),
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Header
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
                          child: Row(
                            children: [
                              const Icon(LucideIcons.mapPin, color: AppColors.primary, size: 16),
                              const SizedBox(width: 8),
                              Text(
                                'Areas',
                                style: AppTypography.headingMedium.copyWith(
                                  fontWeight: FontWeight.w900,
                                  color: AppColors.textPrimary,
                                  fontSize: 15,
                                ),
                              ),
                              const Spacer(),
                              if (!isAllSelected)
                                GestureDetector(
                                  onTap: () => onAreaSelected(null),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: AppColors.primary.withValues(alpha: 0.1),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: const Text(
                                      'Clear',
                                      style: TextStyle(
                                        color: AppColors.primary,
                                        fontWeight: FontWeight.w800,
                                        fontSize: 11,
                                      ),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),

                        Container(
                          height: 1,
                          margin: const EdgeInsets.symmetric(horizontal: 12),
                          color: AppColors.border.withValues(alpha: 0.5),
                        ),
                        const SizedBox(height: 6),

                        // All Areas option
                        _DropdownAreaTile(
                          name: 'All Areas',
                          icon: LucideIcons.layoutGrid,
                          isSelected: isAllSelected,
                          onTap: () => onAreaSelected(null),
                          delay: 0,
                          parentAnimation: fadeAnimation,
                        ),

                        // Individual areas
                        ...areas.asMap().entries.map((entry) => _DropdownAreaTile(
                          name: entry.value.name,
                          icon: _getAreaIcon(entry.value.name),
                          isSelected: selectedAreaId == entry.value.id || selectedAreaId == entry.value.name,
                          onTap: () => onAreaSelected(entry.value.id),
                          delay: entry.key + 1,
                          parentAnimation: fadeAnimation,
                        )),

                        const SizedBox(height: 4),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ----- Dropdown Area Tile with staggered entrance -----
class _DropdownAreaTile extends StatefulWidget {
  final String name;
  final IconData icon;
  final bool isSelected;
  final VoidCallback onTap;
  final int delay;
  final Animation<double> parentAnimation;

  const _DropdownAreaTile({
    required this.name,
    required this.icon,
    required this.isSelected,
    required this.onTap,
    required this.delay,
    required this.parentAnimation,
  });

  @override
  State<_DropdownAreaTile> createState() => _DropdownAreaTileState();
}

class _DropdownAreaTileState extends State<_DropdownAreaTile>
    with SingleTickerProviderStateMixin {
  late AnimationController _slideController;
  late Animation<Offset> _slideAnim;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _slideController = AnimationController(
      duration: const Duration(milliseconds: 200),
      vsync: this,
    );
    _slideAnim = Tween<Offset>(
      begin: const Offset(0.15, 0),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _slideController,
      curve: Curves.easeOutCubic,
    ));
    _fadeAnim = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _slideController, curve: Curves.easeOut),
    );

    Future.delayed(Duration(milliseconds: 40 * widget.delay + 80), () {
      if (mounted) _slideController.forward();
    });
  }

  @override
  void dispose() {
    _slideController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SlideTransition(
      position: _slideAnim,
      child: FadeTransition(
        opacity: _fadeAnim,
        child: InkWell(
          onTap: () {
            FeedbackUtils.lightHaptic();
            widget.onTap();
          },
          borderRadius: BorderRadius.circular(12),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: widget.isSelected ? AppColors.primaryContainer : Colors.transparent,
              borderRadius: BorderRadius.circular(12),
              border: widget.isSelected
                  ? Border.all(color: AppColors.primary.withValues(alpha: 0.25))
                  : null,
            ),
            child: Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: widget.isSelected
                        ? AppColors.primary.withValues(alpha: 0.15)
                        : AppColors.surfaceContainerHigh,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Center(
                    child: Icon(
                      widget.icon,
                      size: 15,
                      color: widget.isSelected ? AppColors.primary : AppColors.textSecondary,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    widget.name,
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: widget.isSelected ? FontWeight.w800 : FontWeight.w600,
                      color: widget.isSelected ? AppColors.primary : AppColors.textPrimary,
                    ),
                  ),
                ),
                if (widget.isSelected)
                  const Icon(LucideIcons.check, size: 16, color: AppColors.primary),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
