import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../services/secure_storage_service.dart';
import '../theme/app_theme.dart';
import 'diagnostics_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final SecureStorageService _storage = SecureStorageService();
  final AuthService _authService = AuthService();

  double _sensitivity = 0.5;
  bool _adaptiveLearning = true;
  bool _livenessCheck = true;
  bool _loading = true;
  int _totalAuths = 0;
  int _successCount = 0;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final settings = await _storage.loadSettings();
    final history = await _storage.loadHistory();
    final template = await _storage.loadTemplate();
    if (!mounted) return;
    setState(() {
      _sensitivity = (settings['sensitivity'] as num?)?.toDouble() ?? 0.5;
      _adaptiveLearning = settings['adaptiveLearning'] as bool? ?? true;
      _livenessCheck = settings['livenessCheck'] as bool? ?? true;
      _totalAuths = history.length;
      _successCount = history.where((h) => h['accepted'] == true).length;
      _loading = false;
    });
    if (template != null) {
      final margin = template.threshold / template.maxEnrollDistance;
      setState(() {
        _sensitivity = ((2.5 - margin) / 1.3).clamp(0.0, 1.0);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text('Settings',
            style: Theme.of(context).textTheme.headlineMedium),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded,
              color: AppTheme.textPrimary),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppTheme.accent))
          : ListView(
              padding: const EdgeInsets.all(24),
              children: [
                _secTitle('Security'),
                _sensitivitySlider(),
                const SizedBox(height: 8),
                _toggle('Adaptive Learning',
                    'Template improves with each successful unlock',
                    _adaptiveLearning, (v) => _setSetting('adaptiveLearning', v)),
                _toggle('Liveness Detection',
                    'Reject signatures that appear non-human',
                    _livenessCheck, (v) => _setSetting('livenessCheck', v)),
                const SizedBox(height: 24),
                _secTitle('Statistics'),
                _statCard(),
                const SizedBox(height: 24),
                _secTitle('Developer'),
                _navCard('Diagnostics',
                    'DTW path visualization & feature breakdown',
                    Icons.bug_report_rounded, AppTheme.accent, () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const DiagnosticsScreen()),
                  );
                }),
                const SizedBox(height: 24),
                _secTitle('Danger Zone'),
                _dangerBtn('Re-enroll Signature',
                    'Delete template and start over', Icons.refresh_rounded, _reEnroll),
                const SizedBox(height: 12),
                _dangerBtn('Clear All Data',
                    'Delete template, settings, and history',
                    Icons.delete_forever_rounded, _clearAll),
                const SizedBox(height: 40),
              ],
            ),
    );
  }

  Widget _secTitle(String t) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Text(t,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppTheme.textMuted, letterSpacing: 1.5)),
      );

  Widget _sensitivitySlider() {
    return Container(
      padding: const EdgeInsets.all(16),
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.canvasBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Sensitivity', style: Theme.of(context).textTheme.bodyLarge),
              Text(
                _sensitivity < 0.33
                    ? 'Loose'
                    : _sensitivity < 0.66
                        ? 'Balanced'
                        : 'Strict',
                style: Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: AppTheme.accent),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SliderTheme(
            data: SliderThemeData(
              activeTrackColor: AppTheme.accent,
              inactiveTrackColor: AppTheme.surfaceLight,
              thumbColor: AppTheme.accent,
              overlayColor: AppTheme.accent.withValues(alpha: 0.2),
              trackHeight: 3,
            ),
            child: Slider(
              value: _sensitivity,
              min: 0,
              max: 1,
              divisions: 20,
              onChanged: (v) async {
                setState(() => _sensitivity = v);
                await _authService.applySensitivity(v);
                await _storage.saveSettings({
                  'sensitivity': v,
                  'adaptiveLearning': _adaptiveLearning,
                  'livenessCheck': _livenessCheck,
                });
              },
            ),
          ),
          Text('Lower = easier to unlock, Higher = more secure',
              style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }

  Widget _toggle(String title, String sub, bool val, Function(bool) fn) {
    return Container(
      padding: const EdgeInsets.all(16),
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.canvasBorder),
      ),
      child: Row(
        children: [
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
          Switch(
            value: val,
            onChanged: (v) { fn(v); setState(() {}); },
            activeThumbColor: AppTheme.accent,
            activeTrackColor: AppTheme.accent.withValues(alpha: 0.3),
          ),
        ],
      ),
    );
  }

  Widget _statCard() {
    final rate = _totalAuths > 0
        ? (_successCount / _totalAuths * 100).toStringAsFixed(0)
        : '--';
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.canvasBorder),
      ),
      child: Row(
        children: [
          _si('Total', '$_totalAuths'),
          _sd(),
          _si('Passed', '$_successCount'),
          _sd(),
          _si('Rate', '$rate%'),
        ],
      ),
    );
  }

  Widget _si(String l, String v) => Expanded(
        child: Column(
          children: [
            Text(v,
                style: Theme.of(context)
                    .textTheme
                    .headlineMedium
                    ?.copyWith(fontSize: 24)),
            const SizedBox(height: 2),
            Text(l, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      );

  Widget _sd() => Container(
        width: 1, height: 40, color: AppTheme.canvasBorder,
      );

  Widget _navCard(String t, String s, IconData i, Color c, VoidCallback fn) {
    return InkWell(
      onTap: fn,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(16),
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: AppTheme.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppTheme.canvasBorder),
        ),
        child: Row(
          children: [
            Icon(i, color: c, size: 22),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(t, style: Theme.of(context).textTheme.bodyLarge),
                  const SizedBox(height: 2),
                  Text(s, style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: AppTheme.textMuted),
          ],
        ),
      ),
    );
  }

  Widget _dangerBtn(String t, String s, IconData i, VoidCallback fn) {
    return InkWell(
      onTap: fn,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.danger.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppTheme.danger.withValues(alpha: 0.2)),
        ),
        child: Row(
          children: [
            Icon(i, color: AppTheme.danger, size: 22),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(t,
                      style: Theme.of(context)
                          .textTheme
                          .bodyLarge
                          ?.copyWith(color: AppTheme.danger)),
                  const SizedBox(height: 2),
                  Text(s, style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: AppTheme.textMuted),
          ],
        ),
      ),
    );
  }

  Future<void> _setSetting(String k, bool v) async {
    final s = await _storage.loadSettings();
    s[k] = v;
    await _storage.saveSettings(s);
  }

  Future<void> _reEnroll() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surface,
        title: Text('Re-enroll?',
            style: Theme.of(context).textTheme.headlineMedium),
        content: Text(
            'This will delete your signature template.\nYou\'ll need to create a new one.',
            style: Theme.of(context).textTheme.bodyMedium),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel',
                  style: TextStyle(color: AppTheme.textSecondary))),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Delete',
                  style: TextStyle(color: AppTheme.danger))),
        ],
      ),
    );
    if (ok == true) {
      await _authService.reset();
      if (mounted) Navigator.of(context).pop(true);
    }
  }

  Future<void> _clearAll() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surface,
        title: Text('Clear All Data?',
            style: Theme.of(context).textTheme.headlineMedium),
        content: Text(
            'This will delete everything: template, settings, and auth history.',
            style: Theme.of(context).textTheme.bodyMedium),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel',
                  style: TextStyle(color: AppTheme.textSecondary))),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Delete All',
                  style: TextStyle(color: AppTheme.danger))),
        ],
      ),
    );
    if (ok == true) {
      await _authService.reset();
      if (mounted) Navigator.of(context).pop(true);
    }
  }
}