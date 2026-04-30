import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/secure_storage_service.dart';
import '../theme/app_theme.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeLogo;
  late Animation<double> _fadeText;
  late Animation<double> _scaleLogo;
  Timer? _navigationTimer;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    );
    _fadeLogo = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0.0, 0.5, curve: Curves.easeOut),
    );
    _scaleLogo = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0.0, 0.5, curve: Curves.elasticOut),
    );
    _fadeText = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0.4, 0.8, curve: Curves.easeOut),
    );
    _controller.forward();
    _navigationTimer = Timer(const Duration(milliseconds: 2200), _navigate);
  }

  Future<void> _navigate() async {
    final storage = SecureStorageService();
    final hasTemplate = await storage.hasTemplate();
    if (!mounted) return;
    HapticFeedback.lightImpact();
    Navigator.of(context)
        .pushReplacementNamed(hasTemplate ? '/lock' : '/enroll');
  }

  @override
  void dispose() {
    _navigationTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            FadeTransition(
              opacity: _fadeLogo,
              child: ScaleTransition(
                scale: _scaleLogo,
                child: Container(
                  width: 88,
                  height: 88,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(22),
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        AppTheme.accent.withValues(alpha: 0.2),
                        AppTheme.accent.withValues(alpha: 0.05),
                      ],
                    ),
                    border: Border.all(
                      color: AppTheme.accent.withValues(alpha: 0.3),
                      width: 1.5,
                    ),
                  ),
                  child: const Icon(Icons.fingerprint_rounded,
                      size: 44, color: AppTheme.accent),
                ),
              ),
            ),
            const SizedBox(height: 24),
            FadeTransition(
              opacity: _fadeText,
              child: const Column(
                children: [
                  Text('SigAuth',
                      style: TextStyle(
                        color: AppTheme.textPrimary,
                        fontSize: 28,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.5,
                      )),
                  SizedBox(height: 6),
                  Text('Behavioral Signature Biometrics',
                      style: TextStyle(
                        color: AppTheme.textSecondary,
                        fontSize: 13,
                        letterSpacing: 0.5,
                      )),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
