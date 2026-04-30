class FeatureVector {
  final double x;
  final double y;
  final double vx;
  final double vy;
  final double speed;
  final double ax;
  final double ay;
  final double pressure;
  final double curvature;
  final bool isStrokeBoundary;

  const FeatureVector({
    this.x = 0,
    this.y = 0,
    this.vx = 0,
    this.vy = 0,
    this.speed = 0,
    this.ax = 0,
    this.ay = 0,
    this.pressure = 0,
    this.curvature = 0,
    this.isStrokeBoundary = false,
  });

  static const Map<String, double> defaultWeights = {
    'x': 0.05,
    'y': 0.05,
    'vx': 0.15,
    'vy': 0.15,
    'speed': 0.2,
    'ax': 0.1,
    'ay': 0.1,
    'pressure': 0.12,
    'curvature': 0.1,
  };

  double distanceTo(FeatureVector other, Map<String, double> w) {
    double d = 0;
    d += (w['x'] ?? 0.0) * (x - other.x) * (x - other.x);
    d += (w['y'] ?? 0.0) * (y - other.y) * (y - other.y);
    d += (w['vx'] ?? 0.0) * (vx - other.vx) * (vx - other.vx);
    d += (w['vy'] ?? 0.0) * (vy - other.vy) * (vy - other.vy);
    d += (w['speed'] ?? 0.0) * (speed - other.speed) * (speed - other.speed);
    d += (w['ax'] ?? 0.0) * (ax - other.ax) * (ax - other.ax);
    d += (w['ay'] ?? 0.0) * (ay - other.ay) * (ay - other.ay);
    d += (w['pressure'] ?? 0.0) * (pressure - other.pressure) * (pressure - other.pressure);
    d += (w['curvature'] ?? 0.0) * (curvature - other.curvature) * (curvature - other.curvature);
    return d;
  }

  List<double> toList() => [
        x, y, vx, vy, speed, ax, ay, pressure, curvature,
        isStrokeBoundary ? 1.0 : 0.0
      ];

  factory FeatureVector.fromList(List<double> l) => FeatureVector(
        x: l[0],
        y: l[1],
        vx: l[2],
        vy: l[3],
        speed: l[4],
        ax: l[5],
        ay: l[6],
        pressure: l[7],
        curvature: l[8],
        isStrokeBoundary: l.length > 9 && l[9] == 1.0,
      );

  Map<String, dynamic> toJson() => {
        'x': x,
        'y': y,
        'vx': vx,
        'vy': vy,
        's': speed,
        'ax': ax,
        'ay': ay,
        'p': pressure,
        'c': curvature,
        'sb': isStrokeBoundary ? 1 : 0,
      };

  factory FeatureVector.fromJson(Map<String, dynamic> json) => FeatureVector(
        x: (json['x'] as num).toDouble(),
        y: (json['y'] as num).toDouble(),
        vx: (json['vx'] as num).toDouble(),
        vy: (json['vy'] as num).toDouble(),
        speed: (json['s'] as num).toDouble(),
        ax: (json['ax'] as num).toDouble(),
        ay: (json['ay'] as num).toDouble(),
        pressure: (json['p'] as num).toDouble(),
        curvature: (json['c'] as num).toDouble(),
        isStrokeBoundary: (json['sb'] as int) == 1,
      );
}