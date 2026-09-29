import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/feedback_utils.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_button.dart';
import '../../auth/auth_controller.dart';
import '../../orders/order_models.dart';
import '../../orders/orders_controller.dart';
import '../restaurant_profile_model.dart';
import '../table_models.dart';
import '../tables_controller.dart';

enum PaymentMethod { cash, card, qr }

class TableBillSheet extends ConsumerStatefulWidget {
  final TableModel table;
  final OrderModel? order;

  const TableBillSheet({
    super.key,
    required this.table,
    this.order,
  });

  static Future<void> show(
    BuildContext context, {
    required TableModel table,
    OrderModel? order,
  }) {
    FeedbackUtils.selectionHaptic();
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => TableBillSheet(
        table: table,
        order: order,
      ),
    );
  }

  @override
  ConsumerState<TableBillSheet> createState() => _TableBillSheetState();
}

class _TableBillSheetState extends ConsumerState<TableBillSheet> {
  PaymentMethod _selectedMethod = PaymentMethod.cash;
  bool _isSettling = false;
  bool _isClearing = false;
  bool _isPaidSuccess = false;
  String? _settledPaymentMethod;

  @override
  void initState() {
    super.initState();
    // If order is already paid, directly show the paid success / clear table state
    if (widget.order?.isPaid == true) {
      _isPaidSuccess = true;
      _settledPaymentMethod = widget.order?.paymentMethod ?? 'online';
    }
  }

  Future<void> _handleSettlePayment(OrderModel activeOrder, num grandTotal) async {
    final session = ref.read(authControllerProvider).session;
    if (session == null) return;

    final waiterName = session.name;
    final waiterId = session.userId ?? session.employeeId;
    final methodStr = _selectedMethod == PaymentMethod.cash
        ? 'cash'
        : (_selectedMethod == PaymentMethod.card ? 'card' : 'upi');

    setState(() => _isSettling = true);
    FeedbackUtils.selectionHaptic();

    try {
      await ref.read(ordersControllerProvider.notifier).settleOrderBill(
        orderId: activeOrder.id,
        tableId: widget.table.id.toString(),
        paymentMethod: methodStr,
        amountPaid: grandTotal,
        paidBy: '$waiterName ($waiterId)',
      );

      // Refresh tables and orders
      ref.read(tablesControllerProvider.notifier).loadTables(session.restaurantId);
      ref.read(ordersControllerProvider.notifier).loadOrders(silent: true, restaurantId: session.restaurantId);

      FeedbackUtils.successHaptic();
      if (!mounted) return;

      setState(() {
        _isSettling = false;
        _isPaidSuccess = true;
        _settledPaymentMethod = methodStr;
      });

      FeedbackUtils.showToast(
        context,
        message: 'Bill for Table ${widget.table.tableNumber} marked as Paid via ${methodStr.toUpperCase()}!',
      );
    } catch (e) {
      debugPrint('[TableBillSheet] Settlement error: $e');
      if (!mounted) return;
      setState(() => _isSettling = false);
      FeedbackUtils.showToast(
        context,
        message: 'Failed to settle bill: $e',
        isError: true,
      );
    }
  }

  Future<void> _handleClearTable() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(LucideIcons.trash2, color: AppColors.error, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Clear ${widget.table.formattedName}?',
                style: AppTypography.headingSmall.copyWith(
                  fontWeight: FontWeight.w800,
                  fontSize: 18,
                ),
              ),
            ),
          ],
        ),
        content: Text(
          'Are you sure you want to clear this table? All orders will be completed and Table ${widget.table.tableNumber} will immediately move to the Available list.',
          style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
        ),
        actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(
              'Cancel',
              style: AppTypography.labelLarge.copyWith(color: AppColors.textSecondary),
            ),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
              elevation: 0,
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text(
              'Clear & Make Available',
              style: TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    final session = ref.read(authControllerProvider).session;
    if (session == null) return;

    setState(() => _isClearing = true);
    FeedbackUtils.selectionHaptic();

    try {
      await ref.read(tablesControllerProvider.notifier).updateTableStatus(
        widget.table.id,
        session.restaurantId,
        'empty',
      );
      ref.read(tablesControllerProvider.notifier).loadTables(session.restaurantId);
      ref.read(ordersControllerProvider.notifier).loadOrders(silent: true, restaurantId: session.restaurantId);

      FeedbackUtils.successHaptic();
      if (!mounted) return;

      FeedbackUtils.showToast(
        context,
        message: 'Table ${widget.table.tableNumber} is now Available!',
      );

      // Pop the bill sheet and return to tables screen
      Navigator.of(context).pop();
    } catch (e) {
      debugPrint('[TableBillSheet] Clear table error: $e');
      if (!mounted) return;
      setState(() => _isClearing = false);
      FeedbackUtils.showToast(
        context,
        message: 'Failed to clear table: $e',
        isError: true,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final allOrders = ref.watch(activeOrdersProvider);
    final activeOrder = widget.order ?? allOrders.where((o) {
      final matchId = o.tableId == widget.table.id.toString();
      final matchNumber = o.tableNumber != null &&
          (o.tableNumber == widget.table.tableNumber ||
              o.tableNumber == widget.table.formattedName.replaceAll('Table ', ''));
      final matchGroup = widget.table.mergedGroupId != null &&
          (o.tableId == widget.table.mergedGroupId || widget.table.mergedGroupId == o.tableId);
      return matchId || matchNumber || matchGroup;
    }).firstOrNull;

    final profileAsync = ref.watch(restaurantProfileProvider);
    final profile = profileAsync.valueOrNull;
    final taxRate = profile?.taxPercentage ?? 5.0;

    final subtotal = activeOrder?.itemsSubtotal ?? (widget.table.activeOrderTotal ?? 0);
    final discountAmount = activeOrder?.discountAmount ?? 0;
    final couponCode = activeOrder?.couponCode;

    final afterDiscount = (subtotal - discountAmount) > 0 ? (subtotal - discountAmount) : 0;
    final gstAmount = afterDiscount * (taxRate / 100);
    final grandTotal = afterDiscount + gstAmount;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.92,
      ),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        border: Border(top: BorderSide(color: AppColors.border, width: 1.5)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Handle Bar
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 12, bottom: 8),
                width: 44,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.borderVariant,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),

            // Sheet Header
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: AppColors.tableNeedBill.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppColors.tableNeedBill.withValues(alpha: 0.4), width: 1.5),
                    ),
                    child: Center(
                      child: Text(
                        widget.table.tableNumber,
                        style: AppTypography.headingLarge.copyWith(
                          color: AppColors.tableNeedBill,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Flexible(
                              child: Text(
                                'Bill • ${widget.table.formattedName}',
                                style: AppTypography.headingMedium.copyWith(
                                  color: AppColors.textPrimary,
                                  fontWeight: FontWeight.w800,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            if (widget.table.areaName != null) ...[
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: AppColors.surfaceContainerHigh,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  widget.table.areaName!,
                                  style: AppTypography.labelSmall.copyWith(
                                    color: AppColors.textSecondary,
                                    fontSize: 10,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          activeOrder?.orderNumber != null
                              ? 'Order #${activeOrder!.orderNumber} • ${activeOrder.items.length} items'
                              : 'Dine-In Summary',
                          style: AppTypography.bodySmall.copyWith(
                            color: AppColors.textSecondary,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Paid / Need Bill Status Pill
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: _isPaidSuccess
                          ? const Color(0xFF10B981).withValues(alpha: 0.15)
                          : AppColors.tableNeedBill.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: _isPaidSuccess
                            ? const Color(0xFF10B981).withValues(alpha: 0.5)
                            : AppColors.tableNeedBill.withValues(alpha: 0.5),
                        width: 1,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          _isPaidSuccess ? LucideIcons.checkCircle2 : LucideIcons.receipt,
                          size: 13,
                          color: _isPaidSuccess ? const Color(0xFF10B981) : AppColors.tableNeedBill,
                        ),
                        const SizedBox(width: 5),
                        Text(
                          _isPaidSuccess ? 'PAID' : 'NEED BILL',
                          style: TextStyle(
                            color: _isPaidSuccess ? const Color(0xFF047857) : AppColors.tableNeedBill,
                            fontWeight: FontWeight.w900,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const Divider(color: AppColors.border, height: 1),

            // Main Content Body
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
                child: _isPaidSuccess
                    ? _buildPaidSuccessView(grandTotal, activeOrder)
                    : _buildBillCalculationView(
                        activeOrder: activeOrder,
                        subtotal: subtotal,
                        discountAmount: discountAmount,
                        couponCode: couponCode,
                        taxRate: taxRate,
                        gstAmount: gstAmount,
                        grandTotal: grandTotal,
                        profile: profile,
                      ),
              ),
            ),

            // Sticky Bottom Section
            if (!_isPaidSuccess)
              _buildStickyPaymentBottom(activeOrder, grandTotal)
            else
              _buildStickyClearTableBottom(),
          ],
        ),
      ),
    );
  }

  // --- Bill Breakdown View ---
  Widget _buildBillCalculationView({
    required OrderModel? activeOrder,
    required num subtotal,
    required num discountAmount,
    required String? couponCode,
    required num taxRate,
    required num gstAmount,
    required num grandTotal,
    required RestaurantProfileModel? profile,
  }) {
    final items = activeOrder?.items ?? [];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section: Order Items List
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'ORDERED ITEMS',
              style: AppTypography.labelSmall.copyWith(
                color: AppColors.textSecondary,
                letterSpacing: 1.1,
                fontWeight: FontWeight.w800,
              ),
            ),
            Text(
              '${items.length} ${items.length == 1 ? 'Item' : 'Items'}',
              style: AppTypography.labelSmall.copyWith(
                color: AppColors.textMuted,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),

        if (items.isNotEmpty)
          Container(
            decoration: BoxDecoration(
              color: AppColors.surfaceContainer,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border, width: 1),
            ),
            child: ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: items.length,
              separatorBuilder: (_, __) => const Divider(color: AppColors.border, height: 1),
              itemBuilder: (context, index) {
                final item = items[index];
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                  child: Row(
                    children: [
                      // Quantity indicator
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                        decoration: BoxDecoration(
                          color: AppColors.primaryContainer,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: AppColors.primary.withValues(alpha: 0.3), width: 0.8),
                        ),
                        child: Text(
                          '${item.quantity}x',
                          style: TextStyle(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w900,
                            fontSize: 11.5,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),

                      // Item name & unit price
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item.itemName,
                              style: AppTypography.bodyMedium.copyWith(
                                color: AppColors.textPrimary,
                                fontWeight: FontWeight.w700,
                                fontSize: 13.5,
                              ),
                            ),
                            if (item.comboItems.isNotEmpty) ...[
                              const SizedBox(height: 2),
                              Text(
                                item.comboItems.map((c) => '${c.quantity * item.quantity}x ${c.name}').join(', '),
                                style: AppTypography.bodySmall.copyWith(
                                  color: const Color(0xFFEA580C),
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                            Text(
                              '${Formatters.formatCurrency(item.price)} each',
                              style: AppTypography.bodySmall.copyWith(
                                color: AppColors.textMuted,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ),

                      // Total item price
                      Text(
                        Formatters.formatCurrency(item.price * item.quantity),
                        style: AppTypography.labelLarge.copyWith(
                          color: AppColors.textPrimary,
                          fontWeight: FontWeight.w800,
                          fontSize: 13.5,
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          )
        else
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surfaceContainer,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Center(
              child: Text(
                'No item records available',
                style: AppTypography.bodySmall.copyWith(color: AppColors.textMuted),
              ),
            ),
          ),

        const SizedBox(height: 20),

        // Section: Bill Summary Card (Subtotal, Discount, Tax, Total)
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surfaceContainerHigh,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.border, width: 1),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'BILL BREAKDOWN',
                style: AppTypography.labelSmall.copyWith(
                  color: AppColors.textSecondary,
                  letterSpacing: 1.1,
                  fontWeight: FontWeight.w800,
                  fontSize: 10,
                ),
              ),
              const SizedBox(height: 12),

              // Subtotal
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Item Subtotal',
                    style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
                  ),
                  Text(
                    Formatters.formatCurrency(subtotal),
                    style: AppTypography.bodyMedium.copyWith(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),

              // Coupon / Discount row
              if (discountAmount > 0) ...[
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(LucideIcons.tag, size: 14, color: Color(0xFF10B981)),
                        const SizedBox(width: 6),
                        Text(
                          couponCode != null && couponCode.isNotEmpty
                              ? 'Coupon Discount ($couponCode)'
                              : 'Coupon / Offer Discount',
                          style: AppTypography.bodyMedium.copyWith(
                            color: const Color(0xFF047857),
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                    Text(
                      '- ${Formatters.formatCurrency(discountAmount)}',
                      style: AppTypography.bodyMedium.copyWith(
                        color: const Color(0xFF10B981),
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ],

              // GST / Tax Row
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'GST (${taxRate.toStringAsFixed(taxRate % 1 == 0 ? 0 : 1)}%)',
                    style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
                  ),
                  Text(
                    '+ ${Formatters.formatCurrency(gstAmount)}',
                    style: AppTypography.bodyMedium.copyWith(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),

              // Sub-tax details
              Padding(
                padding: const EdgeInsets.only(top: 2, left: 4),
                child: Text(
                  'CGST ${(taxRate / 2).toStringAsFixed(1)}% (${Formatters.formatCurrency(gstAmount / 2)}) + SGST ${(taxRate / 2).toStringAsFixed(1)}% (${Formatters.formatCurrency(gstAmount / 2)})',
                  style: const TextStyle(fontSize: 10, color: AppColors.textMuted),
                ),
              ),

              const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: Divider(color: AppColors.borderVariant, height: 1),
              ),

              // Grand Total Payable
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'TOTAL PAYABLE',
                        style: AppTypography.labelSmall.copyWith(
                          color: AppColors.textSecondary,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 1.1,
                          fontSize: 10,
                        ),
                      ),
                      const Text(
                        'Inclusive of all taxes',
                        style: TextStyle(fontSize: 10, color: AppColors.textMuted),
                      ),
                    ],
                  ),
                  Text(
                    Formatters.formatCurrency(grandTotal),
                    style: AppTypography.headingLarge.copyWith(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w900,
                      fontSize: 22,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(height: 20),

        // Section: Payment QR Preview (if QR is selected)
        if (_selectedMethod == PaymentMethod.qr)
          _buildQrCodeCard(grandTotal, profile),
      ],
    );
  }

  // --- QR Code Display Card ---
  Widget _buildQrCodeCard(num grandTotal, RestaurantProfileModel? profile) {
    final paymentQrUrl = profile?.paymentQrUrl;
    final upiId = profile?.upiId ?? 'minerva@upi';
    final restaurantName = profile?.name ?? 'Restaurant';

    // Build standard UPI dynamic payload URL
    final cleanAmount = grandTotal.toStringAsFixed(2);
    final upiPayload = 'upi://pay?pa=$upiId&pn=${Uri.encodeComponent(restaurantName)}&am=$cleanAmount&cu=INR&tn=Table_${widget.table.tableNumber}';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFCBD5E1), width: 1.5),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(LucideIcons.qrCode, size: 18, color: Color(0xFF4F46E5)),
              const SizedBox(width: 8),
              Text(
                'CUSTOMER PAYMENT QR',
                style: AppTypography.labelSmall.copyWith(
                  color: const Color(0xFF334155),
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1.1,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Scan with any UPI app (GPay, PhonePe, Paytm, BHIM)',
            style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary, fontSize: 11),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 14),

          // Display either uploaded QR image or dynamic QR code
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0), width: 1.5),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.06),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: (paymentQrUrl != null && paymentQrUrl.isNotEmpty)
                ? ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: CachedNetworkImage(
                      imageUrl: paymentQrUrl,
                      width: 190,
                      height: 190,
                      fit: BoxFit.contain,
                      placeholder: (_, __) => const SizedBox(
                        width: 190,
                        height: 190,
                        child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
                      ),
                      errorWidget: (_, __, ___) => QrImageView(
                        data: upiPayload,
                        version: QrVersions.auto,
                        size: 190.0,
                        backgroundColor: Colors.white,
                      ),
                    ),
                  )
                : QrImageView(
                    data: upiPayload,
                    version: QrVersions.auto,
                    size: 190.0,
                    backgroundColor: Colors.white,
                  ),
          ),

          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFFEEF2FF),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFC7D2FE), width: 1),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(LucideIcons.wallet, size: 14, color: Color(0xFF4F46E5)),
                const SizedBox(width: 6),
                Text(
                  'UPI ID: $upiId',
                  style: const TextStyle(
                    color: Color(0xFF312E81),
                    fontWeight: FontWeight.w800,
                    fontSize: 11.5,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Amount: ${Formatters.formatCurrency(grandTotal)}',
            style: const TextStyle(
              color: Color(0xFF0F172A),
              fontWeight: FontWeight.w900,
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }

  // --- Paid Success Receipt View ---
  Widget _buildPaidSuccessView(num grandTotal, OrderModel? activeOrder) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
      child: Column(
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: const Color(0xFFECFDF5),
              shape: BoxShape.circle,
              border: Border.all(color: const Color(0xFF10B981), width: 2),
            ),
            child: const Center(
              child: Icon(LucideIcons.checkCheck, color: Color(0xFF10B981), size: 38),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Payment Settled!',
            style: AppTypography.headingLarge.copyWith(
              color: const Color(0xFF065F46),
              fontWeight: FontWeight.w900,
              fontSize: 22,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Received ${Formatters.formatCurrency(grandTotal)} via ${_settledPaymentMethod?.toUpperCase() ?? 'PAYMENT'}',
            style: AppTypography.bodyMedium.copyWith(
              color: AppColors.textSecondary,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 24),

          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surfaceContainer,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border, width: 1),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Table Number', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
                    Text(widget.table.formattedName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Payment Mode', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
                    Text(_settledPaymentMethod?.toUpperCase() ?? 'PAID', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF059669))),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Amount Settled', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
                    Text(Formatters.formatCurrency(grandTotal), style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15, color: AppColors.primary)),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),
          Text(
            'Tap "Clear Table" below to complete orders and mark this table Available for the next guests.',
            textAlign: TextAlign.center,
            style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary, height: 1.3),
          ),
        ],
      ),
    );
  }

  // --- Sticky Bottom: Payment Selector & Mark as Paid ---
  Widget _buildStickyPaymentBottom(OrderModel? activeOrder, num grandTotal) {
    if (activeOrder == null) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: const BoxDecoration(
          color: AppColors.surfaceContainerHigh,
          border: Border(top: BorderSide(color: AppColors.border, width: 1)),
        ),
        child: AppButton(
          label: 'Close Bill',
          variant: ButtonVariant.secondary,
          onPressed: () => Navigator.of(context).pop(),
        ),
      );
    }

    String payButtonLabel;
    IconData payButtonIcon;

    switch (_selectedMethod) {
      case PaymentMethod.cash:
        payButtonLabel = 'Mark as Paid (Cash)';
        payButtonIcon = LucideIcons.banknote;
        break;
      case PaymentMethod.card:
        payButtonLabel = 'Mark as Paid (Card / POS)';
        payButtonIcon = LucideIcons.creditCard;
        break;
      case PaymentMethod.qr:
        payButtonLabel = 'Mark as Paid (QR / UPI)';
        payButtonIcon = LucideIcons.qrCode;
        break;
    }

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      decoration: const BoxDecoration(
        color: AppColors.surfaceContainerHighest,
        border: Border(top: BorderSide(color: AppColors.border, width: 1)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // 3-Option Segmented Payment Mode Selector
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: AppColors.surfaceContainer,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.borderVariant, width: 1),
            ),
            child: Row(
              children: [
                Expanded(
                  child: _buildPaymentTab(
                    method: PaymentMethod.cash,
                    icon: LucideIcons.banknote,
                    label: 'Cash',
                  ),
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: _buildPaymentTab(
                    method: PaymentMethod.card,
                    icon: LucideIcons.creditCard,
                    label: 'Card',
                  ),
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: _buildPaymentTab(
                    method: PaymentMethod.qr,
                    icon: LucideIcons.qrCode,
                    label: 'QR Code',
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Primary Mark as Paid Button
          AppButton(
            label: payButtonLabel,
            icon: payButtonIcon,
            variant: ButtonVariant.primary,
            isLoading: _isSettling,
            onPressed: _isSettling ? null : () => _handleSettlePayment(activeOrder, grandTotal),
          ),
        ],
      ),
    );
  }

  // --- Sticky Bottom: Clear Table Action ---
  Widget _buildStickyClearTableBottom() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        color: AppColors.surfaceContainerHighest,
        border: Border(top: BorderSide(color: AppColors.border, width: 1)),
      ),
      child: AppButton(
        label: 'Clear Table & Mark Available',
        icon: LucideIcons.sparkles,
        variant: ButtonVariant.primary,
        isLoading: _isClearing,
        onPressed: _isClearing ? null : _handleClearTable,
      ),
    );
  }

  Widget _buildPaymentTab({
    required PaymentMethod method,
    required IconData icon,
    required String label,
  }) {
    final isSelected = _selectedMethod == method;
    return InkWell(
      onTap: () {
        FeedbackUtils.selectionHaptic();
        setState(() => _selectedMethod = method);
      },
      borderRadius: BorderRadius.circular(10),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(vertical: 9),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.25),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 15,
              color: isSelected ? Colors.white : AppColors.textSecondary,
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: isSelected ? Colors.white : AppColors.textSecondary,
                fontWeight: isSelected ? FontWeight.w900 : FontWeight.w700,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
