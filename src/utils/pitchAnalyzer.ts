import Meyda from 'meyda';

// Define the pitch detection result type
export interface NotePitch {
  note: string;      // Note name (e.g., 'A', 'C#')
  octave: number;    // Octave number (e.g., 4 for A4)
  frequency: number; // Detected frequency in Hz
  cents: number;     // Detune in cents (-50 to +50)
}

// Note frequencies (A4 = 440Hz standard tuning)
const NOTE_FREQUENCIES: { [note: string]: number } = {
  'C': 261.63,
  'C#': 277.18,
  'D': 293.66,
  'D#': 311.13,
  'E': 329.63,
  'F': 349.23,
  'F#': 369.99,
  'G': 392.00,
  'G#': 415.30,
  'A': 440.00,
  'A#': 466.16,
  'B': 493.88
};

// All notes in chromatic scale
const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Audio processing settings
const SETTINGS = {
  minFrequency: 80,   // Lowest detectable frequency (Hz)
  maxFrequency: 1500, // Highest detectable frequency (Hz)
  bufferSize: 2048,   // FFT size for frequency analysis (MUST be power of 2)
  sampleRate: 16000,  // Expected sample rate
  noiseFloor: -45,    // dB threshold to consider a peak (lowered for better sensitivity)
  peakThreshold: 0.45, // Reduced threshold for better detection
};

// Pre-allocated buffers for better performance
let floatBuffer: Float32Array;
let powerOfTwoBuffer: Float32Array;
let hannWindow: Float32Array;

// Check if a number is a power of 2
function isPowerOfTwo(n: number): boolean {
  return n && (n & (n - 1)) === 0;
}

// Get the next power of 2 size
function nextPowerOfTwo(n: number): number {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

// Initialize resources
export async function initAudioProcessor(): Promise<void> {
  try {
    // Pre-allocate float buffer for PCM conversion
    floatBuffer = new Float32Array(SETTINGS.bufferSize);
    
    // Pre-allocate power-of-two buffer for Meyda
    powerOfTwoBuffer = new Float32Array(SETTINGS.bufferSize);
    
    // Pre-compute Hann window for better spectral analysis
    hannWindow = new Float32Array(SETTINGS.bufferSize);
    for (let i = 0; i < SETTINGS.bufferSize; i++) {
      hannWindow[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (SETTINGS.bufferSize - 1)));
    }
    
    console.log('Audio processor initialized successfully');
    return Promise.resolve();
  } catch (err) {
    console.error('Failed to initialize audio processor:', err);
    return Promise.reject(err);
  }
}

// Convert Int16Array PCM to Float32Array (-1 to 1 range)
// Optimized version that reuses buffer
function convertToFloat32(pcmData: Int16Array): Float32Array {
  const length = Math.min(pcmData.length, floatBuffer.length);
  
  for (let i = 0; i < length; i++) {
    floatBuffer[i] = pcmData[i] / 32768; // Convert to -1.0 to 1.0 range
  }
  
  return floatBuffer.subarray(0, length);
}

// Apply window function to the buffer for better frequency analysis
function applyWindow(buffer: Float32Array): Float32Array {
  const length = Math.min(buffer.length, hannWindow.length);
  
  for (let i = 0; i < length; i++) {
    buffer[i] *= hannWindow[i];
  }
  
  return buffer;
}

// Ensure buffer is power of 2 size for Meyda
function ensurePowerOfTwoBuffer(buffer: Float32Array): Float32Array {
  // If buffer is already power of 2, return it
  if (isPowerOfTwo(buffer.length)) {
    return buffer;
  }
  
  // Find nearest power of 2 (not exceeding our max buffer size)
  const targetSize = Math.min(
    nextPowerOfTwo(buffer.length),
    SETTINGS.bufferSize
  );
  
  // Copy data from original buffer
  const copyLength = Math.min(buffer.length, targetSize);
  for (let i = 0; i < copyLength; i++) {
    powerOfTwoBuffer[i] = buffer[i];
  }
  
  // Zero-pad the rest
  for (let i = copyLength; i < targetSize; i++) {
    powerOfTwoBuffer[i] = 0;
  }
  
  return powerOfTwoBuffer;
}

// Calculate cents deviation from target frequency
function calculateCents(detected: number, target: number): number {
  return Math.round(1200 * Math.log2(detected / target));
}

// Get octave number based on frequency
function getOctaveFromFrequency(freq: number, note: string): number {
  const noteFreqInOctave4 = NOTE_FREQUENCIES[note];
  
  // Base octave for the reference note
  const baseOctave = 4;
  
  // Calculate how many octaves away from the reference
  const octavesFromBase = Math.log2(freq / noteFreqInOctave4);
  
  // Round to nearest octave
  return Math.round(baseOctave + octavesFromBase);
}

// Find the closest note to a given frequency
function findClosestNote(frequency: number): NotePitch | null {
  if (frequency < SETTINGS.minFrequency || frequency > SETTINGS.maxFrequency) {
    return null;
  }
  
  // Reference frequency for A4 = 440Hz
  const refFreq = 440.0;
  
  // Calculate how many half steps away from A4
  const halfStepsFromA4 = Math.round(12 * Math.log2(frequency / refFreq));
  
  // Calculate the note index (0 = C, 1 = C#, etc)
  const noteIndex = (9 + halfStepsFromA4) % 12;
  if (noteIndex < 0 || noteIndex >= ALL_NOTES.length) {
    return null;
  }
  
  const note = ALL_NOTES[noteIndex];
  
  // Calculate the "perfect" frequency for this note
  const octave = getOctaveFromFrequency(frequency, note);
  const noteFreqInOctave4 = NOTE_FREQUENCIES[note];
  const perfectFreq = noteFreqInOctave4 * Math.pow(2, octave - 4);
  
  // Calculate how many cents off the note is
  const cents = calculateCents(frequency, perfectFreq);
  
  return {
    note,
    octave,
    frequency,
    cents
  };
}

// Enhanced autocorrelation function for pitch detection with better accuracy
function autoCorrelate(buffer: Float32Array, sampleRate: number): number | null {
  // Apply Hann window for better spectral results
  applyWindow(buffer);
  
  // Find the root mean square (volume) to decide if there's enough signal
  let rms = 0;
  for (let i = 0; i < buffer.length; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / buffer.length);
  
  // Not enough signal - increased sensitivity for quieter sounds
  if (rms < 0.005) return null;
  
  // Autocorrelate the signal with optimized approach
  const correlations = new Float32Array(buffer.length / 2);
  
  // Optimization: Only compute half the correlations (sufficient for frequency detection)
  // Use memory locality optimization by having the inner loop access sequential memory
  for (let lag = 0; lag < correlations.length; lag++) {
    let sum = 0;
    for (let i = 0; i < buffer.length - lag; i++) {
      sum += buffer[i] * buffer[i + lag];
    }
    correlations[lag] = sum / (buffer.length - lag);
  }
  
  // Find the first peak after the initial drop
  let foundPeak = false;
  let peakIndex = 0;
  
  // Skip the first part where autocorrelation naturally drops
  // Optimize search range based on expected frequencies
  const startIndex = Math.floor(sampleRate / SETTINGS.maxFrequency);
  const endIndex = Math.min(
    correlations.length - 1, 
    Math.ceil(sampleRate / SETTINGS.minFrequency)
  );
  
  // Improved peak finding with adaptive threshold
  let maxCorrelation = 0;
  for (let i = startIndex + 1; i < endIndex - 1; i++) {
    if (correlations[i] > maxCorrelation) {
      maxCorrelation = correlations[i];
    }
  }
  
  // Search for first peak that's at least 30% of the maximum correlation
  // This helps filter out noise peaks
  const threshold = maxCorrelation * 0.3;
  
  for (let i = startIndex + 1; i < endIndex - 1; i++) {
    if (!foundPeak && 
        correlations[i] > threshold &&
        correlations[i] > correlations[i-1] && 
        correlations[i] >= correlations[i+1]) {
      // Found first significant peak
      foundPeak = true;
      peakIndex = i;
      break;
    }
  }
  
  if (!foundPeak) return null;
  
  // Refine the peak using parabolic interpolation for better accuracy
  const y1 = correlations[peakIndex - 1];
  const y2 = correlations[peakIndex];
  const y3 = correlations[peakIndex + 1];
  
  // Parabolic interpolation formula
  const a = (y1 + y3 - 2 * y2) / 2;
  const b = (y3 - y1) / 2;
  
  if (a >= 0) return null; // Not a peak
  
  const refinedPeak = peakIndex - b / (2 * a);
  const frequency = sampleRate / refinedPeak;
  
  return frequency;
}

// Improved YIN algorithm - a more accurate pitch detection method
// This provides better results especially for lower frequencies
function yinPitchDetection(buffer: Float32Array, sampleRate: number): number | null {
  const bufferSize = buffer.length;
  const halfBufferSize = Math.floor(bufferSize / 2);
  const yinBuffer = new Float32Array(halfBufferSize);
  
  // Compute the difference function
  for (let tau = 0; tau < halfBufferSize; tau++) {
    yinBuffer[tau] = 0;
    for (let i = 0; i < halfBufferSize; i++) {
      const delta = buffer[i] - buffer[i + tau];
      yinBuffer[tau] += delta * delta;
    }
  }
  
  // Cumulative normalization
  yinBuffer[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau < halfBufferSize; tau++) {
    runningSum += yinBuffer[tau];
    yinBuffer[tau] *= tau / runningSum;
  }
  
  // Find minimum in normalized difference function
  const threshold = 0.1; // Typical values are between 0.1 and 0.2
  let minVal = 1;
  let minTau = 0;
  
  for (let tau = 2; tau < halfBufferSize; tau++) {
    if (yinBuffer[tau] < threshold) {
      while (tau + 1 < halfBufferSize && yinBuffer[tau + 1] < yinBuffer[tau]) {
        tau++;
      }
      return sampleRate / tau;
    }
    
    if (yinBuffer[tau] < minVal) {
      minVal = yinBuffer[tau];
      minTau = tau;
    }
  }
  
  // If no value found under threshold, use the minimum value
  if (minTau > 0 && minVal < 0.5) {
    // Parabolic interpolation for better accuracy
    const y1 = yinBuffer[minTau - 1];
    const y2 = yinBuffer[minTau];
    const y3 = yinBuffer[minTau + 1];
    const a = (y1 + y3 - 2 * y2) / 2;
    const b = (y3 - y1) / 2;
    
    if (a !== 0) {
      const refinedTau = minTau - b / (2 * a);
      return sampleRate / refinedTau;
    }
    
    return sampleRate / minTau;
  }
  
  return null; // No pitch found
}

// Estimate fundamental frequency using multiple methods
function estimateFrequency(buffer: Float32Array, sampleRate: number): number | null {
  try {
    // Make sure buffer is power of 2 size
    const processBuffer = ensurePowerOfTwoBuffer(buffer);
    
    // Try Meyda's spectral features first
    const features = Meyda.extract([
      'rms', 
      'energy',
      'spectralCentroid',
      'spectralFlatness'
    ], processBuffer);
    
    // Unpack features
    const rms = features.rms as number;
    const energy = features.energy as number;
    const spectralFlatness = features.spectralFlatness as number;
    const spectralCentroid = features.spectralCentroid as number;
    
    // Check if there's enough signal to analyze and it's not too noisy
    if (energy < 0.0005 || rms < 0.005) {
      return null; // Too quiet
    }
    
    if (spectralFlatness > 0.5) {
      return null; // Too noisy
    }
    
    // Try YIN algorithm first for better low-frequency detection
    let frequency = yinPitchDetection(processBuffer, sampleRate);
    
    // If YIN fails, try autocorrelation
    if (!frequency || frequency < SETTINGS.minFrequency || frequency > SETTINGS.maxFrequency) {
      frequency = autoCorrelate(processBuffer, sampleRate);
    }
    
    // If both methods fail but we have a clear spectral centroid in range
    if (!frequency && spectralCentroid > SETTINGS.minFrequency && 
        spectralCentroid < SETTINGS.maxFrequency && spectralFlatness < 0.3) {
      // Use spectral centroid as fallback, but with lower confidence
      return spectralCentroid;
    }
    
    return frequency;
  } catch (error) {
    console.error('Error in frequency estimation:', error);
    return null;
  }
}

// Main pitch detection function with optimizations
export async function detectPitch(pcmData: Int16Array): Promise<NotePitch | null> {
  try {
    // We need enough data to analyze
    if (pcmData.length < 1024) {
      return null;
    }
    
    // Convert to float [-1, 1] - optimized to reuse buffer
    const floatData = convertToFloat32(pcmData);
    
    // Estimate frequency using multiple methods
    const frequency = estimateFrequency(floatData, SETTINGS.sampleRate);
    
    // If no frequency detected
    if (!frequency) {
      return null;
    }
    
    // Find the closest note
    const notePitch = findClosestNote(frequency);
    
    return notePitch;
  } catch (error) {
    console.error('Error detecting pitch:', error);
    return null;
  }
}

// Get expected frequencies for all notes across octaves
export function getNoteFrequencies(minOctave = 2, maxOctave = 6): { [key: string]: number } {
  const frequencies: { [key: string]: number } = {};
  
  for (let octave = minOctave; octave <= maxOctave; octave++) {
    for (const note of ALL_NOTES) {
      const baseFreq = NOTE_FREQUENCIES[note];
      const freq = baseFreq * Math.pow(2, octave - 4); // Adjust for octave
      frequencies[`${note}${octave}`] = freq;
    }
  }
  
  return frequencies;
}