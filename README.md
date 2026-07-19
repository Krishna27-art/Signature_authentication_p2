# BioP2: Hybrid Online Signature Verification System

BioP2 is a **prototype browser-based signature authentication system** that combines **Dynamic Time Warping (DTW)**, **Behavioral Biometrics**, and **Machine Learning-Based Similarity Analysis** using Siamese Neural Networks. Built with React and Vite, it runs entirely in the browser.

> **Note**: This is a **research prototype** for academic purposes. It demonstrates hybrid biometric verification concepts.

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
- **Security**: Liveness detection, cancelable biometrics, replay attack prevention

The system captures signatures through a canvas-based interface, stores enrollment samples locally using encrypted IndexedDB, and evaluates future attempts using adaptive thresholding with confidence calibration.

## Key Features

### Core Authentication (Implemented)
- **Hybrid Authentication**: Combines DTW, behavioral biometrics, and Siamese neural networks
- **Enhanced Feature Extraction**: 20-dimensional behavioral features + advanced trajectory processing
- **Siamese Neural Networks**: Triplet loss with MC-Dropout uncertainty estimation
- **BiLSTM with Attention**: Bidirectional LSTM with temporal attention mechanism

### Advanced Algorithms (Implemented)
- **Enhanced DTW**: Sakoe-Chiba band, FastDTW, Weighted DTW
- **Rhythm Analysis**: Micro-pause detection, stroke rhythm, pen-lift behavior
- **Temporal Entropy**: Multi-dimensional entropy analysis, cadence profiling

### Security Features (Implemented)
- **Liveness Detection**: Motion-based, replay attack prevention, behavioral anomaly detection
- **Cancelable Biometrics**: BioHashing, non-invertible transformations, template protection
- **Secure Storage**: AES-GCM encrypted IndexedDB for biometric data
- **Adaptive Thresholding**: Dynamic thresholds based on user history

## Tech Stack

- Frontend: React 19, Vite
- Machine learning: TensorFlow.js
- Storage: IndexedDB and local browser storage
- Testing: Jest, Playwright
- Tooling: ESLint

## Project Structure

```text
src/
├── App.jsx                     # Main application flow
├── components/
│   ├── SignatureCanvas.jsx     # Signature input component
│   ├── ForgeryReplayDemo.jsx   # Demo interface for forgery and replay attacks
│   ├── PerformanceProfiler.jsx # CPU and memory performance monitoring
│   └── VisualizationDashboard.jsx # Visual analytics dashboard
├── lib/
│   ├── behavioral_model.js     # Behavioral feature model (20 features)
│   ├── biometrics.js           # Biometric orchestration and storage
│   ├── image_model.js          # Visual signature analysis (local histogram similarity)
│   ├── score_fusion.js         # Decision fusion logic with adaptive thresholding
│   ├── siamese_network.js      # Siamese BiLSTM with triplet loss + attention
│   ├── forgery_collection.js   # Collect and store forgery attempt records
│   ├── enhanced_dtw.js         # Enhanced DTW algorithms
│   ├── rhythm_analysis.js      # Rhythm & micro-pause detection
│   ├── temporal_entropy.js     # Temporal entropy analysis
│   ├── liveness_detection.js   # Liveness & replay attack detection
│   ├── cancelable_biometrics.js # BioHashing & template protection
│   ├── evaluation_metrics.js   # FAR/FRR/EER, ROC/DET curves
│   ├── explainable_verification.js # Explainable AI metrics
│   ├── device_calibration.js   # Canvas scale & pressure normalization
│   ├── user_manager.js         # User profiles database
│   └── mobile_hardware.js      # Gyroscope/accelerometer integration
tests/
├── unit.test.js                # Unit tests
├── full_system.test.js         # Full system simulation tests
├── e2e.spec.js                 # Playwright end-to-end tests
└── synthetic_gen.js            # Synthetic signature data generation
public/
└── service_worker.js           # Offline support
```

## Available Scripts

```bash
npm run dev         # Start development server
npm run build       # Create production build
npm run preview     # Preview production build locally
npm run lint        # Run ESLint
npm run test        # Run Jest unit tests
npm run test:e2e    # Run Playwright end-to-end tests
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
Feature Extraction (20 biometric features)
      ↓
 ┌──────────────────┐
 │ DTW Matching     │ ← Mathematical sequence alignment
 └──────────────────┘
      +
 ┌──────────────────┐
 │ Siamese Network  │ ← ML-based similarity comparison
 └──────────────────┘
      ↓
Score Fusion (weighted combination)
      ↓
Adaptive Thresholding (confidence-calibrated)
      ↓
Authentication Decision
```

### 1. Enrollment

The user provides **5 signature samples**. The system:

- Filters out tiny strokes (dots, accidental taps)
- Normalizes coordinates for scale independence
- Extracts 20-dimensional behavioral features
- Computes mean profile and tolerance ranges
- Stores encrypted biometric data in IndexedDB

### 2. Verification

When a new signature is submitted, the system performs:

- **Liveness Verification**: Ensures the signature shows natural timing and isn't a replay
- **DTW Matching**: Sequence alignment using normalized trajectories
- **Siamese Comparison**: Neural network-based embedding similarity
- **Score Fusion**: Weighted combination of DTW and Siamese matching
- **Adaptive Thresholding**: Dynamic thresholds updated with verification history

## Security Notes

This project is a **student research prototype** for demonstrating biometric authentication concepts. It is **not production-ready** and should not be used for security-critical applications.
