import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../auth/auth_controller.dart';
import 'menu_models.dart';
import 'menu_repository.dart';

enum DietaryFilter { all, veg, nonVeg }

class MenuState {
  final bool isLoading;
  final List<MenuCategory> categories;
  final List<MenuItemModel> allItems;
  final String? selectedCategoryId;
  final String searchQuery;
  final DietaryFilter dietaryFilter;
  final String? errorMessage;

  const MenuState({
    this.isLoading = false,
    this.categories = const [],
    this.allItems = const [],
    this.selectedCategoryId,
    this.searchQuery = '',
    this.dietaryFilter = DietaryFilter.all,
    this.errorMessage,
  });

  List<MenuItemModel> get items => allItems;

  List<MenuItemModel> get filteredItems {
    final hasSearch = searchQuery.trim().isNotEmpty;

    return allItems.where((item) {
      // Dietary filter (All, Veg, Non-Veg) - always applied
      if (dietaryFilter == DietaryFilter.veg && !item.isVeg) {
        return false;
      }
      if (dietaryFilter == DietaryFilter.nonVeg && item.isVeg) {
        return false;
      }

      // Category filter - only apply if NOT searching across all items
      if (!hasSearch) {
        if (selectedCategoryId != null && selectedCategoryId!.isNotEmpty && selectedCategoryId != 'ALL') {
          if (selectedCategoryId == 'COMBOS_OFFERS') {
            final isComboOrOffer = item.isSpecial || 
                (item.specialPrice != null && item.specialPrice! > 0) ||
                item.name.toLowerCase().contains('combo') ||
                (item.description != null && item.description!.toLowerCase().contains('combo')) ||
                item.name.toLowerCase().contains('offer') ||
                item.name.toLowerCase().contains('special');
            if (!isComboOrOffer) {
              return false;
            }
          } else if (item.categoryId != selectedCategoryId) {
            return false;
          }
        }
      }

      // Search Query across all items
      if (hasSearch) {
        final query = searchQuery.trim().toLowerCase();
        final matchName = item.name.toLowerCase().contains(query);
        final matchDesc = (item.description ?? '').toLowerCase().contains(query);
        if (!matchName && !matchDesc) return false;
      }

      return true;
    }).toList();
  }

  MenuState copyWith({
    bool? isLoading,
    List<MenuCategory>? categories,
    List<MenuItemModel>? allItems,
    String? selectedCategoryId,
    bool clearSelectedCategory = false,
    String? searchQuery,
    DietaryFilter? dietaryFilter,
    String? errorMessage,
  }) {
    return MenuState(
      isLoading: isLoading ?? this.isLoading,
      categories: categories ?? this.categories,
      allItems: allItems ?? this.allItems,
      selectedCategoryId: clearSelectedCategory ? null : (selectedCategoryId ?? this.selectedCategoryId),
      searchQuery: searchQuery ?? this.searchQuery,
      dietaryFilter: dietaryFilter ?? this.dietaryFilter,
      errorMessage: errorMessage,
    );
  }
}

final menuRepositoryProvider = Provider<MenuRepository>((ref) => MenuRepository());

final menuControllerProvider = StateNotifierProvider<MenuController, MenuState>((ref) {
  final repository = ref.watch(menuRepositoryProvider);
  final authState = ref.watch(authControllerProvider);
  final restaurantId = authState.session?.restaurantId;

  return MenuController(repository, restaurantId);
});

class MenuController extends StateNotifier<MenuState> {
  final MenuRepository _repository;
  String? _restaurantId;

  MenuController(this._repository, this._restaurantId) : super(const MenuState()) {
    if (_restaurantId != null && _restaurantId!.trim().isNotEmpty) {
      loadMenu();
    }
  }

  Future<void> loadMenu([String? restaurantId]) async {
    if (restaurantId != null && restaurantId.trim().isNotEmpty) _restaurantId = restaurantId.trim();
    final restId = _restaurantId;
    if (restId == null || restId.trim().isEmpty) {
      state = state.copyWith(isLoading: false, categories: [], allItems: []);
      return;
    }
    state = state.copyWith(isLoading: true, errorMessage: null);

    try {
      final results = await Future.wait([
        _repository.fetchCategories(restId),
        _repository.fetchMenuItems(restId),
      ]);

      final categories = results[0] as List<MenuCategory>;
      final items = results[1] as List<MenuItemModel>;

      String? initialCategory;
      if (categories.isNotEmpty) {
        initialCategory = categories[0].id;
      }

      state = state.copyWith(
        isLoading: false,
        categories: categories,
        allItems: items,
        selectedCategoryId: state.selectedCategoryId ?? initialCategory,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString().replaceAll('Exception: ', ''),
      );
    }
  }

  void selectCategory(String? categoryId) {
    if (categoryId == null) {
      state = state.copyWith(clearSelectedCategory: true);
    } else {
      state = state.copyWith(selectedCategoryId: categoryId);
    }
  }

  void setDietaryFilter(DietaryFilter filter) {
    state = state.copyWith(dietaryFilter: filter);
  }

  void search(String query) {
    state = state.copyWith(searchQuery: query);
  }
}
