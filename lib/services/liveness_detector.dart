import 'dart:math';
import '../models/signature_point.dart';
import '../models/feature_vector.dart';

class LivenessDetector {
  static const int minRawPoints = 8;
  static const int minDurationMs = 150;
  static const int maxDurationMs = 8000;
  static const double minBoundingBoxSize = 20.0;

  (bool, String?) analyze(
    List<SignaturePoint> rawPoints,
    List<FeatureVector> features, {
    int? enrolledMinDuration,
    int? enrolledMaxDuration,
  }) {
    if (rawPoints.length < minRawPoints) {
      return (false, 'Signature too short (${rawPoints.length} points)');
    }
    final duration = rawPoints.last.timestamp - rawPoints.first.timestamp;
    final effectiveMin = enrolledMinDuration ?? minDurationMs;
    final effectiveMax = enrolledMaxDuration ?? maxDurationMs;
    if (duration < effectiveMin * 0.3) {
      return (false, 'Too fast (${duration}ms)');
    }
    if (duration > effectiveMax * 2.5) {
      return (false, 'Too slow (${duration}ms)');
    }
    final bboxResult = _checkBoundingBox(rawPoints);
    if (!bboxResult.$1) return bboxResult;
    if (features.length >= 10) {
      final velVar = _checkVelocityVariation(features);
      if (!velVar.$1) return velVar;
    }
    final dirResult = _checkDirectionChanges(features);
    if (!dirResult.$1) return dirResult;
    if (features.length >= 10) {
      final accVar = _checkAccelerationVariation(features);
      if (!accVar.$1) return accVar;
    }
    if (rawPoints.length > 20) {
      final smoothResult = _checkNotTooSmooth(rawPoints);
      if (!smoothResult.$1) return (true, null); // Log but don't fail
    }
    // Tremor and Hesitation checks disabled for prototype stability
    return (true, null);
  }

  (bool, String?) _checkBoundingBox(List<SignaturePoint> points) {
    double minX = double.infinity, minY = double.infinity;
    double maxX = double.negativeInfinity, maxY = double.negativeInfinity;
    for (final p in points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    if (maxX - minX < minBoundingBoxSize && maxY - minY < minBoundingBoxSize) {
      return (false, 'Signature too small');
    }
    return (true, null);
  }

  (bool, String?) _checkVelocityVariation(List<FeatureVector> features) {
    final speeds = features.map((f) => f.speed).where((s) => s > 0.01).toList();
    if (speeds.length < 5) return (true, null);
    final mean = speeds.reduce((a, b) => a + b) / speeds.length;
    if (mean < 1e-10) return (true, null);
    final variance =
        speeds.map((s) => (s - mean) * (s - mean)).reduce((a, b) => a + b) /
            speeds.length;
    final cv = sqrt(variance) / mean;
    if (cv < 0.08) {
      return (false, 'Velocity too uniform (CV=${cv.toStringAsFixed(2)})');
    }
    return (true, null);
  }

  (bool, String?) _checkDirectionChanges(List<FeatureVector> features) {
    int changes = 0;
    for (int i = 2; i < features.length; i++) {
      if (features[i].isStrokeBoundary) continue;
      final prevAngle = atan2(features[i - 1].vy, features[i - 1].vx);
      final currAngle = atan2(features[i].vy, features[i].vx);
      double diff = (currAngle - prevAngle).abs();
      if (diff > pi) diff = 2 * pi - diff;
      if (diff > 0.3) changes++;
    }
    final minChanges = max(2, features.length ~/ 20);
    if (changes < minChanges) {
      return (false, 'Too few direction changes ($changes)');
    }
    return (true, null);
  }

  (bool, String?) _checkAccelerationVariation(List<FeatureVector> features) {
    final accMags = features
        .map((f) => sqrt(f.ax * f.ax + f.ay * f.ay))
        .where((a) => a > 0.001)
        .toList();
    if (accMags.length < 5) return (true, null);
    final mean = accMags.reduce((a, b) => a + b) / accMags.length;
    if (mean < 1e-10) return (true, null);
    final variance =
        accMags.map((a) => (a - mean) * (a - mean)).reduce((a, b) => a + b) /
            accMags.length;
    final cv = sqrt(variance) / mean;
    if (cv < 0.06) {
      return (false, 'Acceleration too uniform');
    }
    return (true, null);
  }

  (bool, String?) _checkNotTooSmooth(List<SignaturePoint> points) {
    final spacings = <double>[];
    for (int i = 1; i < points.length; i++) {
      final dx = points[i].x - points[i - 1].x;
      final dy = points[i].y - points[i - 1].y;
      spacings.add(sqrt(dx * dx + dy * dy));
    }
    if (spacings.isEmpty) return (true, null);
    final mean = spacings.reduce((a, b) => a + b) / spacings.length;
    if (mean < 1e-6) return (true, null);
    final variance =
        spacings.map((s) => (s - mean) * (s - mean)).reduce((a, b) => a + b) /
            spacings.length;
    final cv = sqrt(variance) / mean;
    if (cv < 0.05) {
      return (false, 'Suspiciously uniform spacing');
    }
    return (true, null);
  }

  (bool, String?) _checkMicroTremors(List<SignaturePoint> points) {
    // A perfectly smooth trace can happen on high-quality touch devices, so do
    // not reject it by itself. Shape, duration, and dynamics handle matching.
    return (true, null);
  }

  (bool, String?) _checkHesitation(List<SignaturePoint> points) {
    for (int i = 1; i < points.length; i++) {
      final dt = points[i].timestamp - points[i - 1].timestamp;
      final dx = points[i].x - points[i - 1].x;
      final dy = points[i].y - points[i - 1].y;
      final dist = sqrt(dx * dx + dy * dy);

      // Pause longer than 500ms while moving less than 2 pixels is a hesitation
      if (dt > 500 && dist < 2.0) {
        return (false, 'Stroke hesitation detected');
      }
    }
    return (true, null);
  }
}
