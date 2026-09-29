import '../menu/menu_models.dart';

class CartItem {
  final MenuItemModel item;
  int quantity;
  String? specialInstructions;
  List<String> selectedAddons;

  CartItem({
    required this.item,
    this.quantity = 1,
    this.specialInstructions,
    this.selectedAddons = const [],
  });

  num get subtotal => item.effectivePrice * quantity;

  Map<String, dynamic> toJson() {
    return {
      'menu_item_id': item.id,
      'name': item.name,
      'price': item.effectivePrice,
      'quantity': quantity,
      'notes': specialInstructions ?? '',
      'addons': selectedAddons,
    };
  }
}

class CartState {
  final String tableId;
  final String tableNumber;
  final Map<String, CartItem> items; // Key is itemId
  final bool isSubmitting;
  final String? errorMessage;

  const CartState({
    required this.tableId,
    required this.tableNumber,
    this.items = const {},
    this.isSubmitting = false,
    this.errorMessage,
  });

  int get totalItemCount => items.values.fold(0, (sum, i) => sum + i.quantity);

  int getItemQuantity(String itemId) => items[itemId]?.quantity ?? 0;

  num get subtotal => items.values.fold(0, (sum, i) => sum + i.subtotal);

  // 5% GST standard calculation (2.5% CGST + 2.5% SGST)
  num get taxAmount => (subtotal * 0.05);

  num get grandTotal => subtotal + taxAmount;

  CartState copyWith({
    String? tableId,
    String? tableNumber,
    Map<String, CartItem>? items,
    bool? isSubmitting,
    String? errorMessage,
  }) {
    return CartState(
      tableId: tableId ?? this.tableId,
      tableNumber: tableNumber ?? this.tableNumber,
      items: items ?? this.items,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      errorMessage: errorMessage,
    );
  }
}
