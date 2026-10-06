import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart' hide MultipartFile;
import '../../core/network/api_client.dart';
import '../../core/realtime/supabase_service.dart';
import '../../core/theme/app_typography.dart';
import '../../core/utils/feedback_utils.dart';
import '../auth/auth_controller.dart';
import '../auth/mobile_login_screen.dart';
import '../orders/orders_controller.dart';
import '../tables/tables_controller.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  bool _isUploading = false;
  bool _copiedId = false;
  bool _isOnline = true;
  bool _isTogglingStatus = false;
  final ImagePicker _picker = ImagePicker();

  @override
  void initState() {
    super.initState();
    _fetchLiveOnlineStatus();
  }

  Future<void> _fetchLiveOnlineStatus() async {
    final session = ref.read(authControllerProvider).session;
    if (session == null) return;

    try {
      final res = await SupabaseService.client
          .from('employees')
          .select('is_online, availability_status')
          .eq('id', session.userId)
          .maybeSingle();

      if (res != null && mounted) {
        setState(() {
          _isOnline = res['is_online'] == true;
        });
      }
    } catch (e) {
      debugPrint('[ProfileScreen] Error fetching status: $e');
    }
  }

  Future<void> _toggleOnlineStatus() async {
    final session = ref.read(authControllerProvider).session;
    if (session == null || _isTogglingStatus) return;

    final nextStatus = !_isOnline;
    setState(() {
      _isTogglingStatus = true;
      _isOnline = nextStatus; // Optimistic update
    });

    FeedbackUtils.selectionHaptic();

    try {
      // 1. Direct Supabase update
      await SupabaseService.client.from('employees').update({
        'is_online': nextStatus,
        'availability_status': nextStatus ? 'available' : 'offline',
        'updated_at': DateTime.now().toIso8601String(),
      }).eq('id', session.userId);

      // 2. Try POST /api/waiter/status for audit logging
      try {
        final client = ApiClient();
        await client.post('/api/waiter/status', data: {
          'isOnline': nextStatus,
          'waiterId': session.userId,
          'mobile': session.mobile,
          'restaurantId': session.restaurantId,
        });
      } catch (_) {}

      if (mounted) {
        if (nextStatus) {
          FeedbackUtils.successHaptic();
          FeedbackUtils.showToast(context, message: 'You are now Online and ready to receive orders & alerts.');
        } else {
          FeedbackUtils.lightHaptic();
          FeedbackUtils.showToast(context, message: 'You are now Offline. Order alerts paused.');
        }
      }
    } catch (e) {
      debugPrint('[ProfileScreen] Error toggling status: $e');
      if (mounted) {
        setState(() => _isOnline = !nextStatus); // Revert
        FeedbackUtils.heavyHaptic();
        FeedbackUtils.showToast(context, message: 'Failed to update status', isError: true);
      }
    } finally {
      if (mounted) setState(() => _isTogglingStatus = false);
    }
  }

  Future<void> _pickAndUploadAvatar(ImageSource source) async {
    final session = ref.read(authControllerProvider).session;
    if (session == null) return;

    try {
      final XFile? pickedFile = await _picker.pickImage(
        source: source,
        maxWidth: 800,
        maxHeight: 800,
        imageQuality: 85,
      );

      if (pickedFile == null) return;

      setState(() => _isUploading = true);
      FeedbackUtils.selectionHaptic();

      final fileBytes = await pickedFile.readAsBytes();
      final fileExt = pickedFile.name.split('.').last.toLowerCase();
      String? uploadedUrl;

      // 1. Try uploading to Cloudflare R2 via Backend API
      try {
        final client = ApiClient();
        final formData = FormData.fromMap({
          'file': MultipartFile.fromBytes(
            fileBytes,
            filename: 'waiter_${session.userId}_${DateTime.now().millisecondsSinceEpoch}.$fileExt',
          ),
          'waiterId': session.userId,
          'mobile': session.mobile,
          'restaurantId': session.restaurantId,
        });

        final response = await client.post('/api/waiter/profile-image', data: formData);
        if (response.statusCode == 200 && response.data?['avatarUrl'] != null) {
          uploadedUrl = response.data['avatarUrl'].toString();
        }
      } catch (apiErr) {
        debugPrint('[ProfileScreen] API profile-image upload fallback: $apiErr');
      }

      // 2. Direct Supabase Storage fallback if API upload did not return URL
      if (uploadedUrl == null || uploadedUrl.isEmpty) {
        final fileName = '${session.userId}_${DateTime.now().millisecondsSinceEpoch}.$fileExt';
        final storagePath = 'waiters/$fileName';

        await SupabaseService.client.storage.from('avatars').uploadBinary(
          storagePath,
          fileBytes,
          fileOptions: FileOptions(
            contentType: 'image/$fileExt',
            upsert: true,
          ),
        );

        uploadedUrl = SupabaseService.client.storage.from('avatars').getPublicUrl(storagePath);
      }

      // 3. Update employees table
      await SupabaseService.client.from('employees').update({
        'avatar_url': uploadedUrl,
        'updated_at': DateTime.now().toIso8601String(),
      }).eq('id', session.userId);

      // 4. Update local session & table cards
      await ref.read(authControllerProvider.notifier).updateAvatar(uploadedUrl);
      ref.read(tablesControllerProvider.notifier).loadTables();

      FeedbackUtils.successHaptic();
      if (mounted) {
        FeedbackUtils.showToast(context, message: 'Profile picture updated successfully!');
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

  void _copyEmployeeId(String employeeId) {
    Clipboard.setData(ClipboardData(text: employeeId));
    setState(() => _copiedId = true);
    FeedbackUtils.selectionHaptic();
    FeedbackUtils.showToast(context, message: 'Copied ID: $employeeId');
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) setState(() => _copiedId = false);
    });
  }

  void _showAvatarOptions() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFFEEF2F6),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
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
                  width: 44,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFCBD5E1),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Waiter Profile Photo',
                style: AppTypography.headingMedium.copyWith(
                  fontWeight: FontWeight.w900,
                  color: const Color(0xFF1E293B),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Upload a photo to be displayed across Customer, Admin, and KDS screens.',
                style: AppTypography.bodySmall.copyWith(color: const Color(0xFF64748B)),
              ),
              const SizedBox(height: 20),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF0E5),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(LucideIcons.camera, color: Color(0xFFFF6B00), size: 20),
                ),
                title: Text('Take Photo', style: AppTypography.bodyLarge.copyWith(fontWeight: FontWeight.w700)),
                onTap: () {
                  Navigator.of(ctx).pop();
                  _pickAndUploadAvatar(ImageSource.camera);
                },
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF0E5),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(LucideIcons.image, color: Color(0xFFFF6B00), size: 20),
                ),
                title: Text('Choose from Gallery', style: AppTypography.bodyLarge.copyWith(fontWeight: FontWeight.w700)),
                onTap: () {
                  Navigator.of(ctx).pop();
                  _pickAndUploadAvatar(ImageSource.gallery);
                },
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }

  void _showStaffDetailsSheet() {
    final session = ref.read(authControllerProvider).session;
    final formattedMobile = session?.mobile != null && session!.mobile.length >= 10
        ? '+91 ${session.mobile.substring(session.mobile.length - 10)}'
        : (session?.mobile ?? '—');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Center(
        child: Container(
          margin: const EdgeInsets.all(20),
          constraints: const BoxConstraints(maxWidth: 380),
          decoration: BoxDecoration(
            color: const Color(0xFFEEF2F6),
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: Colors.white.withValues(alpha: 0.9), width: 1.2),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFFA6B4C8).withValues(alpha: 0.5),
                blurRadius: 24,
                offset: const Offset(8, 8),
              ),
              const BoxShadow(
                color: Colors.white,
                blurRadius: 24,
                offset: Offset(-8, -8),
              ),
            ],
          ),
          padding: const EdgeInsets.all(22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: const Color(0xFFEEF2F6),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.9)),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFFA6B4C8).withValues(alpha: 0.35),
                              blurRadius: 4,
                              offset: const Offset(1.5, 1.5),
                            ),
                            const BoxShadow(
                              color: Colors.white,
                              blurRadius: 4,
                              offset: Offset(-1.5, -1.5),
                            ),
                          ],
                        ),
                        child: const Icon(LucideIcons.userCheck, color: Color(0xFFFF6B00), size: 18),
                      ),
                      const SizedBox(width: 10),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Staff & Account Details',
                            style: AppTypography.headingSmall.copyWith(
                              fontWeight: FontWeight.w900,
                              color: const Color(0xFF1E293B),
                            ),
                          ),
                          Text(
                            'Personal Staff Credentials',
                            style: AppTypography.labelSmall.copyWith(
                              color: const Color(0xFF94A3B8),
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  IconButton(
                    icon: const Icon(LucideIcons.x, size: 18, color: Color(0xFF64748B)),
                    onPressed: () => Navigator.of(ctx).pop(),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Divider(color: Color(0xFFCBD5E1), height: 1),
              _buildStructuredRow(
                icon: LucideIcons.userCheck,
                label: 'Staff Name',
                value: Text(
                  session?.name ?? 'Staff Waiter',
                  style: AppTypography.bodyMedium.copyWith(fontWeight: FontWeight.w800, color: const Color(0xFF1E293B)),
                ),
              ),
              _buildStructuredRow(
                icon: LucideIcons.hash,
                label: 'Employee ID',
                value: Text(
                  session?.employeeId ?? '—',
                  style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFF334155)),
                ),
              ),
              _buildStructuredRow(
                icon: LucideIcons.smartphone,
                label: 'Primary Mobile',
                value: Text(
                  formattedMobile,
                  style: AppTypography.bodyMedium.copyWith(fontWeight: FontWeight.w800, color: const Color(0xFF1E293B)),
                ),
              ),
              _buildStructuredRow(
                icon: LucideIcons.badgeCheck,
                label: 'Account Status',
                value: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFD1FAE5),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFF6EE7B7)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(width: 6, height: 6, decoration: const BoxDecoration(color: Color(0xFF10B981), shape: BoxShape.circle)),
                      const SizedBox(width: 5),
                      const Text(
                        'Active & Verified',
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFF047857)),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                height: 42,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFEEF2F6),
                    foregroundColor: const Color(0xFF334155),
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                      side: BorderSide(color: Colors.white.withValues(alpha: 0.85)),
                    ),
                  ),
                  onPressed: () => Navigator.of(ctx).pop(),
                  child: const Text('Done', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showRestaurantDetailsSheet() {
    final session = ref.read(authControllerProvider).session;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Center(
        child: Container(
          margin: const EdgeInsets.all(20),
          constraints: const BoxConstraints(maxWidth: 380),
          decoration: BoxDecoration(
            color: const Color(0xFFEEF2F6),
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: Colors.white.withValues(alpha: 0.9), width: 1.2),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFFA6B4C8).withValues(alpha: 0.5),
                blurRadius: 24,
                offset: const Offset(8, 8),
              ),
              const BoxShadow(
                color: Colors.white,
                blurRadius: 24,
                offset: Offset(-8, -8),
              ),
            ],
          ),
          padding: const EdgeInsets.all(22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: const Color(0xFFEEF2F6),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.9)),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFFA6B4C8).withValues(alpha: 0.35),
                              blurRadius: 4,
                              offset: const Offset(1.5, 1.5),
                            ),
                            const BoxShadow(
                              color: Colors.white,
                              blurRadius: 4,
                              offset: Offset(-1.5, -1.5),
                            ),
                          ],
                        ),
                        child: const Icon(LucideIcons.building2, color: Color(0xFFFF6B00), size: 18),
                      ),
                      const SizedBox(width: 10),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Restaurant Details',
                            style: AppTypography.headingSmall.copyWith(
                              fontWeight: FontWeight.w900,
                              color: const Color(0xFF1E293B),
                            ),
                          ),
                          Text(
                            'Assigned Branch & Outlet',
                            style: AppTypography.labelSmall.copyWith(
                              color: const Color(0xFF94A3B8),
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  IconButton(
                    icon: const Icon(LucideIcons.x, size: 18, color: Color(0xFF64748B)),
                    onPressed: () => Navigator.of(ctx).pop(),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Divider(color: Color(0xFFCBD5E1), height: 1),
              _buildStructuredRow(
                icon: LucideIcons.building2,
                label: 'Restaurant Name',
                value: Text(
                  session?.restaurantName ?? 'Dine In One',
                  style: AppTypography.bodyMedium.copyWith(fontWeight: FontWeight.w900, color: const Color(0xFF0F172A)),
                ),
              ),
              _buildStructuredRow(
                icon: LucideIcons.store,
                label: 'Outlet Code / Tenant',
                value: Text(
                  session?.restaurantId ?? '—',
                  style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFF334155)),
                ),
              ),
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                height: 42,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFEEF2F6),
                    foregroundColor: const Color(0xFF334155),
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                      side: BorderSide(color: Colors.white.withValues(alpha: 0.85)),
                    ),
                  ),
                  onPressed: () => Navigator.of(ctx).pop(),
                  child: const Text('Done', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showEndShiftDialog() {
    showDialog(
      context: context,
      builder: (ctx) => Center(
        child: Container(
          margin: const EdgeInsets.all(24),
          constraints: const BoxConstraints(maxWidth: 340),
          decoration: BoxDecoration(
            color: const Color(0xFFEEF2F6),
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: Colors.white.withValues(alpha: 0.9), width: 1.2),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFFA6B4C8).withValues(alpha: 0.5),
                blurRadius: 24,
                offset: const Offset(8, 8),
              ),
              const BoxShadow(
                color: Colors.white,
                blurRadius: 24,
                offset: Offset(-8, -8),
              ),
            ],
          ),
          padding: const EdgeInsets.all(22),
          child: Material(
            color: Colors.transparent,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: const Color(0xFFEEF2F6),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.9)),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFFA6B4C8).withValues(alpha: 0.35),
                            blurRadius: 4,
                            offset: const Offset(2, 2),
                          ),
                          const BoxShadow(
                            color: Colors.white,
                            blurRadius: 4,
                            offset: Offset(-2, -2),
                          ),
                        ],
                      ),
                      child: const Icon(LucideIcons.logOut, color: Color(0xFFE11D48), size: 18),
                    ),
                    const SizedBox(width: 12),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'End Shift?',
                          style: AppTypography.headingMedium.copyWith(
                            fontWeight: FontWeight.w900,
                            color: const Color(0xFF1E293B),
                          ),
                        ),
                        Text(
                          'Sign out of waiter panel',
                          style: AppTypography.bodySmall.copyWith(
                            color: const Color(0xFF64748B),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Text(
                  'Signing out will mark your status as Offline. Table requests will be paused or rerouted to other active staff.',
                  style: AppTypography.bodySmall.copyWith(
                    color: const Color(0xFF475569),
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 22),
                Row(
                  children: [
                    Expanded(
                      child: SizedBox(
                        height: 44,
                        child: OutlinedButton(
                          style: OutlinedButton.styleFrom(
                            backgroundColor: const Color(0xFFEEF2F6),
                            foregroundColor: const Color(0xFF334155),
                            side: BorderSide(color: Colors.white.withValues(alpha: 0.85)),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          ),
                          onPressed: () => Navigator.of(ctx).pop(),
                          child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: SizedBox(
                        height: 44,
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFE11D48),
                            foregroundColor: Colors.white,
                            elevation: 4,
                            shadowColor: const Color(0xFFE11D48).withValues(alpha: 0.4),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          ),
                          onPressed: () async {
                            final navigator = Navigator.of(context);
                            Navigator.of(ctx).pop();
                            final session = ref.read(authControllerProvider).session;
                            if (session != null) {
                              try {
                                await SupabaseService.client.from('employees').update({
                                  'is_online': false,
                                  'availability_status': 'offline',
                                  'updated_at': DateTime.now().toIso8601String(),
                                }).eq('id', session.userId);
                              } catch (_) {}
                            }
                            await ref.read(authControllerProvider.notifier).logout();
                            FeedbackUtils.lightHaptic();
                            navigator.pushAndRemoveUntil(
                              MaterialPageRoute(builder: (_) => const MobileLoginScreen()),
                              (route) => false,
                            );
                          },
                          child: const Text('Confirm', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13)),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStructuredRow({
    required IconData icon,
    required String label,
    required Widget value,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: const Color(0xFFEEF2F6),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.white.withValues(alpha: 0.7)),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFFA6B4C8).withValues(alpha: 0.35),
                  blurRadius: 3,
                  offset: const Offset(1.5, 1.5),
                ),
                const BoxShadow(
                  color: Colors.white,
                  blurRadius: 3,
                  offset: Offset(-1.5, -1.5),
                ),
              ],
            ),
            child: Icon(icon, size: 14, color: const Color(0xFFFF6B00)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              label,
              style: AppTypography.bodySmall.copyWith(
                fontWeight: FontWeight.w700,
                color: const Color(0xFF475569),
              ),
            ),
          ),
          value,
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(authControllerProvider).session;
    final hasAvatar = session?.avatarUrl != null && session!.avatarUrl!.isNotEmpty;
    final initials = session?.name.isNotEmpty == true ? session!.name[0].toUpperCase() : 'W';
    final formattedPhone = session?.mobile != null && session!.mobile.length >= 10
        ? '+91 ${session.mobile.substring(session.mobile.length - 10)}'
        : (session?.mobile ?? '—');

    final tables = ref.watch(tablesControllerProvider).tables;
    final activeTablesCount = tables.where((t) {
      final isAssigned = t.assignedWaiterId == session?.userId ||
          t.assignedWaiterId == session?.employeeId;
      final isOccupied = t.status != 'available' && t.status != 'empty';
      return isAssigned && isOccupied;
    }).length;

    final orders = ref.watch(ordersControllerProvider).orders;
    final activeOrdersCount = orders.where((o) => !o.isCompleted).length;

    return Scaffold(
      backgroundColor: const Color(0xFFEEF2F6),
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(64),
        child: Container(
          decoration: BoxDecoration(
            color: const Color(0xFFEEF2F6).withValues(alpha: 0.95),
            border: Border(
              bottom: BorderSide(color: Colors.white.withValues(alpha: 0.85), width: 1),
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFFA6B4C8).withValues(alpha: 0.18),
                blurRadius: 10,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        'Staff Profile',
                        style: AppTypography.headingSmall.copyWith(
                          fontWeight: FontWeight.w900,
                          color: const Color(0xFF1E293B),
                          letterSpacing: -0.2,
                        ),
                      ),
                      Text(
                        'Service Credentials & Shift Hub',
                        style: AppTypography.labelSmall.copyWith(
                          color: const Color(0xFF64748B),
                          fontWeight: FontWeight.w600,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),

                  // Realtime Live Online/Offline indicator chip
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: _isOnline
                          ? const Color(0xFF10B981).withValues(alpha: 0.15)
                          : const Color(0xFFCBD5E1).withValues(alpha: 0.4),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: _isOnline
                            ? const Color(0xFF10B981).withValues(alpha: 0.35)
                            : const Color(0xFFCBD5E1),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 7,
                          height: 7,
                          decoration: BoxDecoration(
                            color: _isOnline ? const Color(0xFF10B981) : const Color(0xFF94A3B8),
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 5),
                        Text(
                          _isOnline ? 'Online' : 'Offline',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                            color: _isOnline ? const Color(0xFF047857) : const Color(0xFF475569),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
          children: [
            // 1. HERO IDENTITY CARD WITH AVATAR UPLOAD
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFFEEF2F6),
                borderRadius: BorderRadius.circular(28),
                border: Border.all(color: Colors.white.withValues(alpha: 0.9), width: 1.2),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFA6B4C8).withValues(alpha: 0.4),
                    blurRadius: 14,
                    offset: const Offset(5, 5),
                  ),
                  const BoxShadow(
                    color: Colors.white,
                    blurRadius: 14,
                    offset: Offset(-5, -5),
                  ),
                ],
              ),
              child: Stack(
                children: [
                  // Subtle ambient orange glow
                  Positioned(
                    top: -24,
                    right: -24,
                    child: Container(
                      width: 90,
                      height: 90,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: const Color(0xFFFF6B00).withValues(alpha: 0.08),
                      ),
                    ),
                  ),

                  Row(
                    children: [
                      // Avatar with Cloudflare Image Upload Trigger
                      GestureDetector(
                        onTap: _isUploading ? null : _showAvatarOptions,
                        child: Stack(
                          clipBehavior: Clip.none,
                          children: [
                            Container(
                              width: 74,
                              height: 74,
                              padding: const EdgeInsets.all(3),
                              decoration: BoxDecoration(
                                color: const Color(0xFFEEF2F6),
                                borderRadius: BorderRadius.circular(22),
                                border: Border.all(color: Colors.white.withValues(alpha: 0.9)),
                                boxShadow: [
                                  BoxShadow(
                                    color: const Color(0xFFA6B4C8).withValues(alpha: 0.38),
                                    blurRadius: 5,
                                    offset: const Offset(2.5, 2.5),
                                  ),
                                  const BoxShadow(
                                    color: Colors.white,
                                    blurRadius: 5,
                                    offset: Offset(-2.5, -2.5),
                                  ),
                                ],
                              ),
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(19),
                                child: Container(
                                  decoration: const BoxDecoration(
                                    gradient: LinearGradient(
                                      begin: Alignment.topLeft,
                                      end: Alignment.bottomRight,
                                      colors: [
                                        Color(0xFFFF6B00),
                                        Color(0xFFFF7D26),
                                        Color(0xFFFF9344),
                                      ],
                                    ),
                                  ),
                                  child: _isUploading
                                      ? Container(
                                          color: Colors.black45,
                                          child: const Center(
                                            child: SizedBox(
                                              width: 22,
                                              height: 22,
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
                                                  initials,
                                                  style: const TextStyle(
                                                    color: Colors.white,
                                                    fontWeight: FontWeight.w900,
                                                    fontSize: 26,
                                                  ),
                                                ),
                                              ),
                                              errorWidget: (_, __, ___) => Center(
                                                child: Text(
                                                  initials,
                                                  style: const TextStyle(
                                                    color: Colors.white,
                                                    fontWeight: FontWeight.w900,
                                                    fontSize: 26,
                                                  ),
                                                ),
                                              ),
                                            )
                                          : Center(
                                              child: Text(
                                                initials,
                                                style: const TextStyle(
                                                  color: Colors.white,
                                                  fontWeight: FontWeight.w900,
                                                  fontSize: 26,
                                                ),
                                              ),
                                            ),
                                ),
                              ),
                            ),

                            // Camera Action Badge
                            Positioned(
                              bottom: -3,
                              right: -3,
                              child: Container(
                                width: 26,
                                height: 26,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFEEF2F6),
                                  shape: BoxShape.circle,
                                  border: Border.all(color: Colors.white, width: 2),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withValues(alpha: 0.12),
                                      blurRadius: 4,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: const Center(
                                  child: Icon(
                                    LucideIcons.camera,
                                    size: 13,
                                    color: Color(0xFFFF6B00),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 16),

                      // Waiter Details & Badges
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    session?.name ?? 'Staff Waiter',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: AppTypography.headingMedium.copyWith(
                                      fontWeight: FontWeight.w900,
                                      color: const Color(0xFF1E293B),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2.5),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFF6B00).withValues(alpha: 0.10),
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(
                                      color: const Color(0xFFFF6B00).withValues(alpha: 0.25),
                                    ),
                                  ),
                                  child: Text(
                                    (session?.role ?? 'FLOOR WAITER').toUpperCase(),
                                    style: const TextStyle(
                                      color: Color(0xFFFF6B00),
                                      fontSize: 9.5,
                                      fontWeight: FontWeight.w900,
                                      letterSpacing: 0.4,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 5),
                            Row(
                              children: [
                                const Icon(LucideIcons.phone, size: 12, color: Color(0xFFFF6B00)),
                                const SizedBox(width: 6),
                                Text(
                                  formattedPhone,
                                  style: AppTypography.bodySmall.copyWith(
                                    fontWeight: FontWeight.w700,
                                    color: const Color(0xFF64748B),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),

                            // Employee ID Pill with Quick Copy
                            if (session?.employeeId != null && session!.employeeId.isNotEmpty)
                              GestureDetector(
                                onTap: () => _copyEmployeeId(session.employeeId),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFEEF2F6),
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(color: Colors.white.withValues(alpha: 0.8)),
                                    boxShadow: [
                                      BoxShadow(
                                        color: const Color(0xFFA6B4C8).withValues(alpha: 0.3),
                                        blurRadius: 3,
                                        offset: const Offset(1.5, 1.5),
                                      ),
                                      const BoxShadow(
                                        color: Colors.white,
                                        blurRadius: 3,
                                        offset: Offset(-1.5, -1.5),
                                      ),
                                    ],
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Icon(LucideIcons.hash, size: 11, color: Color(0xFFFF6B00)),
                                      const SizedBox(width: 4),
                                      Text(
                                        'ID: ${session.employeeId}',
                                        style: const TextStyle(
                                          fontFamily: 'monospace',
                                          fontSize: 11,
                                          fontWeight: FontWeight.w700,
                                          color: Color(0xFF475569),
                                        ),
                                      ),
                                      const SizedBox(width: 5),
                                      Icon(
                                        _copiedId ? LucideIcons.check : LucideIcons.copy,
                                        size: 11,
                                        color: _copiedId ? const Color(0xFF10B981) : const Color(0xFF94A3B8),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // 2. LIVE SHIFT & WORKLOAD CONTROL
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(width: 7, height: 7, decoration: const BoxDecoration(color: Color(0xFFFF6B00), shape: BoxShape.circle)),
                      const SizedBox(width: 8),
                      const Text(
                        'SHIFT AVAILABILITY & WORKLOAD',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF475569),
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                  const Text(
                    'Live floor sync',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF94A3B8)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 6),

            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFFEEF2F6),
                borderRadius: BorderRadius.circular(26),
                border: Border.all(
                  color: _isOnline ? const Color(0xFF10B981).withValues(alpha: 0.4) : Colors.white.withValues(alpha: 0.85),
                  width: _isOnline ? 1.5 : 1.0,
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFA6B4C8).withValues(alpha: 0.35),
                    blurRadius: 12,
                    offset: const Offset(4, 4),
                  ),
                  const BoxShadow(
                    color: Colors.white,
                    blurRadius: 12,
                    offset: Offset(-4, -4),
                  ),
                ],
              ),
              child: Column(
                children: [
                  // Online Toggle Row
                  Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          gradient: _isOnline
                              ? const LinearGradient(
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                  colors: [Color(0xFF10B981), Color(0xFF14B8A6)],
                                )
                              : null,
                          color: _isOnline ? null : const Color(0xFFEEF2F6),
                          boxShadow: _isOnline
                              ? [
                                  BoxShadow(
                                    color: const Color(0xFF10B981).withValues(alpha: 0.35),
                                    blurRadius: 10,
                                    offset: const Offset(0, 4),
                                  ),
                                ]
                              : [
                                  BoxShadow(
                                    color: const Color(0xFFA6B4C8).withValues(alpha: 0.35),
                                    blurRadius: 4,
                                    offset: const Offset(2, 2),
                                  ),
                                  const BoxShadow(
                                    color: Colors.white,
                                    blurRadius: 4,
                                    offset: Offset(-2, -2),
                                  ),
                                ],
                        ),
                        child: Icon(
                          LucideIcons.power,
                          color: _isOnline ? Colors.white : const Color(0xFF94A3B8),
                          size: 20,
                        ),
                      ),
                      const SizedBox(width: 12),

                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  _isOnline ? 'Active On Shift' : 'Shift On Pause',
                                  style: AppTypography.headingSmall.copyWith(
                                    fontWeight: FontWeight.w900,
                                    color: const Color(0xFF1E293B),
                                    fontSize: 14,
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: _isOnline ? const Color(0xFFD1FAE5) : const Color(0xFFE2E8F0),
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(
                                      color: _isOnline ? const Color(0xFF86EFAC) : const Color(0xFFCBD5E1),
                                    ),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Container(
                                        width: 5,
                                        height: 5,
                                        decoration: BoxDecoration(
                                          color: _isOnline ? const Color(0xFF10B981) : const Color(0xFF64748B),
                                          shape: BoxShape.circle,
                                        ),
                                      ),
                                      const SizedBox(width: 4),
                                      Text(
                                        _isOnline ? 'ONLINE' : 'OFFLINE',
                                        style: TextStyle(
                                          fontSize: 9,
                                          fontWeight: FontWeight.w900,
                                          color: _isOnline ? const Color(0xFF065F46) : const Color(0xFF475569),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 3),
                            Text(
                              _isOnline
                                  ? 'Receiving table orders & customer service calls'
                                  : 'Tap switch to resume alerts and table assignment',
                              style: AppTypography.labelSmall.copyWith(
                                color: const Color(0xFF64748B),
                                fontWeight: FontWeight.w600,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ),

                      // Neumorphic Toggle Switch
                      GestureDetector(
                        onTap: _isTogglingStatus ? null : _toggleOnlineStatus,
                        child: Container(
                          width: 56,
                          height: 32,
                          padding: const EdgeInsets.all(3),
                          decoration: BoxDecoration(
                            color: _isOnline ? const Color(0xFF10B981) : const Color(0xFFCBD5E1),
                            borderRadius: BorderRadius.circular(20),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.15),
                                blurRadius: 4,
                                offset: const Offset(1, 1),
                              ),
                            ],
                          ),
                          child: AnimatedAlign(
                            duration: const Duration(milliseconds: 200),
                            curve: Curves.easeInOut,
                            alignment: _isOnline ? Alignment.centerRight : Alignment.centerLeft,
                            child: Container(
                              width: 26,
                              height: 26,
                              decoration: BoxDecoration(
                                color: const Color(0xFFEEF2F6),
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.2),
                                    blurRadius: 4,
                                    offset: const Offset(1, 1),
                                  ),
                                ],
                              ),
                              child: Center(
                                child: _isTogglingStatus
                                    ? const SizedBox(
                                        width: 12,
                                        height: 12,
                                        child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF64748B)),
                                      )
                                    : Icon(
                                        LucideIcons.radio,
                                        size: 13,
                                        color: _isOnline ? const Color(0xFF047857) : const Color(0xFF94A3B8),
                                      ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 16),
                  const Divider(color: Color(0xFFE2E8F0), height: 1),
                  const SizedBox(height: 16),

                  // Realtime Workload Metric Grid (2 Columns)
                  Row(
                    children: [
                      // Active Tables
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEEF2F6),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.white.withValues(alpha: 0.75)),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFFA6B4C8).withValues(alpha: 0.3),
                                blurRadius: 3,
                                offset: const Offset(1.5, 1.5),
                              ),
                              const BoxShadow(
                                color: Colors.white,
                                blurRadius: 3,
                                offset: Offset(-1.5, -1.5),
                              ),
                            ],
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 36,
                                height: 36,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFF6B00).withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: const Color(0xFFFF6B00).withValues(alpha: 0.2)),
                                ),
                                child: const Icon(LucideIcons.layoutGrid, size: 18, color: Color(0xFFFF6B00)),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'ACTIVE TABLES',
                                      style: TextStyle(
                                        fontSize: 9.5,
                                        fontWeight: FontWeight.w900,
                                        color: Color(0xFF64748B),
                                        letterSpacing: 0.3,
                                      ),
                                    ),
                                    Row(
                                      crossAxisAlignment: CrossAxisAlignment.baseline,
                                      textBaseline: TextBaseline.alphabetic,
                                      children: [
                                        Text(
                                          '$activeTablesCount',
                                          style: const TextStyle(
                                            fontSize: 16,
                                            fontWeight: FontWeight.w900,
                                            color: Color(0xFF1E293B),
                                          ),
                                        ),
                                        const SizedBox(width: 4),
                                        const Text(
                                          'Assigned',
                                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),

                      // Live Orders
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEEF2F6),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.white.withValues(alpha: 0.75)),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFFA6B4C8).withValues(alpha: 0.3),
                                blurRadius: 3,
                                offset: const Offset(1.5, 1.5),
                              ),
                              const BoxShadow(
                                color: Colors.white,
                                blurRadius: 3,
                                offset: Offset(-1.5, -1.5),
                              ),
                            ],
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 36,
                                height: 36,
                                decoration: BoxDecoration(
                                  color: const Color(0xFF2563EB).withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: const Color(0xFF2563EB).withValues(alpha: 0.2)),
                                ),
                                child: const Icon(LucideIcons.utensilsCrossed, size: 18, color: Color(0xFF2563EB)),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'LIVE ORDERS',
                                      style: TextStyle(
                                        fontSize: 9.5,
                                        fontWeight: FontWeight.w900,
                                        color: Color(0xFF64748B),
                                        letterSpacing: 0.3,
                                      ),
                                    ),
                                    Row(
                                      crossAxisAlignment: CrossAxisAlignment.baseline,
                                      textBaseline: TextBaseline.alphabetic,
                                      children: [
                                        Text(
                                          '$activeOrdersCount',
                                          style: const TextStyle(
                                            fontSize: 16,
                                            fontWeight: FontWeight.w900,
                                            color: Color(0xFF1E293B),
                                          ),
                                        ),
                                        const SizedBox(width: 4),
                                        const Text(
                                          'Active',
                                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // 3. DETAILS BUTTONS (SEPARATE BUTTONS FOR RESTAURANT & STAFF)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
              child: Row(
                children: [
                  Container(width: 7, height: 7, decoration: const BoxDecoration(color: Color(0xFFFF6B00), shape: BoxShape.circle)),
                  const SizedBox(width: 8),
                  const Text(
                    'INFORMATION & CREDENTIALS',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF475569),
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),

            // Button 1: Staff & Account Details
            GestureDetector(
              onTap: () {
                FeedbackUtils.selectionHaptic();
                _showStaffDetailsSheet();
              },
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFEEF2F6),
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.85)),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFA6B4C8).withValues(alpha: 0.35),
                      blurRadius: 10,
                      offset: const Offset(4, 4),
                    ),
                    const BoxShadow(
                      color: Colors.white,
                      blurRadius: 10,
                      offset: Offset(-4, -4),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: const Color(0xFFEEF2F6),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.9)),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFFA6B4C8).withValues(alpha: 0.35),
                            blurRadius: 3,
                            offset: const Offset(1.5, 1.5),
                          ),
                          const BoxShadow(
                            color: Colors.white,
                            blurRadius: 3,
                            offset: Offset(-1.5, -1.5),
                          ),
                        ],
                      ),
                      child: const Icon(LucideIcons.userCheck, color: Color(0xFFFF6B00), size: 18),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Staff and Account Details',
                            style: AppTypography.headingSmall.copyWith(
                              fontSize: 14,
                              fontWeight: FontWeight.w900,
                              color: const Color(0xFF1E293B),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'View personal ID, mobile, and account verification',
                            style: AppTypography.bodySmall.copyWith(
                              fontSize: 11,
                              color: const Color(0xFF64748B),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Icon(LucideIcons.chevronRight, size: 18, color: Color(0xFF94A3B8)),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 12),

            // Button 2: Restaurant Details
            GestureDetector(
              onTap: () {
                FeedbackUtils.selectionHaptic();
                _showRestaurantDetailsSheet();
              },
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFEEF2F6),
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.85)),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFA6B4C8).withValues(alpha: 0.35),
                      blurRadius: 10,
                      offset: const Offset(4, 4),
                    ),
                    const BoxShadow(
                      color: Colors.white,
                      blurRadius: 10,
                      offset: Offset(-4, -4),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: const Color(0xFFEEF2F6),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.9)),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFFA6B4C8).withValues(alpha: 0.35),
                            blurRadius: 3,
                            offset: const Offset(1.5, 1.5),
                          ),
                          const BoxShadow(
                            color: Colors.white,
                            blurRadius: 3,
                            offset: Offset(-1.5, -1.5),
                          ),
                        ],
                      ),
                      child: const Icon(LucideIcons.building2, color: Color(0xFFFF6B00), size: 18),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Restaurant Details',
                            style: AppTypography.headingSmall.copyWith(
                              fontSize: 14,
                              fontWeight: FontWeight.w900,
                              color: const Color(0xFF1E293B),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Assigned outlet venue, tenant code & branch',
                            style: AppTypography.bodySmall.copyWith(
                              fontSize: 11,
                              color: const Color(0xFF64748B),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Icon(LucideIcons.chevronRight, size: 18, color: Color(0xFF94A3B8)),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 24),

            // 4. SIGN OUT BUTTON
            GestureDetector(
              onTap: _showEndShiftDialog,
              child: Container(
                height: 48,
                decoration: BoxDecoration(
                  color: const Color(0xFFEEF2F6),
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: const Color(0xFFF43F5E).withValues(alpha: 0.4)),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFA6B4C8).withValues(alpha: 0.35),
                      blurRadius: 8,
                      offset: const Offset(3.5, 3.5),
                    ),
                    const BoxShadow(
                      color: Colors.white,
                      blurRadius: 8,
                      offset: Offset(-3.5, -3.5),
                    ),
                  ],
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(LucideIcons.logOut, size: 16, color: Color(0xFFE11D48)),
                    SizedBox(width: 8),
                    Text(
                      'End Shift & Sign Out',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFFE11D48),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
