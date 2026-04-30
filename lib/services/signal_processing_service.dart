import 'dart:math';
import '../models/signature_point.dart';

class SignalProcessingService {
  static const int resampleTarget = 128;

  List<SignaturePoint> process(List<SignaturePoint> rawPoints) {
    if (rawPoints.length < 3) return rawPoints;

    final strokes = _splitStrokes(rawPoints);
    final smoothed =
        strokes.map((s) => _gaussianSmooth(s, sigma: 1.2)).toList();
    final arcLengths = smoothed.map(_arcLength).toList();
    final totalArc = arcLengths.reduce((a, b) => a + b);

    if (totalArc < 10) return rawPoints;

    final resampled = <SignaturePoint>[];
    int pointsUsed = 0;
    for (int i = 0; i < smoothed.length; i++) {
      final proportion = arcLengths[i] / totalArc;
      int count = (proportion * resampleTarget).round();
      count = count.clamp(
          2,
          resampleTarget - pointsUsed -
              (smoothed.length - i - 1) * 2);
      if (i == smoothed.length - 1) count = resampleTarget - pointsUsed;

      final resampledStroke = _resampleByArcLength(smoothed[i], count);
      if (resampledStroke.isNotEmpty) {
        resampled.add(SignaturePoint(
          x: resampledStroke[0].x,
          y: resampledStroke[0].y,
          pressure: resampledStroke[0].pressure,
          timestamp: resampledStroke[0].timestamp,
          isStrokeStart: true,
        ));
        resampled.addAll(resampledStroke.skip(1));
      }
      pointsUsed += count;
    }

    return _normalizePosition(resampled);
  }

  List<List<SignaturePoint>> _splitStrokes(List<SignaturePoint> points) {
    final strokes = <List<SignaturePoint>>[];
    List<SignaturePoint>? current;
    for (final p in points) {
      if (p.isStrokeStart || current == null) {
        current = [];
        strokes.add(current);
      }
      current.add(p);
    }
    return strokes.where((s) => s.length >= 2).toList();
  }

  List<SignaturePoint> _gaussianSmooth(List<SignaturePoint> points,
      {double sigma = 1.5}) {
    if (points.length < 5) return points;
    final radius = (sigma * 2.5).ceil();
    final kernel = _gaussianKernel(radius, sigma);
    final result = <SignaturePoint>[];
    for (int i = 0; i < points.length; i++) {
      double sx = 0, sy = 0, sp = 0, wt = 0;
      for (int k = -radius; k <= radius; k++) {
        final idx = (i + k).clamp(0, points.length - 1);
        final w = kernel[k + radius];
        sx += points[idx].x * w;
        sy += points[idx].y * w;
        sp += points[idx].pressure * w;
        wt += w;
      }
      result.add(SignaturePoint(
        x: sx / wt,
        y: sy / wt,
        pressure: sp / wt,
        timestamp: points[i].timestamp,
        isStrokeStart: points[i].isStrokeStart,
      ));
    }
    return result;
  }

  List<double> _gaussianKernel(int radius, double sigma) {
    final size = radius * 2 + 1;
    final kernel = List<double>.filled(size, 0);
    double sum = 0;
    for (int i = 0; i < size; i++) {
      final x = (i - radius).toDouble();
      kernel[i] = exp(-(x * x) / (2 * sigma * sigma));
      sum += kernel[i];
    }
    return kernel.map((k) => k / sum).toList();
  }

  double _arcLength(List<SignaturePoint> points) {
    double len = 0;
    for (int i = 1; i < points.length; i++) {
      final dx = points[i].x - points[i - 1].x;
      final dy = points[i].y - points[i - 1].y;
      len += sqrt(dx * dx + dy * dy);
    }
    return len;
  }

  List<SignaturePoint> _resampleByArcLength(
      List<SignaturePoint> points, int count) {
    if (points.length < 2 || count < 2) return points;
    final totalLen = _arcLength(points);
    if (totalLen < 1e-6) {
      return List.generate(
          count,
          (i) => SignaturePoint(
                x: points.first.x,
                y: points.first.y,
                pressure: points.first.pressure,
                timestamp: points.first.timestamp +
                    ((points.last.timestamp - points.first.timestamp) *
                            i /
                            (count - 1))
                        .round(),
              ));
    }
    final interval = totalLen / (count - 1);
    final result = <SignaturePoint>[points.first];
    double distSoFar = 0;
    int i = 1;
    List<SignaturePoint> pts = List.from(points);
    while (i < pts.length && result.length < count) {
      final dx = pts[i].x - pts[i - 1].x;
      final dy = pts[i].y - pts[i - 1].y;
      final segLen = sqrt(dx * dx + dy * dy);
      if (distSoFar + segLen >= interval) {
        final overshoot = interval - distSoFar;
        final ratio = segLen > 0 ? overshoot / segLen : 0;
        final nx = pts[i - 1].x + ratio * dx;
        final ny = pts[i - 1].y + ratio * dy;
        final np = pts[i - 1].pressure +
            ratio * (pts[i].pressure - pts[i - 1].pressure);
        final nt = pts[i - 1].timestamp +
            (ratio * (pts[i].timestamp - pts[i - 1].timestamp)).round();
        result.add(SignaturePoint(
          x: nx, y: ny, pressure: np.clamp(0.0, 1.0), timestamp: nt,
        ));
        pts = [...pts.sublist(0, i), result.last, ...pts.sublist(i)];
        distSoFar = 0;
      } else {
        distSoFar += segLen;
      }
      i++;
    }
    while (result.length < count) {
      result.add(pts.last);
    }
    return result.sublist(0, count);
  }

  List<SignaturePoint> _normalizePosition(List<SignaturePoint> points) {
    if (points.isEmpty) return points;
    double minX = double.infinity, minY = double.infinity;
    double maxX = double.negativeInfinity, maxY = double.negativeInfinity;
    for (final p in points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    final rangeX = maxX - minX;
    final rangeY = maxY - minY;
    final range = max(max(rangeX, rangeY), 1.0);
    final padX = (range - rangeX) / 2;
    final padY = (range - rangeY) / 2;
    return points.map((p) {
      return SignaturePoint(
        x: ((p.x - minX + padX) / range).clamp(0.0, 1.0),
        y: ((p.y - minY + padY) / range).clamp(0.0, 1.0),
        pressure: p.pressure,
        timestamp: p.timestamp,
        isStrokeStart: p.isStrokeStart,
      );
    }).toList();
  }
}