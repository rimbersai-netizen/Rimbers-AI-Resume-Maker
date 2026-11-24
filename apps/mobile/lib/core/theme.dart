import 'package:flutter/material.dart';

/// Rimbers design tokens (blue palette from the 2026-11-24 UI reference: images/Rimbers AI Resume Maker UI.png).
class Tokens {
  static const canvas = Color(0xFFEEF4FF);
  static const surface = Colors.white;
  static const subtle = Color(0xFFE1ECFF);
  static const navy = Color(0xFF0B1F5C);
  static const textPrimary = Color(0xFF0D1B4B);
  static const textSecondary = Color(0xFF55638A);
  static const brand = Color(0xFF1F5FE0);
  static const gradientA = Color(0xFF0E43B8);
  static const gradientB = Color(0xFF3B82FF);
  static const border = Color(0xFFD6E2F8);
  static const success = Color(0xFF22C55E);
  static const warning = Color(0xFFF59E0B);
  static const danger = Color(0xFFE5484D);

  static const gradient = LinearGradient(colors: [gradientA, gradientB]);
  static const rCard = 16.0, rInput = 12.0, rButton = 14.0;
  static const gutter = 16.0;
  static List<BoxShadow> get shadow => [BoxShadow(color: const Color(0xFF0B2A7A).withOpacity(0.08), blurRadius: 16, offset: const Offset(0, 4))];
}

ThemeData buildTheme() {
  final base = ThemeData(useMaterial3: true, colorScheme: ColorScheme.fromSeed(seedColor: Tokens.brand, surface: Tokens.surface));
  final text = base.textTheme.apply(bodyColor: Tokens.textPrimary, displayColor: Tokens.textPrimary);
  OutlineInputBorder border(Color c) => OutlineInputBorder(borderRadius: BorderRadius.circular(Tokens.rInput), borderSide: BorderSide(color: c));
  return base.copyWith(
    scaffoldBackgroundColor: Tokens.canvas,
    textTheme: text,
    appBarTheme: AppBarTheme(
      backgroundColor: Tokens.canvas, foregroundColor: Tokens.textPrimary, elevation: 0, scrolledUnderElevation: 0, centerTitle: true,
      titleTextStyle: text.titleMedium?.copyWith(fontWeight: FontWeight.w600, fontSize: 18)),
    inputDecorationTheme: InputDecorationTheme(
      filled: true, fillColor: Tokens.surface, contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      enabledBorder: border(Tokens.border), focusedBorder: border(Tokens.brand), errorBorder: border(Tokens.danger), focusedErrorBorder: border(Tokens.danger),
      border: border(Tokens.border)),
    cardTheme: CardThemeData(color: Tokens.surface, elevation: 0, margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Tokens.rCard), side: const BorderSide(color: Tokens.border))),
    navigationBarTheme: NavigationBarThemeData(backgroundColor: Tokens.surface, indicatorColor: Tokens.subtle,
      labelTextStyle: WidgetStatePropertyAll(text.labelSmall?.copyWith(fontWeight: FontWeight.w600))),
    chipTheme: base.chipTheme.copyWith(backgroundColor: Tokens.subtle, side: BorderSide.none, shape: const StadiumBorder()),
    snackBarTheme: SnackBarThemeData(behavior: SnackBarBehavior.floating, backgroundColor: Tokens.navy, contentTextStyle: text.bodyMedium?.copyWith(color: Colors.white)),
  );
}
