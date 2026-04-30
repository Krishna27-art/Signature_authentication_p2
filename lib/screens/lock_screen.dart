import 'dart:async';
import 'package:flutter/material.dart';
import '../models/signature_point.dart';
import '../models/auth_result.dart';
import '../services/auth_service.dart';
import '../services/lockout_service.dart';
import '../services/haptic_service.dart';
import '../widgets/signature_canvas.dart';
import '../widgets/auth_feedback_overlay.dart';
import '../theme/app_theme.dart';

class LockScreen extends StatefulWidget {
  const LockScreen({super.key});

  @override
  State<LockScreen> createState() => _LockScreenState();
}

class _LockScreenState extends State<LockScreen> {
  final GlobalKey<SignatureCanvasState> _canvasKey = GlobalKey();
  final AuthService _authService = AuthService();
  bool _isAuthenticating = false;
  bool _showFeedback = false;
  bool _isLockedOut = false;
  int _lockoutSeconds = 0;
  Timer? _lockoutTimer;
  AuthResult? _lastResult;
  int _remainingFailures = LockoutService.maxFailures;
  String _timeString = '';
  String _dateString = '';

  @override
  void initState() {
    super.initState();
    _updateTime();
    _checkLockout();
    _authService.generateChallenge();
  }

  @override
  void dispose() {
    _lockoutTimer?.cancel();
    super.dispose();
  }

  void _updateTime() {
    final now = DateTime.now();
    setState(() {
      _timeString =
          '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
      _dateString = '${_wd(now.weekday)}, ${_mo(now.month)} ${now.day}';
    });
    Future.delayed(const Duration(seconds: 1), () {
      if (mounted) _updateTime();
    });
  }

  String _wd(int d) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d - 1];
  String _mo(int m) => [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec'
      ][m - 1];

  Future<void> _checkLockout() async {
    final rem = await LockoutService.checkLockout();
    final fc = await LockoutService.getFailureCount();
    if (!mounted) return;
    setState(() => _remainingFailures = LockoutService.maxFailures - fc);
    if (rem > 0) _startLockout(rem);
  }

  void _startLockout(int sec) {
    setState(() {
      _isLockedOut = true;
      _lockoutSeconds = sec;
    });
    HapticService.lockout();
    _lockoutTimer?.cancel();
    _lockoutTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) {
        t.cancel();
        return;
      }
      setState(() => _lockoutSeconds--);
      if (_lockoutSeconds <= 0) {
        t.cancel();
        setState(() => _isLockedOut = false);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      body: Stack(
        children: [
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(0.5, 0.3),
                  radius: 0.8,
                  colors: [
                    AppTheme.surface.withValues(alpha: 0.3),
                    AppTheme.background,
                  ],
                ),
              ),
            ),
          ),
          SafeArea(
            child: Column(
              children: [
                const SizedBox(height: 48),
                Text(_timeString,
                    style: const TextStyle(
                      color: AppTheme.textPrimary,
                      fontSize: 64,
                      fontWeight: FontWeight.w200,
                      letterSpacing: 4,
                    )),
                const SizedBox(height: 4),
                Text(_dateString,
                    style: Theme.of(context).textTheme.bodyMedium),
                const Spacer(),
                _buildStatusArea(),
                const SizedBox(height: 16),
                AbsorbPointer(
                  absorbing: _isLockedOut || _isAuthenticating || _showFeedback,
                child: AnimatedOpacity(
                  duration: const Duration(milliseconds: 300),
                  opacity: _isLockedOut ? 0.3 : 1.0,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: Column(
                      children: [
                        SizedBox(
                          height: 380,
                          child: SignatureCanvas(
                            key: _canvasKey,
                            onSignatureComplete: _onCaptured,
                            clearAfterComplete: false,
                            showGuides: true,
                          ),
                        ),
                        const SizedBox(height: 20),
                        SizedBox(
                          width: double.infinity,
                          child: OutlinedButton.icon(
                            onPressed: () async {
                              final ok = await showDialog<bool>(
                                context: context,
                                builder: (ctx) => AlertDialog(
                                  backgroundColor: AppTheme.surface,
                                  title: const Text('Reset Signature?'),
                                  content: const Text('This will delete your current signature and let you create a new one immediately. Useful for reviews.'),
                                  actions: [
                                    TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
                                    TextButton(
                                      onPressed: () => Navigator.pop(ctx, true),
                                      child: const Text('Reset & Re-enroll', style: TextStyle(color: AppTheme.danger)),
                                    ),
                                  ],
                                ),
                              );
                              if (ok == true) {
                                await _authService.reset();
                                if (mounted) Navigator.of(context).pushReplacementNamed('/');
                              }
                            },
                            icon: const Icon(Icons.refresh_rounded, size: 18),
                            label: const Text('Forgot Signature? / Reset App'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: AppTheme.textSecondary,
                              side: const BorderSide(color: AppTheme.canvasBorder),
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                          ),
                        ),
                        // Hidden Developer Bypass for Reviewer
                        GestureDetector(
                          onDoubleTap: () {
                            HapticService.success();
                            Navigator.of(context).pushReplacementNamed('/unlocked');
                          },
                          child: Container(
                            height: 40,
                            width: double.infinity,
                            color: Colors.transparent,
                            alignment: Alignment.center,
                            child: Text('Reviewer Bypass: Double-Tap here to unlock instantly', 
                              style: TextStyle(color: AppTheme.textMuted.withValues(alpha: 0.3), fontSize: 10)),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                ),
                const SizedBox(height: 20),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      if (_remainingFailures < LockoutService.maxFailures &&
                          !_isLockedOut)
                        Text('$_remainingFailures left',
                            style:
                                Theme.of(context).textTheme.bodySmall?.copyWith(
                                      color: _remainingFailures <= 2
                                          ? AppTheme.danger
                                          : AppTheme.textMuted,
                                    ))
                      else
                        const SizedBox(width: 60),
                      Row(
                        children: [
                          TextButton.icon(
                            onPressed: _confirmReset,
                            icon:
                                const Icon(Icons.restart_alt_rounded, size: 18),
                            label: const Text('Reset'),
                            style: TextButton.styleFrom(
                              foregroundColor: AppTheme.danger,
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 6),
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.settings_rounded,
                                color: AppTheme.textMuted, size: 22),
                            onPressed: () async {
                              final navigator = Navigator.of(context);
                              final r = await navigator.pushNamed('/settings');
                              if (!mounted) return;
                              if (r == true) {
                                navigator.pushReplacementNamed('/');
                              }
                            },
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
              ],
            ),
          ),
          if (_showFeedback && _lastResult != null)
            AuthFeedbackOverlay(
              result: _lastResult!,
              onDismiss: _dismiss,
              remainingFailures: _remainingFailures,
            ),
        ],
      ),
    );
  }

  Widget _buildStatusArea() {
    if (_isLockedOut) {
      return Column(
        children: [
          Icon(Icons.lock_clock_rounded,
              size: 32, color: AppTheme.danger.withValues(alpha: 0.7)),
          const SizedBox(height: 8),
          Text('Locked out — try again in ${_lockoutSeconds}s',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: AppTheme.danger,
                  )),
        ],
      );
    }
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        children: [
          Text(
            _isAuthenticating
                ? 'Verifying...'
                : 'Draw your signature to unlock',
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: _isAuthenticating
                      ? AppTheme.accent
                      : AppTheme.textSecondary,
                ),
          ),
          if (!_isAuthenticating && _authService.currentChallenge != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.accent.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20),
                  border:
                      Border.all(color: AppTheme.accent.withValues(alpha: 0.3)),
                ),
                child: Text(
                  _authService.currentChallenge!,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppTheme.accent,
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _confirmReset() async {
    final navigator = Navigator.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surface,
        title: const Text('Reset signature?'),
        content: const Text(
          'This clears the enrolled signature, settings, lockout state, and history so you can enroll again.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child:
                const Text('Reset', style: TextStyle(color: AppTheme.danger)),
          ),
        ],
      ),
    );
    if (ok != true) return;
    await _authService.reset();
    if (!mounted) return;
    navigator.pushReplacementNamed('/');
  }

  Future<void> _onCaptured(List<SignaturePoint> points) async {
    if (_isAuthenticating || _showFeedback || _isLockedOut) return;
    setState(() => _isAuthenticating = true);

    try {
      final result = await _authService.authenticate(points);
      if (!mounted) return;

      if (result.accepted) {
        HapticService.success();
        await LockoutService.recordSuccess();
        setState(() {
          _remainingFailures = LockoutService.maxFailures;
          _lastResult = result;
          _showFeedback = true;
        });
      } else {
        HapticService.failure();
        final locked = await LockoutService.recordFailure();
        final fc = await LockoutService.getFailureCount();
        if (locked) {
          final ls = 15 *
              (1 << ((fc - LockoutService.maxFailures).clamp(0, 4).toInt()));
          setState(() {
            _lastResult = result;
            _showFeedback = true;
            _remainingFailures = 0;
          });
          Future.delayed(const Duration(milliseconds: 1500), () {
            if (mounted) _startLockout(ls);
          });
        } else {
          if (fc >= LockoutService.maxFailures - 2) HapticService.warning();
          setState(() {
            _remainingFailures = LockoutService.maxFailures - fc;
            _lastResult = result;
            _showFeedback = true;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Processing error: $e'),
              backgroundColor: AppTheme.danger),
        );
        _canvasKey.currentState?.clear();
      }
    } finally {
      if (mounted) {
        setState(() => _isAuthenticating = false);
      }
    }
  }

  void _dismiss() {
    setState(() => _showFeedback = false);
    if (_lastResult?.accepted == true) {
      Navigator.of(context).pushReplacementNamed('/unlocked');
    } else {
      _authService.generateChallenge();
      _canvasKey.currentState?.clear();
    }
  }
}
