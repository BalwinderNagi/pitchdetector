import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import Meyda from 'meyda';
import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';
import { decode as atob } from 'base-64';
// @ts-expect-error notypeavailable
import modelAsset from '../assets/pitch_detector.tflite';

let model: TensorflowModel | null = null;

// 1) Helper: create mel filterbank manually
function createMelFilterBank(options: {
  sampleRate: number;
  windowSize: number;
  melBands: number;
  fmin?: number;
  fmax?: number;
}): (powerSpectrum: number[]) => number[] {
  const { sampleRate, windowSize, melBands, fmin = 0, fmax = sampleRate / 2 } = options;
  const fftBins = windowSize / 2;
  const hzPerBin = sampleRate / windowSize;

  function hzToMel(hz: number) {
    return 2595 * Math.log10(1 + hz / 700);
  }
  function melToHz(mel: number) {
    return 700 * (10 ** (mel / 2595) - 1);
  }

  const melMin = hzToMel(fmin);
  const melMax = hzToMel(fmax);
  const melPoints = Array.from({ length: melBands + 2 }, (_, i) =>
    melToHz(melMin + (i / (melBands + 1)) * (melMax - melMin))
  );
  const binPoints = melPoints.map(mel => Math.floor(mel / hzPerBin));

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

  return function (powerSpectrum: number[]): number[] {
    return filters.map(filter =>
      powerSpectrum.reduce((sum, val, idx) => sum + val * filter[idx], 0)
    );
  };
}

// 2) Initialize model
export async function initPitchModel() {
  if (model !== null) return;

  try {
    const asset = Asset.fromModule(modelAsset);
    await asset.downloadAsync();
    console.log('Loaded asset URI:', asset.localUri);

    if (!asset.localUri) {
      throw new Error('Model file path missing.');
    }

    // react-native-fast-tflite can load directly from file:// URLs
    model = await loadTensorflowModel({ 
      url: asset.localUri 
    });
    
    console.log('Model loaded successfully');
  } catch (err) {
    console.error('Failed to load model:', err);
  }
}

// 3) Convert Int16Array PCM to Float32Array
function convertPCM(pcmData: Int16Array): Float32Array {
  const out = new Float32Array(pcmData.length);
  for (let i = 0; i < pcmData.length; i++) {
    out[i] = pcmData[i] / 32768; // Normalize to [-1, 1]
  }
  return out;
}

// 4) Decode Base64 PCM to Int16Array
function decodePCM(base64: string): Int16Array {
  const binary = atob(base64);
  const buf = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i);
  }
  return new Int16Array(buf);
}

// 5) Build log-mel spectrogram
function makeLogMel(
  wav: Float32Array,
  sr = 16000,
  nMels = 64,
  fmax = 8000,
  nFrames = 128
): Float32Array {
  const bufferSize = 2048;
  const hopSize = Math.floor((wav.length - bufferSize) / (nFrames - 1));

  const melFilterBank = createMelFilterBank({
    sampleRate: sr,
    windowSize: bufferSize,
    melBands: nMels,
    fmax,
  });

  const logMel = new Float32Array(nMels * nFrames);
  for (let i = 0; i < nFrames; i++) {
    const start = i * hopSize;
    const frame = wav.subarray(start, start + bufferSize);

    const powerSpec = Meyda.extract('powerSpectrum', frame) as number[];

    const melEnergies = melFilterBank(powerSpec);

    for (let m = 0; m < nMels; m++) {
      logMel[i * nMels + m] = 10 * Math.log10(melEnergies[m] + 1e-8);
    }
  }

  return logMel;
}

// 6) Predict from raw PCM data (Int16Array)
export async function predictFromPCM(pcmData: Int16Array): Promise<[string, number]> {
  if (!model) {
    await initPitchModel();
  }

  if (!model) {
    throw new Error('Failed to initialize model');
  }

  const wav = convertPCM(pcmData);
  const mel = makeLogMel(wav);

  // For react-native-fast-tflite, we need to reshape our 1D array into the expected input shape
  // Create a Float32Array with the correct size
  const inputTensor = new Float32Array(1 * 64 * 128 * 1);
  
  // Copy data from mel to inputTensor
  for (let i = 0; i < mel.length; i++) {
    inputTensor[i] = mel[i];
  }

  // Run the model with direct input array
  // The API expects an array of TypedArrays, not an array of objects
  const outputs = model.runSync([inputTensor]);

  // Process the output - the first output is our class probabilities
  // It's a TypedArray (Float32Array) not an object with a data property
  const outputArray = Array.from(outputs[0] as Float32Array);

  const CHROMA = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  let best = -Infinity;
  let idx = 0;
  for (let i = 0; i < outputArray.length; i++) {
    if (outputArray[i] > best) {
      best = outputArray[i];
      idx = i;
    }
  }

  return [CHROMA[idx], best];
}

// 7) Predict from base64 encoded audio data
export async function predictOneAsync(base64: string): Promise<[string, number]> {
  // Convert base64 to Int16Array
  const pcmData = decodePCM(base64);
  
  // Use the Int16Array function
  return predictFromPCM(pcmData);
}