import 'package:flutter/services.dart';

class HapticService {
  HapticService._();

  static void tap() => HapticFeedback.selectionClick();
  static void lift() => HapticFeedback.mediumImpact();

  static void success() {
    HapticFeedback.heavyImpact();
    Future.delayed(const Duration(milliseconds: 80), () {
      HapticFeedback.lightImpact();
    });
  }

  static void failure() => HapticFeedback.vibrate();
  static void warning() => HapticFeedback.mediumImpact();
  static void enrolled() => HapticFeedback.heavyImpact();

  static void lockout() {
    HapticFeedback.vibrate();
    Future.delayed(const Duration(milliseconds: 100), () {
      HapticFeedback.vibrate();
    });
  }
}
