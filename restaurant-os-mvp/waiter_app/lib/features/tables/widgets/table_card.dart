import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../orders/orders_controller.dart';
import '../table_models.dart';

class TableCard extends ConsumerWidget {
  final TableModel table;
  final VoidCallback onTap;
  final VoidCallback? onLongPress;
  final bool isSelected;
  final bool isSelecting;

  const TableCard({
    super.key,
    required this.table,
    required this.onTap,
    this.onLongPress,
    this.isSelected = false,
    this.isSelecting = false,
  });

  String get _formattedDuration {
    final start = table.customerPresentAt ?? table.lastActivityAt;
    if (start == null) return '';
    final diff = DateTime.now().difference(start);
    if (diff.inMinutes < 1) return '';
    if (diff.inMinutes < 60) {
      return '${diff.inMinutes.clamp(1, 59)}m';
    } else {
      final hours = diff.inHours;
      final mins = diff.inMinutes % 60;
      return '${hours}h ${mins}m';
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activeOrders = ref.watch(activeOrdersProvider);
    final orderForTable = activeOrders.where((o) {
      final tNum = table.tableNumber.trim().toLowerCase();
      final tName = table.formattedName.replaceAll('Table ', '').trim().toLowerCase();
      final dispName = (table.displayName ?? '').replaceAll('Table ', '').trim().toLowerCase();
      final oTableId = o.tableId.trim();
      final oTableNum = (o.tableNumber ?? '').trim().toLowerCase();

      return oTableId == table.id ||
          (oTableNum.isNotEmpty && (oTableNum == tNum || oTableNum == tName || oTableNum == dispName)) ||
          (table.mergedGroupId != null && (oTableId == table.mergedGroupId || oTableNum == dispName)) ||
          table.mergedTableIds.contains(oTableId);
    }).firstOrNull;

    final readyItemsCount = orderForTable?.items.where((i) => i.isReady).length ?? 0;
    final preparingItemsCount = orderForTable?.items.where((i) => i.isPreparing).length ?? 0;

    final rawStatus = table.status.toLowerCase();
    final isReady = readyItemsCount > 0 || rawStatus == 'ready';
    final isPreparing = !isReady && (preparingItemsCount > 0 || ['preparing', 'cooking', 'placed'].contains(rawStatus));
    final isAvailable = table.isAvailable;
    final isNeedBill = table.isNeedBill;
    final isDirty = table.isDirty;
    final isReserved = table.isReserved;
    final isOnHold = table.isOnHold;

    // ── Dynamic 4 Card Background Colors matching Waiter Web Panel ──
    // 1. Ready: #8F87F1 (Lavender / Soft Purple)
    // 2. Preparing: #FFDE63 (Warm Butter Yellow)
    // 3. Available: #ABE7B2 (Fresh Mint Green)
    // 4. Assigned / In-Service: #8CA9FF (Periwinkle Blue)
    final Color cardBgColor = isReady
        ? const Color(0xFF8F87F1)
        : isPreparing
            ? const Color(0xFFFFDE63)
            : isAvailable
                ? const Color(0xFFABE7B2)
                : const Color(0xFF8CA9FF);

    final assigned = !isAvailable ? (table.assignedWaiterName ?? '').trim() : '';
    final assignedAvatar = !isAvailable && table.assignedWaiterAvatar != null && table.assignedWaiterAvatar!.trim().isNotEmpty && table.assignedWaiterAvatar != 'null'
        ? table.assignedWaiterAvatar!.trim()
        : null;
    final hasAssignedWaiter = !isAvailable && (assigned.isNotEmpty || assignedAvatar != null || (table.assignedWaiterId != null && table.assignedWaiterId!.isNotEmpty));

    final coNames = <String>[];
    if (!isAvailable && table.coWaiterNames != null && table.coWaiterNames!.trim().isNotEmpty) {
      coNames.addAll(table.coWaiterNames!.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty));
    }

    final isTransferred = !isAvailable && table.isTransferred;
    final duration = _formattedDuration;
    final showDuration = !isAvailable && duration.isNotEmpty;

    // Status dot color & label
    Color statusDotColor;
    String statusLabel;
    if (isReady) {
      statusDotColor = const Color(0xFF6D28D9);
      statusLabel = readyItemsCount > 0 ? '$readyItemsCount Ready to Serve' : 'Ready to Serve';
    } else if (isPreparing) {
      statusDotColor = const Color(0xFFD97706);
      statusLabel = preparingItemsCount > 0 ? '$preparingItemsCount Preparing' : 'Preparing';
    } else if (isAvailable) {
      statusDotColor = const Color(0xFF059669);
      statusLabel = 'Available';
    } else if (isNeedBill) {
      statusDotColor = const Color(0xFF7C3AED);
      statusLabel = 'Need Bill';
    } else if (isDirty) {
      statusDotColor = const Color(0xFF475569);
      statusLabel = 'Needs Cleaning';
    } else if (isReserved) {
      statusDotColor = const Color(0xFF4F46E5);
      statusLabel = 'Reserved';
    } else if (isOnHold) {
      statusDotColor = const Color(0xFF0284C7);
      statusLabel = 'On Hold';
    } else {
      statusDotColor = const Color(0xFF2563EB);
      statusLabel = assigned.isNotEmpty ? 'Assigned ($assigned)' : 'Occupied';
    }

    final name = table.formattedName.replaceAll(RegExp(r'\s*\+\s*'), '+');
    final isMergedName = name.contains('+');
    final isLongName = name.length > 8;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        onLongPress: onLongPress,
        borderRadius: BorderRadius.circular(22),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          width: double.infinity,
          decoration: BoxDecoration(
            color: cardBgColor,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(
              color: isSelected ? const Color(0xFFFF6B35) : const Color(0xFF000000),
              width: isSelected ? 2.5 : 1.5,
            ),
            boxShadow: isSelected
                ? [
                    const BoxShadow(
                      color: Color(0x59FF6B35),
                      blurRadius: 15,
                      offset: Offset(5, 5),
                    ),
                    const BoxShadow(
                      color: Color(0xCCFFFFFF),
                      blurRadius: 10,
                      offset: Offset(-3, -3),
                    ),
                  ]
                : [
                    const BoxShadow(
                      color: Color(0x14000000),
                      blurRadius: 10,
                      offset: Offset(4, 4),
                    ),
                    const BoxShadow(
                      color: Color(0x99FFFFFF),
                      blurRadius: 8,
                      offset: Offset(-2, -2),
                    ),
                  ],
          ),
          padding: const EdgeInsets.all(12),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Top Row: Capacity & Indicators (Left) + Table Name (Right) ──
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // Left side: Selection checkbox / Capacity pill / Merged / Pinned
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (isSelecting || isSelected) ...[
                        Container(
                          width: 20,
                          height: 20,
                          margin: const EdgeInsets.only(right: 5),
                          decoration: BoxDecoration(
                            color: isSelected ? const Color(0xFFFF6B35) : Colors.white.withValues(alpha: 0.65),
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: isSelected ? const Color(0xFFFF6B35) : const Color(0x33000000),
                              width: 1.2,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: isSelected ? const Color(0x59FF6B35) : Colors.black.withValues(alpha: 0.05),
                                blurRadius: 4,
                                offset: const Offset(0, 1),
                              ),
                            ],
                          ),
                          child: isSelected
                              ? const Center(
                                  child: Icon(Icons.check, size: 12, color: Colors.white),
                                )
                              : null,
                        ),
                      ],

                      // Neumorphic Capacity Pill
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.65),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.7), width: 1),
                          boxShadow: const [
                            BoxShadow(
                              color: Color(0x10000000),
                              blurRadius: 2,
                              offset: Offset(1, 1),
                            ),
                          ],
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(LucideIcons.users, size: 10, color: Color(0xFF334155)),
                            const SizedBox(width: 3),
                            Text(
                              '${table.capacity}',
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF1E293B),
                              ),
                            ),
                          ],
                        ),
                      ),

                      if (table.isMerged) ...[
                        const SizedBox(width: 4),
                        Container(
                          width: 20,
                          height: 20,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.65),
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white.withValues(alpha: 0.7), width: 1),
                          ),
                          child: const Center(
                            child: Icon(LucideIcons.link2, size: 10, color: Color(0xFF0F172A)),
                          ),
                        ),
                      ],

                      if (table.displayName?.contains('Pinned') == true && !isSelecting) ...[
                        const SizedBox(width: 4),
                        Container(
                          width: 20,
                          height: 20,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.65),
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white.withValues(alpha: 0.7), width: 1),
                          ),
                          child: Center(
                            child: Container(
                              width: 6,
                              height: 6,
                              decoration: const BoxDecoration(
                                color: Color(0xFFD97706),
                                shape: BoxShape.circle,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),

                  // Right side: Table Name
                  Flexible(
                    child: Text(
                      name,
                      style: TextStyle(
                        fontFamily: 'Outfit',
                        fontWeight: FontWeight.w900,
                        fontSize: isLongName || isMergedName ? 15 : 18,
                        letterSpacing: -0.3,
                        color: isSelected ? const Color(0xFFFF6B35) : const Color(0xFF0F172A),
                      ),
                      textAlign: TextAlign.right,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),

              // ── Center Content: Assigned Waiter or Operational Alert ──
              Expanded(
                child: Center(
                  child: hasAssignedWaiter
                      ? Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            // Kitchen Alert Pill above avatar if any
                            if (isReady) ...[
                              Container(
                                margin: const EdgeInsets.only(bottom: 3),
                                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(color: const Color(0xFFD8B4FE), width: 1),
                                  boxShadow: const [
                                    BoxShadow(color: Color(0x10000000), blurRadius: 2, offset: Offset(0, 1)),
                                  ],
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Icon(LucideIcons.chefHat, size: 9, color: Color(0xFF7E22CE)),
                                    const SizedBox(width: 3),
                                    Text(
                                      readyItemsCount > 0 ? '$readyItemsCount Ready' : 'Ready',
                                      style: const TextStyle(
                                        fontSize: 9,
                                        fontWeight: FontWeight.w900,
                                        color: Color(0xFF3B0764),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ] else if (isPreparing) ...[
                              Container(
                                margin: const EdgeInsets.only(bottom: 3),
                                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(color: const Color(0xFFFCD34D), width: 1),
                                  boxShadow: const [
                                    BoxShadow(color: Color(0x10000000), blurRadius: 2, offset: Offset(0, 1)),
                                  ],
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Icon(LucideIcons.utensils, size: 8.5, color: Color(0xFFB45309)),
                                    const SizedBox(width: 3),
                                    Text(
                                      preparingItemsCount > 0 ? '$preparingItemsCount Prep' : 'Prep',
                                      style: const TextStyle(
                                        fontSize: 9,
                                        fontWeight: FontWeight.w900,
                                        color: Color(0xFF78350F),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ] else if (isTransferred) ...[
                              Container(
                                margin: const EdgeInsets.only(bottom: 3),
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(color: const Color(0xFFF472B6), width: 0.8),
                                ),
                                child: Text(
                                  '${table.transferredFromWaiterName ?? "W"} ➔ ${table.transferredToWaiterName ?? "W"}',
                                  style: const TextStyle(
                                    fontSize: 8.5,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFFBE185D),
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],

                            // Waiter Avatar Ring + Image
                            Stack(
                              clipBehavior: Clip.none,
                              children: [
                                Container(
                                  width: 44,
                                  height: 44,
                                  padding: const EdgeInsets.all(2),
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    gradient: LinearGradient(
                                      colors: [
                                        Colors.white.withValues(alpha: 0.95),
                                        Colors.white.withValues(alpha: 0.6),
                                      ],
                                      begin: Alignment.topLeft,
                                      end: Alignment.bottomRight,
                                    ),
                                    boxShadow: const [
                                      BoxShadow(
                                        color: Color(0x1F000000),
                                        blurRadius: 8,
                                        offset: Offset(0, 3),
                                      ),
                                    ],
                                  ),
                                  child: ClipRRect(
                                    borderRadius: BorderRadius.circular(22),
                                    child: assignedAvatar != null
                                        ? CachedNetworkImage(
                                            imageUrl: assignedAvatar,
                                            fit: BoxFit.cover,
                                            placeholder: (_, __) => _buildAvatarFallback(assigned),
                                            errorWidget: (_, __, ___) => _buildAvatarFallback(assigned),
                                          )
                                        : _buildAvatarFallback(assigned),
                                  ),
                                ),

                                // Co-waiters count indicator
                                if (coNames.isNotEmpty)
                                  Positioned(
                                    bottom: -1,
                                    right: -3,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF4F46E5),
                                        borderRadius: BorderRadius.circular(10),
                                        border: Border.all(color: Colors.white, width: 1.5),
                                      ),
                                      child: Text(
                                        '+${coNames.length}',
                                        style: const TextStyle(
                                          fontSize: 8.5,
                                          fontWeight: FontWeight.w900,
                                          color: Colors.white,
                                        ),
                                      ),
                                    ),
                                  ),
                              ],
                            ),

                            // Waiter Name text
                            const SizedBox(height: 3),
                            Text(
                              assigned.isNotEmpty ? assigned : (coNames.isNotEmpty ? coNames.join(', ') : 'Assigned'),
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF0F172A),
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              textAlign: TextAlign.center,
                            ),
                          ],
                        )
                      : isReady
                          ? Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(color: const Color(0xFFD8B4FE), width: 1),
                                boxShadow: const [
                                  BoxShadow(color: Color(0x10000000), blurRadius: 4, offset: Offset(0, 1)),
                                ],
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(LucideIcons.chefHat, size: 12, color: Color(0xFF7E22CE)),
                                  const SizedBox(width: 4),
                                  Text(
                                    readyItemsCount > 0 ? '$readyItemsCount Ready to Serve' : 'Ready to Serve',
                                    style: const TextStyle(
                                      fontSize: 10.5,
                                      fontWeight: FontWeight.w900,
                                      color: Color(0xFF3B0764),
                                    ),
                                  ),
                                ],
                              ),
                            )
                          : isPreparing
                              ? Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(color: const Color(0xFFFCD34D), width: 1),
                                    boxShadow: const [
                                      BoxShadow(color: Color(0x10000000), blurRadius: 4, offset: Offset(0, 1)),
                                    ],
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Icon(LucideIcons.utensils, size: 11, color: Color(0xFFB45309)),
                                      const SizedBox(width: 4),
                                      Text(
                                        preparingItemsCount > 0 ? '$preparingItemsCount Preparing' : 'Preparing',
                                        style: const TextStyle(
                                          fontSize: 10.5,
                                          fontWeight: FontWeight.w900,
                                          color: Color(0xFF78350F),
                                        ),
                                      ),
                                    ],
                                  ),
                                )
                              : isAvailable
                                  ? Column(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Container(
                                          width: 32,
                                          height: 32,
                                          decoration: BoxDecoration(
                                            color: Colors.white.withValues(alpha: 0.5),
                                            shape: BoxShape.circle,
                                          ),
                                          child: const Center(
                                            child: Icon(LucideIcons.sparkles, size: 15, color: Color(0xFF065F46)),
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        const Text(
                                          'Ready to Seat',
                                          style: TextStyle(
                                            fontSize: 10.5,
                                            fontWeight: FontWeight.w900,
                                            color: Color(0xFF064E3B),
                                          ),
                                        ),
                                      ],
                                    )
                                  : isDirty
                                      ? Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                          decoration: BoxDecoration(
                                            color: Colors.white,
                                            borderRadius: BorderRadius.circular(20),
                                            border: Border.all(color: const Color(0xFFCBD5E1), width: 1),
                                          ),
                                          child: const Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              Icon(LucideIcons.sparkles, size: 10, color: Color(0xFF475569)),
                                              SizedBox(width: 3),
                                              Text(
                                                'Ready for cleaning',
                                                style: TextStyle(
                                                  fontSize: 10,
                                                  fontWeight: FontWeight.w800,
                                                  color: Color(0xFF334155),
                                                ),
                                              ),
                                            ],
                                          ),
                                        )
                                      : const Text(
                                          'In service',
                                          style: TextStyle(
                                            fontSize: 10.5,
                                            fontWeight: FontWeight.w800,
                                            color: Color(0xFF334155),
                                          ),
                                        ),
                ),
              ),

              // ── Bottom: Tactile Neumorphic Status Bar ──
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.72),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.7), width: 1),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x0A000000),
                      blurRadius: 3,
                      offset: Offset(0, 1),
                    ),
                  ],
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Status dot + Status label
                    Flexible(
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 7,
                            height: 7,
                            decoration: BoxDecoration(
                              color: statusDotColor,
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: statusDotColor.withValues(alpha: 0.5),
                                  blurRadius: 4,
                                  spreadRadius: 1,
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 5),
                          Flexible(
                            child: Text(
                              statusLabel,
                              style: const TextStyle(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF1E293B),
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Duration pill or Bill amount pill
                    if (isNeedBill && table.activeOrderTotal != null && table.activeOrderTotal! > 0)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF3E8FF),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: const Color(0xFFE9D5FF), width: 0.8),
                        ),
                        child: Text(
                          '₹${table.activeOrderTotal!.toInt()}',
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF581C87),
                          ),
                        ),
                      )
                    else if (showDuration)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.85),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.6), width: 0.8),
                        ),
                        child: Text(
                          duration,
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF334155),
                          ),
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
  }

  Widget _buildAvatarFallback(String name) {
    final initial = name.isNotEmpty ? name.substring(0, 1).toUpperCase() : 'W';
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFFFF6B00), Color(0xFFE0531A)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Center(
        child: Text(
          initial,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 16,
            fontWeight: FontWeight.w900,
            fontFamily: 'Outfit',
          ),
        ),
      ),
    );
  }
}
