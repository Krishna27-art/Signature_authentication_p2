import 'package:flutter/material.dart';
import '../models/signature_point.dart';
import '../models/feature_vector.dart';
import '../services/auth_service.dart';
import '../services/haptic_service.dart';
import '../widgets/signature_canvas.dart';
import '../theme/app_theme.dart';

class EnrollmentScreen extends StatefulWidget {
  const EnrollmentScreen({super.key});

  @override
  State<EnrollmentScreen> createState() => _EnrollmentScreenState();
}

class _EnrollmentScreenState extends State<EnrollmentScreen> {
  final AuthService _authService = AuthService();
  final int _requiredSamples = 5;
  int _currentSample = 0;
  bool _isProcessing = false;
  bool _isComplete = false;

  final List<List<FeatureVector>> _enrolledFeatures = [];
  final List<int> _durations = [];
  final List<double> _pairwiseDists = [];

  late String _statusMessage;
  late String _subMessage;
  String? _qualityNote;

  @override
  void initState() {
    super.initState();
    _statusMessage = 'Draw your signature below';
    _subMessage = 'Sample 1 of $_requiredSamples';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            children: [
              const SizedBox(height: 36),
              _buildHeader(),
              const SizedBox(height: 24),
              Expanded(
                child:
                    _isComplete ? _buildCompleteView() : _buildCanvas(),
              ),
              const SizedBox(height: 20),
              _buildProgressBar(),
              const SizedBox(height: 12),
              _buildStatus(),
              if (_qualityNote != null) ...[
                const SizedBox(height: 4),
                Text(_qualityNote!,
                    style: Theme.of(context)
                        .textTheme
                        .bodySmall
                        ?.copyWith(color: AppTheme.warning),
                    textAlign: TextAlign.center),
              ],
              if (_pairwiseDists.isNotEmpty) ...[
                const SizedBox(height: 12),
                _buildConsistencyBar(),
              ],
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppTheme.accent.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Icon(Icons.fingerprint, size: 32, color: AppTheme.accent),
        ),
        const SizedBox(height: 14),
        Text('Create Your Signature',
            style: Theme.of(context).textTheme.headlineLarge,
            textAlign: TextAlign.center),
        const SizedBox(height: 6),
        Text(
            'Sign naturally each time. Your motion patterns\ncreate a secure behavioral template.',
            style: Theme.of(context).textTheme.bodyMedium,
            textAlign: TextAlign.center),
      ],
    );
  }

  Widget _buildCanvas() {
    return SignatureCanvas(
      onSignatureComplete: _onCaptured,
      clearAfterComplete: true,
      showGuides: true,
    );
  }

  Widget _buildCompleteView() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppTheme.success.withValues(alpha: 0.15),
              boxShadow: [
                BoxShadow(
                    color: AppTheme.success.withValues(alpha: 0.3), blurRadius: 30),
              ],
            ),
            child: const Icon(Icons.check_circle_rounded,
                size: 64, color: AppTheme.success),
          ),
          const SizedBox(height: 24),
          Text('Enrollment Complete',
              style: Theme.of(context)
                  .textTheme
                  .headlineMedium
                  ?.copyWith(color: AppTheme.success)),
          const SizedBox(height: 10),
          Text('Template secured. Unlocking...',
              style: Theme.of(context).textTheme.bodyMedium,
              textAlign: TextAlign.center),
        ],
      ),
    );
  }

  Widget _buildProgressBar() {
    return Row(
      children: List.generate(_requiredSamples, (i) {
        final isActive = i == _currentSample && !_isComplete;
        final isDone = i < _currentSample;
        return Expanded(
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            margin: const EdgeInsets.symmetric(horizontal: 3),
            height: 4,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(2),
              color: isDone
                  ? AppTheme.accent
                  : isActive
                      ? AppTheme.accent.withValues(alpha: 0.4)
                      : AppTheme.surfaceLight,
            ),
          ),
        );
      }),
    );
  }

  Widget _buildStatus() {
    return Column(
      children: [
        Text(_statusMessage, style: Theme.of(context).textTheme.bodyLarge),
        const SizedBox(height: 2),
        Text(_subMessage, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }

  Widget _buildConsistencyBar() {
    final maxD = _pairwiseDists.isEmpty
        ? 1.0
        : _pairwiseDists.reduce((a, b) => a > b ? a : b);
    final avgD = _pairwiseDists.isEmpty
        ? 0.0
        : _pairwiseDists.reduce((a, b) => a + b) / _pairwiseDists.length;
    final consistency = (1.0 - (avgD / maxD).toDouble().clamp(0.0, 1.0)).clamp(0.0, 1.0);
    final cc = consistency > 0.7
        ? AppTheme.success
        : consistency > 0.4
            ? AppTheme.warning
            : AppTheme.danger;
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Consistency',
                style: Theme.of(context).textTheme.bodySmall),
            Text('${(consistency * 100).toStringAsFixed(0)}%',
                style: Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: cc)),
          ],
        ),
        const SizedBox(height: 4),
        ClipRRect(
          borderRadius: BorderRadius.circular(2),
          child: LinearProgressIndicator(
            value: consistency,
            backgroundColor: AppTheme.surfaceLight,
            valueColor: AlwaysStoppedAnimation(cc),
            minHeight: 3,
          ),
        ),
      ],
    );
  }

  Future<void> _onCaptured(List<SignaturePoint> points) async {
    if (_isProcessing || _isComplete) return;
    if (points.length < 10) {
      setState(() {
        _statusMessage = 'Too short — sign more deliberately';
        _qualityNote = null;
      });
      return;
    }
    final dur = points.last.timestamp - points.first.timestamp;
    if (dur < 200) {
      setState(() {
        _statusMessage = 'Too fast — take your time';
        _qualityNote = null;
      });
      return;
    }
    setState(() {
      _isProcessing = true;
      _statusMessage = 'Processing...';
      _qualityNote = null;
    });
    _durations.add(dur);
    final features = _authService.processEnrollmentSample(points);
    if (features.isEmpty) {
      setState(() {
        _isProcessing = false;
        _statusMessage = 'Could not extract features. Try again.';
      });
      return;
    }
    if (_enrolledFeatures.isNotEmpty) {
      for (final prev in _enrolledFeatures) {
        _pairwiseDists.add(_authService.computeSingleDTW(features, prev));
      }
    }
    _enrolledFeatures.add(features);
    _currentSample++;
    HapticService.enrolled();
    if (_pairwiseDists.isNotEmpty) {
      final lastD = _enrolledFeatures.length >= 2
          ? _pairwiseDists.sublist(
              _pairwiseDists.length - (_enrolledFeatures.length - 1))
          : _pairwiseDists;
      final mxD = lastD.reduce((a, b) => a > b ? a : b);
      final avD = lastD.reduce((a, b) => a + b) / lastD.length;
      if (mxD > avD * 2.5) {
        _qualityNote =
            'Tip: Try to keep your signature consistent in speed and shape';
      }
    }
    if (_currentSample >= _requiredSamples) {
      final threshold = await _authService.buildTemplate(_enrolledFeatures);
      await _authService.setDurationBounds(_durations);
      if (threshold != null) {
        setState(() {
          _isComplete = true;
          _isProcessing = false;
          _statusMessage = 'Threshold: ${threshold.toStringAsFixed(3)}';
        });
        Future.delayed(const Duration(seconds: 2), () {
          if (mounted) Navigator.of(context).pushReplacementNamed('/lock');
        });
      } else {
        setState(() {
          _isProcessing = false;
          _currentSample = 0;
          _enrolledFeatures.clear();
          _durations.clear();
          _pairwiseDists.clear();
          _statusMessage = 'Enrollment failed. Please try again.';
          _subMessage = 'Sample 1 of $_requiredSamples';
          _qualityNote = 'Your signatures were too different from each other.';
        });
      }
    } else {
      setState(() {
        _isProcessing = false;
        _statusMessage = 'Great! Sign again';
        _subMessage = 'Sample ${_currentSample + 1} of $_requiredSamples';
      });
    }
  }
}