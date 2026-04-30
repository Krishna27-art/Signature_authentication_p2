import 'package:flutter/material.dart';
import 'screens/splash_screen.dart';
import 'screens/lock_screen.dart';
import 'screens/enrollment_screen.dart';
import 'screens/unlocked_screen.dart';
import 'screens/settings_screen.dart';
import 'theme/app_theme.dart';

class SigAuthApp extends StatelessWidget {
  const SigAuthApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SigAuth',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      initialRoute: '/',
      onGenerateRoute: _routes,
    );
  }

  static Route<dynamic> _routes(RouteSettings settings) {
    switch (settings.name) {
      case '/':
        return PageRouteBuilder(
          pageBuilder: (_, __, ___) => const SplashScreen(),
          transitionDuration: Duration.zero,
        );
      case '/enroll':
        return PageRouteBuilder(
          pageBuilder: (_, __, ___) => const EnrollmentScreen(),
          transitionDuration: const Duration(milliseconds: 400),
          transitionsBuilder: (_, anim, __, child) =>
              FadeTransition(opacity: anim, child: child),
        );
      case '/lock':
        return PageRouteBuilder(
          pageBuilder: (_, __, ___) => const LockScreen(),
          transitionDuration: const Duration(milliseconds: 400),
          transitionsBuilder: (_, anim, __, child) =>
              FadeTransition(opacity: anim, child: child),
        );
      case '/unlocked':
        return PageRouteBuilder(
          pageBuilder: (_, __, ___) => const UnlockedScreen(),
          transitionDuration: const Duration(milliseconds: 500),
          transitionsBuilder: (_, anim, __, child) =>
              FadeTransition(opacity: anim, child: child),
        );
      case '/settings':
        return PageRouteBuilder(
          pageBuilder: (_, __, ___) => const SettingsScreen(),
          transitionDuration: const Duration(milliseconds: 300),
          transitionsBuilder: (_, anim, __, child) =>
              FadeTransition(opacity: anim, child: child),
        );
      default:
        return MaterialPageRoute(builder: (_) => const SplashScreen());
    }
  }
}
