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

    final isSelectionMode = _selectedTableIds.isNotEmpty;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: isSelectionMode ? AppColors.primaryContainer : AppColors.surface,
        elevation: 0,
        leading: isSelectionMode
            ? IconButton(
                icon: const Icon(Icons.close_rounded, color: AppColors.primary),
                onPressed: _clearSelection,
              )
            : Container(
                margin: const EdgeInsets.only(left: 16),
                child: const Center(
                  child: Icon(
                    Icons.restaurant_rounded,
                    color: AppColors.primary,
                    size: 24,
                  ),
                ),
              ),
        title: isSelectionMode
            ? Text(
                '${_selectedTableIds.length} Table${_selectedTableIds.length > 1 ? 's' : ''} Selected',
                style: AppTypography.headingMedium.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w800,
                ),
              )
            : Text(
                session?.restaurantName ?? 'Dine in One',
                style: AppTypography.headingLarge.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.5,
                ),
              ),
        actions: [
          if (isSelectionMode) ...[
            TextButton(
              onPressed: () {
                setState(() {
                  _selectedTableIds.addAll(allTables.map((t) => t.id));
                });
              },
              child: const Text(
                'Select All',
                style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w800),
              ),
            ),
          ] else ...[
            _AreasButton(
              areas: tablesState.areas,
              selectedAreaId: tablesState.selectedAreaId,
              onAreaSelected: (areaId) {
                ref.read(tablesControllerProvider.notifier).selectArea(areaId);
              },
            ),
            const SizedBox(width: 8),
          ],
        ],
      ),
      body: Stack(
        children: [
          RefreshIndicator(
            color: AppColors.primary,
            backgroundColor: AppColors.surfaceContainer,
            onRefresh: () async {
              final restaurantId = session?.restaurantId ?? '202603180001';
              await ref.read(tablesControllerProvider.notifier).loadTables(restaurantId);
            },
            child: Column(
              children: [
                // Top Status Filter Buttons (All, Ready, Preparing, Available, Empty)
                Container(
                  height: 46,
                  margin: const EdgeInsets.fromLTRB(0, 6, 0, 4),
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    physics: const BouncingScrollPhysics(),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    children: [
                      _buildStatusFilterChip(
                        keyId: 'ALL',
                        label: 'All',
                        count: allTables.length,
                        activeColor: AppColors.primary,
                        isSelected: tablesState.selectedStatusFilter == 'ALL',
                        onTap: () => tablesNotifier.selectStatusFilter('ALL'),
                      ),
                      const SizedBox(width: 8),
                      _buildStatusFilterChip(
                        keyId: 'READY',
                        label: 'Ready',
                        count: readyCount,
                        activeColor: const Color(0xFF8B5CF6), // Electric Purple / Need Bill
                        isSelected: tablesState.selectedStatusFilter == 'READY',
                        onTap: () => tablesNotifier.selectStatusFilter('READY'),
                      ),
                      const SizedBox(width: 8),
                      _buildStatusFilterChip(
                        keyId: 'PREPARING',
                        label: 'Preparing',
                        count: preparingCount,
                        activeColor: const Color(0xFFF59E0B), // Amber Gold
                        isSelected: tablesState.selectedStatusFilter == 'PREPARING',
                        onTap: () => tablesNotifier.selectStatusFilter('PREPARING'),
                      ),
                      const SizedBox(width: 8),
                      _buildStatusFilterChip(
                        keyId: 'AVAILABLE',
                        label: 'Available',
                        count: emptyCount > 0 ? emptyCount : allTables.where((t) => t.isAvailable).length,
                        activeColor: const Color(0xFF10B981), // Emerald Green
                        isSelected: tablesState.selectedStatusFilter == 'AVAILABLE',
                        onTap: () => tablesNotifier.selectStatusFilter('AVAILABLE'),
                      ),
                      const SizedBox(width: 8),
                      _buildStatusFilterChip(
                        keyId: 'EMPTY',
                        label: 'Empty',
                        count: allTables.where((t) => t.status.toLowerCase() == 'empty' || t.status.toLowerCase() == 'free').length,
                        activeColor: const Color(0xFF0284C7), // Sky Blue
                        isSelected: tablesState.selectedStatusFilter == 'EMPTY',
                        onTap: () => tablesNotifier.selectStatusFilter('EMPTY'),
                      ),
                    ],
                  ),
                ),



                const Divider(color: AppColors.border, height: 1),

                // Tables Grid
                Expanded(
                  child: Builder(
                    builder: (context) {
                      if (tablesState.isLoading && tablesState.allTables.isEmpty) {
                        return const Center(
                          child: GridSkeleton(itemCount: 6),
                        );
                      }

                      if (tablesState.errorMessage != null && tablesState.allTables.isEmpty) {
                        return Center(
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
                        );
                      }

                      final tables = filteredTables;

                      if (tables.isEmpty) {
                        return const Center(
                          child: EmptyStateView(
                            title: 'No Tables in this Filter',
                            subtitle: 'Change the status filter or area to view tables.',
                            icon: LucideIcons.layoutGrid,
                          ),
                        );
                      }

                      return GridView.builder(
                        padding: EdgeInsets.fromLTRB(16, 12, 16, isSelectionMode ? 110 : 20),
                        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          crossAxisSpacing: 14,
                          mainAxisSpacing: 14,
                          childAspectRatio: 0.82,
                        ),
                        itemCount: tables.length,
                        itemBuilder: (context, index) {
                          final table = tables[index];
                          final isSelected = _selectedTableIds.contains(table.id);

                          return TableCard(
                            table: table,
                            isSelected: isSelected,
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
                      );
                    },
                  ),
                ),
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

  Widget _buildStatusFilterChip({
    required String keyId,
    required String label,
    required int count,
    required Color activeColor,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          FeedbackUtils.selectionHaptic();
          onTap();
        },
        borderRadius: BorderRadius.circular(20),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
          decoration: BoxDecoration(
            color: isSelected ? activeColor : AppColors.surface,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isSelected ? activeColor : AppColors.border,
              width: 1.2,
            ),
            boxShadow: isSelected
                ? [
                    BoxShadow(
                      color: activeColor.withValues(alpha: 0.3),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : null,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: AppTypography.labelLarge.copyWith(
                  color: isSelected ? Colors.white : AppColors.textPrimary,
                  fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                  fontSize: 12.5,
                ),
              ),
              if (count > 0) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? Colors.white.withValues(alpha: 0.25)
                        : AppColors.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    '$count',
                    style: TextStyle(
                      color: isSelected ? Colors.white : AppColors.textSecondary,
                      fontSize: 10.5,
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
