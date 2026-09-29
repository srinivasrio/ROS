import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import '../theme/app_colors.dart';

class LoadingSkeleton extends StatelessWidget {
  final double width;
  final double height;
  final double borderRadius;

  const LoadingSkeleton({
    super.key,
    required this.width,
    required this.height,
    this.borderRadius = 16,
  });

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: AppColors.surfaceContainer,
      highlightColor: AppColors.surfaceContainerHighest,
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: AppColors.surfaceContainer,
          borderRadius: BorderRadius.circular(borderRadius),
        ),
      ),
    );
  }
}

class GridSkeleton extends StatelessWidget {
  final int itemCount;

  const GridSkeleton({super.key, this.itemCount = 6});

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      physics: const NeverScrollableScrollPhysics(),
      shrinkWrap: true,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 14,
        mainAxisSpacing: 14,
        childAspectRatio: 1.05,
      ),
      itemCount: itemCount,
      itemBuilder: (context, index) {
        return const LoadingSkeleton(
          width: double.infinity,
          height: double.infinity,
          borderRadius: 16,
        );
      },
    );
  }
}

typedef TableGridSkeleton = GridSkeleton;

class ListSkeleton extends StatelessWidget {
  final int itemCount;

  const ListSkeleton({super.key, this.itemCount = 5});

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      physics: const NeverScrollableScrollPhysics(),
      shrinkWrap: true,
      itemCount: itemCount,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (_, __) => const LoadingSkeleton(
        width: double.infinity,
        height: 80,
        borderRadius: 16,
      ),
    );
  }
}
