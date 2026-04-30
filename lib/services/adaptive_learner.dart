import '../models/feature_vector.dart';
import '../models/signature_template.dart';

class AdaptiveLearner {
  static const double learningRate = 0.08;
  static const int maxAdaptations = 200;

  bool isAnomalousScore(double score, double threshold) {
    if (threshold == 0) return true;
    final ratio = score / threshold;
    // Scores too close to rejection or too perfect are suspicious
    return ratio > 0.9 || ratio < 0.05;
  }

  SignatureTemplate updateTemplate(
    SignatureTemplate current,
    List<FeatureVector> newFeatures, {
    double? customLearningRate,
  }) {
    final lr = customLearningRate ?? learningRate;
    final ref = current.reference;
    if (ref.length != newFeatures.length) {
      return current;
    }
    final updatedRef = <FeatureVector>[];
    for (int i = 0; i < ref.length; i++) {
      final oldF = ref[i];
      final newF = newFeatures[i];
      updatedRef.add(FeatureVector(
        x: (1 - lr) * oldF.x + lr * newF.x,
        y: (1 - lr) * oldF.y + lr * newF.y,
        vx: (1 - lr) * oldF.vx + lr * newF.vx,
        vy: (1 - lr) * oldF.vy + lr * newF.vy,
        speed: (1 - lr) * oldF.speed + lr * newF.speed,
        ax: (1 - lr) * oldF.ax + lr * newF.ax,
        ay: (1 - lr) * oldF.ay + lr * newF.ay,
        pressure: (1 - lr) * oldF.pressure + lr * newF.pressure,
        curvature: (1 - lr) * oldF.curvature + lr * newF.curvature,
        isStrokeBoundary: oldF.isStrokeBoundary,
      ));
    }
    return SignatureTemplate(
      reference: updatedRef,
      featureStdDevs: current.featureStdDevs,
      threshold: current.threshold,
      sampleCount: current.sampleCount,
      maxEnrollDistance: current.maxEnrollDistance,
      createdAt: current.createdAt,
      lastUpdated: DateTime.now(),
      minDurationMs: current.minDurationMs,
      maxDurationMs: current.maxDurationMs,
    );
  }

  double adjustThreshold(
    double currentThreshold,
    List<double> recentScores,
    List<bool> recentOutcomes, {
    double maxRelax = 1.15,
    double maxTighten = 0.95,
  }) {
    if (recentOutcomes.length < 3) return currentThreshold;
    final recentFailures =
        recentOutcomes.reversed.take(3).where((o) => !o).length;
    if (recentFailures >= 3) {
      return (currentThreshold * maxRelax)
          .clamp(currentThreshold * 0.8, currentThreshold * 1.3);
    }
    final recentPassScores = <double>[];
    for (int i = 0;
        i < recentOutcomes.length && recentPassScores.length < 5;
        i++) {
      final idx = recentOutcomes.length - 1 - i;
      if (recentOutcomes[idx]) {
        recentPassScores.add(recentScores[idx] / currentThreshold);
      }
    }
    if (recentPassScores.length >= 3) {
      final avgRatio =
          recentPassScores.reduce((a, b) => a + b) / recentPassScores.length;
      if (avgRatio < 0.4) {
        return (currentThreshold * maxTighten)
            .clamp(currentThreshold * 0.7, currentThreshold * 1.1);
      }
    }
    return currentThreshold;
  }
}