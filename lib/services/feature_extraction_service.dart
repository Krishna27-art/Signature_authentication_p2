import 'dart:math';
import '../models/signature_point.dart';
import '../models/feature_vector.dart';

class FeatureExtractionService {
  List<FeatureVector> extract(List<SignaturePoint> points) {
    if (points.length < 3) return [];
    final n = points.length;

    // Step 1: position + pressure
    final features = List<FeatureVector>.filled(
        n,
        const FeatureVector(
          x: 0, y: 0, vx: 0, vy: 0, speed: 0,
          ax: 0, ay: 0, pressure: 0, curvature: 0,
        ));
    for (int i = 0; i < n; i++) {
      features[i] = FeatureVector(
        x: points[i].x,
        y: points[i].y,
        pressure: points[i].pressure,
        isStrokeBoundary: points[i].isStrokeStart,
      );
    }

    // Step 2: velocities
    final velocities = _computeVelocities(points);
    for (int i = 0; i < n; i++) {
      features[i] = FeatureVector(
        x: features[i].x,
        y: features[i].y,
        vx: velocities[i].dx,
        vy: velocities[i].dy,
        speed: velocities[i].speed,
        pressure: features[i].pressure,
        isStrokeBoundary: features[i].isStrokeBoundary,
      );
    }

    // Step 3: accelerations
    final accelerations = _computeAccelerations(velocities);
    for (int i = 0; i < n; i++) {
      features[i] = FeatureVector(
        x: features[i].x,
        y: features[i].y,
        vx: features[i].vx,
        vy: features[i].vy,
        speed: features[i].speed,
        ax: accelerations[i].dx,
        ay: accelerations[i].dy,
        pressure: features[i].pressure,
        isStrokeBoundary: features[i].isStrokeBoundary,
      );
    }

    // Step 4: curvature
    final curvatures = _computeCurvatures(points);
    for (int i = 0; i < n; i++) {
      features[i] = FeatureVector(
        x: features[i].x,
        y: features[i].y,
        vx: features[i].vx,
        vy: features[i].vy,
        speed: features[i].speed,
        ax: features[i].ax,
        ay: features[i].ay,
        pressure: features[i].pressure,
        curvature: curvatures[i],
        isStrokeBoundary: features[i].isStrokeBoundary,
      );
    }

    // Step 5: normalize dynamics
    return _normalizeFeatures(features);
  }

  List<_Vel> _computeVelocities(List<SignaturePoint> points) {
    final n = points.length;
    final result = List<_Vel>.filled(n, const _Vel(0, 0, 0));
    for (int i = 0; i < n; i++) {
      if (points[i].isStrokeStart && i > 0) {
        result[i] = const _Vel(0, 0, 0);
        continue;
      }
      double dx, dy, dt;
      if (i == 0) {
        if (n > 1 && !points[1].isStrokeStart) {
          dx = points[1].x - points[0].x;
          dy = points[1].y - points[0].y;
          dt = (points[1].timestamp - points[0].timestamp).toDouble();
        } else {
          continue;
        }
      } else if (i == n - 1) {
        dx = points[i].x - points[i - 1].x;
        dy = points[i].y - points[i - 1].y;
        dt = (points[i].timestamp - points[i - 1].timestamp).toDouble();
      } else {
        if (points[i + 1].isStrokeStart) {
          dx = points[i].x - points[i - 1].x;
          dy = points[i].y - points[i - 1].y;
          dt = (points[i].timestamp - points[i - 1].timestamp).toDouble();
        } else {
          dx = (points[i + 1].x - points[i - 1].x) / 2;
          dy = (points[i + 1].y - points[i - 1].y) / 2;
          dt = ((points[i + 1].timestamp - points[i - 1].timestamp) / 2)
              .toDouble();
        }
      }
      dt = dt.abs();
      if (dt < 1) dt = 1;
      result[i] = _Vel(dx / dt, dy / dt, sqrt(dx * dx + dy * dy) / dt);
    }
    return result;
  }

  List<_Vel> _computeAccelerations(List<_Vel> velocities) {
    final n = velocities.length;
    final result = List<_Vel>.filled(n, const _Vel(0, 0, 0));
    for (int i = 0; i < n; i++) {
      if (i == 0) {
        if (n > 1) {
          result[i] = _Vel(
            velocities[1].dx - velocities[0].dx,
            velocities[1].dy - velocities[0].dy,
            velocities[1].speed - velocities[0].speed,
          );
        }
      } else if (i == n - 1) {
        result[i] = _Vel(
          velocities[i].dx - velocities[i - 1].dx,
          velocities[i].dy - velocities[i - 1].dy,
          velocities[i].speed - velocities[i - 1].speed,
        );
      } else {
        result[i] = _Vel(
          (velocities[i + 1].dx - velocities[i - 1].dx) / 2,
          (velocities[i + 1].dy - velocities[i - 1].dy) / 2,
          (velocities[i + 1].speed - velocities[i - 1].speed) / 2,
        );
      }
    }
    return result;
  }

  List<double> _computeCurvatures(List<SignaturePoint> points) {
    final n = points.length;
    final curvatures = List<double>.filled(n, 0);
    for (int i = 1; i < n - 1; i++) {
      if (points[i].isStrokeStart || points[i + 1].isStrokeStart) {
        curvatures[i] = 0;
        continue;
      }
      final dx1 = points[i].x - points[i - 1].x;
      final dy1 = points[i].y - points[i - 1].y;
      final dx2 = points[i + 1].x - points[i].x;
      final dy2 = points[i + 1].y - points[i].y;
      final cross = (dx1 * dy2 - dy1 * dx2).abs();
      final d1 = sqrt(dx1 * dx1 + dy1 * dy1);
      final d2 = sqrt(dx2 * dx2 + dy2 * dy2);
      final denom = (d1 * d2 * (d1 + d2) / 2);
      curvatures[i] = denom > 1e-10 ? cross / denom : 0;
    }
    return curvatures;
  }

  List<FeatureVector> _normalizeFeatures(List<FeatureVector> features) {
    if (features.isEmpty) return features;
    double minVx = double.infinity, maxVx = double.negativeInfinity;
    double minVy = double.infinity, maxVy = double.negativeInfinity;
    double minSpd = double.infinity, maxSpd = double.negativeInfinity;
    double minAx = double.infinity, maxAx = double.negativeInfinity;
    double minAy = double.infinity, maxAy = double.negativeInfinity;
    double minCurv = double.infinity, maxCurv = double.negativeInfinity;
    for (final f in features) {
      if (f.vx < minVx) minVx = f.vx;
      if (f.vx > maxVx) maxVx = f.vx;
      if (f.vy < minVy) minVy = f.vy;
      if (f.vy > maxVy) maxVy = f.vy;
      if (f.speed < minSpd) minSpd = f.speed;
      if (f.speed > maxSpd) maxSpd = f.speed;
      if (f.ax < minAx) minAx = f.ax;
      if (f.ax > maxAx) maxAx = f.ax;
      if (f.ay < minAy) minAy = f.ay;
      if (f.ay > maxAy) maxAy = f.ay;
      if (f.curvature < minCurv) minCurv = f.curvature;
      if (f.curvature > maxCurv) maxCurv = f.curvature;
    }
    return features.map((f) {
      return FeatureVector(
        x: f.x,
        y: f.y,
        vx: _nv(f.vx, minVx, maxVx),
        vy: _nv(f.vy, minVy, maxVy),
        speed: _nv(f.speed, minSpd, maxSpd),
        ax: _nv(f.ax, minAx, maxAx),
        ay: _nv(f.ay, minAy, maxAy),
        pressure: f.pressure,
        curvature: _nv(f.curvature, minCurv, maxCurv),
        isStrokeBoundary: f.isStrokeBoundary,
      );
    }).toList();
  }

  double _nv(double v, double min, double max) {
    final range = max - min;
    if (range < 1e-10) return 0.5;
    return ((v - min) / range).clamp(0.0, 1.0);
  }
}

class _Vel {
  final double dx, dy, speed;
  const _Vel(this.dx, this.dy, this.speed);
}