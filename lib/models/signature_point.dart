/// Raw point captured from touch/pen input.
/// Layer 2: Input Capture — the fundamental data unit.
class SignaturePoint {
  final double x;
  final double y;
  final double pressure; // 0.0–1.0, 0.5 default if device cannot read
  final int timestamp; // milliseconds since first point in this signature
  final int pointerId;
  final bool isStrokeStart; // true for the first point of each new stroke

  const SignaturePoint({
    required this.x,
    required this.y,
    this.pressure = 0.5,
    required this.timestamp,
    this.pointerId = 0,
    this.isStrokeStart = false,
  });

  Map<String, dynamic> toJson() => {
        'x': x,
        'y': y,
        'p': pressure,
        't': timestamp,
        'pid': pointerId,
        's': isStrokeStart ? 1 : 0,
      };

  factory SignaturePoint.fromJson(Map<String, dynamic> json) => SignaturePoint(
        x: (json['x'] as num).toDouble(),
        y: (json['y'] as num).toDouble(),
        pressure: (json['p'] as num?)?.toDouble() ?? 0.5,
        timestamp: json['t'] as int,
        pointerId: json['pid'] as int? ?? 0,
        isStrokeStart: (json['s'] as int?) == 1,
      );

  @override
  String toString() =>
      'Pt(x:${x.toStringAsFixed(1)} y:${y.toStringAsFixed(1)} t:$timestamp${isStrokeStart ? " [STROKE]" : ""})';
}
