import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/feedback_utils.dart';
import '../../../core/widgets/app_button.dart';
import '../table_models.dart';
import '../tables_controller.dart';

class MergeTablesSheet extends ConsumerStatefulWidget {
  final TableModel? initialTable;

  const MergeTablesSheet({
    super.key,
    this.initialTable,
  });

  @override
  ConsumerState<MergeTablesSheet> createState() => _MergeTablesSheetState();
}

class _MergeTablesSheetState extends ConsumerState<MergeTablesSheet> {
  final Set<String> _selectedTableIds = {};
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    if (widget.initialTable != null) {
      _selectedTableIds.add(widget.initialTable!.id);
    }
  }

  void _toggleTable(TableModel table) {
    FeedbackUtils.selectionHaptic();
    setState(() {
      if (_selectedTableIds.contains(table.id)) {
        _selectedTableIds.remove(table.id);
      } else {
        _selectedTableIds.add(table.id);
      }
    });
  }

  Future<void> _handleMerge() async {
    if (_selectedTableIds.length < 2) {
      FeedbackUtils.showToast(context, message: 'Please select at least 2 tables to merge', isError: true);
      return;
    }

    setState(() => _isLoading = true);
    try {
      await ref.read(tablesControllerProvider.notifier).mergeTables(_selectedTableIds.toList());
      FeedbackUtils.successHaptic();
      if (!mounted) return;
      FeedbackUtils.showToast(context, message: 'Tables merged successfully!');
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      FeedbackUtils.showToast(
        context,
        message: e.toString().replaceAll('Exception: ', ''),
        isError: true,
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tablesState = ref.watch(tablesControllerProvider);
    final allTables = tablesState.allTables;

    // Filter tables for merging (show available tables first)
    final selectedTables = allTables.where((t) => _selectedTableIds.contains(t.id)).toList();
    final totalSeats = selectedTables.fold<int>(0, (sum, t) => sum + t.capacity);
    final selectedNames = selectedTables.map((t) => t.tableNumber).toList();
    selectedNames.sort((a, b) => int.tryParse(a)?.compareTo(int.tryParse(b) ?? 0) ?? a.compareTo(b));
    final previewName = selectedNames.isNotEmpty ? 'Table ${selectedNames.join("+")}' : 'Select tables to merge';

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
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
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.primaryContainer,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Icon(LucideIcons.link2, color: AppColors.primary, size: 22),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Merge Tables',
                          style: AppTypography.headingMedium.copyWith(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        Text(
                          'Combine multiple tables into a single dining group',
                          style: AppTypography.bodySmall.copyWith(
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, color: AppColors.textSecondary),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
            ),

            const Divider(color: AppColors.border, height: 1),

            // Summary Banner
            Container(
              margin: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: _selectedTableIds.length >= 2 ? AppColors.primaryLight : AppColors.surfaceContainerHigh,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: _selectedTableIds.length >= 2 ? AppColors.primary : AppColors.border,
                  width: 1.5,
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          previewName,
                          style: AppTypography.labelLarge.copyWith(
                            color: _selectedTableIds.length >= 2 ? AppColors.primary : AppColors.textPrimary,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${_selectedTableIds.length} tables selected • $totalSeats total seats',
                          style: AppTypography.bodySmall.copyWith(
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (_selectedTableIds.length >= 2)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        'Ready',
                        style: AppTypography.labelSmall.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                ],
              ),
            ),

            // Selectable Tables List
            Flexible(
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                shrinkWrap: true,
                itemCount: allTables.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final table = allTables[index];
                  final isSelected = _selectedTableIds.contains(table.id);
                  final isAlreadyMerged = table.isMerged;
                  final isOccupied = table.isOccupied && !isSelected;

                  return Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: isAlreadyMerged ? null : () => _toggleTable(table),
                      borderRadius: BorderRadius.circular(14),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? AppColors.primaryLight
                              : (isAlreadyMerged ? AppColors.surfaceContainerLow : AppColors.surface),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: isSelected
                                ? AppColors.primary
                                : (isAlreadyMerged ? AppColors.borderVariant : AppColors.border),
                            width: isSelected ? 2 : 1,
                          ),
                        ),
                        child: Row(
                          children: [
                            // Selection checkbox indicator
                            Container(
                              width: 24,
                              height: 24,
                              decoration: BoxDecoration(
                                color: isSelected ? AppColors.primary : Colors.transparent,
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: isSelected ? AppColors.primary : AppColors.textMuted,
                                  width: 2,
                                ),
                              ),
                              child: isSelected
                                  ? const Icon(Icons.check_rounded, size: 16, color: Colors.white)
                                  : null,
                            ),
                            const SizedBox(width: 12),

                            // Table Number & Details
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Text(
                                        table.formattedName,
                                        style: AppTypography.labelLarge.copyWith(
                                          color: isAlreadyMerged ? AppColors.textMuted : AppColors.textPrimary,
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                      if (table.areaName != null) ...[
                                        const SizedBox(width: 8),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                          decoration: BoxDecoration(
                                            color: AppColors.surfaceContainerHigh,
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: Text(
                                            table.areaName!,
                                            style: AppTypography.labelSmall.copyWith(
                                              color: AppColors.textSecondary,
                                              fontSize: 10,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                        ),
                                      ],
                                      if (isAlreadyMerged) ...[
                                        const SizedBox(width: 8),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                          decoration: BoxDecoration(
                                            color: AppColors.errorContainer,
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: const Text(
                                            'Already Merged',
                                            style: TextStyle(
                                              color: AppColors.onErrorContainer,
                                              fontSize: 10,
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '${table.capacity} Seats • Status: ${table.status.toUpperCase()}',
                                    style: AppTypography.bodySmall.copyWith(
                                      color: isOccupied ? AppColors.tableOccupied : AppColors.textSecondary,
                                      fontWeight: FontWeight.w500,
                                      fontSize: 11,
                                    ),
                                  ),
                                ],
                              ),
                            ),

                            // Capacity badge
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: isSelected ? AppColors.primaryContainer : AppColors.surfaceContainerHigh,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    LucideIcons.users,
                                    size: 13,
                                    color: isSelected ? AppColors.primary : AppColors.textSecondary,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    '${table.capacity}',
                                    style: TextStyle(
                                      color: isSelected ? AppColors.primary : AppColors.textPrimary,
                                      fontWeight: FontWeight.w800,
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),

            const Divider(color: AppColors.border, height: 1),

            // Bottom Action CTA
            Padding(
              padding: const EdgeInsets.all(16),
              child: AppButton(
                label: _selectedTableIds.length >= 2
                    ? 'Merge ${_selectedTableIds.length} Tables ($totalSeats Seats)'
                    : 'Select at least 2 tables to merge',
                isLoading: _isLoading,
                icon: LucideIcons.link2,
                onPressed: _selectedTableIds.length >= 2 ? _handleMerge : null,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
