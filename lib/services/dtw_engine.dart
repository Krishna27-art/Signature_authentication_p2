import 'dart:math';
import '../models/feature_vector.dart';
import '../models/signature_template.dart';

class DTWEngine {
  static const double windowFraction = 0.3;

  double compute(
    List<FeatureVector> a,
    List<FeatureVector> b, {
    Map<String, double>? weights,
    SignatureTemplate? template,
    double? threshold,
  }) {
    final n = a.length;
    final m = b.length;
    if (n == 0 || m == 0) return double.infinity;

    final w = max(10, (max(n, m) * windowFraction).floor());
    final prev = List<double>.filled(m + 1, double.infinity);
    final curr = List<double>.filled(m + 1, double.infinity);
    prev[0] = 0;

    Map<String, double> effectiveWeights =
        weights ?? FeatureVector.defaultWeights;
    if (template != null && template.featureStdDevs.isNotEmpty) {
      effectiveWeights = _adaptiveWeights(template, effectiveWeights);
    }

    for (int i = 1; i <= n; i++) {
      curr.fillRange(0, m + 1, double.infinity);
      final jStart = max(1, i - w);
      final jEnd = min(m, i + w);
      double minRowCost = double.infinity;

      for (int j = jStart; j <= jEnd; j++) {
        final cost = a[i - 1].distanceTo(b[j - 1], effectiveWeights);
        curr[j] = cost + _min3(prev[j], curr[j - 1], prev[j - 1]);
        if (curr[j] < minRowCost) minRowCost = curr[j];
      }

      for (int j = 0; j <= m; j++) {
        prev[j] = curr[j];
      }
    }
    return prev[m];
  }

  ({double maxDist, double avgDist}) computeEnrollmentStats(
      List<List<FeatureVector>> samples) {
    double maxDist = 0;
    double totalDist = 0;
    int count = 0;
    for (int i = 0; i < samples.length; i++) {
      for (int j = i + 1; j < samples.length; j++) {
        final d = compute(samples[i], samples[j]);
        if (d > maxDist) maxDist = d;
        totalDist += d;
        count++;
      }
    }
    return (
      maxDist: maxDist,
      avgDist: count > 0 ? totalDist / count : 0,
    );
  }

  List<FeatureVector> computeCentroid(List<List<FeatureVector>> samples) {
    if (samples.isEmpty) return [];
    final n = samples[0].length;
    final centroid = <FeatureVector>[];
    for (int i = 0; i < n; i++) {
      double x = 0, y = 0, vx = 0, vy = 0, speed = 0;
      double ax = 0, ay = 0, pressure = 0, curvature = 0;
      int boundaryCount = 0;
      for (final sample in samples) {
        final f = sample[i];
        x += f.x;
        y += f.y;
        vx += f.vx;
        vy += f.vy;
        speed += f.speed;
        ax += f.ax;
        ay += f.ay;
        pressure += f.pressure;
        curvature += f.curvature;
        if (f.isStrokeBoundary) boundaryCount++;
      }
      final s = samples.length.toDouble();
      centroid.add(FeatureVector(
        x: x / s,
        y: y / s,
        vx: vx / s,
        vy: vy / s,
        speed: speed / s,
        ax: ax / s,
        ay: ay / s,
        pressure: pressure / s,
        curvature: curvature / s,
        isStrokeBoundary: boundaryCount > samples.length / 2,
      ));
    }
    return centroid;
  }

  List<double> computeStdDevs(List<List<FeatureVector>> samples) {
    if (samples.isEmpty || samples[0].isEmpty) return [];
    final n = samples[0].length;
    final stdDevs = List<double>.filled(10, 0);
    for (int i = 0; i < n; i++) {
      final values = List<List<double>>.generate(10, (_) => []);
      for (final sample in samples) {
        final fl = sample[i].toList();
        for (int f = 0; f < 10; f++) {
          values[f].add(fl[f]);
        }
      }
      for (int f = 0; f < 10; f++) {
        final mean = values[f].reduce((a, b) => a + b) / values[f].length;
        final variance = values[f]
                .map((v) => (v - mean) * (v - mean))
                .reduce((a, b) => a + b) /
            values[f].length;
        stdDevs[f] += sqrt(variance);
      }
    }
    for (int f = 0; f < 10; f++) {
      stdDevs[f] /= n;
    }
    return stdDevs;
  }

  Map<String, double> _adaptiveWeights(
      SignatureTemplate template, Map<String, double> baseWeights) {
    final stds = template.featureStdDevs;
    if (stds.length != 10) return baseWeights;
    final invStds = stds.map((s) => s < 1e-10 ? 10.0 : 1.0 / s).toList();
    final total = invStds.reduce((a, b) => a + b);
    final featureKeys = [
      'x',
      'y',
      'vx',
      'vy',
      'speed',
      'ax',
      'ay',
      'pressure',
      'curvature'
    ];
    final adapted = <String, double>{};
    for (int i = 0; i < featureKeys.length; i++) {
      // Limit the influence of high-precision features to avoid over-fitting
      final adaptiveW = (invStds[i] / total * 9).clamp(0.2, 3.5);
      adapted[featureKeys[i]] =
          0.5 * adaptiveW + 0.5 * (baseWeights[featureKeys[i]] ?? 0.1);
    }
    return adapted;
  }

  double _min3(double a, double b, double c) {
    if (a <= b && a <= c) return a;
    if (b <= a && b <= c) return b;
    return c;
  }
}
