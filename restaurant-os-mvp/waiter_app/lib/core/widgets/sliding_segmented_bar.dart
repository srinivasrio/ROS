import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';
import '../utils/feedback_utils.dart';

class SlidingTabItem {
  final String keyId;
  final String label;
  final int? count;
  final IconData? icon;
  final Color? activeColor;
  final Widget? leading;

  const SlidingTabItem({
    required this.keyId,
    required this.label,
    this.count,
    this.icon,
    this.activeColor,
    this.leading,
  });
}

class SlidingSegmentedBar extends StatelessWidget {
  final List<SlidingTabItem> items;
  final String selectedKey;
  final ValueChanged<String> onSelected;
  final double height;
  final EdgeInsetsGeometry margin;

  const SlidingSegmentedBar({
    super.key,
    required this.items,
    required this.selectedKey,
    required this.onSelected,
    this.height = 46,
    this.margin = const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
  });

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();

    final selectedIndex = items.indexWhere((item) => item.keyId.toUpperCase() == selectedKey.toUpperCase()).clamp(0, items.length - 1);
    final activeColor = (selectedIndex >= 0 && selectedIndex < items.length)
        ? (items[selectedIndex].activeColor ?? AppColors.primary)
        : AppColors.primary;

    return Container(
      height: height,
      margin: margin,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerHigh,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderVariant, width: 1),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final itemWidth = constraints.maxWidth / items.length;

          return Stack(
            children: [
              // Smooth traveling animated background indicator
              AnimatedPositioned(
                duration: const Duration(milliseconds: 300),
                curve: Curves.easeInOutCubicEmphasized,
                left: selectedIndex * itemWidth,
                top: 0,
                bottom: 0,
                width: itemWidth,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 250),
                  curve: Curves.easeInOut,
                  decoration: BoxDecoration(
                    color: activeColor,
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: activeColor.withValues(alpha: 0.35),
                        blurRadius: 10,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                ),
              ),

              // Tab text buttons row
              Row(
                children: List.generate(items.length, (index) {
                  final item = items[index];
                  final isSelected = index == selectedIndex;

                  return Expanded(
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: () {
                          FeedbackUtils.selectionHaptic();
                          onSelected(item.keyId);
                        },
                        borderRadius: BorderRadius.circular(12),
                        child: Center(
                          child: AnimatedDefaultTextStyle(
                            duration: const Duration(milliseconds: 200),
                            style: AppTypography.labelSmall.copyWith(
                              color: isSelected ? Colors.white : AppColors.textSecondary,
                              fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                              fontSize: 12,
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                if (item.leading != null) item.leading!,
                                if (item.icon != null && item.leading == null) ...[
                                  Icon(
                                    item.icon,
                                    size: 14,
                                    color: isSelected ? Colors.white : AppColors.textSecondary,
                                  ),
                                  const SizedBox(width: 4),
                                ],
                                Flexible(
                                  child: Text(
                                    item.label,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                if (item.count != null && item.count! > 0) ...[
                                  const SizedBox(width: 4),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                    decoration: BoxDecoration(
                                      color: isSelected
                                          ? Colors.black.withValues(alpha: 0.2)
                                          : AppColors.surfaceContainerHighest,
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      '${item.count}',
                                      style: TextStyle(
                                        color: isSelected ? Colors.white : AppColors.textMuted,
                                        fontSize: 10,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                }),
              ),
            ],
          );
        },
      ),
    );
  }
}
