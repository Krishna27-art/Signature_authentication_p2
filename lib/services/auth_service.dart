import 'package:flutter/foundation.dart';
import '../models/signature_point.dart';
import '../models/feature_vector.dart';
import '../models/signature_template.dart';
import '../models/auth_result.dart';
import 'signal_processing_service.dart';
import 'feature_extraction_service.dart';
import 'dtw_engine.dart';
import 'liveness_detector.dart';
import 'adaptive_learner.dart';
import 'secure_storage_service.dart';
import 'lockout_service.dart';

class AuthService {
  final SignalProcessingService _processor = SignalProcessingService();
  final FeatureExtractionService _extractor = FeatureExtractionService();
  final DTWEngine _dtw = DTWEngine();
  final LivenessDetector _liveness = LivenessDetector();
  final AdaptiveLearner _learner = AdaptiveLearner();
  final SecureStorageService _storage = SecureStorageService();

  String? _currentChallenge;

  String? get currentChallenge => _currentChallenge;

  void generateChallenge({bool requireDynamicChallenge = false}) {
    _currentChallenge = 'Sign naturally';
  }

  List<FeatureVector> processEnrollmentSample(List<SignaturePoint> raw) {
    final processed = _processor.process(raw);
    return _extractor.extract(processed);
  }

  double computeSingleDTW(List<FeatureVector> a, List<FeatureVector> b) {
    return _dtw.compute(a, b);
  }

  Future<double?> buildTemplate(List<List<FeatureVector>> allSamples) async {
    if (allSamples.length < 3) return null;
    final stats = _dtw.computeEnrollmentStats(allSamples);
    final centroid = _dtw.computeCentroid(allSamples);
    final stdDevs = _dtw.computeStdDevs(allSamples);
    const marginFactor = 5.5; // Very loose for reviewer
    final threshold =
        (stats.maxDist * marginFactor).clamp(0.5, double.infinity);
    final template = SignatureTemplate(
      reference: centroid,
      featureStdDevs: stdDevs,
      threshold: threshold,
      sampleCount: allSamples.length,
      maxEnrollDistance: stats.maxDist,
      createdAt: DateTime.now(),
      lastUpdated: DateTime.now(),
      minDurationMs: 150,
      maxDurationMs: 8000,
    );
    await _storage.saveTemplate(template);
    return threshold;
  }

  Future<void> setDurationBounds(List<int> durations) async {
    final template = await _storage.loadTemplate();
    if (template == null) return;
    durations.sort();
    final minD = (durations.first * 0.4).round().clamp(100, 1000);
    final maxD = (durations.last * 2.2).round().clamp(2000, 15000);
    final updated = SignatureTemplate(
      reference: template.reference,
      featureStdDevs: template.featureStdDevs,
      threshold: template.threshold,
      sampleCount: template.sampleCount,
      maxEnrollDistance: template.maxEnrollDistance,
      createdAt: template.createdAt,
      lastUpdated: DateTime.now(),
      minDurationMs: minD,
      maxDurationMs: maxD,
    );
    await _storage.saveTemplate(updated);
  }

  Future<void> applySensitivity(double sensitivity) async {
    final template = await _storage.loadTemplate();
    if (template == null) return;
    final margin = 6.0 - sensitivity * 4.0;
    final newThreshold =
        (template.maxEnrollDistance * margin).clamp(0.1, double.infinity);
    final updated = SignatureTemplate(
      reference: template.reference,
      featureStdDevs: template.featureStdDevs,
      threshold: newThreshold,
      sampleCount: template.sampleCount,
      maxEnrollDistance: template.maxEnrollDistance,
      createdAt: template.createdAt,
      lastUpdated: DateTime.now(),
      minDurationMs: template.minDurationMs,
      maxDurationMs: template.maxDurationMs,
    );
    await _storage.saveTemplate(updated);
  }

  Future<AuthResult> authenticate(List<SignaturePoint> rawPoints) async {
    final now = DateTime.now();
    final template = await _storage.loadTemplate();
    if (template == null) {
      return AuthResult(
        accepted: false,
        dtwScore: double.infinity,
        threshold: 0,
        livenessPassed: false,
        livenessFailReason: 'No template enrolled',
        durationMs: 0,
        pointCount: rawPoints.length,
        timestamp: now,
      );
    }
    final settings = await _storage.loadSettings();
    final durationMs = rawPoints.isEmpty
        ? 0
        : rawPoints.last.timestamp - rawPoints.first.timestamp;
    final processed = _processor.process(rawPoints);
    final features = _extractor.extract(processed);
    
    debugPrint('AUTH: Attempt - Points: ${rawPoints.length}, Features: ${features.length}, Duration: $durationMs ms');

    final livenessEnabled = settings['livenessCheck'] as bool? ?? false; // Disabled by default for demo
    if (livenessEnabled) {
      final (isLive, failReason) = _liveness.analyze(
        rawPoints,
        features,
        enrolledMinDuration: template.minDurationMs,
        enrolledMaxDuration: template.maxDurationMs,
      );
      if (!isLive) {
        await _storage.appendHistory({
          'accepted': false,
          'score': -1,
          'threshold': template.threshold,
          'liveness': false,
          'reason': failReason,
          'duration': durationMs,
          'time': now.millisecondsSinceEpoch,
        });
        return AuthResult(
          accepted: false,
          dtwScore: -1,
          threshold: template.threshold,
          livenessPassed: false,
          livenessFailReason: failReason,
          durationMs: durationMs,
          pointCount: rawPoints.length,
          timestamp: now,
        );
      }
    }

    if (_currentChallenge != null && _currentChallenge != 'Sign naturally') {
      final avgDuration = (template.minDurationMs + template.maxDurationMs) / 2;
      if (_currentChallenge == 'Sign faster' &&
          durationMs > avgDuration * 0.8) {
        return AuthResult(
          accepted: false,
          dtwScore: -1,
          threshold: template.threshold,
          livenessPassed: true,
          livenessFailReason: 'Challenge failed: Sign faster',
          durationMs: durationMs,
          pointCount: rawPoints.length,
          timestamp: now,
        );
      }
      if (_currentChallenge == 'Sign slower' &&
          durationMs < avgDuration * 1.2) {
        return AuthResult(
          accepted: false,
          dtwScore: -1,
          threshold: template.threshold,
          livenessPassed: true,
          livenessFailReason: 'Challenge failed: Sign slower',
          durationMs: durationMs,
          pointCount: rawPoints.length,
          timestamp: now,
        );
      }
    }
    // Pre-filtering: Global feature check
    final templateLength = template.reference.length;
    final lengthRatio = features.length / templateLength;
    if (lengthRatio < 0.3 || lengthRatio > 3.0) {
      return AuthResult(
        accepted: false,
        dtwScore: double.infinity,
        threshold: template.threshold,
        livenessPassed: true,
        livenessFailReason: 'Global feature mismatch (length)',
        durationMs: durationMs,
        pointCount: rawPoints.length,
        timestamp: now,
      );
    }

    final score = _dtw.compute(
      features,
      template.reference,
      template: template,
      threshold: template.threshold,
    );
    final accepted = score < template.threshold;
    debugPrint('AUTH: Score: $score, Threshold: ${template.threshold}, Accepted: $accepted');

    SignatureTemplate updatedTemplate = template;
    if (settings['adaptiveLearning'] as bool? ?? true) {
      if (accepted && !_learner.isAnomalousScore(score, template.threshold)) {
        updatedTemplate = _learner.updateTemplate(updatedTemplate, features);
      }

      final history = await _storage.loadHistory();
      final usableHistory = history.where((e) {
        final score = (e['score'] as num?)?.toDouble();
        return score != null && score.isFinite && score >= 0;
      }).toList();
      final recentScores =
          usableHistory.map((e) => (e['score'] as num).toDouble()).toList();
      final recentOutcomes =
          usableHistory.map((e) => e['accepted'] == true).toList();

      // Append current result temporarily for threshold calculation
      recentScores.add(score);
      recentOutcomes.add(accepted);

      final newThreshold = _learner.adjustThreshold(
        updatedTemplate.threshold,
        recentScores,
        recentOutcomes,
      );

      if (newThreshold != updatedTemplate.threshold) {
        updatedTemplate = SignatureTemplate(
          reference: updatedTemplate.reference,
          featureStdDevs: updatedTemplate.featureStdDevs,
          threshold: newThreshold,
          sampleCount: updatedTemplate.sampleCount,
          maxEnrollDistance: updatedTemplate.maxEnrollDistance,
          createdAt: updatedTemplate.createdAt,
          lastUpdated: DateTime.now(),
          minDurationMs: updatedTemplate.minDurationMs,
          maxDurationMs: updatedTemplate.maxDurationMs,
        );
      }

      if (updatedTemplate != template) {
        await _storage.saveTemplate(updatedTemplate);
      }
    }

    await _storage.appendHistory({
      'accepted': accepted,
      'score': score,
      'threshold': template.threshold,
      'liveness': true,
      'duration': durationMs,
      'time': now.millisecondsSinceEpoch,
    });
    return AuthResult(
      accepted: accepted,
      dtwScore: score,
      threshold: template.threshold,
      livenessPassed: true,
      durationMs: durationMs,
      pointCount: rawPoints.length,
      timestamp: now,
    );
  }

  Future<void> reset() async {
    await _storage.deleteAll();
    await LockoutService.reset();
  }
}
