import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';
import 'app_button.dart';

class EmptyStateView extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final String? description;
  final String? actionLabel;
  final VoidCallback? onAction;

  const EmptyStateView({
    super.key,
    this.icon = LucideIcons.inbox,
    required this.title,
    this.subtitle,
    this.description,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    final descText = subtitle ?? description ?? '';

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: AppColors.surfaceContainerHigh,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.borderVariant, width: 1.5),
              ),
              child: Icon(icon, size: 32, color: AppColors.textMuted),
            ),
            const SizedBox(height: 20),
            Text(
              title,
              textAlign: TextAlign.center,
              style: AppTypography.headingMedium.copyWith(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w800,
              ),
            ),
            if (descText.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                descText,
                textAlign: TextAlign.center,
                style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
              ),
            ],
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 24),
              AppButton(
                label: actionLabel!,
                onPressed: onAction,
                width: 180,
                height: 48,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
