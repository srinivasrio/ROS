import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/feedback_utils.dart';
import '../../../core/widgets/app_button.dart';
import '../../auth/auth_controller.dart';
import '../table_models.dart';
import '../tables_controller.dart';

class GiveTableAccessSheet extends ConsumerStatefulWidget {
  final TableModel table;

  const GiveTableAccessSheet({
    super.key,
    required this.table,
  });

  static Future<void> show(BuildContext context, {required TableModel table}) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => GiveTableAccessSheet(table: table),
    );
  }

  @override
  ConsumerState<GiveTableAccessSheet> createState() => _GiveTableAccessSheetState();
}

class _GiveTableAccessSheetState extends ConsumerState<GiveTableAccessSheet> {
  bool _isLoading = true;
  bool _isSubmitting = false;
  String? _submittingType; // 'share' | 'transfer'
  List<WaiterModel> _waiters = [];
  WaiterModel? _selectedWaiter;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadWaiters();
  }

  Future<void> _loadWaiters() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final currentUser = ref.read(authControllerProvider).session;
      final currentUserId = currentUser?.userId ?? currentUser?.employeeId;

      final waiters = await ref.read(tablesControllerProvider.notifier).fetchAvailableWaiters(
        excludeEmployeeId: currentUserId,
      );

      if (mounted) {
        setState(() {
          _waiters = waiters;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'Failed to load available waiters';
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _handleGrantAccess(String grantType) async {
    if (_selectedWaiter == null) {
      FeedbackUtils.showToast(context, message: 'Please select a waiter first', isError: true);
      return;
    }

    final session = ref.read(authControllerProvider).session;
    if (session == null) return;

    final numTableId = int.tryParse(widget.table.id);
    if (numTableId == null) {
      FeedbackUtils.showToast(context, message: 'Invalid table ID', isError: true);
      return;
    }

    setState(() {
      _isSubmitting = true;
      _submittingType = grantType;
    });
    FeedbackUtils.selectionHaptic();

    try {
      final ownerId = session.userId.isNotEmpty ? session.userId : (session.employeeId ?? '');
      final result = await ref.read(tablesControllerProvider.notifier).grantTableAccess(
        tableId: numTableId,
        ownerId: ownerId,
        targetWaiterId: _selectedWaiter!.id,
        grantType: grantType,
      );

      FeedbackUtils.successHaptic();
      if (mounted) {
        final msg = result['message']?.toString() ??
            (grantType == 'transfer'
                ? 'Table ${widget.table.tableNumber} transferred to ${_selectedWaiter!.name}'
                : 'Access granted to ${_selectedWaiter!.name} on Table ${widget.table.tableNumber}');
        FeedbackUtils.showToast(context, message: msg);
        Navigator.of(context).pop(); // Close give access sheet
      }
    } catch (e) {
      debugPrint('[GiveTableAccessSheet] Error: $e');
      if (mounted) {
        FeedbackUtils.showToast(context, message: 'Failed to update access: $e', isError: true);
      }
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _submittingType = null;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.88,
      ),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(top: BorderSide(color: AppColors.border, width: 1.5)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Handle bar
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 12, bottom: 8),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.borderVariant,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),

            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: const Color(0xFF4F46E5).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: const Color(0xFF4F46E5).withValues(alpha: 0.25),
                        width: 1.2,
                      ),
                    ),
                    child: const Center(
                      child: Icon(LucideIcons.userPlus, color: Color(0xFF4F46E5), size: 22),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Give Access • Table ${widget.table.tableNumber}',
                          style: AppTypography.headingMedium.copyWith(
                            fontWeight: FontWeight.w900,
                            fontSize: 18,
                          ),
                        ),
                        const SizedBox(height: 2),
                        const Text(
                          'Select a waiter to share or transfer table control',
                          style: TextStyle(
                            fontSize: 12,
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(LucideIcons.x, color: AppColors.textMuted, size: 20),
                    visualDensity: VisualDensity.compact,
                  ),
                ],
              ),
            ),

            const Divider(color: AppColors.border, height: 1),

            // Content List
            Flexible(
              child: _isLoading
                  ? const Padding(
                      padding: EdgeInsets.symmetric(vertical: 40),
                      child: Center(
                        child: CircularProgressIndicator(color: AppColors.primary),
                      ),
                    )
                  : _errorMessage != null
                      ? Padding(
                          padding: const EdgeInsets.symmetric(vertical: 30, horizontal: 20),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(LucideIcons.alertCircle, color: AppColors.error, size: 32),
                              const SizedBox(height: 10),
                              Text(_errorMessage!, style: const TextStyle(color: AppColors.textSecondary)),
                              const SizedBox(height: 12),
                              AppButton(
                                label: 'Retry',
                                variant: ButtonVariant.secondary,
                                onPressed: _loadWaiters,
                              ),
                            ],
                          ),
                        )
                      : _waiters.isEmpty
                          ? Padding(
                              padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 24),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Container(
                                    width: 52,
                                    height: 52,
                                    decoration: BoxDecoration(
                                      color: AppColors.surfaceContainerHigh,
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Center(
                                      child: Icon(LucideIcons.users, color: AppColors.textMuted, size: 24),
                                    ),
                                  ),
                                  const SizedBox(height: 12),
                                  Text(
                                    'No Other Waiters Available',
                                    style: AppTypography.headingSmall.copyWith(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 15,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  const Text(
                                    'All other staff members are currently offline or in different roles.',
                                    textAlign: TextAlign.center,
                                    style: TextStyle(color: AppColors.textMuted, fontSize: 12),
                                  ),
                                ],
                              ),
                            )
                          : ListView.separated(
                              shrinkWrap: true,
                              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                              itemCount: _waiters.length,
                              separatorBuilder: (_, __) => const SizedBox(height: 10),
                              itemBuilder: (context, index) {
                                final waiter = _waiters[index];
                                final isSelected = _selectedWaiter?.id == waiter.id;

                                return InkWell(
                                  onTap: () {
                                    FeedbackUtils.selectionHaptic();
                                    setState(() {
                                      _selectedWaiter = waiter;
                                    });
                                  },
                                  borderRadius: BorderRadius.circular(16),
                                  child: AnimatedContainer(
                                    duration: const Duration(milliseconds: 180),
                                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                    decoration: BoxDecoration(
                                      color: isSelected
                                          ? const Color(0xFFEEF2FF)
                                          : AppColors.surfaceContainer,
                                      borderRadius: BorderRadius.circular(16),
                                      border: Border.all(
                                        color: isSelected
                                            ? const Color(0xFF4F46E5)
                                            : AppColors.border,
                                        width: isSelected ? 2 : 1,
                                      ),
                                      boxShadow: isSelected
                                          ? [
                                              BoxShadow(
                                                color: const Color(0xFF4F46E5).withValues(alpha: 0.12),
                                                blurRadius: 8,
                                                offset: const Offset(0, 2),
                                              ),
                                            ]
                                          : null,
                                    ),
                                    child: Row(
                                      children: [
                                        // Waiter Avatar with online indicator
                                        Stack(
                                          clipBehavior: Clip.none,
                                          children: [
                                            if (waiter.avatarUrl != null && waiter.avatarUrl!.isNotEmpty)
                                              ClipRRect(
                                                borderRadius: BorderRadius.circular(14),
                                                child: CachedNetworkImage(
                                                  imageUrl: waiter.avatarUrl!,
                                                  width: 44,
                                                  height: 44,
                                                  fit: BoxFit.cover,
                                                  placeholder: (_, __) => Container(
                                                    width: 44,
                                                    height: 44,
                                                    color: AppColors.primaryContainer,
                                                    child: Center(
                                                      child: Text(
                                                        waiter.name.isNotEmpty ? waiter.name[0].toUpperCase() : 'W',
                                                        style: const TextStyle(fontWeight: FontWeight.bold),
                                                      ),
                                                    ),
                                                  ),
                                                  errorWidget: (_, __, ___) => Container(
                                                    width: 44,
                                                    height: 44,
                                                    color: AppColors.primaryContainer,
                                                    child: Center(
                                                      child: Text(
                                                        waiter.name.isNotEmpty ? waiter.name[0].toUpperCase() : 'W',
                                                        style: const TextStyle(fontWeight: FontWeight.bold),
                                                      ),
                                                    ),
                                                  ),
                                                ),
                                              )
                                            else
                                              Container(
                                                width: 44,
                                                height: 44,
                                                decoration: BoxDecoration(
                                                  color: isSelected
                                                      ? const Color(0xFF4F46E5)
                                                      : const Color(0xFFE0E7FF),
                                                  borderRadius: BorderRadius.circular(14),
                                                ),
                                                child: Center(
                                                  child: Text(
                                                    waiter.name.isNotEmpty ? waiter.name[0].toUpperCase() : 'W',
                                                    style: TextStyle(
                                                      color: isSelected ? Colors.white : const Color(0xFF4338CA),
                                                      fontWeight: FontWeight.w900,
                                                      fontSize: 18,
                                                    ),
                                                  ),
                                                ),
                                              ),
                                            // Online green dot
                                            Positioned(
                                              right: -2,
                                              bottom: -2,
                                              child: Container(
                                                width: 13,
                                                height: 13,
                                                decoration: BoxDecoration(
                                                  color: const Color(0xFF10B981),
                                                  shape: BoxShape.circle,
                                                  border: Border.all(color: Colors.white, width: 2),
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(width: 14),

                                        // Name & Details
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Row(
                                                children: [
                                                  Text(
                                                    waiter.name,
                                                    style: AppTypography.headingSmall.copyWith(
                                                      fontWeight: FontWeight.w800,
                                                      fontSize: 15,
                                                      color: isSelected
                                                          ? const Color(0xFF312E81)
                                                          : AppColors.textPrimary,
                                                    ),
                                                  ),
                                                  const SizedBox(width: 6),
                                                  Container(
                                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                                                    decoration: BoxDecoration(
                                                      color: const Color(0xFF10B981).withValues(alpha: 0.12),
                                                      borderRadius: BorderRadius.circular(6),
                                                    ),
                                                    child: const Text(
                                                      'ONLINE',
                                                      style: TextStyle(
                                                        color: Color(0xFF047857),
                                                        fontWeight: FontWeight.w900,
                                                        fontSize: 8.5,
                                                        letterSpacing: 0.5,
                                                      ),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                              const SizedBox(height: 3),
                                              Row(
                                                children: [
                                                  if (waiter.employeeId.isNotEmpty) ...[
                                                    Text(
                                                      'ID: ${waiter.employeeId}',
                                                      style: const TextStyle(
                                                        fontSize: 11.5,
                                                        color: AppColors.textMuted,
                                                        fontWeight: FontWeight.w600,
                                                      ),
                                                    ),
                                                    const SizedBox(width: 8),
                                                    const Text('•', style: TextStyle(color: AppColors.textMuted)),
                                                    const SizedBox(width: 8),
                                                  ],
                                                  Text(
                                                    waiter.activeTablesCount == 0
                                                        ? 'No active tables'
                                                        : '${waiter.activeTablesCount} active table${waiter.activeTablesCount > 1 ? "s" : ""}',
                                                    style: TextStyle(
                                                      fontSize: 11.5,
                                                      color: waiter.activeTablesCount == 0
                                                          ? const Color(0xFF059669)
                                                          : const Color(0xFFD97706),
                                                      fontWeight: FontWeight.w700,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ],
                                          ),
                                        ),

                                        // Radio selection indicator
                                        Container(
                                          width: 24,
                                          height: 24,
                                          decoration: BoxDecoration(
                                            shape: BoxShape.circle,
                                            color: isSelected ? const Color(0xFF4F46E5) : Colors.transparent,
                                            border: Border.all(
                                              color: isSelected ? const Color(0xFF4F46E5) : AppColors.borderVariant,
                                              width: 2,
                                            ),
                                          ),
                                          child: isSelected
                                              ? const Center(
                                                  child: Icon(Icons.check, size: 14, color: Colors.white),
                                                )
                                              : null,
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),
            ),

            // Bottom Actions (2 Action Buttons: Give Access Only & Transfer Table)
            if (_waiters.isNotEmpty) ...[
              Container(
                padding: const EdgeInsets.fromLTRB(20, 14, 20, 16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  border: const Border(top: BorderSide(color: AppColors.border, width: 1)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.04),
                      blurRadius: 10,
                      offset: const Offset(0, -3),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (_selectedWaiter == null) ...[
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceContainerHigh,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.border, width: 1),
                        ),
                        child: Row(
                          children: const [
                            Icon(LucideIcons.info, size: 16, color: AppColors.textMuted),
                            SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'Select a waiter above to choose an access option',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textSecondary,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ] else ...[
                      // Option 1: Give Access Only (Both can manage)
                      InkWell(
                        onTap: _isSubmitting ? null : () => _handleGrantAccess('share'),
                        borderRadius: BorderRadius.circular(14),
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFF4F46E5), Color(0xFF6366F1)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(14),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF4F46E5).withValues(alpha: 0.28),
                                blurRadius: 8,
                                offset: const Offset(0, 3),
                              ),
                            ],
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 36,
                                height: 36,
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.2),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: const Center(
                                  child: Icon(LucideIcons.users, color: Colors.white, size: 18),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Give Access Only',
                                      style: AppTypography.headingSmall.copyWith(
                                        color: Colors.white,
                                        fontWeight: FontWeight.w900,
                                        fontSize: 14.5,
                                      ),
                                    ),
                                    Text(
                                      'Both you & ${_selectedWaiter!.name} can take orders & manage table',
                                      style: TextStyle(
                                        color: Colors.white.withValues(alpha: 0.9),
                                        fontSize: 11,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              if (_isSubmitting && _submittingType == 'share')
                                const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                )
                              else
                                const Icon(LucideIcons.chevronRight, color: Colors.white, size: 18),
                            ],
                          ),
                        ),
                      ),

                      const SizedBox(height: 10),

                      // Option 2: Transfer Table (Handover completely)
                      InkWell(
                        onTap: _isSubmitting ? null : () => _handleGrantAccess('transfer'),
                        borderRadius: BorderRadius.circular(14),
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFFE11D48), Color(0xFFF43F5E)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(14),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFFE11D48).withValues(alpha: 0.25),
                                blurRadius: 8,
                                offset: const Offset(0, 3),
                              ),
                            ],
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 36,
                                height: 36,
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.2),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: const Center(
                                  child: Icon(LucideIcons.arrowRightLeft, color: Colors.white, size: 18),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Transfer Table',
                                      style: AppTypography.headingSmall.copyWith(
                                        color: Colors.white,
                                        fontWeight: FontWeight.w900,
                                        fontSize: 14.5,
                                      ),
                                    ),
                                    Text(
                                      '${_selectedWaiter!.name} becomes sole owner. You surrender access.',
                                      style: TextStyle(
                                        color: Colors.white.withValues(alpha: 0.9),
                                        fontSize: 11,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              if (_isSubmitting && _submittingType == 'transfer')
                                const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                )
                              else
                                const Icon(LucideIcons.chevronRight, color: Colors.white, size: 18),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
