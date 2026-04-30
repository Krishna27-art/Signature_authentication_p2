import 'package:flutter/material.dart';
import 'package:flutter_windowmanager/flutter_windowmanager.dart';
import 'app.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Mobile Security: Screenshot protection (Android)
  try {
    await FlutterWindowManager.addFlags(FlutterWindowManager.FLAG_SECURE);
  } catch (e) {
    debugPrint('WindowManager Error: $e');
  }

  runApp(const SigAuthApp());
}
