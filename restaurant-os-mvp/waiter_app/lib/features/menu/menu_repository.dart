import 'package:flutter/foundation.dart';
import '../../core/realtime/supabase_service.dart';
import 'menu_models.dart';

class MenuRepository {
  Future<List<MenuCategory>> fetchCategories(String restaurantId) async {
    try {
      final response = await SupabaseService.client.rpc(
        'get_categories_by_restaurant',
        params: {'p_restaurant_id': restaurantId},
      );

      final List<dynamic> data = response as List<dynamic>;
      if (data.isNotEmpty) {
        return data.map((json) => MenuCategory.fromJson(json as Map<String, dynamic>)).toList();
      }

      final directResponse = await SupabaseService.client
          .from('menu_categories')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .eq('is_active', true)
          .order('display_order', ascending: true);

      return (directResponse as List<dynamic>)
          .map((json) => MenuCategory.fromJson(json as Map<String, dynamic>))
          .toList();
    } catch (e) {
      debugPrint('[MenuRepository] Fallback fetching categories: $e');
      try {
        final directResponse = await SupabaseService.client
            .from('menu_categories')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .eq('is_active', true)
            .order('display_order', ascending: true);

        return (directResponse as List<dynamic>)
            .map((json) => MenuCategory.fromJson(json as Map<String, dynamic>))
            .toList();
      } catch (_) {
        return [];
      }
    }
  }

  Future<List<MenuItemModel>> fetchMenuItems(String restaurantId) async {
    try {
      final response = await SupabaseService.client.rpc(
        'get_menu_items_by_restaurant',
        params: {'p_restaurant_id': restaurantId},
      );

      final List<dynamic> data = response as List<dynamic>;
      if (data.isNotEmpty) {
        return data.map((json) => MenuItemModel.fromJson(json as Map<String, dynamic>)).toList();
      }

      final directResponse = await SupabaseService.client
          .from('menu_items')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .eq('is_available', true);

      return (directResponse as List<dynamic>)
          .map((json) => MenuItemModel.fromJson(json as Map<String, dynamic>))
          .toList();
    } catch (e) {
      debugPrint('[MenuRepository] Fallback fetching menu items: $e');
      try {
        final directResponse = await SupabaseService.client
            .from('menu_items')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .eq('is_available', true);

        return (directResponse as List<dynamic>)
            .map((json) => MenuItemModel.fromJson(json as Map<String, dynamic>))
            .toList();
      } catch (err) {
        debugPrint('[MenuRepository] Direct query failed: $err');
        throw Exception('Failed to load menu items: $err');
      }
    }
  }
}
