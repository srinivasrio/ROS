class MenuCategory {
  final String id;
  final String name;
  final String? imageUrl;
  final int displayOrder;

  MenuCategory({
    required this.id,
    required this.name,
    this.imageUrl,
    this.displayOrder = 0,
  });

  factory MenuCategory.fromJson(Map<String, dynamic> json) {
    return MenuCategory(
      id: json['id'].toString(),
      name: json['name'] ?? 'Category',
      imageUrl: json['image_url'],
      displayOrder: json['display_order'] is int ? json['display_order'] : 0,
    );
  }
}

class MenuItemModel {
  final String id;
  final String name;
  final String? description;
  final num price;
  final num? specialPrice;
  final String? imageUrl;
  final String categoryId;
  final String? subcategoryId;
  final String itemType; // 'Veg' | 'Non-Veg'
  final bool isAvailable;
  final bool isSpecial;
  final List<String> defaultAddons;
  final Map<String, dynamic>? priceVariants;

  MenuItemModel({
    required this.id,
    required this.name,
    this.description,
    required this.price,
    this.specialPrice,
    this.imageUrl,
    required this.categoryId,
    this.subcategoryId,
    this.itemType = 'Veg',
    this.isAvailable = true,
    this.isSpecial = false,
    this.defaultAddons = const [],
    this.priceVariants,
  });

  factory MenuItemModel.fromJson(Map<String, dynamic> json) {
    return MenuItemModel(
      id: json['id'].toString(),
      name: json['name'] ?? '',
      description: json['description'],
      price: json['price'] != null ? (json['price'] as num) : 0,
      specialPrice: json['special_price'] != null ? (json['special_price'] as num) : null,
      imageUrl: json['image_url'],
      categoryId: json['category_id']?.toString() ?? '',
      subcategoryId: json['sub_category_id']?.toString(),
      itemType: json['item_type'] ?? ((json['is_veg'] == false) ? 'Non-Veg' : 'Veg'),
      isAvailable: json['is_available'] != false,
      isSpecial: json['is_popular'] == true || json['is_today_special'] == true,
      priceVariants: json['price_variants'] is Map<String, dynamic> ? json['price_variants'] : null,
    );
  }

  bool get isVeg => itemType.toLowerCase() == 'veg';
  num get effectivePrice => specialPrice ?? price;
  bool get hasVariants => (priceVariants != null && priceVariants!.isNotEmpty) || defaultAddons.isNotEmpty;
}
