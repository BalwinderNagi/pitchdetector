// src/utils/pitchDetector.ts

import * as tf from '@tensorflow/tfjs-react-native';
import { Asset } from 'expo-asset';
import { decode as atob } from 'base-64';
import Meyda from 'meyda';

// Import the tflite model statically
import modelAsset from '../assets/pitch_detector.tflite';

let interpreter: any = null;

export async function initPitchModel() {
  if (interpreter !== null) return;

  await tf.ready();

  // Load the asset
  const asset = Asset.fromModule(modelAsset);
  await asset.downloadAsync();

  // Allocate the interpreter (adjust this if you have a specific loading method)
  interpreter = await tf.loadGraphModel(asset.localUri!);
}

// 2) Base64 → Uint8Array PCM → Float32Array audio samples
function decodePCM(base64: string): Float32Array {
  const binary = atob(base64);
  const buf    = new ArrayBuffer(binary.length);
  const view   = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i);
  }
  // 16-bit PCM little endian → Float32 in [-1,1]
  const pcm16 = new Int16Array(buf);
  const out   = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) {
    out[i] = pcm16[i] / 32768;
  }
  return out;
}

// 3) Build 64×128 log-mel spectrogram via Meyda
function makeLogMel(
  wav: Float32Array,
  sr = 16000,
  nMels = 64,
  fmax = 8000,
  nFrames = 128
): Float32Array {
  const bufferSize = 2048;
  const hopSize    = Math.floor((wav.length - bufferSize) / (nFrames - 1));

  const melFilterBank = Meyda.createMelFilterBank({
    sampleRate: sr,
    windowSize: bufferSize,
    melBands:   nMels,
    fmax,
  });

  const logMel = new Float32Array(nMels * nFrames);
  for (let i = 0; i < nFrames; i++) {
    const start = i * hopSize;
    const frame = wav.subarray(start, start + bufferSize);

    const powerSpec: number[] = Meyda.extract('powerSpectrum', frame) as number[];
    const melEnergies: number[] = melFilterBank(powerSpec);

    for (let m = 0; m < nMels; m++) {
      logMel[i * nMels + m] = 10 * Math.log10(melEnergies[m] + 1e-8);
    }
  }

  return logMel;
}

// 4) Run inference
export async function predictOneAsync(base64: string): Promise<[string, number]> {
  if (!interpreter) {
    await initPitchModel();
  }

  const wav   = decodePCM(base64);
  const mel   = makeLogMel(wav);
  const input = tf.tensor(mel, [1, 64, 128, 1]);

  interpreter.setInputTensor(0, input);
  interpreter.invoke();

  const output = interpreter.getOutputTensor(0);
  const data   = output.dataSync() as Float32Array;

  const CHROMA = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  let best = -Infinity, idx = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i] > best) {
      best = data[i];
      idx  = i;
    }
  }

  return [CHROMA[idx], best];
}
