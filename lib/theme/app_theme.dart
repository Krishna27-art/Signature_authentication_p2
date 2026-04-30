import 'package:flutter/material.dart';

class AppTheme {
  AppTheme._();

  static const Color background = Color(0xFF0A0E17);
  static const Color surface = Color(0xFF131A2B);
  static const Color surfaceLight = Color(0xFF1A2340);
  static const Color accent = Color(0xFF00E5C8);
  static const Color accentDim = Color(0x3300E5C8);
  static const Color success = Color(0xFF00E676);
  static const Color danger = Color(0xFFFF3D57);
  static const Color warning = Color(0xFFFFB74D);
  static const Color textPrimary = Color(0xFFE8ECF4);
  static const Color textSecondary = Color(0xFF7A8BA7);
  static const Color textMuted = Color(0xFF4A5568);
  static const Color canvasBorder = Color(0xFF1E2A45);
  static const Color strokeColor = Color(0xFF00E5C8);
  static const Color guideColor = Color(0xFF1E2A45);

  static ThemeData get darkTheme => ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: background,
        colorScheme: const ColorScheme.dark(
          primary: accent,
          secondary: accent,
          surface: surface,
          error: danger,
        ),
        textTheme: const TextTheme(
          headlineLarge: TextStyle(
            color: textPrimary,
            fontSize: 28,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.5,
          ),
          headlineMedium: TextStyle(
            color: textPrimary,
            fontSize: 22,
            fontWeight: FontWeight.w600,
          ),
          bodyLarge: TextStyle(
            color: textPrimary,
            fontSize: 16,
            fontWeight: FontWeight.w400,
          ),
          bodyMedium: TextStyle(
            color: textSecondary,
            fontSize: 14,
            fontWeight: FontWeight.w400,
          ),
          bodySmall: TextStyle(
            color: textMuted,
            fontSize: 12,
            fontWeight: FontWeight.w400,
          ),
          labelLarge: TextStyle(
            color: background,
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
      );
}