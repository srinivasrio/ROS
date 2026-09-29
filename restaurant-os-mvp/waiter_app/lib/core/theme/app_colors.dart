import 'package:flutter/material.dart';

class AppColors {
  // Clean White / Light Canvas & Surfaces
  static const Color background = Color(0xFFF8FAFC); // Clean crisp slate-50
  static const Color surface = Color(0xFFFFFFFF);    // Pure white
  static const Color surfaceContainerLow = Color(0xFFF8FAFC);
  static const Color surfaceContainer = Color(0xFFFFFFFF);
  static const Color surfaceContainerHigh = Color(0xFFF1F5F9);
  static const Color surfaceContainerHighest = Color(0xFFE2E8F0);
  static const Color surfaceBright = Color(0xFFFFFFFF);
  static const Color surfaceMuted = Color(0xFFF1F5F9);

  // Primary Brand (Vibrant Coral Flame)
  static const Color primary = Color(0xFFFF6B35);
  static const Color primaryAccent = Color(0xFFFF7A45);
  static const Color primaryLight = Color(0xFFFFEDE4);
  static const Color onPrimary = Color(0xFFFFFFFF);
  static const Color primaryContainer = Color(0xFFFFEDE4);
  static const Color onPrimaryContainer = Color(0xFF9A3412);

  // Secondary & Neutral Variants
  static const Color secondary = Color(0xFF64748B);
  static const Color onSecondary = Color(0xFFFFFFFF);
  static const Color secondaryContainer = Color(0xFFF1F5F9);
  static const Color secondaryLight = Color(0xFFE2E8F0);
  static const Color secondaryDark = Color(0xFF334155);
  static const Color tertiary = Color(0xFF64748B);

  // Typography / Text Colors (High Contrast on White)
  static const Color textPrimary = Color(0xFF0F172A);   // Deep Slate 900
  static const Color textSecondary = Color(0xFF475569); // Slate 600
  static const Color textMuted = Color(0xFF94A3B8);     // Slate 400
  static const Color onBackground = Color(0xFF0F172A);
  static const Color onSurface = Color(0xFF0F172A);
  static const Color onSurfaceVariant = Color(0xFF475569);

  // Borders & Outlines
  static const Color border = Color(0xFFE2E8F0);        // Slate 200
  static const Color borderVariant = Color(0xFFCBD5E1); // Slate 300
  static const Color outline = Color(0xFF94A3B8);
  static const Color outlineVariant = Color(0xFFE2E8F0);

  // Semantic Operational Status Colors
  static const Color tableAvailable = Color(0xFF10B981); // Emerald Green
  static const Color tableOccupied = Color(0xFFF59E0B);  // Amber Gold
  static const Color tableNeedBill = Color(0xFF8B5CF6);  // Electric Purple
  static const Color tableDirty = Color(0xFF64748B);     // Slate Gray
  static const Color tableOnHold = Color(0xFF0284C7);    // Sky Blue
  static const Color tableReserved = Color(0xFF6366F1);  // Indigo

  // Status Aliases for Badges & Components
  static const Color ready = Color(0xFF10B981);
  static final Color readyBg = const Color(0xFF10B981).withValues(alpha: 0.12);
  static const Color readyBorder = Color(0xFF10B981);

  static const Color cooking = Color(0xFFF59E0B);
  static final Color cookingBg = const Color(0xFFF59E0B).withValues(alpha: 0.12);
  static const Color cookingBorder = Color(0xFFF59E0B);

  static const Color eating = Color(0xFFFF6B35);
  static final Color eatingBg = const Color(0xFFFF6B35).withValues(alpha: 0.12);
  static const Color eatingBorder = Color(0xFFFF6B35);

  static const Color onHold = Color(0xFF0284C7);
  static final Color onHoldBg = const Color(0xFF0284C7).withValues(alpha: 0.12);
  static const Color onHoldBorder = Color(0xFF0284C7);

  static const Color empty = Color(0xFF64748B);
  static final Color emptyBg = const Color(0xFF64748B).withValues(alpha: 0.10);
  static const Color emptyBorder = Color(0xFFCBD5E1);

  // Functional Alerts
  static const Color success = Color(0xFF10B981);
  static const Color error = Color(0xFFEF4444);
  static const Color onError = Color(0xFFFFFFFF);
  static const Color errorContainer = Color(0xFFFEE2E2);
  static const Color onErrorContainer = Color(0xFF991B1B);
  static const Color warning = Color(0xFFF59E0B);
  static const Color onWarning = Color(0xFFFFFFFF);
  static const Color info = Color(0xFF0284C7);

  // Dietary
  static const Color veg = Color(0xFF10B981);
  static const Color nonVeg = Color(0xFFEF4444);
  static const Color egg = Color(0xFFF59E0B);

  // Card Overlays & Shadows
  static const Color shadowColor = Color(0x0F0F172A);
}
