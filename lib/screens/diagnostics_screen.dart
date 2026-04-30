import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../models/signature_point.dart';
import '../models/feature_vector.dart';
import '../models/signature_template.dart';
import '../services/signal_processing_service.dart';
import '../services/feature_extraction_service.dart';

import '../services/secure_storage_service.dart';
import '../widgets/signature_canvas.dart';

class DiagnosticsScreen extends StatefulWidget {
  const DiagnosticsScreen({super.key});

  @override
  State<DiagnosticsScreen> createState() => _DiagnosticsScreenState();
}

class _DiagnosticsScreenState extends State<DiagnosticsScreen> {
  final SignalProcessingService _processor = SignalProcessingService();
  final FeatureExtractionService _extractor = FeatureExtractionService();
  final SecureStorageService _storage = SecureStorageService();

  SignatureTemplate? _template;
  bool _hasResult = false;
  double _dtwScore = 0;
  double _threshold = 0;
  bool _accepted = false;
  List<_FB> _breakdown = [];
  List<Offset> _dtwPath = [];

  @override
  void initState() {
    super.initState();
    _loadTemplate();
  }

  Future<void> _loadTemplate() async {
    final t = await _storage.loadTemplate();
    if (mounted) setState(() => _template = t);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text('Diagnostics',
            style: Theme.of(context).textTheme.headlineMedium),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded,
              color: AppTheme.textPrimary),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          _buildTemplateInfo(),
          const SizedBox(height: 20),
          Text('Capture a test signature:',
              style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 12),
          SignatureCanvas(
            onSignatureComplete: _runDiag,
            clearAfterComplete: true,
            showGuides: false,
            baseStrokeWidth: 2.5,
          ),
          const SizedBox(height: 20),
          if (_hasResult) ...[
            _buildResultHeader(),
            const SizedBox(height: 16),
            _buildDTWPathVis(),
            const SizedBox(height: 20),
            _buildFeatureBreakdown(),
          ],
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildTemplateInfo() {
    if (_template == null) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppTheme.canvasBorder),
        ),
        child: Row(
          children: [
            const Icon(Icons.warning_amber_rounded,
                color: AppTheme.warning, size: 20),
            const SizedBox(width: 12),
            Text('No template found. Enroll first.',
                style: Theme.of(context).textTheme.bodyMedium),
          ],
        ),
      );
    }
    final t = _template!;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.canvasBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Template Info',
              style: Theme.of(context).textTheme.bodyLarge),
          const SizedBox(height: 10),
          _ir('Points', '${t.reference.length}'),
          _ir('Samples', '${t.sampleCount}'),
          _ir('Threshold', t.threshold.toStringAsFixed(4)),
          _ir('Max enroll dist', t.maxEnrollDistance.toStringAsFixed(4)),
          _ir('Duration range', '${t.minDurationMs}–${t.maxDurationMs}ms'),
          const SizedBox(height: 8),
          Text('Feature Std Devs',
              style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 4),
          _buildStdBar(t.featureStdDevs),
        ],
      ),
    );
  }

  Widget _ir(String l, String v) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(l, style: Theme.of(context).textTheme.bodySmall),
          Text(v,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppTheme.accent, fontFamily: 'monospace')),
        ],
      ),
    );
  }

  Widget _buildStdBar(List<double> stds) {
    if (stds.isEmpty) return const SizedBox.shrink();
    final names = ['x', 'y', 'vx', 'vy', 'spd', 'ax', 'ay', 'prs', 'crv', 'bnd'];
    final mx = stds.reduce((a, b) => a > b ? a : b).clamp(0.001, double.infinity);
    return SizedBox(
      height: stds.length * 16.0,
      child: Row(
        children: [
          SizedBox(
            width: 32,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: names
                  .map((n) => Text(n,
                      style: const TextStyle(
                          fontSize: 9,
                          color: AppTheme.textMuted,
                          fontFamily: 'monospace')))
                  .toList(),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: stds.asMap().entries.map((e) {
                final r = e.value / mx;
                return Container(
                  height: 12,
                  margin: const EdgeInsets.symmetric(vertical: 2),
                  child: Row(
                    children: [
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(2),
                          child: LinearProgressIndicator(
                            value: r,
                            backgroundColor: AppTheme.surfaceLight,
                            valueColor: AlwaysStoppedAnimation(
                                r < 0.3 ? AppTheme.success
                                    : r < 0.7 ? AppTheme.warning
                                    : AppTheme.danger),
                            minHeight: 12,
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      SizedBox(
                        width: 40,
                        child: Text(e.value.toStringAsFixed(3),
                            style: const TextStyle(
                                fontSize: 8,
                                color: AppTheme.textMuted,
                                fontFamily: 'monospace')),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildResultHeader() {
    final c = _accepted ? AppTheme.success : AppTheme.danger;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: c.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(_accepted ? Icons.check_rounded : Icons.close_rounded,
              color: c, size: 28),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_accepted ? 'ACCEPTED' : 'REJECTED',
                    style: TextStyle(
                        color: c,
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1)),
                const SizedBox(height: 2),
                Text(
                  'DTW: ${_dtwScore.toStringAsFixed(4)} / ${_threshold.toStringAsFixed(4)}  (${_threshold > 0 ? (_dtwScore / _threshold * 100).toStringAsFixed(0) : '—'}%)',
                  style: const TextStyle(
                      color: AppTheme.textSecondary,
                      fontSize: 12,
                      fontFamily: 'monospace'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDTWPathVis() {
    final rl = _template?.reference.length ?? 0;
    if (_dtwPath.isEmpty || rl == 0) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.canvasBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('DTW Warping Path',
              style: Theme.of(context).textTheme.bodyLarge),
          const SizedBox(height: 4),
          Text(
            'X: Attempt  Y: Template ($rl pts)',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 200,
            child: CustomPaint(
              painter: _DTWPathPainter(path: _dtwPath),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFeatureBreakdown() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.canvasBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Feature Distance Breakdown',
              style: Theme.of(context).textTheme.bodyLarge),
          const SizedBox(height: 12),
          ..._breakdown.map((b) => _buildBR(b)),
        ],
      ),
    );
  }

  Widget _buildBR(_FB b) {
    final mx = _breakdown.isEmpty
        ? 1.0
        : _breakdown.map((x) => x.wd).reduce((a, c) => a > c ? a : c);
    final r = (b.wd / mx.clamp(0.001, double.infinity)).toDouble().clamp(0.0, 1.0);
    final c = r < 0.3 ? AppTheme.success : r < 0.7 ? AppTheme.warning : AppTheme.danger;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(
            width: 72,
            child: Text(b.name,
                style: const TextStyle(
                    fontSize: 11,
                    color: AppTheme.textSecondary,
                    fontFamily: 'monospace')),
          ),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(2),
              child: LinearProgressIndicator(
                value: r,
                backgroundColor: AppTheme.surfaceLight,
                valueColor: AlwaysStoppedAnimation(c),
                minHeight: 10,
              ),
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 56,
            child: Text(b.wd.toStringAsFixed(4),
                textAlign: TextAlign.right,
                style: const TextStyle(
                    fontSize: 10,
                    color: AppTheme.textMuted,
                    fontFamily: 'monospace')),
          ),
        ],
      ),
    );
  }

  Future<void> _runDiag(List<SignaturePoint> raw) async {
    if (_template == null) return;
    final processed = _processor.process(raw);
    final features = _extractor.extract(processed);
    if (features.isEmpty) return;
    final result = _computeWithPath(features, _template!.reference);
    if (!mounted) return;
    setState(() {
      _dtwScore = result.score;
      _threshold = _template!.threshold;
      _accepted = _dtwScore < _threshold;
      _dtwPath = result.path;
      _breakdown = result.bd;
      _hasResult = true;
    });
  }

  _DTWR _computeWithPath(List<FeatureVector> a, List<FeatureVector> b) {
    final n = a.length;
    final m = b.length;
    final w = (math.max(n, m) * 0.3).floor().clamp(10, math.max(n, m));
    final dtw = List.generate(
        n + 1, (_) => List<double>.filled(m + 1, double.infinity));
    dtw[0][0] = 0;

    Map<String, double> wts = FeatureVector.defaultWeights;
    if (_template != null && _template!.featureStdDevs.isNotEmpty) {
      wts = _getEffectiveWeights(_template!, wts);
    }

    final fNames = ['pos-x', 'pos-y', 'vel-x', 'vel-y', 'speed',
        'acc-x', 'acc-y', 'press', 'curv'];
    final wList = [
      wts['x'] ?? 0.1,
      wts['y'] ?? 0.1,
      wts['vx'] ?? 0.1,
      wts['vy'] ?? 0.1,
      wts['speed'] ?? 0.1,
      wts['ax'] ?? 0.1,
      wts['ay'] ?? 0.1,
      wts['pressure'] ?? 0.1,
      wts['curvature'] ?? 0.1,
    ];
    final fAcc = List<double>.filled(9, 0);
    int pLen = 0;

    for (int i = 1; i <= n; i++) {
      for (int j = (i - w).clamp(1, m).toInt(); j <= (i + w).clamp(0, m).toInt(); j++) {
        final cost = a[i - 1].distanceTo(b[j - 1], wts);
        dtw[i][j] = cost + math.min(dtw[i - 1][j],
            math.min(dtw[i][j - 1], dtw[i - 1][j - 1]));
      }
    }

    final path = <Offset>[];
    int i = n, j = m;
    while (i > 0 && j > 0) {
      path.add(Offset((j - 1).toDouble(), (i - 1).toDouble()));
      pLen++;
      final af = a[i - 1], bf = b[j - 1];
      final rd = [
        _sq(af.x - bf.x), _sq(af.y - bf.y), _sq(af.vx - bf.vx),
        _sq(af.vy - bf.vy), _sq(af.speed - bf.speed),
        _sq(af.ax - bf.ax), _sq(af.ay - bf.ay),
        _sq(af.pressure - bf.pressure), _sq(af.curvature - bf.curvature),
      ];
      for (int f = 0; f < 9; f++) {
        fAcc[f] += rd[f] * wList[f];
      }
      final mv = math.min(dtw[i - 1][j],
          math.min(dtw[i][j - 1], dtw[i - 1][j - 1]));
      if (mv == dtw[i - 1][j - 1]) { i--; j--; }
      else if (mv == dtw[i - 1][j]) { i--; }
      else { j--; }
    }
    path.add(const Offset(0, 0));
    final reversedPath = path.reversed.toList();

    final bd = <_FB>[];
    for (int f = 0; f < 9; f++) {
      bd.add(_FB(name: fNames[f], wd: fAcc[f] / pLen.clamp(1, 999999)));
    }
    return _DTWR(score: dtw[n][m], path: reversedPath, bd: bd);
  }

  Map<String, double> _getEffectiveWeights(
      SignatureTemplate template, Map<String, double> baseWeights) {
    final stds = template.featureStdDevs;
    if (stds.length != 10) return baseWeights;
    final invStds = stds.map((s) => s < 1e-10 ? 10.0 : 1.0 / s).toList();
    final total = invStds.reduce((a, b) => a + b);
    final featureKeys = [
      'x', 'y', 'vx', 'vy', 'speed', 'ax', 'ay', 'pressure', 'curvature'
    ];
    final adapted = <String, double>{};
    for (int i = 0; i < featureKeys.length; i++) {
      final adaptiveW = (invStds[i] / total * 9).clamp(0.2, 3.5);
      adapted[featureKeys[i]] =
          0.5 * adaptiveW + 0.5 * (baseWeights[featureKeys[i]] ?? 0.1);
    }
    return adapted;
  }

  double _sq(double v) => v * v;
}

class _DTWR {
  final double score;
  final List<Offset> path;
  final List<_FB> bd;
  _DTWR({required this.score, required this.path, required this.bd});
}

class _FB {
  final String name;
  final double wd;
  _FB({required this.name, required this.wd});
}

class _DTWPathPainter extends CustomPainter {
  final List<Offset> path;
  _DTWPathPainter({required this.path});

  @override
  void paint(Canvas canvas, Size size) {
    if (path.isEmpty) return;
    final mx = math.max(
        path.map((p) => p.dx).reduce(math.max),
        path.map((p) => p.dy).reduce(math.max));
    const pad = 8.0;
    final dw = size.width - pad * 2;
    final dh = size.height - pad * 2;

    final gp = Paint()..color = AppTheme.guideColor..strokeWidth = 0.3;
    for (int i = 0; i <= 4; i++) {
      final y = pad + dh * i / 4;
      canvas.drawLine(Offset(pad, y), Offset(size.width - pad, y), gp);
      final x = pad + dw * i / 4;
      canvas.drawLine(Offset(x, pad), Offset(x, size.height - pad), gp);
    }

    final mapped = path.map((p) => Offset(
      pad + (p.dx / mx.clamp(1, double.infinity)) * dw,
      pad + (p.dy / mx.clamp(1, double.infinity)) * dh,
    )).toList();

    final pp = Paint()
      ..color = AppTheme.accent
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke
      ..isAntiAlias = true;
    final po = Path()..moveTo(mapped.first.dx, mapped.first.dy);
    for (int i = 1; i < mapped.length; i++) {
      po.lineTo(mapped[i].dx, mapped[i].dy);
    }
    canvas.drawPath(po, pp);

    final di = (mapped.length / 20).clamp(1, 10).toInt();
    final dp = Paint()..color = AppTheme.accent..style = PaintingStyle.fill;
    for (int i = 0; i < mapped.length; i += di) {
      canvas.drawCircle(mapped[i], 2.5, dp);
    }
    canvas.drawCircle(mapped.first, 4, Paint()..color = AppTheme.success..style = PaintingStyle.fill);
    canvas.drawCircle(mapped.last, 4, Paint()..color = AppTheme.danger..style = PaintingStyle.fill);

    final tp = TextPainter(textDirection: TextDirection.ltr);
    tp.text = const TextSpan(text: '0', style: TextStyle(color: AppTheme.textMuted, fontSize: 8));
    tp.layout();
    tp.paint(canvas, Offset(pad, size.height - 2));
    tp.text = TextSpan(text: '${mx.toInt()}', style: const TextStyle(color: AppTheme.textMuted, fontSize: 8));
    tp.layout();
    tp.paint(canvas, Offset(size.width - pad - 12, size.height - 2));
  }

  @override
  bool shouldRepaint(covariant _DTWPathPainter old) => true;
}