import 'feature_vector.dart';

class SignatureTemplate {
  final List<FeatureVector> reference;
  final List<double> featureStdDevs;
  final double threshold;
  final int sampleCount;
  final double maxEnrollDistance;
  final DateTime createdAt;
  final DateTime lastUpdated;
  final int minDurationMs;
  final int maxDurationMs;

  const SignatureTemplate({
    required this.reference,
    required this.featureStdDevs,
    required this.threshold,
    required this.sampleCount,
    required this.maxEnrollDistance,
    required this.createdAt,
    required this.lastUpdated,
    required this.minDurationMs,
    required this.maxDurationMs,
  });

  Map<String, dynamic> toJson() => {
        'ref': reference.map((f) => f.toList()).toList(),
        'std': featureStdDevs,
        'thr': threshold,
        'n': sampleCount,
        'maxD': maxEnrollDistance,
        'created': createdAt.millisecondsSinceEpoch,
        'updated': lastUpdated.millisecondsSinceEpoch,
        'minDur': minDurationMs,
        'maxDur': maxDurationMs,
      };

  factory SignatureTemplate.fromJson(Map<String, dynamic> json) {
    final refLists = (json['ref'] as List).cast<List<dynamic>>();
    final ref = refLists
        .map((l) => FeatureVector.fromList(l.cast<double>()))
        .toList();
    final std = (json['std'] as List).cast<double>();
    return SignatureTemplate(
      reference: ref,
      featureStdDevs: std,
      threshold: (json['thr'] as num).toDouble(),
      sampleCount: json['n'] as int,
      maxEnrollDistance: (json['maxD'] as num).toDouble(),
      createdAt: DateTime.fromMillisecondsSinceEpoch(json['created'] as int),
      lastUpdated: DateTime.fromMillisecondsSinceEpoch(json['updated'] as int),
      minDurationMs: json['minDur'] as int? ?? 200,
      maxDurationMs: json['maxDur'] as int? ?? 5000,
    );
  }
}