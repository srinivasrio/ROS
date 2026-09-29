import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/utils/feedback_utils.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/app_network_image.dart';
import '../../core/widgets/empty_state_view.dart';
import '../../core/widgets/loading_skeleton.dart';
import '../../core/widgets/sliding_segmented_bar.dart';
import '../auth/auth_controller.dart';
import '../cart/cart_controller.dart';
import '../cart/cart_screen.dart';
import '../tables/table_models.dart';
import '../tables/tables_controller.dart';
import 'menu_controller.dart';
import 'menu_models.dart';
import 'widgets/dish_card.dart';
import 'widgets/item_customization_sheet.dart';

class MenuScreen extends ConsumerStatefulWidget {
  final TableModel? table;

  const MenuScreen({
    super.key,
    this.table,
  });

  @override
  ConsumerState<MenuScreen> createState() => _MenuScreenState();
}

class _MenuScreenState extends ConsumerState<MenuScreen> {
  final TextEditingController _searchController = TextEditingController();
  final ScrollController _categoryScrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final session = ref.read(authControllerProvider).session;
      final restaurantId = session?.restaurantId ?? '202603180001';
      ref.read(menuControllerProvider.notifier).loadMenu(restaurantId);
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    _categoryScrollController.dispose();
    super.dispose();
  }

  void _openCustomizationSheet(MenuItemModel item, String tableId) {
    FeedbackUtils.selectionHaptic();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ItemCustomizationSheet(item: item, tableId: tableId),
    );
  }

  String? _formatImageUrl(String? url) {
    if (url == null || url.trim().isEmpty) return null;
    final clean = url.trim();
    if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
    if (clean.startsWith('assets/')) return clean;
    if (clean.startsWith('/restaurants/')) {
      return 'https://pub-fc925b324e51441ba1d8aef9ee47e211.r2.dev$clean';
    }
    if (clean.startsWith('/menu/')) {
      return 'https://pub-fc925b324e51441ba1d8aef9ee47e211.r2.dev/restaurants/202603180001$clean';
    }
    if (clean.startsWith('/')) {
      return 'https://pub-fc925b324e51441ba1d8aef9ee47e211.r2.dev/restaurants/202603180001/menu$clean';
    }
    return 'https://pub-fc925b324e51441ba1d8aef9ee47e211.r2.dev/restaurants/202603180001/menu/$clean';
  }

  @override
  Widget build(BuildContext context) {
    final menuState = ref.watch(menuControllerProvider);
    final menuNotifier = ref.read(menuControllerProvider.notifier);
    final activeTable = widget.table ?? ref.watch(selectedTableProvider);
    final tableId = activeTable?.id ?? 'temp_table';
    final cartState = ref.watch(cartProviderFamily(tableId));
    final cartNotifier = ref.read(cartProviderFamily(tableId).notifier);

    final currentUser = ref.watch(authControllerProvider).session;
    final currentUserId = currentUser?.userId ?? currentUser?.employeeId;
    final role = currentUser?.role?.toLowerCase() ?? '';
    final isAdmin = role == 'admin' || role == 'supervisor' || role == 'restaurant_admin';
    final canManageTable = activeTable == null || activeTable.isWaiterAuthorized(currentUserId, isAdmin: isAdmin);

    final allItems = menuState.allItems;
    final vegCount = allItems.where((i) => i.isVeg).length;
    final nonVegCount = allItems.where((i) => !i.isVeg).length;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        leading: widget.table != null
            ? IconButton(
                icon: const Icon(Icons.arrow_back_rounded, color: AppColors.textPrimary),
                onPressed: () => Navigator.of(context).pop(),
              )
            : null,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Menu',
              style: AppTypography.headingMedium.copyWith(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w800,
              ),
            ),
            if (activeTable != null)
              Row(
                children: [
                  Text(
                    'Ordering for ${activeTable.formattedName}',
                    style: AppTypography.bodySmall.copyWith(
                      color: canManageTable ? AppColors.primary : AppColors.error,
                      fontWeight: FontWeight.w700,
                      fontSize: 11,
                    ),
                  ),
                  if (!canManageTable) ...[
                    const SizedBox(width: 4),
                    const Icon(LucideIcons.lock, size: 11, color: AppColors.error),
                  ],
                ],
              ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.rotateCw, size: 20, color: AppColors.primary),
            onPressed: () {
              final session = ref.read(authControllerProvider).session;
              final restaurantId = session?.restaurantId ?? '202603180001';
              menuNotifier.loadMenu(restaurantId);
            },
          ),
          const SizedBox(width: 6),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Top Controls: Search Bar & Veg / Non-Veg / All Filter Bar
            Container(
              padding: const EdgeInsets.fromLTRB(14, 10, 14, 8),
              color: AppColors.surface,
              child: Column(
                children: [
                  // Search Input
                  Container(
                    height: 42,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceContainerHigh,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.border, width: 1),
                    ),
                    child: TextField(
                      controller: _searchController,
                      onChanged: (val) => menuNotifier.search(val),
                      style: AppTypography.bodyMedium.copyWith(color: AppColors.textPrimary),
                      decoration: InputDecoration(
                        hintText: 'Search dishes, soups, biryanis...',
                        hintStyle: AppTypography.bodySmall.copyWith(color: AppColors.textMuted),
                        prefixIcon: const Icon(LucideIcons.search, size: 18, color: AppColors.textSecondary),
                        suffixIcon: _searchController.text.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.clear_rounded, size: 18, color: AppColors.textSecondary),
                                onPressed: () {
                                  _searchController.clear();
                                  menuNotifier.search('');
                                },
                              )
                            : null,
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(vertical: 11),
                      ),
                    ),
                  ),

                  const SizedBox(height: 8),

                  // Veg & Non-Veg Filter Buttons with Smooth Traveling Indicator
                  SlidingSegmentedBar(
                    margin: EdgeInsets.zero,
                    height: 42,
                    selectedKey: menuState.dietaryFilter.name.toUpperCase(),
                    onSelected: (key) {
                      switch (key) {
                        case 'VEG':
                          menuNotifier.setDietaryFilter(DietaryFilter.veg);
                          break;
                        case 'NONVEG':
                        case 'NON_VEG':
                          menuNotifier.setDietaryFilter(DietaryFilter.nonVeg);
                          break;
                        default:
                          menuNotifier.setDietaryFilter(DietaryFilter.all);
                          break;
                      }
                    },
                    items: [
                      const SlidingTabItem(
                        keyId: 'ALL',
                        label: 'All',
                        activeColor: AppColors.primary,
                        icon: LucideIcons.layoutGrid,
                      ),
                      SlidingTabItem(
                        keyId: 'VEG',
                        label: 'Veg',
                        activeColor: const Color(0xFF16A34A), // Emerald Leaf Green
                        leading: Container(
                          width: 12,
                          height: 12,
                          margin: const EdgeInsets.only(right: 5),
                          decoration: BoxDecoration(
                            border: Border.all(
                              color: menuState.dietaryFilter == DietaryFilter.veg ? Colors.white : const Color(0xFF16A34A),
                              width: 1.5,
                            ),
                            borderRadius: BorderRadius.circular(3),
                          ),
                          child: Center(
                            child: Container(
                              width: 5,
                              height: 5,
                              decoration: BoxDecoration(
                                color: menuState.dietaryFilter == DietaryFilter.veg ? Colors.white : const Color(0xFF16A34A),
                                shape: BoxShape.circle,
                              ),
                            ),
                          ),
                        ),
                      ),
                      SlidingTabItem(
                        keyId: 'NONVEG',
                        label: 'Non-Veg',
                        activeColor: const Color(0xFFDC2626), // Crimson Red
                        leading: Container(
                          width: 12,
                          height: 12,
                          margin: const EdgeInsets.only(right: 5),
                          decoration: BoxDecoration(
                            border: Border.all(
                              color: menuState.dietaryFilter == DietaryFilter.nonVeg ? Colors.white : const Color(0xFFDC2626),
                              width: 1.5,
                            ),
                            borderRadius: BorderRadius.circular(3),
                          ),
                          child: Center(
                            child: Container(
                              width: 5,
                              height: 5,
                              decoration: BoxDecoration(
                                color: menuState.dietaryFilter == DietaryFilter.nonVeg ? Colors.white : const Color(0xFFDC2626),
                                shape: BoxShape.circle,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            if (activeTable != null && !canManageTable)
              Container(
                width: double.infinity,
                margin: const EdgeInsets.fromLTRB(14, 0, 14, 8),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFFCA5A5)),
                ),
                child: Row(
                  children: [
                    const Icon(LucideIcons.lock, size: 16, color: Color(0xFFDC2626)),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        '${activeTable.formattedName} is assigned to ${activeTable.assignedWaiterName ?? "another waiter"}. Only the assigned waiter can order food.',
                        style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFF991B1B)),
                      ),
                    ),
                  ],
                ),
              ),

            const Divider(color: AppColors.border, height: 1),

            // Main Body: Vertical Category Sidebar on Left + Dishes on Right
            Expanded(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 1. Vertical Category Sidebar with Images (Left Side) with Smooth Travel Animation
                  Container(
                    width: 104,
                    decoration: const BoxDecoration(
                      color: AppColors.surface,
                      border: Border(right: BorderSide(color: AppColors.border, width: 1)),
                    ),
                    child: Builder(
                      builder: (context) {
                        int selectedIndex = 0;
                        if (menuState.selectedCategoryId == 'COMBOS_OFFERS') {
                          selectedIndex = 0;
                        } else {
                          final idx = menuState.categories.indexWhere((c) => c.id == menuState.selectedCategoryId);
                          selectedIndex = idx >= 0 ? idx + 1 : 0;
                        }

                        const double tileHeight = 108.0;
                        const double tileSpacing = 6.0;

                        return SingleChildScrollView(
                          controller: _categoryScrollController,
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
                          child: Stack(
                            children: [
                              // Smooth Traveling Indicator Pill
                              AnimatedPositioned(
                                duration: const Duration(milliseconds: 260),
                                curve: Curves.easeOutCubic,
                                top: selectedIndex * (tileHeight + tileSpacing),
                                left: 4,
                                right: 4,
                                height: tileHeight,
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: AppColors.primaryLight,
                                    borderRadius: BorderRadius.circular(14),
                                    border: Border.all(
                                      color: AppColors.primary.withValues(alpha: 0.35),
                                      width: 1.5,
                                    ),
                                    boxShadow: [
                                      BoxShadow(
                                        color: AppColors.primary.withValues(alpha: 0.12),
                                        blurRadius: 8,
                                        offset: const Offset(0, 2),
                                      ),
                                    ],
                                  ),
                                  child: Align(
                                    alignment: Alignment.centerLeft,
                                    child: Container(
                                      width: 4,
                                      height: 38,
                                      decoration: const BoxDecoration(
                                        color: AppColors.primary,
                                        borderRadius: BorderRadius.horizontal(right: Radius.circular(4)),
                                      ),
                                    ),
                                  ),
                                ),
                              ),

                              // Column of Category Buttons
                              Column(
                                mainAxisSize: MainAxisSize.min,
                                children: List.generate(menuState.categories.length + 1, (index) {
                                  if (index == 0) {
                                    final isSelected = menuState.selectedCategoryId == 'COMBOS_OFFERS';
                                    final comboCount = menuState.allItems.where((i) =>
                                      i.isSpecial ||
                                      (i.specialPrice != null && i.specialPrice! > 0) ||
                                      i.name.toLowerCase().contains('combo') ||
                                      (i.description != null && i.description!.toLowerCase().contains('combo')) ||
                                      i.name.toLowerCase().contains('offer') ||
                                      i.name.toLowerCase().contains('special')
                                    ).length;

                                    return Padding(
                                      padding: EdgeInsets.only(bottom: index < menuState.categories.length ? tileSpacing : 0.0),
                                      child: _buildVerticalCategoryTile(
                                        label: 'Combos and offers',
                                        icon: LucideIcons.badgePercent,
                                        imageUrl: null,
                                        count: comboCount,
                                        isSelected: isSelected,
                                        onTap: () {
                                          FeedbackUtils.selectionHaptic();
                                          menuNotifier.selectCategory('COMBOS_OFFERS');
                                          _scrollToCategory(0, tileHeight, tileSpacing);
                                        },
                                      ),
                                    );
                                  }

                                  final category = menuState.categories[index - 1];
                                  final isSelected = menuState.selectedCategoryId == category.id;
                                  final itemCount = menuState.allItems.where((i) => i.categoryId == category.id).length;

                                  return Padding(
                                    padding: EdgeInsets.only(bottom: index < menuState.categories.length ? tileSpacing : 0.0),
                                    child: _buildVerticalCategoryTile(
                                      label: category.name,
                                      icon: _getCategoryIcon(category.name),
                                      imageUrl: _formatImageUrl(category.imageUrl),
                                      count: itemCount,
                                      isSelected: isSelected,
                                      onTap: () {
                                        FeedbackUtils.selectionHaptic();
                                        menuNotifier.selectCategory(category.id);
                                        _scrollToCategory(index, tileHeight, tileSpacing);
                                      },
                                    ),
                                  );
                                }),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),

                  // 2. Dishes Grid / List (Right Side)
                  Expanded(
                    child: Builder(
                      builder: (context) {
                        if (menuState.isLoading && menuState.allItems.isEmpty) {
                          return const Padding(
                            padding: EdgeInsets.all(12),
                            child: ListSkeleton(itemCount: 6),
                          );
                        }

                        if (menuState.errorMessage != null && menuState.allItems.isEmpty) {
                          return Center(
                            child: EmptyStateView(
                              title: 'Unable to Load Menu',
                              subtitle: menuState.errorMessage!,
                              icon: LucideIcons.alertCircle,
                              actionLabel: 'Retry',
                              onAction: () {
                                final session = ref.read(authControllerProvider).session;
                                final restaurantId = session?.restaurantId ?? '202603180001';
                                menuNotifier.loadMenu(restaurantId);
                              },
                            ),
                          );
                        }

                        final items = menuState.filteredItems;
                        final isSearching = menuState.searchQuery.trim().isNotEmpty;

                        if (items.isEmpty) {
                          return Center(
                            child: EmptyStateView(
                              title: isSearching ? 'No Results Found' : 'No Dishes Found',
                              subtitle: isSearching
                                  ? 'No items matched "${menuState.searchQuery.trim()}".'
                                  : 'Try adjusting your category or veg filter.',
                              icon: LucideIcons.utensils,
                              actionLabel: isSearching ? 'Clear Search' : null,
                              onAction: isSearching
                                  ? () {
                                      _searchController.clear();
                                      menuNotifier.search('');
                                    }
                                  : null,
                            ),
                          );
                        }

                        return ListView.separated(
                          padding: const EdgeInsets.fromLTRB(10, 10, 10, 88),
                          physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
                          itemCount: items.length + (isSearching ? 1 : 0),
                          separatorBuilder: (_, __) => const SizedBox(height: 10),
                          itemBuilder: (context, index) {
                            if (isSearching && index == 0) {
                              return Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                decoration: BoxDecoration(
                                  color: AppColors.primaryContainer,
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(LucideIcons.search, size: 14, color: AppColors.primary),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        'All Results: ${items.length} items found',
                                        style: TextStyle(
                                          color: AppColors.primary,
                                          fontSize: 12,
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                    ),
                                    InkWell(
                                      onTap: () {
                                        _searchController.clear();
                                        menuNotifier.search('');
                                      },
                                      child: const Padding(
                                        padding: EdgeInsets.all(2),
                                        child: Icon(Icons.close_rounded, size: 16, color: AppColors.primary),
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            }

                            final dish = items[isSearching ? index - 1 : index];
                            final qty = cartState.getItemQuantity(dish.id);

                            return DishCard(
                              item: dish,
                              quantity: qty,
                              onAdd: canManageTable
                                  ? () => cartNotifier.addItem(dish)
                                  : () => FeedbackUtils.showToast(context, message: 'Only assigned waiter can add items for ${activeTable?.formattedName}', isError: true),
                              onIncrement: canManageTable
                                  ? () => cartNotifier.incrementQuantity(dish.id)
                                  : () => FeedbackUtils.showToast(context, message: 'Only assigned waiter can add items for ${activeTable?.formattedName}', isError: true),
                              onDecrement: canManageTable
                                  ? () => cartNotifier.decrementQuantity(dish.id)
                                  : () => FeedbackUtils.showToast(context, message: 'Only assigned waiter can modify items for ${activeTable?.formattedName}', isError: true),
                              onCustomize: canManageTable
                                  ? () => _openCustomizationSheet(dish, tableId)
                                  : () => FeedbackUtils.showToast(context, message: 'Only assigned waiter can customize items for ${activeTable?.formattedName}', isError: true),
                            );
                          },
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),

      // Floating Cart Summary Bar
      bottomSheet: cartState.items.isNotEmpty
          ? Container(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
              decoration: BoxDecoration(
                color: AppColors.surface,
                border: const Border(top: BorderSide(color: AppColors.border, width: 1)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.08),
                    blurRadius: 16,
                    offset: const Offset(0, -4),
                  ),
                ],
              ),
              child: SafeArea(
                top: false,
                child: Row(
                  children: [
                    // Total info
                    Expanded(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: AppColors.primaryContainer,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  '${cartState.totalItemCount} Items',
                                  style: AppTypography.labelSmall.copyWith(
                                    color: AppColors.onPrimaryContainer,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                Formatters.formatCurrency(cartState.grandTotal),
                                style: AppTypography.headingMedium.copyWith(
                                  color: AppColors.textPrimary,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Table: ${activeTable?.formattedName ?? "Selected Table"}',
                            style: AppTypography.bodySmall.copyWith(
                              color: AppColors.textSecondary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),

                    // View Cart Button
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: canManageTable ? AppColors.primary : AppColors.surfaceContainerHighest,
                        foregroundColor: canManageTable ? AppColors.onPrimary : AppColors.textMuted,
                        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        elevation: canManageTable ? 4 : 0,
                      ),
                      onPressed: canManageTable
                          ? () {
                              FeedbackUtils.selectionHaptic();
                              final targetTable = activeTable ?? TableModel(id: tableId, tableNumber: '1', capacity: 4, status: 'empty');
                              Navigator.of(context).push(
                                MaterialPageRoute(builder: (_) => CartScreen(table: targetTable)),
                              );
                            }
                          : () {
                              FeedbackUtils.showToast(context, message: 'This table is assigned to ${activeTable?.assignedWaiterName ?? "another waiter"}', isError: true);
                            },
                      icon: Icon(canManageTable ? LucideIcons.shoppingBag : LucideIcons.lock, size: 18),
                      label: Text(
                        canManageTable ? 'View Cart' : 'Table Locked',
                        style: AppTypography.labelLarge.copyWith(
                          color: canManageTable ? AppColors.onPrimary : AppColors.textMuted,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            )
          : null,
    );
  }

  void _scrollToCategory(int index, double tileHeight, double tileSpacing) {
    if (!_categoryScrollController.hasClients) return;
    final targetOffset = (index * (tileHeight + tileSpacing)) - 100;
    _categoryScrollController.animateTo(
      targetOffset.clamp(0.0, _categoryScrollController.position.maxScrollExtent),
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeOutCubic,
    );
  }

  Widget _buildVerticalCategoryTile({
    required String label,
    required IconData icon,
    String? imageUrl,
    required int count,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: SizedBox(
          height: 108,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Category Image / Thumbnail
                AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(11),
                    border: Border.all(
                      color: isSelected ? AppColors.primary : AppColors.borderVariant,
                      width: isSelected ? 2 : 1,
                    ),
                    boxShadow: [
                      if (isSelected)
                        BoxShadow(
                          color: AppColors.primary.withValues(alpha: 0.25),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        ),
                    ],
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: AppNetworkImage(
                    imageUrl: imageUrl,
                    name: label,
                    width: 38,
                    height: 38,
                    borderRadius: BorderRadius.circular(9),
                    fallbackIcon: icon,
                  ),
                ),

                const SizedBox(height: 4),

                Text(
                  label,
                  style: AppTypography.labelSmall.copyWith(
                    color: isSelected ? AppColors.primary : AppColors.textPrimary,
                    fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                    fontSize: 10,
                    height: 1.15,
                  ),
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),

                if (count > 0) ...[
                  const SizedBox(height: 2),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                    decoration: BoxDecoration(
                      color: isSelected ? AppColors.primary.withValues(alpha: 0.15) : AppColors.surfaceContainerHigh,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      '$count',
                      style: TextStyle(
                        color: isSelected ? AppColors.primary : AppColors.textMuted,
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  IconData _getCategoryIcon(String categoryName) {
    final name = categoryName.toLowerCase();
    if (name.contains('starter') || name.contains('appetizer')) return LucideIcons.utensils;
    if (name.contains('soup')) return LucideIcons.coffee;
    if (name.contains('curry') || name.contains('curries')) return LucideIcons.flame;
    if (name.contains('biryani') || name.contains('rice')) return LucideIcons.soup;
    if (name.contains('bread') || name.contains('roti') || name.contains('naan')) return LucideIcons.croissant;
    if (name.contains('burger') || name.contains('fast')) return LucideIcons.sandwich;
    if (name.contains('chinese') || name.contains('noodles')) return LucideIcons.utensilsCrossed;
    if (name.contains('dessert') || name.contains('sweet') || name.contains('ice')) return LucideIcons.iceCream;
    if (name.contains('drink') || name.contains('beverage')) return LucideIcons.glassWater;
    return LucideIcons.utensils;
  }
}
