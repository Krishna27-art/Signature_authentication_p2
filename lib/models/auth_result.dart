class AuthResult {
  final bool accepted;
  final double dtwScore;
  final double threshold;
  final bool livenessPassed;
  final String? livenessFailReason;
  final int durationMs;
  final int pointCount;
  final DateTime timestamp;

  const AuthResult({
    required this.accepted,
    required this.dtwScore,
    required this.threshold,
    required this.livenessPassed,
    this.livenessFailReason,
    required this.durationMs,
    required this.pointCount,
    required this.timestamp,
  });

  double get scoreRatio =>
      threshold > 0 ? dtwScore / threshold : (dtwScore > 0 ? 999.0 : 0.0);
}