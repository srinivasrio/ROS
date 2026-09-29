import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/realtime/supabase_service.dart';
import '../auth/auth_controller.dart';

class RestaurantProfileModel {
  final String restaurantId;
  final String name;
  final String? phone;
  final String? email;
  final String? gstNumber;
  final num taxPercentage;
  final String? paymentQrUrl;
  final String? upiId;
  final String? logoUrl;

  RestaurantProfileModel({
    required this.restaurantId,
    required this.name,
    this.phone,
    this.email,
    this.gstNumber,
    this.taxPercentage = 5.0,
    this.paymentQrUrl,
    this.upiId,
    this.logoUrl,
  });

  factory RestaurantProfileModel.fromJson(Map<String, dynamic> json) {
    final info = json['restaurant_info'] is Map<String, dynamic>
        ? json['restaurant_info'] as Map<String, dynamic>
        : <String, dynamic>{};

    return RestaurantProfileModel(
      restaurantId: json['restaurant_id']?.toString() ?? '',
      name: json['name']?.toString() ?? info['name']?.toString() ?? 'Restaurant',
      phone: json['phone']?.toString() ?? info['phone']?.toString(),
      email: json['email']?.toString() ?? info['email']?.toString(),
      gstNumber: json['gst_number']?.toString(),
      taxPercentage: (info['tax_percentage'] != null)
          ? (info['tax_percentage'] as num)
          : ((json['tax_percentage'] != null) ? (json['tax_percentage'] as num) : 5.0),
      paymentQrUrl: (info['payment_qr_url'] != null && info['payment_qr_url'].toString().isNotEmpty)
          ? info['payment_qr_url'].toString()
          : (json['payment_qr_url']?.toString()),
      upiId: (info['upi_id'] != null && info['upi_id'].toString().isNotEmpty)
          ? info['upi_id'].toString()
          : (json['upi_id']?.toString()),
      logoUrl: (info['logo_url'] != null && info['logo_url'].toString().isNotEmpty)
          ? info['logo_url'].toString()
          : null,
    );
  }
}

final restaurantProfileProvider = FutureProvider<RestaurantProfileModel?>((ref) async {
  final session = ref.watch(authControllerProvider).session;
  final restaurantId = session?.restaurantId ?? '202603180001';

  try {
    final res = await SupabaseService.client
        .from('restaurant_profile')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

    if (res != null) {
      return RestaurantProfileModel.fromJson(res as Map<String, dynamic>);
    }
  } catch (e) {
    debugPrint('[restaurantProfileProvider] Error fetching profile: $e');
  }
  return null;
});
