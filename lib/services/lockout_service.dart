import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class LockoutService {
  LockoutService._();
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );
  static const _failKey = 'sigauth_fail_count';
  static const _lockKey = 'sigauth_lock_until';
  static const int maxFailures = 5;
  static const int baseLockoutSeconds = 15;

  static Future<int> checkLockout() async {
    final lockUntil = await _storage.read(key: _lockKey);
    if (lockUntil == null) return 0;
    final lockMs = int.tryParse(lockUntil) ?? 0;
    final now = DateTime.now().millisecondsSinceEpoch;
    final remaining = ((lockMs - now) / 1000).ceil();
    if (remaining <= 0) {
      await _storage.delete(key: _lockKey);
      await _storage.delete(key: _failKey);
      return 0;
    }
    return remaining;
  }

  static Future<bool> recordFailure() async {
    final countStr = await _storage.read(key: _failKey);
    int count = int.tryParse(countStr ?? '0') ?? 0;
    count++;
    if (count >= maxFailures) {
      final lockSeconds =
          baseLockoutSeconds * (1 << ((count - maxFailures).clamp(0, 4).toInt()));
      final lockUntil = DateTime.now()
          .add(Duration(seconds: lockSeconds))
          .millisecondsSinceEpoch;
      await _storage.write(key: _lockKey, value: lockUntil.toString());
      await _storage.write(key: _failKey, value: count.toString());
      return true;
    }
    await _storage.write(key: _failKey, value: count.toString());
    return false;
  }

  static Future<void> recordSuccess() async {
    await _storage.delete(key: _failKey);
    await _storage.delete(key: _lockKey);
  }

  static Future<int> getFailureCount() async {
    final countStr = await _storage.read(key: _failKey);
    return int.tryParse(countStr ?? '0') ?? 0;
  }

  static Future<void> reset() async {
    await _storage.delete(key: _failKey);
    await _storage.delete(key: _lockKey);
  }
}