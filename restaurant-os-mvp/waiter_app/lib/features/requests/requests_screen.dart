import 'dart:async';
import 'dart:convert';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/utils/feedback_utils.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/app_button.dart';
import '../../core/widgets/app_network_image.dart';
import '../../core/widgets/empty_state_view.dart';
import '../../core/widgets/loading_skeleton.dart';
import '../auth/auth_controller.dart';
import '../orders/orders_controller.dart';
import '../tables/tables_controller.dart';
import 'requests_controller.dart';
import 'widgets/table_access_request_sheet.dart';

class RequestsScreen extends ConsumerWidget {
  const RequestsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final requestsState = ref.watch(requestsControllerProvider);
    final visibleRequests = ref.watch(visibleRequestsProvider);
    final requestsNotifier = ref.read(requestsControllerProvider.notifier);
    final authState = ref.watch(authControllerProvider);
    final session = authState.session;

    return Scaffold(
      backgroundColor: const Color(0xFFEEF2F6),
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(56),
        child: Container(
          decoration: const BoxDecoration(
            color: Color(0xFFEEF2F6),
            border: Border(
              bottom: BorderSide(color: Color(0xE6FFFFFF), width: 1),
            ),
            boxShadow: [
              BoxShadow(
                color: Color(0x33A6B4C8),
                blurRadius: 8,
                offset: Offset(0, 2),
              ),
            ],
          ),
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  const SizedBox(width: 36),
                  const Expanded(
                    child: Text(
                      'Requests',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontFamily: 'Outfit',
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF1E293B),
                        letterSpacing: -0.3,
                      ),
                    ),
                  ),
                  InkWell(
                    onTap: () {
                      FeedbackUtils.selectionHaptic();
                      if (session != null) {
                        requestsNotifier.loadRequests(restaurantId: session.restaurantId);
                      }
                    },
                    borderRadius: BorderRadius.circular(18),
                    child: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: const Color(0xFFEEF2F6),
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white.withValues(alpha: 0.8), width: 1),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x66A6B4C8),
                            blurRadius: 5,
                            offset: Offset(2, 2),
                          ),
                          BoxShadow(
                            color: Color(0xF2FFFFFF),
                            blurRadius: 5,
                            offset: Offset(-2, -2),
                          ),
                        ],
                      ),
                      child: const Center(
                        child: Icon(LucideIcons.rotateCw, size: 15, color: Color(0xFF475569)),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
      body: SafeArea(
        child: requestsState.isLoading && visibleRequests.isEmpty
            ? ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: 3,
                itemBuilder: (_, __) => const Padding(
                  padding: EdgeInsets.only(bottom: 12),
                  child: LoadingSkeleton(width: double.infinity, height: 110),
                ),
              )
            : visibleRequests.isEmpty
                ? const EmptyStateView(
                    icon: LucideIcons.bellOff,
                    title: 'All Caught Up!',
                    subtitle: 'No pending requests at this time.',
                  )
                : RefreshIndicator(
                    onRefresh: () async {
                      if (session != null) {
                        await requestsNotifier.loadRequests(restaurantId: session.restaurantId);
                      }
                    },
                    color: AppColors.primary,
                    backgroundColor: AppColors.surfaceContainer,
                    child: ListView.builder(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                      physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
                      itemCount: visibleRequests.length,
                      itemBuilder: (context, index) {
                        final req = visibleRequests[index];

                        return Container(
                          margin: const EdgeInsets.only(bottom: 14),
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEEF2F6),
                            borderRadius: BorderRadius.circular(22),
                            border: Border.all(
                              color: req.isPending ? const Color(0x8CFF6B35) : Colors.white.withValues(alpha: 0.85),
                              width: req.isPending ? 1.5 : 1,
                            ),
                            boxShadow: const [
                              BoxShadow(
                                color: Color(0x61A6B4C8),
                                blurRadius: 8,
                                offset: Offset(3.5, 3.5),
                              ),
                              BoxShadow(
                                color: Color(0xF2FFFFFF),
                                blurRadius: 8,
                                offset: Offset(-3.5, -3.5),
                              ),
                            ],
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Top Row: Service Image + Title + Table Badge + Timestamp
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.center,
                                children: [
                                  // Service Image
                                  Container(
                                    width: 48,
                                    height: 48,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFEEF2F6),
                                      borderRadius: BorderRadius.circular(12),
                                      border: Border.all(color: Colors.white.withValues(alpha: 0.8), width: 1),
                                      boxShadow: const [
                                        BoxShadow(
                                          color: Color(0x66A6B4C8),
                                          blurRadius: 3,
                                          offset: Offset(1.5, 1.5),
                                        ),
                                        BoxShadow(
                                          color: Color(0xE6FFFFFF),
                                          blurRadius: 3,
                                          offset: Offset(-1.5, -1.5),
                                        ),
                                      ],
                                    ),
                                    child: ClipRRect(
                                      borderRadius: BorderRadius.circular(12),
                                      child: AppNetworkImage(
                                        imageUrl: req.imageUrl,
                                        name: req.serviceLabel ?? req.formattedTitle,
                                        width: 48,
                                        height: 48,
                                        fit: BoxFit.cover,
                                        fallbackIcon: LucideIcons.bell,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 12),

                                  // Service Details
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Expanded(
                                              child: Text(
                                                req.formattedTitle,
                                                style: AppTypography.headingSmall.copyWith(
                                                  fontWeight: FontWeight.w800,
                                                  fontSize: 16,
                                                ),
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                            ),
                                            if (req.quantity > 1) ...[
                                              const SizedBox(width: 6),
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                                decoration: BoxDecoration(
                                                  color: AppColors.primaryContainer,
                                                  borderRadius: BorderRadius.circular(8),
                                                  border: Border.all(
                                                    color: AppColors.primary.withValues(alpha: 0.3),
                                                    width: 1,
                                                  ),
                                                ),
                                                child: Text(
                                                  'Qty: ${req.quantity}',
                                                  style: const TextStyle(
                                                    color: AppColors.primary,
                                                    fontWeight: FontWeight.w800,
                                                    fontSize: 11,
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ],
                                        ),
                                        const SizedBox(height: 4),
                                        Row(
                                          children: [
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: AppColors.surfaceContainerHighest,
                                                borderRadius: BorderRadius.circular(6),
                                              ),
                                              child: Text(
                                                req.formattedTableName,
                                                style: AppTypography.labelSmall.copyWith(
                                                  color: AppColors.textPrimary,
                                                  fontWeight: FontWeight.w800,
                                                  fontSize: 11,
                                                ),
                                              ),
                                            ),
                                            if (req.requestType == 'order_ready') ...[
                                              const SizedBox(width: 6),
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                                decoration: BoxDecoration(
                                                  color: const Color(0xFFECFDF5),
                                                  borderRadius: BorderRadius.circular(6),
                                                  border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.5)),
                                                ),
                                                child: const Row(
                                                  mainAxisSize: MainAxisSize.min,
                                                  children: [
                                                    Icon(LucideIcons.checkCircle2, size: 11, color: Color(0xFF047857)),
                                                    SizedBox(width: 3),
                                                    Text(
                                                      'Ready to Serve',
                                                      style: TextStyle(
                                                        color: Color(0xFF047857),
                                                        fontWeight: FontWeight.w800,
                                                        fontSize: 10,
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            ],
                                            const SizedBox(width: 8),
                                            RequestTimerBadge(createdAt: req.createdAt),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),

                               // Table Access Request specific card or Notes
                              if (req.isTableAccessRequest) ...[
                                const SizedBox(height: 10),
                                Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFEEF2FF),
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(color: const Color(0xFFC7D2FE)),
                                  ),
                                  child: Row(
                                    children: [
                                      Container(
                                        width: 36,
                                        height: 36,
                                        decoration: BoxDecoration(
                                          color: const Color(0xFF4F46E5),
                                          borderRadius: BorderRadius.circular(10),
                                        ),
                                        child: Center(
                                          child: Text(
                                            (req.requesterName ?? 'W')[0].toUpperCase(),
                                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              'Requester: ${req.requesterName ?? "Waiter"}',
                                              style: const TextStyle(
                                                fontSize: 13,
                                                fontWeight: FontWeight.w800,
                                                color: Color(0xFF312E81),
                                              ),
                                            ),
                                            if (req.requesterMobile != null && req.requesterMobile!.isNotEmpty) ...[
                                              const SizedBox(height: 2),
                                              Text(
                                                'Mobile: ${req.requesterMobile}',
                                                style: const TextStyle(fontSize: 11, color: Color(0xFF4F46E5)),
                                              ),
                                            ],
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ] else if (req.displayNotes != null && req.displayNotes!.isNotEmpty) ...[
                                const SizedBox(height: 10),
                                Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: AppColors.surfaceContainerHigh,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    'Note: ${req.displayNotes}',
                                    style: AppTypography.bodySmall.copyWith(
                                      color: AppColors.textSecondary,
                                      fontStyle: FontStyle.italic,
                                    ),
                                  ),
                                ),
                              ],

                              const SizedBox(height: 14),

                              // Action Buttons
                              Row(
                                children: [
                                  if (req.requestType == 'order_ready') ...[
                                    Expanded(
                                      child: AppButton(
                                        label: 'Mark as Served',
                                        icon: LucideIcons.checkCheck,
                                        onPressed: () async {
                                          FeedbackUtils.successHaptic();
                                          String? itemId;
                                          String? orderId;
                                          String? tableId = req.tableId;
                                          if (req.additionalNotes != null && req.additionalNotes!.isNotEmpty) {
                                            try {
                                              final data = jsonDecode(req.additionalNotes!);
                                              if (data is Map) {
                                                itemId = data['item_id']?.toString();
                                                orderId = data['order_id']?.toString();
                                                if (data['table_id'] != null) tableId = data['table_id'].toString();
                                              }
                                            } catch (_) {}
                                          }

                                          if (itemId != null && itemId.isNotEmpty) {
                                            await ref.read(ordersControllerProvider.notifier).markItemServed(itemId);
                                          } else if (orderId != null && orderId.isNotEmpty) {
                                            await ref.read(ordersControllerProvider.notifier).markServed(orderId, tableId ?? '');
                                          } else {
                                            await requestsNotifier.completeRequest(req.id);
                                          }

                                          ref.read(tablesControllerProvider.notifier).loadData(silent: true);
                                          if (context.mounted) {
                                            FeedbackUtils.showToast(context, message: '${req.formattedTitle} marked as Served!');
                                          }
                                        },
                                      ),
                                    ),
                                  ] else if (req.isTableAccessRequest && req.isPending) ...[
                                    Expanded(
                                      flex: 2,
                                      child: AppButton(
                                        label: 'Decline',
                                        variant: ButtonVariant.secondary,
                                        onPressed: () {
                                          FeedbackUtils.selectionHaptic();
                                          final approverId = session?.userId ?? session?.employeeId ?? '';
                                          requestsNotifier.declineTableAccess(
                                            requestId: req.id,
                                            declinerId: approverId,
                                          );
                                        },
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      flex: 3,
                                      child: AppButton(
                                        label: 'Approve',
                                        icon: LucideIcons.checkCheck,
                                        onPressed: () {
                                          FeedbackUtils.selectionHaptic();
                                          final approverId = session?.userId ?? session?.employeeId ?? '5b3a8b19-8682-4194-bd28-9a1886f4da67';
                                          TableAccessRequestSheet.show(
                                            context,
                                            request: req,
                                            onApprove: (transferType) async {
                                              try {
                                                await requestsNotifier.approveTableAccess(
                                                  requestId: req.id,
                                                  approverId: approverId,
                                                  transferType: transferType,
                                                );
                                                ref.read(tablesControllerProvider.notifier).loadData(silent: true);
                                                if (context.mounted) {
                                                  final msg = transferType == 'transfer'
                                                      ? 'Table ${req.formattedTableName} transferred'
                                                      : 'Shared access granted for ${req.formattedTableName} (Both can manage)';
                                                  FeedbackUtils.showToast(context, message: msg);
                                                }
                                              } catch (e) {
                                                if (context.mounted) {
                                                  FeedbackUtils.showToast(context, message: 'Failed to approve: $e', isError: true);
                                                }
                                              }
                                            },
                                            onDecline: () {
                                              requestsNotifier.declineTableAccess(
                                                requestId: req.id,
                                                declinerId: approverId,
                                              );
                                            },
                                          );
                                        },
                                      ),
                                    ),
                                  ] else if (req.isPending) ...[
                                    Expanded(
                                      child: AppButton(
                                        label: 'Accept Request',
                                        icon: LucideIcons.check,
                                        onPressed: () {
                                          FeedbackUtils.successHaptic();
                                          final waiterId = session?.userId ?? session?.employeeId ?? '5b3a8b19-8682-4194-bd28-9a1886f4da67';
                                          requestsNotifier.acceptRequest(req.id, waiterId);
                                        },
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    InkWell(
                                      onTap: () async {
                                        FeedbackUtils.lightHaptic();
                                        await requestsNotifier.completeRequest(req.id);
                                      },
                                      borderRadius: BorderRadius.circular(14),
                                      child: Container(
                                        width: 52,
                                        height: 52,
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFEEF2F6),
                                          borderRadius: BorderRadius.circular(14),
                                          border: Border.all(color: Colors.white.withValues(alpha: 0.85), width: 1),
                                          boxShadow: const [
                                            BoxShadow(
                                              color: Color(0x59A6B4C8),
                                              blurRadius: 6,
                                              offset: Offset(2.5, 2.5),
                                            ),
                                            BoxShadow(
                                              color: Color(0xF2FFFFFF),
                                              blurRadius: 6,
                                              offset: Offset(-2.5, -2.5),
                                            ),
                                          ],
                                        ),
                                        child: const Center(
                                          child: Icon(LucideIcons.x, size: 18, color: Color(0xFF64748B)),
                                        ),
                                      ),
                                    ),
                                  ] else if (req.isAccepted) ...[
                                    Expanded(
                                      child: AppButton(
                                        label: 'Mark as Completed',
                                        icon: LucideIcons.checkCheck,
                                        variant: ButtonVariant.secondary,
                                        onPressed: () {
                                          FeedbackUtils.successHaptic();
                                          requestsNotifier.completeRequest(req.id);
                                        },
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
      ),
    );
  }
}

class RequestTimerBadge extends StatefulWidget {
  final DateTime? createdAt;
  const RequestTimerBadge({super.key, this.createdAt});

  @override
  State<RequestTimerBadge> createState() => _RequestTimerBadgeState();
}

class _RequestTimerBadgeState extends State<RequestTimerBadge> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  void _startTimer() {
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        setState(() {});
      }
    });
  }

  @override
  void didUpdateWidget(covariant RequestTimerBadge oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.createdAt != widget.createdAt) {
      setState(() {});
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final created = widget.createdAt ?? DateTime.now();
    final diff = DateTime.now().difference(created);
    final isWarning = diff.inMinutes >= 5 && diff.inMinutes < 10;
    final isUrgent = diff.inMinutes >= 10;

    final timerColor = isUrgent
        ? const Color(0xFFDC2626) // Crimson Red
        : isWarning
            ? const Color(0xFFD97706) // Amber / Orange
            : AppColors.textSecondary;

    final bgColor = isUrgent
        ? const Color(0xFFFEF2F2)
        : isWarning
            ? const Color(0xFFFFFBEB)
            : AppColors.surfaceContainerHighest;

    final border = (isUrgent || isWarning)
        ? Border.all(
            color: isUrgent ? const Color(0xFFFCA5A5) : const Color(0xFFFCD34D),
            width: 1,
          )
        : null;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(6),
        border: border,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(LucideIcons.clock, size: 11, color: timerColor),
          const SizedBox(width: 3.5),
          Text(
            Formatters.formatLiveTimer(created),
            style: TextStyle(
              color: timerColor,
              fontSize: 10.5,
              fontWeight: FontWeight.w800,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}
