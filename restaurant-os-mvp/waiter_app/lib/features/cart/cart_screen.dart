import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/utils/feedback_utils.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/app_button.dart';
import '../../core/widgets/quantity_stepper.dart';
import '../auth/auth_controller.dart';
import '../tables/table_models.dart';
import '../tables/tables_controller.dart';
import 'cart_controller.dart';

class CartScreen extends ConsumerWidget {
  final TableModel table;

  const CartScreen({
    super.key,
    required this.table,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cartState = ref.watch(cartProviderFamily(table.id));
    final cartNotifier = ref.read(cartProviderFamily(table.id).notifier);
    final authState = ref.watch(authControllerProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Text(
              'Review Order',
              style: AppTypography.headingMedium.copyWith(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
            Text(
              table.formattedName,
              style: AppTypography.bodySmall.copyWith(
                color: AppColors.primary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
        actions: [
          if (cartState.items.isNotEmpty)
            TextButton(
              onPressed: () {
                cartNotifier.clearCart();
                Navigator.of(context).pop();
              },
              child: Text(
                'Clear',
                style: AppTypography.labelMedium.copyWith(color: AppColors.error),
              ),
            ),
        ],
      ),
      body: SafeArea(
        child: cartState.items.isEmpty
            ? Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(LucideIcons.shoppingBag, size: 48, color: AppColors.textMuted),
                    const SizedBox(height: 12),
                    Text('No items in cart', style: AppTypography.headingSmall),
                    const SizedBox(height: 6),
                    Text('Add items from the menu to build an order', style: AppTypography.bodySmall),
                  ],
                ),
              )
            : Column(
                children: [
                  Expanded(
                    child: ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        // Items Container
                        Container(
                          decoration: BoxDecoration(
                            color: AppColors.surfaceContainer,
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: AppColors.border, width: 1),
                          ),
                          child: ListView.separated(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            itemCount: cartState.items.length,
                            separatorBuilder: (_, __) => const Divider(color: AppColors.border),
                            itemBuilder: (context, index) {
                              final item = cartState.items.values.elementAt(index);

                              return Padding(
                                padding: const EdgeInsets.all(16),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            item.item.name,
                                            style: AppTypography.headingSmall.copyWith(
                                              color: AppColors.textPrimary,
                                              fontSize: 15,
                                            ),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            Formatters.formatCurrency(item.item.effectivePrice),
                                            style: AppTypography.bodySmall.copyWith(
                                              color: AppColors.primary,
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                          if (item.specialInstructions != null &&
                                              item.specialInstructions!.isNotEmpty) ...[
                                            const SizedBox(height: 4),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: AppColors.surfaceContainerHighest,
                                                borderRadius: BorderRadius.circular(6),
                                                border: Border.all(color: AppColors.borderVariant, width: 1),
                                              ),
                                              child: Text(
                                                'Note: ${item.specialInstructions}',
                                                style: AppTypography.bodySmall.copyWith(
                                                  color: AppColors.textSecondary,
                                                  fontSize: 11,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),
                                    ),
                                    QuantityStepper(
                                      quantity: item.quantity,
                                      onIncrement: () => cartNotifier.incrementQuantity(item.item.id),
                                      onDecrement: () => cartNotifier.decrementQuantity(item.item.id),
                                      compact: true,
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                        ),

                        const SizedBox(height: 16),

                        // Add More Items Action
                        OutlinedButton.icon(
                          onPressed: () => Navigator.of(context).pop(),
                          icon: const Icon(LucideIcons.plus, size: 18, color: AppColors.primary),
                          label: Text(
                            'Add More Dishes',
                            style: AppTypography.labelLarge.copyWith(color: AppColors.primary),
                          ),
                          style: OutlinedButton.styleFrom(
                            backgroundColor: AppColors.surfaceContainer,
                            side: const BorderSide(color: AppColors.borderVariant, width: 1.5),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                        ),

                        const SizedBox(height: 20),

                        // Bill Summary Box
                        Container(
                          padding: const EdgeInsets.all(18),
                          decoration: BoxDecoration(
                            color: AppColors.surfaceContainer,
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: AppColors.border, width: 1),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'BILL ESTIMATION',
                                style: AppTypography.labelSmall.copyWith(
                                  letterSpacing: 1.1,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                              const SizedBox(height: 12),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text('Subtotal', style: AppTypography.bodyMedium),
                                  Text(
                                    Formatters.formatCurrency(cartState.subtotal),
                                    style: AppTypography.bodyLarge.copyWith(fontWeight: FontWeight.w600),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text('GST (5%)', style: AppTypography.bodyMedium),
                                  Text(
                                    Formatters.formatCurrency(cartState.taxAmount),
                                    style: AppTypography.bodyLarge.copyWith(fontWeight: FontWeight.w600),
                                  ),
                                ],
                              ),
                              const Padding(
                                padding: EdgeInsets.symmetric(vertical: 10),
                                child: Divider(color: AppColors.border),
                              ),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    'Grand Total',
                                    style: AppTypography.headingSmall.copyWith(fontWeight: FontWeight.w800),
                                  ),
                                  Text(
                                    Formatters.formatCurrency(cartState.grandTotal),
                                    style: AppTypography.headingLarge.copyWith(
                                      color: AppColors.primary,
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Bottom Action: Send to Kitchen
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: const BoxDecoration(
                      color: AppColors.surfaceContainerHigh,
                      border: Border(top: BorderSide(color: AppColors.border, width: 1)),
                    ),
                    child: Builder(
                      builder: (context) {
                        final currentUser = authState.session;
                        final currentUserId = currentUser?.userId ?? currentUser?.employeeId;
                        final role = currentUser?.role?.toLowerCase() ?? '';
                        final isAdmin = role == 'admin' || role == 'supervisor' || role == 'restaurant_admin';
                        final canManageTable = table.isWaiterAuthorized(currentUserId, isAdmin: isAdmin);

                        return AppButton(
                          label: canManageTable ? 'Order Now (Send to Kitchen)' : 'Table Locked (Other Waiter)',
                          icon: canManageTable ? LucideIcons.send : LucideIcons.lock,
                          variant: canManageTable ? ButtonVariant.primary : ButtonVariant.secondary,
                          isLoading: cartState.isSubmitting,
                          onPressed: canManageTable
                              ? () async {
                                  final waiterId = authState.session?.userId ?? 'unknown';
                                  final success = await cartNotifier.submitOrder(waiterId);

                                  if (context.mounted) {
                                    if (success) {
                                      FeedbackUtils.successHaptic();
                                      FeedbackUtils.showToast(context, message: 'Order sent to Kitchen successfully!');
                                      ref.read(selectedTableProvider.notifier).state = null;
                                      Navigator.of(context).popUntil((route) => route.isFirst);
                                    } else {
                                      FeedbackUtils.showToast(
                                        context,
                                        message: cartState.errorMessage ?? 'Failed to send order',
                                        isError: true,
                                      );
                                    }
                                  }
                                }
                              : () {
                                  FeedbackUtils.showToast(
                                    context,
                                    message: 'Only assigned waiter (${table.assignedWaiterName ?? "Staff"}) can place orders for ${table.formattedName}',
                                    isError: true,
                                  );
                                },
                        );
                      },
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}
