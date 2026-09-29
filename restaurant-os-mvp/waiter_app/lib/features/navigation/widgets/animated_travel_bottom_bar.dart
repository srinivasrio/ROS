import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/feedback_utils.dart';

class NavDestinationItem {
  final IconData icon;
  final IconData selectedIcon;
  final String label;
  final int badgeCount;

  const NavDestinationItem({
    required this.icon,
    required this.selectedIcon,
    required this.label,
    this.badgeCount = 0,
  });
}

class AnimatedTravelBottomBar extends StatefulWidget {
  final int selectedIndex;
  final ValueChanged<int> onDestinationSelected;
  final List<NavDestinationItem> destinations;

  const AnimatedTravelBottomBar({
    super.key,
    required this.selectedIndex,
    required this.onDestinationSelected,
    required this.destinations,
  });

  @override
  State<AnimatedTravelBottomBar> createState() => _AnimatedTravelBottomBarState();
}

class _AnimatedTravelBottomBarState extends State<AnimatedTravelBottomBar>
    with TickerProviderStateMixin {
  late AnimationController _travelController;
  late Animation<double> _travelAnimation;

  late AnimationController _bounceController;
  late Animation<double> _scaleAnimation;

  double _fromIndex = 0.0;
  double _toIndex = 0.0;
  int _activeTappedIndex = 0;

  @override
  void initState() {
    super.initState();
    _fromIndex = widget.selectedIndex.toDouble();
    _toIndex = widget.selectedIndex.toDouble();
    _activeTappedIndex = widget.selectedIndex;

    // 1. Ultra-smooth travel glide animation (Material 3 Emphasized Curve)
    _travelController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 380),
    );

    _travelAnimation = CurvedAnimation(
      parent: _travelController,
      curve: Curves.easeInOutCubicEmphasized,
    );

    // 2. Subtle spring bounce on active tab
    _bounceController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 280),
    );

    _scaleAnimation = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween(begin: 1.0, end: 0.88).chain(CurveTween(curve: Curves.easeOut)),
        weight: 30,
      ),
      TweenSequenceItem(
        tween: Tween(begin: 0.88, end: 1.14).chain(CurveTween(curve: Curves.easeOutBack)),
        weight: 45,
      ),
      TweenSequenceItem(
        tween: Tween(begin: 1.14, end: 1.0).chain(CurveTween(curve: Curves.easeIn)),
        weight: 25,
      ),
    ]).animate(_bounceController);
  }

  @override
  void didUpdateWidget(covariant AnimatedTravelBottomBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.selectedIndex != widget.selectedIndex) {
      _animateTo(widget.selectedIndex);
    }
  }

  @override
  void dispose() {
    _travelController.dispose();
    _bounceController.dispose();
    super.dispose();
  }

  void _animateTo(int targetIndex) {
    _fromIndex = _getCurrentPosition();
    _toIndex = targetIndex.toDouble();
    _activeTappedIndex = targetIndex;

    _travelController.forward(from: 0.0);
    _bounceController.forward(from: 0.0);
  }

  double _getCurrentPosition() {
    if (!_travelController.isAnimating) {
      return _toIndex;
    }
    return _fromIndex + (_toIndex - _fromIndex) * _travelAnimation.value;
  }

  void _handleTap(int index) {
    if (widget.selectedIndex != index) {
      FeedbackUtils.selectionHaptic();
      _animateTo(index);
      widget.onDestinationSelected(index);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    return Container(
      padding: EdgeInsets.fromLTRB(14, 8, 14, bottomPadding > 0 ? bottomPadding + 4 : 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: const Border(
          top: BorderSide(color: AppColors.border, width: 0.8),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.035),
            blurRadius: 16,
            offset: const Offset(0, -4),
          ),
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.025),
            blurRadius: 20,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final totalWidth = constraints.maxWidth;
          final itemCount = widget.destinations.length;
          final tabWidth = totalWidth / itemCount;
          const capsulePadding = 3.0;
          final baseCapsuleWidth = tabWidth - (capsulePadding * 2);

          return SizedBox(
            height: 58,
            child: Stack(
              children: [
                // 1. Fluid Smooth Traveling Capsule (with Elastic Stretch)
                AnimatedBuilder(
                  animation: _travelAnimation,
                  builder: (context, child) {
                    final t = _travelAnimation.value;
                    final isMovingForward = _toIndex >= _fromIndex;

                    // Elastic leading & trailing physics for organic liquid stretch
                    final leadingT = isMovingForward
                        ? Curves.easeOutCubic.transform(t)
                        : Curves.easeInCubic.transform(t);
                    final trailingT = isMovingForward
                        ? Curves.easeInCubic.transform(t)
                        : Curves.easeOutCubic.transform(t);

                    final leftPos = isMovingForward
                        ? (_fromIndex * tabWidth) + ((_toIndex - _fromIndex) * tabWidth * trailingT) + capsulePadding
                        : (_fromIndex * tabWidth) + ((_toIndex - _fromIndex) * tabWidth * leadingT) + capsulePadding;

                    final rightPos = isMovingForward
                        ? ((_fromIndex + 1) * tabWidth) + ((_toIndex - _fromIndex) * tabWidth * leadingT) - capsulePadding
                        : ((_fromIndex + 1) * tabWidth) + ((_toIndex - _fromIndex) * tabWidth * trailingT) - capsulePadding;

                    final currentWidth = (rightPos - leftPos).clamp(baseCapsuleWidth * 0.9, tabWidth * 2.2);

                    return Positioned(
                      left: leftPos,
                      top: 4,
                      width: currentWidth,
                      height: 50,
                      child: child!,
                    );
                  },
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          AppColors.primaryLight,
                          AppColors.primaryLight.withValues(alpha: 0.65),
                        ],
                      ),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(
                        color: AppColors.primary.withValues(alpha: 0.32),
                        width: 1.2,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primary.withValues(alpha: 0.10),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                  ),
                ),

                // 2. Navigation Destination Items Row
                Row(
                  children: List.generate(itemCount, (index) {
                    final item = widget.destinations[index];
                    final isSelected = widget.selectedIndex == index;

                    return Expanded(
                      child: Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: () => _handleTap(index),
                          splashColor: AppColors.primary.withValues(alpha: 0.08),
                          highlightColor: Colors.transparent,
                          borderRadius: BorderRadius.circular(18),
                          child: SizedBox(
                            height: 58,
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                // Icon with Badge and Spring Scale
                                AnimatedBuilder(
                                  animation: _scaleAnimation,
                                  builder: (context, child) {
                                    final scale = (isSelected && _activeTappedIndex == index)
                                        ? _scaleAnimation.value
                                        : (isSelected ? 1.08 : 0.96);

                                    return Transform.scale(
                                      scale: scale,
                                      child: Stack(
                                        clipBehavior: Clip.none,
                                        children: [
                                          AnimatedSwitcher(
                                            duration: const Duration(milliseconds: 220),
                                            switchInCurve: Curves.easeOut,
                                            switchOutCurve: Curves.easeIn,
                                            transitionBuilder: (child, animation) {
                                              return FadeTransition(
                                                opacity: animation,
                                                child: ScaleTransition(
                                                  scale: Tween(begin: 0.88, end: 1.0).animate(animation),
                                                  child: child,
                                                ),
                                              );
                                            },
                                            child: Icon(
                                              isSelected ? item.selectedIcon : item.icon,
                                              key: ValueKey<bool>(isSelected),
                                              size: 21,
                                              color: isSelected
                                                  ? AppColors.primary
                                                  : AppColors.textSecondary.withValues(alpha: 0.65),
                                            ),
                                          ),

                                          // Notification Badge for pending requests
                                          if (item.badgeCount > 0)
                                            Positioned(
                                              top: -4,
                                              right: -8,
                                              child: Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                                                decoration: BoxDecoration(
                                                  color: AppColors.primary,
                                                  borderRadius: BorderRadius.circular(10),
                                                  border: Border.all(color: Colors.white, width: 1.5),
                                                  boxShadow: [
                                                    BoxShadow(
                                                      color: AppColors.primary.withValues(alpha: 0.4),
                                                      blurRadius: 4,
                                                      offset: const Offset(0, 1),
                                                    ),
                                                  ],
                                                ),
                                                constraints: const BoxConstraints(
                                                  minWidth: 16,
                                                  minHeight: 16,
                                                ),
                                                child: Center(
                                                  child: Text(
                                                    item.badgeCount > 99 ? '99+' : '${item.badgeCount}',
                                                    style: AppTypography.labelSmall.copyWith(
                                                      color: Colors.white,
                                                      fontSize: 9,
                                                      fontWeight: FontWeight.w900,
                                                      height: 1.0,
                                                    ),
                                                  ),
                                                ),
                                              ),
                                            ),
                                        ],
                                      ),
                                    );
                                  },
                                ),
                                const SizedBox(height: 3),

                                // Animated Label Text with Crossfade
                                AnimatedDefaultTextStyle(
                                  duration: const Duration(milliseconds: 220),
                                  curve: Curves.easeInOutCubic,
                                  style: AppTypography.labelSmall.copyWith(
                                    color: isSelected ? AppColors.primary : AppColors.textMuted,
                                    fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                                    fontSize: isSelected ? 11 : 10.5,
                                    letterSpacing: isSelected ? -0.1 : 0.0,
                                  ),
                                  child: Text(
                                    item.label,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    );
                  }),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
