import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../config/app_config.dart';
import '../theme/app_colors.dart';

class AppNetworkImage extends StatelessWidget {
  final String? imageUrl;
  final String? name;
  final double? width;
  final double? height;
  final BoxFit fit;
  final BorderRadius? borderRadius;
  final IconData fallbackIcon;

  const AppNetworkImage({
    super.key,
    required this.imageUrl,
    this.name,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.borderRadius,
    this.fallbackIcon = LucideIcons.utensils,
  });

  String? _resolveAssetPath(String? url, String? itemName) {
    if (url != null && url.isNotEmpty) {
      final uri = url.split('?').first;
      final filename = uri.split('/').last;
      if (filename.isNotEmpty && (filename.endsWith('.jpeg') || filename.endsWith('.jpg') || filename.endsWith('.png') || filename.endsWith('.webp'))) {
        return 'assets/menu/$filename';
      }
    }

    if (itemName != null && itemName.isNotEmpty) {
      final slug = itemName.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), '-').replaceAll(RegExp(r'^-+|-+$'), '');
      return 'assets/menu/$slug.jpeg';
    }

    return null;
  }

  String? _resolveNetworkUrl(String? url) {
    if (url == null || url.trim().isEmpty) return null;
    final clean = url.trim();
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      return clean;
    }
    if (clean.startsWith('/')) {
      return '${AppConfig.baseApiUrl}$clean';
    }
    return '${AppConfig.baseApiUrl}/$clean';
  }

  @override
  Widget build(BuildContext context) {
    final netUrl = _resolveNetworkUrl(imageUrl);
    final assetPath = _resolveAssetPath(imageUrl, name);

    Widget imageWidget;

    if (netUrl != null && (netUrl.startsWith('http://') || netUrl.startsWith('https://'))) {
      imageWidget = CachedNetworkImage(
        imageUrl: netUrl,
        width: width,
        height: height,
        fit: fit,
        placeholder: (context, url) => Container(
          width: width,
          height: height,
          color: AppColors.surfaceContainerHigh,
          child: const Center(
            child: SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
            ),
          ),
        ),
        errorWidget: (context, url, error) => _buildFallback(),
      );
    } else if (imageUrl != null && imageUrl!.startsWith('assets/')) {
      imageWidget = Image.asset(
        imageUrl!,
        width: width,
        height: height,
        fit: fit,
        errorBuilder: (_, __, ___) => _buildFallback(),
      );
    } else {
      imageWidget = _buildFallback();
    }

    if (borderRadius != null) {
      return ClipRRect(
        borderRadius: borderRadius!,
        child: imageWidget,
      );
    }

    return imageWidget;
  }

  Widget _buildFallback() {
    return Container(
      width: width,
      height: height,
      color: AppColors.surfaceContainerHigh,
      child: Center(
        child: Icon(
          fallbackIcon,
          size: (width != null && width! < 40) ? 16 : 22,
          color: AppColors.textSecondary,
        ),
      ),
    );
  }
}
