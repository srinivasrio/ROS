import 'dart:ui';
import 'package:flutter/material.dart';
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

    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, bottomPadding > 0 ? bottomPadding + 6 : 14),
      child: Center(
        heightFactor: 1.0,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 440),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(36),
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
              child: Container(
                padding: const EdgeInsets.all(5),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(36),
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Color(0xC7FFFFFF), // rgba(255, 255, 255, 0.78)
                      Color(0x99F3F6FB), // rgba(243, 246, 251, 0.60)
                      Color(0xBDFFFFFF), // rgba(255, 255, 255, 0.74)
                    ],
                  ),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.75),
                    width: 1.2,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF0F172A).withValues(alpha: 0.15),
                      blurRadius: 36,
                      offset: const Offset(0, 14),
                    ),
                    BoxShadow(
                      color: const Color(0xFF0F172A).withValues(alpha: 0.08),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Stack(
                  children: [
                    // Micro specular liquid gleam across top edge
                    Positioned(
                      top: 0,
                      left: 24,
                      right: 24,
                      height: 1,
                      child: Container(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              Colors.transparent,
                              Colors.white.withValues(alpha: 0.95),
                              Colors.transparent,
                            ],
                          ),
                        ),
                      ),
                    ),

                    LayoutBuilder(
                      builder: (context, constraints) {
                        final totalWidth = constraints.maxWidth;
                        final itemCount = widget.destinations.length;
                        final tabWidth = totalWidth / itemCount;
                        const capsulePadding = 3.0;
                        final baseCapsuleWidth = tabWidth - (capsulePadding * 2);

                        return SizedBox(
                          height: 52,
                          child: Stack(
                            children: [
                              // 1. Fluid Smooth Traveling Capsule (with Elastic Stretch & Vibrant Orange Gradient)
                              AnimatedBuilder(
                                animation: _travelAnimation,
                                builder: (context, child) {
                                  final t = _travelAnimation.value;
                                  final isMovingForward = _toIndex >= _fromIndex;

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
                                    top: 2,
                                    width: currentWidth,
                                    height: 48,
                                    child: child!,
                                  );
                                },
                                child: Container(
                                  decoration: BoxDecoration(
                                    gradient: const LinearGradient(
                                      begin: Alignment.topLeft,
                                      end: Alignment.bottomRight,
                                      colors: [
                                        Color(0xFFFF6B00), // #FF6B00
                                        Color(0xFFFF8533), // #FF8533
                                      ],
                                    ),
                                    borderRadius: BorderRadius.circular(26),
                                    border: Border.all(
                                      color: Colors.white.withValues(alpha: 0.35),
                                      width: 1.0,
                                    ),
                                    boxShadow: [
                                      BoxShadow(
                                        color: const Color(0xFFF97316).withValues(alpha: 0.50),
                                        blurRadius: 16,
                                        offset: const Offset(0, 4),
                                      ),
                                      BoxShadow(
                                        color: const Color(0xFFF97316).withValues(alpha: 0.30),
                                        blurRadius: 6,
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
                                        splashColor: Colors.transparent,
                                        highlightColor: Colors.transparent,
                                        borderRadius: BorderRadius.circular(26),
                                        child: SizedBox(
                                          height: 52,
                                          child: Column(
                                            mainAxisAlignment: MainAxisAlignment.center,
                                            children: [
                                              // Icon with Badge and Spring Scale
                                              AnimatedBuilder(
                                                animation: _scaleAnimation,
                                                builder: (context, child) {
                                                  final scale = (isSelected && _activeTappedIndex == index)
                                                      ? _scaleAnimation.value
                                                      : (isSelected ? 1.06 : 0.96);

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
                                                            size: 20,
                                                            color: isSelected
                                                                ? Colors.white
                                                                : const Color(0xFF64748B), // Slate 500
                                                            shadows: isSelected
                                                                ? [
                                                                    const Shadow(
                                                                      color: Color(0x33000000),
                                                                      offset: Offset(0, 1),
                                                                      blurRadius: 2,
                                                                    ),
                                                                  ]
                                                                : null,
                                                          ),
                                                        ),

                                                        // Notification Badge for pending requests
                                                        if (item.badgeCount > 0)
                                                          Positioned(
                                                            top: -4,
                                                            right: -8,
                                                            child: Container(
                                                              padding: const EdgeInsets.symmetric(horizontal: 4.5, vertical: 1.5),
                                                              decoration: BoxDecoration(
                                                                color: isSelected ? Colors.white : const Color(0xFFFF6B00),
                                                                borderRadius: BorderRadius.circular(10),
                                                                border: Border.all(
                                                                  color: isSelected ? const Color(0xFFFFEDD5) : Colors.white,
                                                                  width: 1.2,
                                                                ),
                                                                boxShadow: [
                                                                  BoxShadow(
                                                                    color: isSelected
                                                                        ? Colors.black.withValues(alpha: 0.1)
                                                                        : const Color(0xFFF97316).withValues(alpha: 0.4),
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
                                                                    color: isSelected ? const Color(0xFFEA580C) : Colors.white,
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
                                              const SizedBox(height: 2),

                                              // Animated Label Text with Crossfade
                                              AnimatedDefaultTextStyle(
                                                duration: const Duration(milliseconds: 220),
                                                curve: Curves.easeInOutCubic,
                                                style: AppTypography.labelSmall.copyWith(
                                                  color: isSelected ? Colors.white : const Color(0xFF64748B),
                                                  fontWeight: isSelected ? FontWeight.w900 : FontWeight.w600,
                                                  fontSize: isSelected ? 10.5 : 10,
                                                  letterSpacing: isSelected ? -0.2 : 0.0,
                                                  shadows: isSelected
                                                      ? [
                                                          const Shadow(
                                                            color: Color(0x33000000),
                                                            offset: Offset(0, 1),
                                                            blurRadius: 1.5,
                                                          ),
                                                        ]
                                                      : null,
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
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
