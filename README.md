# BioP2: Hybrid Online Signature Verification System

BioP2 is a **prototype browser-based signature authentication system** that combines **Dynamic Time Warping (DTW)**, **Behavioral Biometrics**, and **Machine Learning-Based Similarity Analysis** using Siamese Neural Networks. Built with React and Vite, it runs entirely in the browser with offline-first capabilities.

> **Note**: This is a **research prototype** for academic purposes. It demonstrates advanced biometric concepts but is not production-ready for security-critical applications.

![License](https://img.shields.io/badge/license-ISC-blue)
![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite-61dafb)
![AI](https://img.shields.io/badge/AI-TensorFlow.js-orange)
![Testing](https://img.shields.io/badge/testing-Jest%20%7C%20Playwright-green)
![Status](https://img.shields.io/badge/status-Prototype-yellow)

## Overview

BioP2 implements a **hybrid biometric authentication architecture** that fuses multiple verification signals:

- **Mathematical Matching**: Enhanced DTW with Sakoe-Chiba, FastDTW, and Weighted DTW
- **Behavioral Biometrics**: Temporal dynamics, rhythm analysis, micro-pause detection, entropy profiling
- **Deep Learning**: Siamese Networks with triplet loss, BiLSTM with attention
- **Uncertainty Estimation**: Monte Carlo dropout for confidence assessment
- **Security**: Liveness detection, cancelable biometrics, replay attack prevention
- **Analytics**: Performance monitoring, statistical evaluation, visualization dashboard

The system captures signatures through a canvas-based interface, stores enrollment samples locally using encrypted IndexedDB, and evaluates future attempts using adaptive thresholding with confidence calibration.

**Implementation Status**: This is a **student research prototype** demonstrating biometric concepts. Core features are implemented; advanced features are experimental prototypes requiring further development.

## Key Features

### Core Authentication (Implemented)
- **Hybrid Authentication**: Combines DTW, behavioral biometrics, and Siamese neural networks
- **Enhanced Feature Extraction**: 12-dimensional behavioral features + advanced trajectory processing
- **Siamese Neural Networks**: Triplet loss with MC-Dropout uncertainty estimation
- **BiLSTM with Attention**: Bidirectional LSTM with temporal attention mechanism
- **Uncertainty Estimation**: Monte Carlo dropout for confidence assessment

### Advanced Algorithms (Implemented)
- **Enhanced DTW**: Sakoe-Chiba band, FastDTW, DDTW, Weighted DTW, Itakura constraint
- **Trajectory Processing**: Resampling, Bézier/spline smoothing, curvature normalization
- **Stroke Analysis**: Segmentation, directional features, transition matrices
- **Rhythm Analysis**: Micro-pause detection, stroke rhythm, pen-lift behavior
- **Temporal Entropy**: Multi-dimensional entropy analysis, cadence profiling

### Security Features (Implemented)
- **Liveness Detection**: Motion-based, replay attack prevention, behavioral anomaly detection
- **Cancelable Biometrics**: BioHashing, non-invertible transformations, template revocation
- **Secure Storage**: AES-GCM encrypted IndexedDB for biometric data
- **Adaptive Thresholding**: Confidence-calibrated thresholds based on performance

### Analytics & Visualization (Implemented)
- **Performance Monitoring**: Verification statistics, score tracking
- **Visualization Dashboard**: DTW alignment, confidence meter, feature graphs
- **Statistical Evaluation**: Confidence intervals, bootstrap resampling, hypothesis testing
- **Benchmark Dashboard**: ROC/DET curves, score distributions, accuracy metrics

### Experimental Features (Prototype)
- **Mobile Support**: Touch pressure detection, stylus support (device-dependent)
- **Adversarial Detection**: FGSM/PGD attack simulation (prototype)
- **Continuous Learning**: Online adaptation simulation, concept drift detection
- **Transformer Encoders**: Multi-head self-attention (prototype implementation)

**Note**: Experimental features are implemented to demonstrate concepts but require further development and validation.

## Tech Stack

- Frontend: React 19, Vite
- Machine learning: TensorFlow.js, Transformers.js
- Storage: IndexedDB and local browser storage
- Testing: Jest, Playwright
- Tooling: ESLint

## Project Structure

```text
src/
├── App.jsx                     # Main application flow
├── components/
│   ├── SignatureCanvas.jsx     # Signature input component
│   ├── VisualizationDashboard.jsx # Visual analytics dashboard
│   └── BenchmarkDashboard.jsx  # Benchmark evaluation dashboard
├── lib/
│   ├── behavioral_model.js     # Behavioral feature model (12 features)
│   ├── biometrics.js           # Biometric orchestration and storage
│   ├── image_model.js          # Visual signature analysis
│   ├── score_fusion.js         # Decision fusion logic with adaptive thresholding
│   ├── siamese_network.js      # Siamese BiLSTM with triplet loss + attention
│   ├── forgery_detection.js    # Forgery detection with synthetic training
│   ├── enhanced_dtw.js         # Enhanced DTW algorithms
│   ├── trajectory_processing.js # Trajectory resampling & smoothing
│   ├── stroke_analysis.js      # Stroke segmentation & features
│   ├── rhythm_analysis.js      # Rhythm & micro-pause detection
│   ├── temporal_entropy.js     # Temporal entropy analysis
│   ├── liveness_detection.js   # Liveness & replay attack detection
│   ├── cancelable_biometrics.js # BioHashing & template protection
│   ├── evaluation_metrics.js   # FAR/FRR/EER, ROC/DET curves
│   ├── statistical_evaluation.js # Statistical validation
│   ├── uncertainty_estimation.js # MC-Dropout & ensemble uncertainty
│   ├── unified_preprocessing.js # Unified preprocessing pipeline
│   ├── real_accuracy_evaluation.js # Real accuracy metrics (FAR, FRR, EER)
│   ├── performance_optimizer.js # Browser performance optimization
│   ├── transformer_encoder.js  # Transformer & BiLSTM encoders (prototype)
│   ├── mobile_pressure.js      # Touch pressure & stylus support (experimental)
│   ├── adversarial_detection.js # FGSM/PGD attack detection (prototype)
│   ├── benchmark_evaluation.js # SVC2004/SigComp evaluation (interface)
│   ├── adaptive_learning.js    # Online adaptation & drift detection (prototype)
│   ├── cross_device_testing.js # Cross-device compatibility (prototype)
│   ├── analytics_dashboard.js  # Real-time monitoring (prototype)
│   └── mobile_hardware.js     # Gyroscope/accelerometer integration (prototype)
tests/
├── unit.test.js                # Unit tests
├── e2e.spec.js                 # End-to-end tests
└── synthetic_gen.js            # Synthetic signature data generation
public/
└── service_worker.js           # Offline support
```

## Getting Started

### Prerequisites

- Node.js 18 or later recommended
- npm

### Installation

```bash
git clone https://github.com/Krishna27-art/Signature_authentication_system.git
cd Signature_authentication_system
npm install
```

### Run the Application

```bash
npm run dev
```

After the development server starts, open the local Vite URL shown in your terminal.

## Available Scripts

```bash
npm run dev         # Start development server
npm run build       # Create production build
npm run preview     # Preview production build locally
npm run lint        # Run ESLint
npm run test        # Run Jest unit tests
npm run test:e2e    # Run Playwright end-to-end tests
npm run test:e2e:ui # Open Playwright UI mode
npm run test:report # Open Playwright test report
```

## How It Works

### System Architecture

```
Canvas Input
      ↓
Point Capture (pointer events)
      ↓
Preprocessing
      ↓
Feature Extraction (12 biometric features)
      ↓
 ┌──────────────────┐
 │ DTW Matching     │ ← Mathematical sequence alignment
 └──────────────────┘
      +
 ┌──────────────────┐
 │ Behavioral AI    │ ← Temporal dynamics analysis
 └──────────────────┘
      +
 ┌──────────────────┐
 │ Siamese Network  │ ← ML-based similarity comparison
 └──────────────────┘
      +
 ┌──────────────────┐
 │ Forgery Detector │ ← Synthetic attack pattern recognition
 └──────────────────┘
      ↓
Score Fusion (weighted combination)
      ↓
Adaptive Thresholding (confidence-calibrated)
      ↓
Authentication Decision
```

### 1. Enrollment

The user provides **7 signature samples** (increased from 5 for better accuracy). The system:

- Filters out tiny strokes (dots, accidental taps)
- Normalizes coordinates for scale independence
- Extracts 12-dimensional behavioral features
- Trains behavioral model on genuine samples with synthetic negatives
- Computes mean profile and tolerance ranges
- Stores encrypted biometric data in IndexedDB

### 2. Verification

When a new signature is submitted, the system performs:

- **DTW Matching**: Sequence alignment using normalized trajectories
- **Behavioral Analysis**: Velocity, acceleration, pressure, curvature, angular velocity
- **Siamese Comparison**: Neural network-based embedding similarity
- **Forgery Detection**: Pattern recognition against synthetic attack types
- **Score Fusion**: Weighted combination (DTW 65%, Image 17.5%, Behavior 17.5%)
- **Adaptive Thresholding**: Confidence-calibrated based on score stability

### 3. Decision Making

The system uses:

- **Cold-start threshold**: 68 (lowered from 80 for first-time users)
- **Adaptive range**: 65-88 based on user performance history
- **Confidence calibration**: Adjusts threshold based on score stability
- **Behavioral model maturity**: Activates after 25 successful logins

## Testing

This repository includes both unit and browser-based test coverage:

- `Jest` validates core logic and utility behavior
- `Playwright` verifies end-to-end flows
- `test_harness.html` provides a browser-based synthetic testing interface

## Security Notes

This project is a **student research prototype** for demonstrating biometric authentication concepts. It is **not production-ready** and should not be used for security-critical applications.

**Known Limitations:**
- **Browser ML Limitations**: TensorFlow.js has performance and memory constraints compared to server-side ML
- **No Real Datasets**: Evaluation uses synthetic data; real benchmark datasets (SVC2004, SigComp) are not included
- **Prototype Implementations**: Many advanced features (Transformers, federated learning, adversarial defenses) are prototype implementations requiring further development
- **Mobile Hardware**: Mobile sensor integration is experimental and requires device-specific testing
- **No Hardware Security**: Lacks secure enclave, TPM, or hardware-backed biometric protection
- **Continuous Learning Risks**: Online adaptation could potentially learn forged signatures without proper safeguards

**For Production Use:**
- Server-side security review
- Threat modeling and penetration testing
- Formal biometric performance evaluation on real datasets
- Hardware-backed security integration
- Regulatory compliance review (GDPR, biometric data protection laws)

## Repository

- GitHub: https://github.com/Krishna27-art/Signature_authentication_system
- Issues: https://github.com/Krishna27-art/Signature_authentication_system/issues

## License

This project is licensed under the ISC License.
