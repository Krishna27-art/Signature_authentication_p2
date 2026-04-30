import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/signature_template.dart';

class SecureStorageService {
  final FlutterSecureStorage _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  static const _templateKey = 'sigauth_template_v2';
  static const _settingsKey = 'sigauth_settings_v2';
  static const _historyKey = 'sigauth_history_v2';

  Future<bool> hasTemplate() async {
    return await _storage.containsKey(key: _templateKey);
  }

  Future<void> saveTemplate(SignatureTemplate template) async {
    final json = jsonEncode(template.toJson());
    await _storage.write(key: _templateKey, value: json);
  }

  Future<SignatureTemplate?> loadTemplate() async {
    final json = await _storage.read(key: _templateKey);
    if (json == null) return null;
    try {
      return SignatureTemplate.fromJson(
          jsonDecode(json) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<void> deleteTemplate() async {
    await _storage.delete(key: _templateKey);
  }

  Future<Map<String, dynamic>> loadSettings() async {
    final json = await _storage.read(key: _settingsKey);
    if (json == null) {
      return {
        'sensitivity': 0.5,
        'adaptiveLearning': true,
        'livenessCheck': true,
      };
    }
    try {
      return jsonDecode(json) as Map<String, dynamic>;
    } catch (_) {
      return {'sensitivity': 0.5, 'adaptiveLearning': true, 'livenessCheck': true};
    }
  }

  Future<void> saveSettings(Map<String, dynamic> settings) async {
    await _storage.write(key: _settingsKey, value: jsonEncode(settings));
  }

  Future<List<Map<String, dynamic>>> loadHistory() async {
    final json = await _storage.read(key: _historyKey);
    if (json == null) return [];
    try {
      return (jsonDecode(json) as List).cast<Map<String, dynamic>>();
    } catch (_) {
      return [];
    }
  }

  Future<void> appendHistory(Map<String, dynamic> entry) async {
    final history = await loadHistory();
    history.add(entry);
    if (history.length > 50) history.removeRange(0, history.length - 50);
    await _storage.write(key: _historyKey, value: jsonEncode(history));
  }

  Future<void> clearHistory() async {
    await _storage.delete(key: _historyKey);
  }

  Future<void> deleteAll() async {
    await _storage.delete(key: _templateKey);
    await _storage.delete(key: _settingsKey);
    await _storage.delete(key: _historyKey);
  }
}