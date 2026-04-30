import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class UnlockedScreen extends StatefulWidget {
  const UnlockedScreen({super.key});

  @override
  State<UnlockedScreen> createState() => _UnlockedScreenState();
}

class _UnlockedScreenState extends State<UnlockedScreen> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      // Auto-lock when leaving the app
      Navigator.of(context).pushReplacementNamed('/lock');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 16),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppTheme.success.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(Icons.lock_open_rounded,
                        color: AppTheme.success, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Text('Device Unlocked',
                      style: Theme.of(context)
                          .textTheme
                          .headlineMedium
                          ?.copyWith(color: AppTheme.success, fontSize: 18)),
                ],
              ),
              const SizedBox(height: 40),
              Text('Prototype 2 — Signature Auth',
                  style: Theme.of(context).textTheme.headlineLarge),
              const SizedBox(height: 8),
              Text(
                'Behavioral biometric authentication verified.\n'
                'All processing happened on-device.\n'
                'Zero network calls were made.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const Spacer(),
              _infoCard(context, 'Authentication Method',
                  'Dynamic Time Warping + Liveness Detection', Icons.fingerprint_rounded, AppTheme.accent),
              const SizedBox(height: 12),
              _infoCard(context, 'Security Level',
                  'On-device template · AES-256 encrypted storage', Icons.shield_rounded, AppTheme.success),
              const SizedBox(height: 12),
              _infoCard(context, 'Adaptive Learning',
                  'Template evolves with successful authentications', Icons.tune_rounded, AppTheme.warning),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: () => Navigator.of(context)
                      .pushReplacementNamed('/lock'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.surfaceLight,
                    foregroundColor: AppTheme.textPrimary,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Lock Again'),
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _infoCard(BuildContext context, String title, String sub, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.canvasBorder),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.bodyLarge),
                const SizedBox(height: 2),
                Text(sub, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}