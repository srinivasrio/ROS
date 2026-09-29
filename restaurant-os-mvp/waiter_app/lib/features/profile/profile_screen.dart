import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/config/app_config.dart';
import '../../core/realtime/supabase_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/utils/feedback_utils.dart';
import '../../core/widgets/app_button.dart';
import '../auth/auth_controller.dart';
import '../auth/mobile_login_screen.dart';
import '../tables/tables_controller.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  bool _isUploading = false;
  final ImagePicker _picker = ImagePicker();

  Future<void> _pickAndUploadAvatar(ImageSource source) async {
    final session = ref.read(authControllerProvider).session;
    if (session == null) return;

    try {
      final XFile? pickedFile = await _picker.pickImage(
        source: source,
        maxWidth: 600,
        maxHeight: 600,
        imageQuality: 85,
      );

      if (pickedFile == null) return;

      setState(() => _isUploading = true);

      final fileBytes = await pickedFile.readAsBytes();
      final fileExt = pickedFile.name.split('.').last;
      final fileName = '${session.userId}_${DateTime.now().millisecondsSinceEpoch}.$fileExt';
      final storagePath = 'waiters/$fileName';

      // 1. Upload to Supabase avatars bucket
      await SupabaseService.client.storage.from('avatars').uploadBinary(
        storagePath,
        fileBytes,
        fileOptions: FileOptions(
          contentType: 'image/$fileExt',
          upsert: true,
        ),
      );

      // 2. Obtain public URL
      final publicUrl = SupabaseService.client.storage.from('avatars').getPublicUrl(storagePath);

      // 3. Update employees table
      await SupabaseService.client.from('employees').update({
        'avatar_url': publicUrl,
        'updated_at': DateTime.now().toIso8601String(),
      }).eq('id', session.userId);

      // 4. Update session
      await ref.read(authControllerProvider.notifier).updateAvatar(publicUrl);

      // 5. Refresh tables state so all table cards reflect the updated waiter avatar
      ref.read(tablesControllerProvider.notifier).loadTables();

      FeedbackUtils.successHaptic();
      if (mounted) {
        FeedbackUtils.showToast(context, message: 'Profile photo updated successfully!');
      }
    } catch (e) {
      debugPrint('[ProfileScreen] Error uploading avatar: $e');
      FeedbackUtils.heavyHaptic();
      if (mounted) {
        FeedbackUtils.showToast(context, message: 'Failed to upload photo', isError: true);
      }
    } finally {
      if (mounted) setState(() => _isUploading = false);
    }
  }

  Future<void> _removeAvatar() async {
    final session = ref.read(authControllerProvider).session;
    if (session == null) return;

    setState(() => _isUploading = true);
    try {
      await SupabaseService.client.from('employees').update({
        'avatar_url': null,
        'updated_at': DateTime.now().toIso8601String(),
      }).eq('id', session.userId);

      await ref.read(authControllerProvider.notifier).updateAvatar(null);
      ref.read(tablesControllerProvider.notifier).loadTables();

      FeedbackUtils.successHaptic();
      if (mounted) {
        FeedbackUtils.showToast(context, message: 'Profile photo removed.');
      }
    } catch (e) {
      if (mounted) {
        FeedbackUtils.showToast(context, message: 'Failed to remove photo', isError: true);
      }
    } finally {
      if (mounted) setState(() => _isUploading = false);
    }
  }

  void _showAvatarOptions() {
    final session = ref.read(authControllerProvider).session;
    final hasAvatar = session?.avatarUrl != null && session!.avatarUrl!.isNotEmpty;

    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
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
              Text(
                'Profile Photo',
                style: AppTypography.headingMedium.copyWith(
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Your photo will appear on assigned tables across the team.',
                style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 20),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(LucideIcons.camera, color: AppColors.primary, size: 20),
                ),
                title: Text('Take Photo', style: AppTypography.bodyLarge.copyWith(fontWeight: FontWeight.w700)),
                onTap: () {
                  Navigator.of(ctx).pop();
                  _pickAndUploadAvatar(ImageSource.camera);
                },
              ),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(LucideIcons.image, color: AppColors.primary, size: 20),
                ),
                title: Text('Choose from Gallery', style: AppTypography.bodyLarge.copyWith(fontWeight: FontWeight.w700)),
                onTap: () {
                  Navigator.of(ctx).pop();
                  _pickAndUploadAvatar(ImageSource.gallery);
                },
              ),
              if (hasAvatar)
                ListTile(
                  leading: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.error.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(LucideIcons.trash2, color: AppColors.error, size: 20),
                  ),
                  title: Text('Remove Photo', style: AppTypography.bodyLarge.copyWith(color: AppColors.error, fontWeight: FontWeight.w700)),
                  onTap: () {
                    Navigator.of(ctx).pop();
                    _removeAvatar();
                  },
                ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }

  void _handleLogout(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surfaceContainer,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: AppColors.border, width: 1),
        ),
        title: Text(
          'Sign Out',
          style: AppTypography.headingMedium.copyWith(color: AppColors.textPrimary),
        ),
        content: Text(
          'Are you sure you want to sign out of your waiter shift?',
          style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text('Cancel', style: AppTypography.labelLarge.copyWith(color: AppColors.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
              elevation: 0,
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () async {
              Navigator.of(ctx).pop();
              await ref.read(authControllerProvider.notifier).logout();
              if (context.mounted) {
                FeedbackUtils.lightHaptic();
                Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute(builder: (_) => const MobileLoginScreen()),
                  (route) => false,
                );
              }
            },
            child: Text('Sign Out', style: AppTypography.labelLarge.copyWith(color: Colors.white, fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(authControllerProvider).session;
    final hasAvatar = session?.avatarUrl != null && session!.avatarUrl!.isNotEmpty;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        title: Text(
          'Waiter Profile',
          style: AppTypography.headingLarge.copyWith(
            color: AppColors.primary,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            // Profile Card with Interactive Avatar Upload
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.surfaceContainer,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.border, width: 1),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                children: [
                  // Avatar with Camera Tap Trigger
                  GestureDetector(
                    onTap: _isUploading ? null : _showAvatarOptions,
                    child: Stack(
                      clipBehavior: Clip.none,
                      children: [
                        Container(
                          width: 68,
                          height: 68,
                          decoration: BoxDecoration(
                            color: AppColors.primary,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: Colors.white, width: 2),
                            boxShadow: [
                              BoxShadow(
                                color: AppColors.primary.withValues(alpha: 0.25),
                                blurRadius: 8,
                                offset: const Offset(0, 3),
                              ),
                            ],
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(18),
                            child: _isUploading
                                ? Container(
                                    color: Colors.black45,
                                    child: const Center(
                                      child: SizedBox(
                                        width: 24,
                                        height: 24,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2.5,
                                          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                        ),
                                      ),
                                    ),
                                  )
                                : hasAvatar
                                    ? CachedNetworkImage(
                                        imageUrl: session.avatarUrl!,
                                        fit: BoxFit.cover,
                                        placeholder: (_, __) => Center(
                                          child: Text(
                                            session.name.isNotEmpty ? session.name[0].toUpperCase() : 'W',
                                            style: AppTypography.displayLarge.copyWith(
                                              color: AppColors.onPrimary,
                                              fontSize: 26,
                                              fontWeight: FontWeight.w900,
                                            ),
                                          ),
                                        ),
                                        errorWidget: (_, __, ___) => Center(
                                          child: Text(
                                            session.name.isNotEmpty ? session.name[0].toUpperCase() : 'W',
                                            style: AppTypography.displayLarge.copyWith(
                                              color: AppColors.onPrimary,
                                              fontSize: 26,
                                              fontWeight: FontWeight.w900,
                                            ),
                                          ),
                                        ),
                                      )
                                    : Center(
                                        child: Text(
                                          (session?.name.isNotEmpty == true) ? session!.name[0].toUpperCase() : 'W',
                                          style: AppTypography.displayLarge.copyWith(
                                            color: AppColors.onPrimary,
                                            fontSize: 26,
                                            fontWeight: FontWeight.w900,
                                          ),
                                        ),
                                      ),
                          ),
                        ),
                        Positioned(
                          bottom: -3,
                          right: -3,
                          child: Container(
                            padding: const EdgeInsets.all(5.5),
                            decoration: BoxDecoration(
                              color: AppColors.primary,
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.white, width: 2),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.15),
                                  blurRadius: 4,
                                ),
                              ],
                            ),
                            child: const Icon(
                              LucideIcons.camera,
                              size: 11,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          session?.name ?? 'Staff Waiter',
                          style: AppTypography.headingMedium.copyWith(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          session?.mobile ?? '',
                          style: AppTypography.bodySmall.copyWith(
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppColors.primary.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                (session?.role ?? 'WAITER').toUpperCase(),
                                style: AppTypography.labelSmall.copyWith(
                                  color: AppColors.primary,
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            GestureDetector(
                              onTap: _showAvatarOptions,
                              child: Text(
                                hasAvatar ? 'Change Photo' : 'Add Photo',
                                style: AppTypography.labelSmall.copyWith(
                                  color: AppColors.primary,
                                  fontWeight: FontWeight.w800,
                                  decoration: TextDecoration.underline,
                                ),
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

            const SizedBox(height: 20),

            // Restaurant Tenant Info
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
                    'RESTAURANT DETAILS',
                    style: AppTypography.labelSmall.copyWith(
                      color: AppColors.textSecondary,
                      letterSpacing: 1.1,
                    ),
                  ),
                  const SizedBox(height: 12),
                  _buildDetailRow(
                    icon: LucideIcons.building2,
                    label: 'Restaurant',
                    value: session?.restaurantName ?? 'Dine In One',
                  ),
                  const SizedBox(height: 10),
                  _buildDetailRow(
                    icon: LucideIcons.hash,
                    label: 'Tenant ID',
                    value: session?.restaurantId ?? 'N/A',
                  ),
                  const SizedBox(height: 10),
                  _buildDetailRow(
                    icon: LucideIcons.badgeCheck,
                    label: 'Status',
                    value: 'Active Shift',
                    valueColor: AppColors.tableAvailable,
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // App Version Box
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: AppColors.surfaceContainer,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: AppColors.border, width: 1),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(LucideIcons.info, size: 20, color: AppColors.textMuted),
                      const SizedBox(width: 12),
                      Text(
                        'App Version',
                        style: AppTypography.bodyMedium.copyWith(color: AppColors.textPrimary),
                      ),
                    ],
                  ),
                  Text(
                    'v${AppConfig.appVersion}',
                    style: AppTypography.labelMedium.copyWith(
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 32),

            // Sign Out Button
            AppButton(
              label: 'End Shift / Sign Out',
              icon: LucideIcons.logOut,
              variant: ButtonVariant.danger,
              onPressed: () => _handleLogout(context),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow({
    required IconData icon,
    required String label,
    required String value,
    Color? valueColor,
  }) {
    return Row(
      children: [
        Icon(icon, size: 16, color: AppColors.textMuted),
        const SizedBox(width: 10),
        Text(
          label,
          style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
        ),
        const Spacer(),
        Text(
          value,
          style: AppTypography.bodyMedium.copyWith(
            fontWeight: FontWeight.w700,
            color: valueColor ?? AppColors.textPrimary,
          ),
        ),
      ],
    );
  }
}
