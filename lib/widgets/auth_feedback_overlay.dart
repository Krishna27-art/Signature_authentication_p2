import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../models/auth_result.dart';

class AuthFeedbackOverlay extends StatefulWidget {
  final AuthResult result;
  final VoidCallback onDismiss;
  final int remainingFailures;

  const AuthFeedbackOverlay({
    super.key,
    required this.result,
    required this.onDismiss,
    this.remainingFailures = 0,
  });

  @override
  State<AuthFeedbackOverlay> createState() => _AuthFeedbackOverlayState();
}

class _AuthFeedbackOverlayState extends State<AuthFeedbackOverlay>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnim;
  late Animation<double> _opacityAnim;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    );
    _scaleAnim = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0.0, 0.4, curve: Curves.elasticOut),
    );
    _opacityAnim = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0.7, 1.0, curve: Curves.easeIn),
    );
    _controller.forward().then((_) => widget.onDismiss());
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ok = widget.result.accepted;
    final color = ok ? AppTheme.success : AppTheme.danger;
    final icon = ok ? Icons.check_rounded : Icons.close_rounded;

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final opacity = (1.0 - _opacityAnim.value).clamp(0.0, 1.0);
        return Opacity(
          opacity: opacity,
          child: Container(
            color: AppTheme.background.withValues(alpha: 0.88),
            child: Center(
              child: Transform.scale(
                scale: _scaleAnim.value,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(28),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: color.withValues(alpha: 0.12),
                        boxShadow: [
                          BoxShadow(
                            color: color.withValues(alpha: 0.25),
                            blurRadius: 50,
                            spreadRadius: 8,
                          ),
                        ],
                      ),
                      child: Icon(icon, size: 72, color: color),
                    ),
                    const SizedBox(height: 28),
                    Text(
                      ok ? 'Authenticated' : 'Denied',
                      style: Theme.of(context)
                          .textTheme
                          .headlineMedium
                          ?.copyWith(color: color, fontWeight: FontWeight.w700),
                    ),
                    if (!ok) ...[
                      const SizedBox(height: 10),
                      if (widget.result.livenessFailReason != null)
                        Text(widget.result.livenessFailReason!,
                            style: Theme.of(context).textTheme.bodyMedium,
                            textAlign: TextAlign.center)
                      else
                        Text(
                          'Score: ${(widget.result.scoreRatio * 100).toStringAsFixed(0)}% of threshold',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      if (widget.remainingFailures > 0 &&
                          widget.remainingFailures <= 3)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            '${widget.remainingFailures} attempt${widget.remainingFailures > 1 ? "s" : ""} before lockout',
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(color: AppTheme.warning),
                          ),
                        ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}