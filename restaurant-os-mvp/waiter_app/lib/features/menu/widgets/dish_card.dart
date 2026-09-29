import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_network_image.dart';
import '../../../core/widgets/quantity_stepper.dart';
import '../menu_models.dart';

class DishCard extends StatelessWidget {
  final MenuItemModel item;
  final int quantity;
  final VoidCallback onAdd;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;
  final VoidCallback onCustomize;

  const DishCard({
    super.key,
    required this.item,
    required this.quantity,
    required this.onAdd,
    required this.onIncrement,
    required this.onDecrement,
    required this.onCustomize,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceContainer,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border, width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.2),
            blurRadius: 6,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Veg / Non-Veg badge indicator
          Container(
            margin: const EdgeInsets.only(top: 3),
            padding: const EdgeInsets.all(2),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(4),
              border: Border.all(
                color: item.isVeg ? AppColors.veg : AppColors.nonVeg,
                width: 1.5,
              ),
            ),
            child: Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: item.isVeg ? AppColors.veg : AppColors.nonVeg,
              ),
            ),
          ),
          const SizedBox(width: 12),

          // Details Column
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.name,
                  style: AppTypography.headingSmall.copyWith(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  Formatters.formatCurrency(item.price),
                  style: AppTypography.labelLarge.copyWith(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                if (item.description != null && item.description!.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    item.description!,
                    style: AppTypography.bodySmall.copyWith(
                      color: AppColors.textSecondary,
                      height: 1.3,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                if (item.hasVariants) ...[
                  const SizedBox(height: 6),
                  GestureDetector(
                    onTap: onCustomize,
                    child: Text(
                      'Customizable options available',
                      style: AppTypography.labelSmall.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 12),

          // Right action: Image & Quantity Stepper
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              AppNetworkImage(
                imageUrl: item.imageUrl,
                name: item.name,
                width: 72,
                height: 72,
                borderRadius: BorderRadius.circular(12),
                fallbackIcon: item.isVeg ? Icons.eco_rounded : Icons.restaurant_rounded,
              ),
              const SizedBox(height: 8),

              QuantityStepper(
                quantity: quantity,
                onAdd: onAdd,
                onIncrement: onIncrement,
                onDecrement: onDecrement,
              ),
            ],
          ),
        ],
      ),
    );
  }
}
