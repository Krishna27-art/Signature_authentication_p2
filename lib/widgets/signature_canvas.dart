import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import '../models/signature_point.dart';
import '../services/haptic_service.dart';
import '../theme/app_theme.dart';

class SignatureCanvas extends StatefulWidget {
  final void Function(List<SignaturePoint> points) onSignatureComplete;
  final Color strokeColor;
  final double baseStrokeWidth;
  final bool showGuides;
  final bool clearAfterComplete;
  final bool enableHaptics;

  const SignatureCanvas({
    super.key,
    required this.onSignatureComplete,
    this.strokeColor = AppTheme.strokeColor,
    this.baseStrokeWidth = 4.0,
    this.showGuides = true,
    this.clearAfterComplete = true,
    this.enableHaptics = true,
  });

  @override
  State<SignatureCanvas> createState() => SignatureCanvasState();
}

class SignatureCanvasState extends State<SignatureCanvas> {
  final List<List<SignaturePoint>> _strokes = [];
  List<SignaturePoint> _currentStroke = [];
  final List<List<_RenderSeg>> _renderSegs = [];
  List<_RenderSeg> _currentSegs = [];
  int? _activePointerId;
  int? _baseTimestamp;
  bool _isDrawing = false;
  Timer? _completeTimer;
  static const int _velBufSize = 3;
  final List<double> _velBuf = [];

  @override
  void dispose() {
    _completeTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.canvasBorder, width: 1.5),
        boxShadow: const [
          BoxShadow(color: AppTheme.accentDim, blurRadius: 20, spreadRadius: 0),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Stack(
          children: [
            if (widget.showGuides)
              const Positioned.fill(child: _GuideWidget()),
            Positioned.fill(
              child: CustomPaint(
                painter: _VarWidthPainter(
                  segs: [..._renderSegs, _currentSegs],
                  strokeColor: widget.strokeColor,
                ),
              ),
            ),
            Positioned.fill(
              child: Listener(
                behavior: HitTestBehavior.opaque,
                onPointerDown: _onDown,
                onPointerMove: _onMove,
                onPointerUp: _onUp,
                onPointerCancel: _onCancel,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _onDown(PointerDownEvent e) {
    _completeTimer?.cancel();
    if (_isDrawing || _activePointerId != null) return;
    _isDrawing = true;
    _activePointerId = e.pointer;
    _velBuf.clear();
    _baseTimestamp ??= DateTime.now().millisecondsSinceEpoch;
    final now = DateTime.now().millisecondsSinceEpoch - _baseTimestamp!;
    final pt = SignaturePoint(
      x: e.localPosition.dx, y: e.localPosition.dy,
      pressure: _pres(e), timestamp: now, pointerId: e.pointer, isStrokeStart: true,
    );
    setState(() {
      _currentStroke = [pt];
      _currentSegs = [
        _RenderSeg(e.localPosition, e.localPosition, widget.baseStrokeWidth * 1.3),
      ];
    });
    if (widget.enableHaptics) HapticService.tap();
  }

  void _onMove(PointerMoveEvent e) {
    if (!_isDrawing || e.pointer != _activePointerId) return;
    final now = DateTime.now().millisecondsSinceEpoch - _baseTimestamp!;
    final prev = _currentStroke.last;
    final dx = e.localPosition.dx - prev.x;
    final dy = e.localPosition.dy - prev.y;
    final dt = max(1, now - prev.timestamp);
    final speed = sqrt(dx * dx + dy * dy) / dt;
    _velBuf.add(speed);
    if (_velBuf.length > _velBufSize) _velBuf.removeAt(0);
    final avg = _velBuf.reduce((a, b) => a + b) / _velBuf.length;
    final wf = (1.4 - avg * 0.37).clamp(0.3, 1.5);
    final w = widget.baseStrokeWidth * wf;
    final pt = SignaturePoint(
      x: e.localPosition.dx, y: e.localPosition.dy,
      pressure: _pres(e), timestamp: now, pointerId: e.pointer,
    );
    setState(() {
      _currentStroke.add(pt);
      _currentSegs.add(_RenderSeg(
        Offset(prev.x, prev.y), e.localPosition, w,
      ));
    });
  }

  void _onUp(PointerUpEvent e) {
    if (!_isDrawing || e.pointer != _activePointerId) return;
    _isDrawing = false;
    _activePointerId = null;
    final now = DateTime.now().millisecondsSinceEpoch - _baseTimestamp!;
    final pt = SignaturePoint(
      x: e.localPosition.dx, y: e.localPosition.dy,
      pressure: _pres(e), timestamp: now, pointerId: e.pointer,
    );
    _currentStroke.add(pt);
    if (_currentSegs.isNotEmpty) {
      _currentSegs.add(_RenderSeg(
        Offset(_currentStroke[_currentStroke.length - 2].x,
            _currentStroke[_currentStroke.length - 2].y),
        e.localPosition,
        widget.baseStrokeWidth * 0.3,
      ));
    }
    if (widget.enableHaptics) HapticService.lift();
    if (_currentStroke.length >= 2) {
      final all = [..._strokes.expand((s) => s), ..._currentStroke];
      setState(() {
        _renderSegs.add(List.from(_currentSegs));
        _strokes.add(List.from(_currentStroke));
        _currentStroke = [];
        _currentSegs = [];
      });
      _completeTimer = Timer(const Duration(milliseconds: 250), () {
        try {
          widget.onSignatureComplete(all);
        } finally {
          if (widget.clearAfterComplete) clear();
        }
      });
    } else {
      setState(() { _currentStroke = []; _currentSegs = []; });
    }
  }

  void _onCancel(PointerCancelEvent e) {
    if (e.pointer != _activePointerId) return;
    _isDrawing = false;
    _activePointerId = null;
    setState(() { _currentStroke = []; _currentSegs = []; });
  }

  void clear() {
    setState(() {
      _strokes.clear();
      _renderSegs.clear();
      _currentStroke.clear();
      _currentSegs.clear();
      _baseTimestamp = null;
      _velBuf.clear();
    });
  }

  double _pres(PointerEvent e) {
    try { if (e.pressure > 0 && e.pressure <= 1.0) return e.pressure; } catch (_) {}
    return 0.5;
  }
}

class _RenderSeg {
  final Offset from, to;
  final double width;
  const _RenderSeg(this.from, this.to, this.width);
}

class _VarWidthPainter extends CustomPainter {
  final List<List<_RenderSeg>> segs;
  final Color strokeColor;
  _VarWidthPainter({required this.segs, required this.strokeColor});

  @override
  void paint(Canvas canvas, Size size) {
    for (final stroke in segs) {
      if (stroke.isEmpty) continue;
      for (final s in stroke) {
        _seg(canvas, s, strokeColor.withValues(alpha: 0.1), s.width * 4, blur: 6);
      }
      for (final s in stroke) {
        _seg(canvas, s, strokeColor, s.width);
      }
      for (final s in stroke) {
        _seg(canvas, s, strokeColor.withValues(alpha: 0.6), s.width * 0.4);
      }
    }
  }

  void _seg(Canvas c, _RenderSeg s, Color col, double w, {double? blur}) {
    final p = Paint()
      ..color = col ..strokeWidth = w
      ..strokeCap = StrokeCap.round ..style = PaintingStyle.stroke
      ..isAntiAlias = true;
    if (blur != null) p.maskFilter = MaskFilter.blur(BlurStyle.normal, blur);
    c.drawLine(s.from, s.to, p);
  }

  @override
  bool shouldRepaint(_VarWidthPainter old) => true;
}

class _GuideWidget extends StatelessWidget {
  const _GuideWidget();

  @override
  Widget build(BuildContext context) {
    return CustomPaint(painter: _GuidePainter());
  }
}

class _GuidePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()..color = AppTheme.guideColor..strokeWidth = 0.5..style = PaintingStyle.stroke;
    final by = size.height * 0.72;
    canvas.drawLine(Offset(size.width * 0.08, by), Offset(size.width * 0.92, by), p);
    final cx = size.width / 2;
    const ms = 10.0;
    final mp = Paint()..color = AppTheme.guideColor.withValues(alpha: 0.35)..strokeWidth = 0.8..style = PaintingStyle.stroke;
    canvas.drawLine(Offset(cx - ms, by - ms), Offset(cx + ms, by + ms), mp);
    canvas.drawLine(Offset(cx + ms, by - ms), Offset(cx - ms, by + ms), mp);
  }

  @override
  bool shouldRepaint(covariant CustomPainter old) => false;
}