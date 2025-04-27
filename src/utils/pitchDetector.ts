import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import Tflite from 'react-native-tflite';
import { decode as atob } from 'base-64';
import Meyda from 'meyda';

import modelAsset from '../assets/pitch_detector.tflite';

let interpreter: Tflite | null = null;

function createMelFilterBank(options: { //  Makes a helper that builds and returns a function to convert each spectrum slice into a mel-scaled filterbank vector
  sampleRate: number;
  windowSize: number;
  melBands: number;
  fmin?: number;
  fmax?: number;
}): (powerSpectrum: number[]) => number[] {
  const { sampleRate, windowSize, melBands, fmin = 0, fmax = sampleRate / 2 } = options;
  const fftBins = windowSize / 2;
  const hzPerBin = sampleRate / windowSize;

  function hzToMel(hz: number) { // Converts hz to mel scale
    return 2595 * Math.log10(1 + hz / 700);
  }
  function melToHz(mel: number) { // Converts mel scale to hz
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


export async function initPitchModel() {
  if (interpreter !== null) return;

  interpreter = new Tflite();

  try {
    const asset = Asset.fromModule(modelAsset);
    await asset.downloadAsync();
    console.log('Loaded asset URI:', asset.localUri);

    const modelPath = asset.localUri?.replace('file://', '');

    if (!modelPath) {
      throw new Error('Model file path missing.');
    }

    await new Promise<void>((resolve, reject) => {
      interpreter!.loadModel(
        {
          model: modelPath,
          labels: '',
          numThreads: 1,
        },
        (err: any, res: any) => {
          if (err) {
            console.error('Failed to load model:', err);
            reject(err);
          } else {
            console.log('Interpreter loaded successfully');
            resolve();
          }
        }
      );
    });
  } catch (err) {
    console.error('Failed to load model:', err);
  }
}

// 3) changes Base64 PCM to Float32Array
function decodePCM(base64: string): Float32Array {
  const binary = atob(base64);
  const buf = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i);
  }
  const pcm16 = new Int16Array(buf);
  const out = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) {
    out[i] = pcm16[i] / 32768;
  }
  return out;
}

// 4) Build log-mel spectrogram
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

// 5) Predict one
export async function predictOneAsync(base64: string): Promise<[string, number]> {
  if (!interpreter) {
    await initPitchModel();
  }

  const wav = decodePCM(base64);
  const mel = makeLogMel(wav);

  const inputArray = Array.from(mel);

  return new Promise<[string, number]>((resolve, reject) => {
    interpreter!.runModelOnArray(
      {
        input: inputArray,
        inputShape: [1, 64, 128, 1],
        outputShape: [1, 12],
        type: 'float32',
      },
      (err: any, res: any) => {
        if (err || !res) {
          console.error('Prediction failed:', err);
          reject(err);
          return;
        }

        const CHROMA = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        let best = -Infinity;
        let idx = 0;
        for (let i = 0; i < res.length; i++) {
          if (res[i] > best) {
            best = res[i];
            idx = i;
          }
        }

        resolve([CHROMA[idx], best]);
      }
    );
  });
}