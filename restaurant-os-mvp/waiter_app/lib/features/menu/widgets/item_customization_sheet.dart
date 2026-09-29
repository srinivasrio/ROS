import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/feedback_utils.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_button.dart';
import '../../cart/cart_controller.dart';
import '../menu_models.dart';

class ItemCustomizationSheet extends ConsumerStatefulWidget {
  final MenuItemModel item;
  final String? initialInstructions;
  final String? tableId;
  final Function(String instructions, List<String> addons)? onSave;

  const ItemCustomizationSheet({
    super.key,
    required this.item,
    this.initialInstructions,
    this.tableId,
    this.onSave,
  });

  @override
  ConsumerState<ItemCustomizationSheet> createState() => _ItemCustomizationSheetState();
}

class _ItemCustomizationSheetState extends ConsumerState<ItemCustomizationSheet> {
  late final TextEditingController _notesController;
  final List<String> _quickNotes = [
    'Less spicy',
    'No onion',
    'No garlic',
    'Extra spicy',
    'Crispy',
    'Serve hot',
  ];

  @override
  void initState() {
    super.initState();
    _notesController = TextEditingController(text: widget.initialInstructions);
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(top: BorderSide(color: AppColors.border, width: 1.5)),
      ),
      padding: EdgeInsets.fromLTRB(
        24,
        16,
        24,
        MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.borderVariant,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  widget.item.name,
                  style: AppTypography.headingMedium.copyWith(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              Text(
                Formatters.formatCurrency(widget.item.effectivePrice),
                style: AppTypography.headingSmall.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),

          const SizedBox(height: 20),

          Text(
            'SPECIAL INSTRUCTIONS',
            style: AppTypography.labelSmall.copyWith(
              color: AppColors.textSecondary,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 10),

          // Quick Tags
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _quickNotes.map((note) {
              return ActionChip(
                label: Text(note),
                labelStyle: AppTypography.labelSmall.copyWith(
                  color: AppColors.textPrimary,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
                backgroundColor: AppColors.surfaceContainerHigh,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                  side: const BorderSide(color: AppColors.borderVariant),
                ),
                onPressed: () {
                  FeedbackUtils.lightHaptic();
                  final current = _notesController.text.trim();
                  if (current.isEmpty) {
                    _notesController.text = note;
                  } else {
                    _notesController.text = '$current, $note';
                  }
                },
              );
            }).toList(),
          ),

          const SizedBox(height: 16),

          Container(
            decoration: BoxDecoration(
              color: AppColors.surfaceContainer,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border, width: 1),
            ),
            child: TextField(
              controller: _notesController,
              maxLines: 2,
              style: AppTypography.bodyMedium.copyWith(color: AppColors.textPrimary),
              decoration: InputDecoration(
                hintText: 'e.g. Less salt, packing separately...',
                hintStyle: AppTypography.bodyMedium.copyWith(color: AppColors.textMuted),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.all(14),
              ),
            ),
          ),

          const SizedBox(height: 24),

          AppButton(
            label: 'Add to Order',
            onPressed: () {
              FeedbackUtils.lightHaptic();
              final instructions = _notesController.text.trim();
              if (widget.onSave != null) {
                widget.onSave!(instructions, []);
              } else if (widget.tableId != null) {
                ref.read(cartProviderFamily(widget.tableId!).notifier).addItem(
                      widget.item,
                      specialInstructions: instructions.isEmpty ? null : instructions,
                    );
              }
              Navigator.of(context).pop();
            },
          ),
        ],
      ),
    );
  }
}
