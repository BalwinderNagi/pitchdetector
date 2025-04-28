import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import Meyda from 'meyda';
import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';
import { decode as atob } from 'base-64';

import modelAsset from '../assets/pitch_detector.tflite';

// Shared singleton model instance
let model: TensorflowModel | null = null;

// Define buffer interface to support TypeScript
interface ProcessingBuffers {
  powerSpec: Float32Array;
  melOutput: Float32Array;
  inputTensor: Float32Array;
  wavBuffer?: Float32Array;
  decodeBuffer?: ArrayBuffer;
  decodeView?: Uint8Array;
  hannWindow?: Float32Array;
  frameBuffer?: Float32Array;
  [key: string]: any; // Allow dynamic properties
}

// Pre-allocated buffers for performance
const BUFFERS: ProcessingBuffers = {
  // Mel spectrogram computation
  powerSpec: new Float32Array(2048),
  melOutput: new Float32Array(64 * 128),
  // Reusable model input tensor (avoid constant reallocation)
  inputTensor: new Float32Array(1 * 64 * 128 * 1)
};

// Cached Mel filterbank
let melFilterBank: ((powerSpectrum: number[]) => number[]) | null = null;

// 1) Helper: create mel filterbank with memoization
function createMelFilterBank(options: {
  sampleRate: number;
  windowSize: number;
  melBands: number;
  fmin?: number;
  fmax?: number;
}): (powerSpectrum: number[]) => number[] {
  // If we already have a filterbank with the same parameters, return it
  if (melFilterBank) return melFilterBank;

  const { sampleRate, windowSize, melBands, fmin = 80, fmax = sampleRate / 2 } = options;
  const fftBins = windowSize / 2;
  const hzPerBin = sampleRate / windowSize;

  // Mel scale conversion functions
  function hzToMel(hz: number) {
    return 2595 * Math.log10(1 + hz / 700);
  }
  function melToHz(mel: number) {
    return 700 * (10 ** (mel / 2595) - 1);
  }

  const melMin = hzToMel(fmin);
  const melMax = hzToMel(fmax);

  // Pre-compute mel points for performance
  const melPoints = Array.from({ length: melBands + 2 }, (_, i) =>
    melToHz(melMin + (i / (melBands + 1)) * (melMax - melMin))
  );

  // Convert mel points to FFT bin indices
  const binPoints = melPoints.map(mel => Math.floor(mel / hzPerBin));

  // Pre-compute filter banks
  const filters = Array.from({ length: melBands }, (_, i) => {
    const filter = new Float32Array(fftBins);
    for (let j = binPoints[i]; j < binPoints[i + 1]; j++) {
      filter[j] = (j - binPoints[i]) / (binPoints[i + 1] - binPoints[i]);
    }
    for (let j = binPoints[i + 1]; j < binPoints[i + 2]; j++) {
      filter[j] = (binPoints[i + 2] - j) / (binPoints[i + 2] - binPoints[i + 1]);
    }
    return filter;
  });

  // Create and cache the filterbank function
  melFilterBank = function (powerSpectrum: number[]): number[] {
    return filters.map(filter =>
      powerSpectrum.reduce((sum, val, idx) => sum + val * filter[idx], 0)
    );
  };

  return melFilterBank;
}

// 2) Initialize model with proper error handling
export async function initPitchModel() {
  if (model !== null) return;

  try {
    // Load asset with explicit path tracking
    const asset = Asset.fromModule(modelAsset);
    await asset.downloadAsync();

    if (!asset.localUri) {
      throw new Error('Model file path missing.');
    }

    console.log('Loading pitch detection model from:', asset.localUri);

    // Load model with more detailed error handling
    try {
      model = await loadTensorflowModel({
        url: asset.localUri
      });
      console.log('Pitch detection model loaded successfully');
    } catch (modelError) {
      console.error('TensorFlow model load error:', modelError);
      throw new Error(`Failed to load TensorFlow model: ${modelError.message}`);
    }
  } catch (err) {
    console.error('Failed to initialize pitch detection model:', err);
    // Don't rethrow - allow app to continue without ML functionality
  }
}

// 3) Optimized PCM conversion with direct reuse of buffer
function convertPCM(pcmData: Int16Array): Float32Array {
  // Create output buffer only if needed
  let out: Float32Array;

  if (!BUFFERS.wavBuffer || BUFFERS.wavBuffer.length < pcmData.length) {
    // Store in BUFFERS for future reuse
    BUFFERS.wavBuffer = new Float32Array(pcmData.length);
  }
  out = BUFFERS.wavBuffer!;

  // Normalize in place (optimization: unroll loop for faster processing)
  const len = pcmData.length;
  for (let i = 0; i < len - 3; i += 4) {
    out[i] = pcmData[i] / 32768;
    out[i + 1] = pcmData[i + 1] / 32768;
    out[i + 2] = pcmData[i + 2] / 32768;
    out[i + 3] = pcmData[i + 3] / 32768;
  }

  // Handle remaining elements
  for (let i = len - (len % 4); i < len; i++) {
    out[i] = pcmData[i] / 32768;
  }

  return out.subarray(0, len);
}

// 4) Decode Base64 PCM to Int16Array - optimized (should rarely be used)
function decodePCM(base64: string): Int16Array {
  const binary = atob(base64);
  const bufLength = binary.length;

  // Create or resize buffer if necessary
  if (!BUFFERS.decodeBuffer || BUFFERS.decodeBuffer.byteLength < bufLength) {
    BUFFERS.decodeBuffer = new ArrayBuffer(bufLength * 1.2); // Add 20% extra space
    BUFFERS.decodeView = new Uint8Array(BUFFERS.decodeBuffer);
  }

  // Fill buffer with binary data
  for (let i = 0; i < bufLength; i++) {
    BUFFERS.decodeView![i] = binary.charCodeAt(i);
  }

  // Return view as Int16Array
  return new Int16Array(BUFFERS.decodeBuffer, 0, bufLength / 2);
}

// 5) Build optimized log-mel spectrogram with buffer reuse
function makeLogMel(
  wav: Float32Array,
  sr = 16000,
  nMels = 64,
  fmax = 8000,
  nFrames = 128
): Float32Array {
  const bufferSize = 2048;

  // Calculate a more optimal hop size with overlap
  const wavLength = wav.length;
  let hopSize: number;

  if (wavLength >= bufferSize * nFrames) {
    // Enough data for non-overlapping frames
    hopSize = Math.floor((wavLength - bufferSize) / (nFrames - 1));
  } else {
    // Need to overlap frames to fit nFrames
    hopSize = Math.max(1, Math.floor((wavLength - bufferSize) / Math.max(1, nFrames - 1)));
  }

  // Create or get cached mel filterbank
  if (!melFilterBank) {
    melFilterBank = createMelFilterBank({
      sampleRate: sr,
      windowSize: bufferSize,
      melBands: nMels,
      fmax,
    });
  }

  // Process frames in batches for better performance
  const result = BUFFERS.melOutput.subarray(0, nMels * nFrames);

  // Create a Hann window for better spectral analysis if needed
  if (!BUFFERS.hannWindow) {
    BUFFERS.hannWindow = new Float32Array(bufferSize);
    for (let i = 0; i < bufferSize; i++) {
      BUFFERS.hannWindow[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (bufferSize - 1)));
    }
  }

  // Frame processing with batching
  for (let i = 0; i < nFrames; i++) {
    // Calculate frame start position
    const start = Math.min(i * hopSize, Math.max(0, wavLength - bufferSize));

    // Create a temporary frame buffer or reuse existing
    if (!BUFFERS.frameBuffer) {
      BUFFERS.frameBuffer = new Float32Array(bufferSize);
    }

    // Copy frame data and apply Hann window
    for (let j = 0; j < bufferSize; j++) {
      const srcIdx = start + j;
      BUFFERS.frameBuffer[j] = srcIdx < wavLength ? wav[srcIdx] * BUFFERS.hannWindow![j] : 0;
    }

    // Extract power spectrum
    const powerSpec = Meyda.extract('powerSpectrum', BUFFERS.frameBuffer) as number[];

    // Apply mel filterbank
    const melEnergies = melFilterBank(powerSpec);

    // Convert to log mel and store in result array
    for (let m = 0; m < nMels; m++) {
      // Add a small constant to avoid log(0)
      result[i * nMels + m] = Math.max(-100, 10 * Math.log10(melEnergies[m] + 1e-10));
    }
  }

  return result;
}

// 6) Optimized prediction from raw PCM data with signal quality check
export async function predictFromPCM(pcmData: Int16Array): Promise<[string, number]> {
  try {
    // Check for sufficient signal level before processing
    let signalLevel = 0;
    const sampleSize = Math.min(pcmData.length, 1000);
    for (let i = 0; i < sampleSize; i++) {
      signalLevel += Math.abs(pcmData[i]) / 32768;
    }
    signalLevel /= sampleSize;

    // Skip processing if signal is too weak
    if (signalLevel < 0.01) {
      return ['', 0]; // No valid signal
    }

    // Make sure model is initialized
    if (!model) {
      try {
        await initPitchModel();
      } catch (error) {
        console.error('Failed to initialize model:', error);
        return ['', 0];
      }
    }

    if (!model) {
      return ['', 0]; // Model still not available
    }

    try {
      // Normalize PCM data with reusable buffer
      const wav = convertPCM(pcmData);

      // Create log-mel spectrogram with buffer reuse
      const mel = makeLogMel(wav);

      // Copy data to input tensor buffer (already allocated)
      const inputTensor = BUFFERS.inputTensor;
      for (let i = 0; i < mel.length; i++) {
        inputTensor[i] = mel[i];
      }

      // Run model with performance tracking
      const startTime = performance.now();
      const outputs = model.runSync([inputTensor]);
      const inferenceTime = performance.now() - startTime;

      if (inferenceTime > 100) {
        console.log(`ML inference took ${inferenceTime.toFixed(1)}ms - may need optimization`);
      }

      // Process results - get raw output array
      const outputArray = Array.from(outputs[0] as Float32Array);

      // Add sanity check for degenerate outputs (all similar values)
      // Calculate standard deviation of outputs
      let sum = 0;
      let sumSquared = 0;
      for (let val of outputArray) {
        sum += val;
        sumSquared += val * val;
      }
      const mean = sum / outputArray.length;
      const variance = sumSquared / outputArray.length - mean * mean;
      const stdDev = Math.sqrt(variance);

      // If standard deviation is very low, outputs are too similar (likely noise)
      if (stdDev < 0.05) {
        console.log('ML model outputs too uniform, likely noise input:',
          { stdDev, mean, min: Math.min(...outputArray), max: Math.max(...outputArray) });
        return ['', 0]; // Not confident enough - values too similar
      }

      const CHROMA = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

      // Find highest probability note
      let best = -Infinity;
      let idx = 0;
      // Also track second best for confidence comparison
      let secondBest = -Infinity;

      for (let i = 0; i < outputArray.length; i++) {
        if (outputArray[i] > best) {
          secondBest = best;
          best = outputArray[i];
          idx = i;
        } else if (outputArray[i] > secondBest) {
          secondBest = outputArray[i];
        }
      }

      // Calculate true confidence as separation between top predictions
      // This is more robust than just using the value
      const confidenceMargin = best - secondBest;
      const normalizedConfidence = best;

      // Combined confidence metric
      const confidence = (normalizedConfidence * 0.7) + (confidenceMargin * 0.3);

      // Debug logging for suspicious outputs
      if (normalizedConfidence > 0.9 && CHROMA[idx] === 'C#') {
        console.log('Suspicious C# detection, raw outputs:', {
          topValue: best.toFixed(4),
          secondValue: secondBest.toFixed(4),
          margin: confidenceMargin.toFixed(4),
          allValues: outputArray.map(v => v.toFixed(3)).join(', ')
        });
      }

      // Apply stricter confidence threshold for C# to avoid false positives
      const thresholdByNote = (note: string) => {
        return note === 'C#' ? 0.3 : 0.15; // Higher threshold for C#
      };

      if (confidence < thresholdByNote(CHROMA[idx])) {
        return ['', 0]; // Not confident enough
      }

      return [CHROMA[idx], best];
    } catch (error) {
      // Specifically check for the 'property w doesn't exist' error
      if (error instanceof ReferenceError && error.message.includes("'w'")) {
        console.error('ML model error - missing property. Check TensorFlow model compatibility:', error);
        return ['', 0];
      }
      console.error('Error during pitch prediction:', error);
      return ['', 0];
    }
  } catch (err) {
    console.log(err)
  }
}

// 7) Predict from base64 encoded audio data (legacy support)
export async function predictOneAsync(base64: string): Promise<[string, number]> {
  try {
    // Convert base64 to Int16Array
    const pcmData = decodePCM(base64);

    // Use the Int16Array function
    return predictFromPCM(pcmData);
  } catch (error) {
    console.error('Error processing base64 audio:', error);
    return ['', 0];
  }
}