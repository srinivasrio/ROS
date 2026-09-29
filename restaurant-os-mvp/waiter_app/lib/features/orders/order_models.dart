import 'dart:convert';

class ComboSubItemModel {
  final String name;
  final int quantity;
  final num? price;
  final String? imageUrl;
  final String? itemType;

  ComboSubItemModel({
    required this.name,
    this.quantity = 1,
    this.price,
    this.imageUrl,
    this.itemType,
  });

  factory ComboSubItemModel.fromDynamic(dynamic data) {
    if (data is String) {
      final parts = data.split('×');
      final name = parts[0].trim();
      final qty = parts.length > 1 ? int.tryParse(parts[1].trim()) ?? 1 : 1;
      return ComboSubItemModel(name: name, quantity: qty);
    }
    if (data is Map) {
      final map = Map<String, dynamic>.from(data);
      final rawName = map['name'] ?? map['title'] ?? map['item_name'] ?? 'Item';
      final rawQty = map['quantity'] is int
          ? map['quantity'] as int
          : (int.tryParse(map['quantity']?.toString() ?? '') ?? 1);
      final rawPrice = map['price'] is num
          ? map['price'] as num
          : (num.tryParse(map['price']?.toString() ?? '') ?? 0);
      return ComboSubItemModel(
        name: rawName.toString(),
        quantity: rawQty,
        price: rawPrice,
        imageUrl: map['image_url']?.toString() ?? map['imageUrl']?.toString(),
        itemType: map['item_type']?.toString(),
      );
    }
    return ComboSubItemModel(name: data.toString());
  }
}

class OrderItemModel {
  final String id;
  final String orderId;
  final String menuItemId;
  final String itemName;
  final int quantity;
  final num priceAtTime;
  final String status;
  final String? notes;
  final String? imageUrl;
  final String itemType;
  final List<ComboSubItemModel> comboItems;

  OrderItemModel({
    required this.id,
    required this.orderId,
    required this.menuItemId,
    required this.itemName,
    required this.quantity,
    required this.priceAtTime,
    required this.status,
    this.notes,
    this.imageUrl,
    this.itemType = 'standard',
    this.comboItems = const [],
  });

  factory OrderItemModel.fromJson(Map<String, dynamic> json) {
    final nameVal = json['name']?.toString();
    final isGenericName = nameVal != null && (nameVal.startsWith('Item #') || nameVal == 'Unknown Item');
    final rawName = json['combo_name'] ?? json['item_name'] ?? (!isGenericName ? json['name'] : null) ?? (json['menu_items'] is Map ? json['menu_items']['name'] : null) ?? json['name'];
    final rawImage = json['image_url'] ?? json['combo_image'] ?? (json['menu_items'] is Map ? json['menu_items']['image_url'] : null);

    // Parse combo or special sub-items
    List<ComboSubItemModel> parsedComboItems = [];
    dynamic rawComboItems = json['combo_items'] ?? json['comboItems'] ?? json['specialItemsData'] ?? json['sub_items'] ?? json['items'];
    if (rawComboItems is String && rawComboItems.isNotEmpty) {
      try {
        rawComboItems = jsonDecode(rawComboItems);
      } catch (_) {}
    }
    if (rawComboItems is List) {
      parsedComboItems = rawComboItems.map((e) => ComboSubItemModel.fromDynamic(e)).toList();
    }

    final itemType = (json['item_type'] ?? (parsedComboItems.isNotEmpty ? 'combo' : 'standard')).toString();

    return OrderItemModel(
      id: json['id'].toString(),
      orderId: json['order_id']?.toString() ?? '',
      menuItemId: json['menu_item_id']?.toString() ?? '',
      itemName: (rawName != null && rawName.toString().isNotEmpty) ? rawName.toString() : 'Item #${json['menu_item_id'] ?? json['id']}',
      quantity: json['quantity'] is int ? json['quantity'] : 1,
      priceAtTime: json['price_at_time'] != null 
          ? (json['price_at_time'] as num) 
          : (json['price'] != null ? (json['price'] as num) : 0),
      status: json['status'] ?? 'placed',
      notes: json['notes'],
      imageUrl: rawImage?.toString(),
      itemType: itemType,
      comboItems: parsedComboItems,
    );
  }

  num get price => priceAtTime;
  bool get isPlaced => status.toLowerCase() == 'placed' || status.toLowerCase() == 'queued';
  bool get isReady => status.toLowerCase() == 'ready';
  bool get isCooking => status.toLowerCase() == 'preparing' || status.toLowerCase() == 'cooking';
  bool get isPreparing => status.toLowerCase() == 'preparing' || status.toLowerCase() == 'cooking' || status.toLowerCase() == 'placed';
  bool get isServed => status.toLowerCase() == 'served';
  bool get isCombo => itemType.toLowerCase() == 'combo' || comboItems.isNotEmpty;
  bool get isSpecial => itemType.toLowerCase() == 'special';
  bool get hasComboItems => comboItems.isNotEmpty;
}

class OrderModel {
  final String id;
  final String tableId;
  final String? tableNumber;
  final String status;
  final num totalAmount;
  final String? waiterId;
  final String? waiterName;
  final bool isCompleted;
  final DateTime? createdAt;
  final List<OrderItemModel> items;
  final int? orderNumber;
  final String? couponCode;
  final num discountAmount;
  final String? paymentMethod;
  final num? gstAmount;
  final num? serviceCharge;
  final num? amountPaid;

  OrderModel({
    required this.id,
    required this.tableId,
    this.tableNumber,
    required this.status,
    required this.totalAmount,
    this.waiterId,
    this.waiterName,
    this.isCompleted = false,
    this.createdAt,
    this.items = const [],
    this.orderNumber,
    this.couponCode,
    this.discountAmount = 0,
    this.paymentMethod,
    this.gstAmount,
    this.serviceCharge,
    this.amountPaid,
  });

  factory OrderModel.fromJson(Map<String, dynamic> json, [List<OrderItemModel> items = const []]) {
    return OrderModel(
      id: json['id'].toString(),
      tableId: json['table_id']?.toString() ?? '',
      tableNumber: json['tables']?['table_number']?.toString() ?? json['table_number']?.toString(),
      status: json['status'] ?? 'placed',
      totalAmount: json['total_amount'] != null ? (json['total_amount'] as num) : 0,
      waiterId: json['waiter_id']?.toString(),
      waiterName: json['waiter_name'],
      isCompleted: json['is_completed'] == true,
      createdAt: json['created_at'] != null ? DateTime.tryParse(json['created_at']) : null,
      orderNumber: json['order_number'] is int ? json['order_number'] : int.tryParse(json['order_number']?.toString() ?? ''),
      couponCode: json['coupon_code']?.toString(),
      discountAmount: json['discount_amount'] != null ? (json['discount_amount'] as num) : 0,
      paymentMethod: json['payment_method']?.toString(),
      gstAmount: json['gst_amount'] != null ? (json['gst_amount'] as num) : null,
      serviceCharge: json['service_charge'] != null ? (json['service_charge'] as num) : null,
      amountPaid: json['amount_paid'] != null ? (json['amount_paid'] as num) : null,
      items: items,
    );
  }

  bool get isReady => status.toLowerCase() == 'ready' || items.any((i) => i.isReady);
  bool get isPreparing => status.toLowerCase() == 'preparing' || status.toLowerCase() == 'placed';
  bool get isServed => status.toLowerCase() == 'served';
  bool get isPaid => status.toLowerCase() == 'paid';

  num get itemsSubtotal {
    if (items.isNotEmpty) {
      return items.fold<num>(0, (sum, i) => sum + (i.price * i.quantity));
    }
    return totalAmount > 0 ? totalAmount : 0;
  }

  num calculatePayableAmount({num taxRate = 5.0}) {
    final sub = itemsSubtotal;
    final afterDiscount = (sub - discountAmount) > 0 ? (sub - discountAmount) : 0;
    final tax = (afterDiscount * (taxRate / 100));
    return afterDiscount + tax;
  }
}
