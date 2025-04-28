import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Platform
} from 'react-native';
import { useAudioRecorder } from '@siteed/expo-audio-studio';
import { decode as atob } from 'base-64';
import { detectPitch, NotePitch, initAudioProcessor } from '../../utils/pitchAnalyzer';
import { initPitchModel, predictFromPCM } from '../../utils/pitchDetector';

// Extended audio event interface
interface ExtendedAudioEvent {
  encoded?: string;
  data?: string | Float32Array;
  position: number;
  fileUri: string;
  eventDataSize: number;
  totalSize: number;
  compression?: any;
  deltaSize?: number;
  encodedLength?: number;
  lastEmittedSize?: number;
  mimeType?: string;
  streamUuid?: string;
}

// Reusable buffer for audio processing - avoid reallocating memory
const REUSABLE_BUFFERS = {
  // Pre-allocate view buffer for PCM conversion
  view: new Uint8Array(16384), 
  // Pre-allocate int16 buffer
  int16Data: new Int16Array(8192),
  // Pre-allocate buffer for binary data
  buffer: new ArrayBuffer(16384)
};

// Debug component with memo optimization
const DebugDisplay = React.memo(({ 
  analyzerData, 
  mlData, 
  showDebug 
}: { 
  analyzerData: any, 
  mlData: any, 
  showDebug: boolean 
}) => {
  if (!showDebug) return null;
  
  return (
    <View style={styles.debugContainer}>
      <Text style={styles.debugTitle}>Debug Info</Text>
      <Text style={styles.debugText}>Analyzer: {JSON.stringify(analyzerData)}</Text>
      <Text style={styles.debugText}>ML: {JSON.stringify(mlData)}</Text>
    </View>
  );
});

// Classic Tuner Component with memoization and optimized animations
const ClassicTuner = React.memo(({ 
  note, 
  cents, 
  frequency,
  hasStableNote 
}: { 
  note: string;
  cents: number;
  frequency: number | null;
  hasStableNote: boolean;
}) => {
  const needleAnimation = useRef(new Animated.Value(0)).current;
  
  // Optimize animation - only animate when cents change significantly
  useEffect(() => {
    const targetValue = cents / 50; // -1 to 1 range for -50 to +50 cents
    // Access value safely with toJSON() instead of internal _value property
    const currentValue = 0;
    
    // Only animate if change is significant (reduces unnecessary animations)
    if (Math.abs(currentValue - targetValue) > 0.05) {
      Animated.spring(needleAnimation, {
        toValue: targetValue,
        useNativeDriver: true,
        // Optimize animation parameters for better performance
        friction: 9,    // Increased friction for less oscillation
        tension: 30,    // Adjusted tension for smoother movement
        restDisplacementThreshold: 0.01, // Stops animation earlier
        restSpeedThreshold: 0.01        // Stops animation earlier
      }).start();
    }
  }, [cents]);
  
  const rotate = needleAnimation.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-45deg', '45deg']
  });
  
  // Format frequency conditionally
  const formattedFrequency = useMemo(() => {
    if (!frequency) return '';
    
    // Only show cents when stable and off pitch
    const centsText = hasStableNote && Math.abs(cents) > 1 
      ? `(${cents > 0 ? '+' : ''}${Math.round(cents)} cents)` 
      : '';
      
    return `${frequency.toFixed(1)} Hz ${centsText}`;
  }, [frequency, cents, hasStableNote]);
  
  return (
    <View style={styles.classicTunerContainer}>
      <Text style={styles.classicTunerTitle}>Classic Tuner</Text>
      
      <View style={styles.needleContainer}>
        <View style={styles.tunerScale}>
          <Text style={[styles.tunerMark, { left: '0%' }]}>♭</Text>
          <Text style={[styles.tunerMark, { left: '50%', transform: [{ translateX: -5 }] }]}>●</Text>
          <Text style={[styles.tunerMark, { right: '0%' }]}>♯</Text>
          
          <View style={styles.scaleLine} />
          
          <View style={[styles.tickMark, { left: '0%' }]} />
          <View style={[styles.tickMark, { left: '25%' }]} />
          <View style={[styles.tickMark, { left: '50%' }]} />
          <View style={[styles.tickMark, { left: '75%' }]} />
          <View style={[styles.tickMark, { right: '0%' }]} />
        </View>
        
        <Animated.View 
          style={[
            styles.needle,
            { transform: [{ rotate }] },
            hasStableNote ? styles.needleActive : styles.needleInactive
          ]} 
        />
      </View>
      
      <View style={styles.noteContainer}>
        <Text style={[
          styles.noteText,
          hasStableNote ? styles.noteTextActive : styles.noteTextInactive
        ]}>
          {note || '–'}
        </Text>
        
        {frequency && (
          <Text style={styles.frequencyText}>
            {formattedFrequency}
          </Text>
        )}
      </View>
    </View>
  );
});

// ML-based pitch detector component with memoization
const MLPitchDetector = React.memo(({ 
  mlNote, 
  mlConfidence, 
  isProcessing, 
  isModelReady,
  processingTime
}: { 
  mlNote: string;
  mlConfidence: number;
  isProcessing: boolean;
  isModelReady: boolean;
  processingTime: number;
}) => {
  return (
    <View style={styles.mlDetectorContainer}>
      <View style={styles.mlHeader}>
        <Text style={styles.mlTitle}>ML Pitch Detector</Text>
        {isModelReady ? (
          <View style={styles.mlStatusBadge}>
            <Text style={styles.mlStatusText}>Ready</Text>
          </View>
        ) : (
          <View style={[styles.mlStatusBadge, styles.mlStatusLoading]}>
            <Text style={styles.mlStatusText}>Loading...</Text>
          </View>
        )}
      </View>
      
      <View style={styles.mlContentContainer}>
        {isProcessing ? (
          <View style={styles.mlProcessingContainer}>
            <ActivityIndicator size="small" color="#3498db" />
            <Text style={styles.mlProcessingText}>Processing audio...</Text>
          </View>
        ) : (
          <>
            {mlNote ? (
              <View style={styles.mlResultContainer}>
                <Text style={styles.mlNoteText}>{mlNote}</Text>
                <View style={styles.mlConfidenceBar}>
                  <View 
                    style={[
                      styles.mlConfidenceFill, 
                      { width: `${mlConfidence * 100}%` },
                      mlConfidence > 0.7 ? styles.mlConfidenceHigh : 
                      mlConfidence > 0.4 ? styles.mlConfidenceMedium : 
                      styles.mlConfidenceLow
                    ]} 
                  />
                </View>
                <Text style={styles.mlConfidenceText}>
                  Confidence: {Math.round(mlConfidence * 100)}%
                  {processingTime > 0 && ` (${processingTime}ms)`}
                </Text>
              </View>
            ) : (
              <Text style={styles.mlPlaceholderText}>
                {isModelReady ? 'Waiting for clear note...' : 'Model loading...'}
              </Text>
            )}
          </>
        )}
      </View>
    </View>
  );
});

// Main tuner screen component with optimized audio processing
export default function DualTunerScreen() {
  // Debug flags
  const SHOW_DEBUG = __DEV__;  // Only show debug in development builds
  
  // Use reducer pattern for related state to minimize re-renders
  const [tunerState, setTunerState] = useState({
    currentNote: null as NotePitch | null,
    hasStableNote: false,
    debugAnalyzerData: null as any
  });
  
  const [mlState, setMlState] = useState({
    mlNote: '',
    mlConfidence: 0,
    isProcessingML: false,
    mlModelReady: false,
    processingTime: 0,
    debugMLData: null as any
  });
  
  // Shared state
  const [isListening, setIsListening] = useState(false);
  const [analyzerReady, setAnalyzerReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Audio context ref with all processing state
  const audioContextRef = useRef({
    isListening: false,
    streamId: '',
    noteHistory: [] as NotePitch[],
    noSignalTimeout: null as NodeJS.Timeout | null,
    isProcessingML: false,
    mlReadyForProcessing: true,
    lastMLBuffer: null as Int16Array | null,
    processingStartTime: 0,
    mlProcessCount: 0,
    analysisCount: 0,
    // Audio statistics
    volumeLevel: 0,
    lastUpdateTime: 0,
    // Temporary reusable buffer
    tmpData: new Int16Array(4096),
    // Throttling
    throttleMS: 0,
    lastProcessTime: 0,
    // Stability tracking
    stableCount: 0,
    previousNote: ''
  });
  
  // Get audio recorder
  const {
    startRecording,
    stopRecording,
    isRecording,
  } = useAudioRecorder({
    logger: console
  });

  // Initialize both audio analysis systems
  useEffect(() => {
    const setup = async () => {
      try {
        // Run both initializations in parallel for faster startup
        const initPromises = [
          // Initialize frequency analyzer first (faster)
          initAudioProcessor().then(() => {
            setAnalyzerReady(true);
            console.log('Audio analyzer ready');
          }),
          
          // Initialize ML model in parallel
          initPitchModel().then(() => {
            setMlState(prev => ({...prev, mlModelReady: true}));
            console.log('ML pitch model ready');
          })
        ];
        
        await Promise.all(initPromises);
      } catch (err) {
        console.error('Failed to initialize:', err);
        setError('Failed to initialize audio processors');
      }
    };
    
    setup();
    
    return () => {
      cleanupAudio();
    };
  }, []);
  
  // Optimized base64 to Int16Array conversion
  // This is a critical performance bottleneck
  const fastBase64ToPCM = useCallback((base64Data: string): Int16Array => {
    try {
      // Get buffer size once
      const binaryLength = atob(base64Data).length;
      
      // Only recreate buffer if necessary
      if (binaryLength > REUSABLE_BUFFERS.buffer.byteLength) {
        REUSABLE_BUFFERS.buffer = new ArrayBuffer(binaryLength * 1.5); // Add some extra space
        REUSABLE_BUFFERS.view = new Uint8Array(REUSABLE_BUFFERS.buffer);
        REUSABLE_BUFFERS.int16Data = new Int16Array(REUSABLE_BUFFERS.buffer);
      }
      
      // Convert directly into pre-allocated buffer
      const binary = atob(base64Data);
      for (let i = 0; i < binary.length; i++) {
        REUSABLE_BUFFERS.view[i] = binary.charCodeAt(i);
      }
      
      // Return a view into the buffer - no additional memory allocation
      return REUSABLE_BUFFERS.int16Data.subarray(0, binaryLength / 2);
    } catch (error) {
      console.warn('Error converting base64:', error);
      return new Int16Array(0);
    }
  }, []);
  
  // Separate ML processing thread that runs at a controlled rate
  useEffect(() => {
    let mlProcessingInterval: NodeJS.Timeout | null = null;
    
    if (isListening && mlState.mlModelReady) {
      // Use dynamic interval rate based on device performance
      const intervalRate = Platform.OS === 'ios' ? 400 : 600; 
      
      mlProcessingInterval = setInterval(async () => {
        if (audioContextRef.current.isProcessingML || 
            !audioContextRef.current.mlReadyForProcessing || 
            !audioContextRef.current.lastMLBuffer) {
          return;
        }
        
        try {
          // Mark as processing
          audioContextRef.current.isProcessingML = true;
          audioContextRef.current.mlReadyForProcessing = false;
          setMlState(prev => ({...prev, isProcessingML: true}));
          
          // Start timing
          audioContextRef.current.processingStartTime = Date.now();
          
          // Process the latest buffer
          const pcmData = audioContextRef.current.lastMLBuffer;
          
          // Only process if we have enough signal - prevents ML processing noise
          const signalLevel = calculateSignalLevel(pcmData);
          if (signalLevel < 0.01) {
            // Skip processing if signal is too weak
            audioContextRef.current.isProcessingML = false;
            audioContextRef.current.mlReadyForProcessing = true;
            setMlState(prev => ({...prev, isProcessingML: false}));
            return;
          }
          
          // Increment process count (for debugging)
          audioContextRef.current.mlProcessCount++;
          const processId = audioContextRef.current.mlProcessCount;
          
          if (SHOW_DEBUG) {
            setMlState(prev => ({
              ...prev, 
              debugMLData: {
                processId,
                bufferLength: pcmData?.length || 0,
                signalLevel: signalLevel.toFixed(3),
                time: new Date().toISOString().substring(11, 23)
              }
            }));
          }
          
          // Process with ML model
          const [note, confidence] = await predictFromPCM(pcmData);
          
          // Calculate processing time
          const endTime = Date.now();
          const elapsed = endTime - audioContextRef.current.processingStartTime;
          
          // ML consistency check - compare with classic tuner results
          const isConsistentWithClassic = 
            tunerState.currentNote && 
            note === tunerState.currentNote.note && 
            tunerState.hasStableNote;
            
          // Modulate confidence based on consistency with classic tuner
          const adjustedConfidence = isConsistentWithClassic 
            ? Math.min(1.0, confidence * 1.2) // Boost confidence if notes match
            : confidence * 0.8; // Reduce confidence if notes don't match
          
          // Skip updating UI for C# detections with questionable confidence
          // This helps filter out the erroneous persistent C#
          const skipUpdate = note === 'C#' && 
                             adjustedConfidence > 0.85 && 
                             !isConsistentWithClassic;
                             
          // Only update UI if we have reasonable confidence
          // This reduces flickering of unreliable results
          if (adjustedConfidence > 0.2 && !skipUpdate) {
            setMlState(prev => ({
              ...prev,
              mlNote: note || '',
              mlConfidence: adjustedConfidence || 0,
              processingTime: elapsed,
              isProcessingML: false,
              debugMLData: SHOW_DEBUG ? {
                ...prev.debugMLData,
                result: note,
                confidence: adjustedConfidence.toFixed(2),
                rawConfidence: confidence.toFixed(2),
                isConsistent: isConsistentWithClassic,
                elapsed
              } : null
            }));
          } else {
            // Just update processing status without changing note
            setMlState(prev => ({
              ...prev,
              processingTime: elapsed,
              isProcessingML: false,
              debugMLData: SHOW_DEBUG ? {
                ...prev.debugMLData,
                skipped: skipUpdate ? 'Likely false C#' : 'Low confidence',
                confidence: adjustedConfidence.toFixed(2),
                rawConfidence: confidence.toFixed(2),
                note: note,
                isConsistent: isConsistentWithClassic,
                elapsed
              } : null
            }));
          }
        } catch (error) {
          console.log('ML processing error:', error);
          setMlState(prev => ({...prev, isProcessingML: false}));
        } finally {
          // Mark as done processing
          audioContextRef.current.isProcessingML = false;
          
          // Dynamic cooldown based on processing time
          // Faster devices can process more frequently
          const processingTime = Date.now() - audioContextRef.current.processingStartTime;
          const cooldownTime = Math.max(100, 300 - processingTime); 
          
          setTimeout(() => {
            audioContextRef.current.mlReadyForProcessing = true;
          }, cooldownTime);
        }
      }, intervalRate);
    }
    
    return () => {
      if (mlProcessingInterval) {
        clearInterval(mlProcessingInterval);
      }
    };
  }, [isListening, mlState.mlModelReady, tunerState]);
  
  // Calculate signal level from PCM data
  const calculateSignalLevel = useCallback((pcmData: Int16Array): number => {
    let sum = 0;
    const sampleSize = Math.min(pcmData.length, 1000); // Use a smaller sample size for speed
    
    for (let i = 0; i < sampleSize; i++) {
      sum += Math.abs(pcmData[i] / 32768); // Normalize to [0,1]
    }
    
    return sum / sampleSize;
  }, []);
  
  // Audio cleanup with multiple safeguards
  const cleanupAudio = useCallback(() => {
    try {
      if (isRecording) {
        stopRecording().catch(err => {
          console.log('Error stopping recording:', err);
        });
      }
    } catch (e) {
      console.log('Error in cleanup:', e);
    }
    
    if (audioContextRef.current.noSignalTimeout) {
      clearTimeout(audioContextRef.current.noSignalTimeout);
      audioContextRef.current.noSignalTimeout = null;
    }
    
    // Reset all state
    audioContextRef.current.isListening = false;
    audioContextRef.current.noteHistory = [];
    audioContextRef.current.isProcessingML = false;
    audioContextRef.current.mlReadyForProcessing = true;
    audioContextRef.current.lastMLBuffer = null;
    audioContextRef.current.mlProcessCount = 0;
    audioContextRef.current.stableCount = 0;
    audioContextRef.current.previousNote = '';
    
    setIsListening(false);
    setTunerState({
      currentNote: null,
      hasStableNote: false,
      debugAnalyzerData: null
    });
    
    setMlState(prev => ({
      ...prev,
      mlNote: '',
      mlConfidence: 0,
      isProcessingML: false,
      processingTime: 0,
      debugMLData: null
    }));
  }, [isRecording, stopRecording]);
  
  // Process audio data with throttling and optimizations
  const handleAudioStream = useCallback(async (event: ExtendedAudioEvent) => {
    if (!audioContextRef.current.isListening) return;
    
    // Validate stream ID if we have one
    if (audioContextRef.current.streamId && 
        event.streamUuid && 
        audioContextRef.current.streamId !== event.streamUuid) {
      return;
    }
    
    // Store stream ID from first event
    if (!audioContextRef.current.streamId && event.streamUuid) {
      audioContextRef.current.streamId = event.streamUuid;
    }
    
    try {
      // Extract audio data
      if (!event.encoded && !event.data) return;
      
      let audioData = event.encoded || event.data;
      if (!audioData || typeof audioData !== 'string') return;
      
      // Performance optimization: throttle processing on slower devices
      const now = Date.now();
      if (now - audioContextRef.current.lastProcessTime < audioContextRef.current.throttleMS) {
        return;
      }
      audioContextRef.current.lastProcessTime = now;
      
      // Convert to Int16Array using optimized function
      try {
        const int16Data = fastBase64ToPCM(audioData);
        
        // Need sufficient data
        if (int16Data.length < 2048) return;
        
        // Calculate signal strength - skip processing very quiet audio
        const signalLevel = calculateSignalLevel(int16Data);
        if (signalLevel < 0.005) {
          // Very quiet - likely no sound - skip processing
          return;
        }
        
        // PART 1: Classic tuner - Process with frequency analyzer
        if (analyzerReady) {
          // Every other update, dynamically adjust throttle based on processing time
          if (audioContextRef.current.analysisCount++ % 5 === 0) {
            const startTime = performance.now();
            const analyzerResult = await detectPitch(int16Data);
            const endTime = performance.now();
            
            // Dynamically adjust throttling based on performance
            const processingTime = endTime - startTime;
            if (processingTime > 25) {
              // Increase throttling if processing is taking too long
              audioContextRef.current.throttleMS = Math.min(150, audioContextRef.current.throttleMS + 10);
            } else if (processingTime < 15 && audioContextRef.current.throttleMS > 0) {
              // Decrease throttling if processing is fast
              audioContextRef.current.throttleMS = Math.max(0, audioContextRef.current.throttleMS - 5);
            }
            
            if (SHOW_DEBUG) {
              setTunerState(prev => ({
                ...prev,
                debugAnalyzerData: analyzerResult ? {
                  note: analyzerResult.note,
                  freq: analyzerResult.frequency.toFixed(1),
                  cents: analyzerResult.cents,
                  time: new Date().toISOString().substring(11, 23),
                  throttle: audioContextRef.current.throttleMS,
                  signalLevel: signalLevel.toFixed(3)
                } : { noResult: true, signalLevel: signalLevel.toFixed(3) }
              }));
            }
            
            // Process result
            processAnalyzerResult(analyzerResult);
          } else {
            // Normal processing without metrics or debug updates
            const analyzerResult = await detectPitch(int16Data);
            processAnalyzerResult(analyzerResult);
          }
        }
        
        // PART 2: Store latest buffer for ML processing
        // But don't process it here - leave that to the ML processing interval
        if (mlState.mlModelReady && int16Data.length >= 4096) {
          // Check for significant audio before storing for ML
          // This prevents wasting ML processing on silence/noise
          audioContextRef.current.volumeLevel = signalLevel;
          
          if (signalLevel > 0.01) { // Only send meaningful audio to ML
            // Copy to a new buffer to avoid reference issues
            // This is one place where we need to allocate new memory
            const bufferCopy = new Int16Array(int16Data.length);
            bufferCopy.set(int16Data);
            audioContextRef.current.lastMLBuffer = bufferCopy;
          }
        }
      } catch (error) {
        console.log('Buffer processing error:', error);
      }
    } catch (error) {
      console.error('Audio processing error:', error);
    }
  }, [analyzerReady, mlState.mlModelReady, fastBase64ToPCM, calculateSignalLevel]);
  
  // Process analyzer results with improved note stability detection
  const processAnalyzerResult = useCallback((analyzerResult: NotePitch | null) => {
    if (!analyzerResult) return;
    
    // Reset no signal timeout
    if (audioContextRef.current.noSignalTimeout) {
      clearTimeout(audioContextRef.current.noSignalTimeout);
    }
    
    // Set new timeout to clear display if no signal
    audioContextRef.current.noSignalTimeout = setTimeout(() => {
      setTunerState(prev => ({
        ...prev,
        hasStableNote: false,
        currentNote: null
      }));
      audioContextRef.current.noteHistory = [];
      audioContextRef.current.stableCount = 0;
    }, 2000);
    
    // Add to history (short history for low latency)
    audioContextRef.current.noteHistory.push(analyzerResult);
    
    // Keep only recent history
    if (audioContextRef.current.noteHistory.length > 3) {
      audioContextRef.current.noteHistory.shift();
    }
    
    // Calculate weighted average with more recent samples weighted higher
    const sum = {
      frequency: 0,
      cents: 0,
      weight: 0
    };
    
    // Implement hysteresis for note stability
    // Count occurrences of each note
    const noteOccurrences: Record<string, number> = {};
    
    for (let i = 0; i < audioContextRef.current.noteHistory.length; i++) {
      const weight = i + 1; // More weight to recent samples
      const pitch = audioContextRef.current.noteHistory[i];
      
      sum.frequency += pitch.frequency * weight;
      sum.cents += pitch.cents * weight;
      sum.weight += weight;
      
      // Count occurrences of this note
      noteOccurrences[pitch.note] = (noteOccurrences[pitch.note] || 0) + 1;
    }
    
    const avgFreq = sum.frequency / sum.weight;
    const avgCents = sum.cents / sum.weight;
    
    // Find most frequent note
    let mostFrequentNote = analyzerResult.note;
    let maxOccurrences = 0;
    
    for (const [note, count] of Object.entries(noteOccurrences)) {
      if (count > maxOccurrences) {
        maxOccurrences = count;
        mostFrequentNote = note;
      }
    }
    
    // Improved stability detection with hysteresis
    let isStable = false;
    
    // Check if note is the same as the previous most stable note
    if (mostFrequentNote === audioContextRef.current.previousNote) {
      audioContextRef.current.stableCount++;
      // Require more stability for a new note, less for continuing the same note
      isStable = audioContextRef.current.stableCount >= 2 && Math.abs(avgCents) < 25;
    } else {
      // Reset stability counter for new note
      audioContextRef.current.stableCount = 0;
      audioContextRef.current.previousNote = mostFrequentNote;
      // Higher threshold for accepting a new note
      isStable = maxOccurrences >= 2 && Math.abs(avgCents) < 15;
    }
    
    // Always update with current note for responsiveness
    setTunerState(prev => ({
      ...prev,
      currentNote: {
        note: mostFrequentNote,
        frequency: avgFreq,
        cents: avgCents,
        octave: analyzerResult.octave
      },
      hasStableNote: isStable
    }));
  }, []);
  
  // Start/stop listening with error handling
  const toggleListening = useCallback(async () => {
    if (isListening) {
      cleanupAudio();
    } else {
      if (!analyzerReady) {
        setError('Audio analyzer not initialized yet');
        return;
      }
      
      setError(null);
      audioContextRef.current.isListening = true;
      audioContextRef.current.noteHistory = [];
      audioContextRef.current.mlReadyForProcessing = true;
      audioContextRef.current.lastMLBuffer = null;
      audioContextRef.current.throttleMS = 0; // Start with no throttling
      audioContextRef.current.stableCount = 0;
      audioContextRef.current.previousNote = '';
      
      try {
        // Start recording with continuous mode
        await startRecording({
          sampleRate: 16000,
          channels: 1,
          filename: 'wav',
          onAudioStream: handleAudioStream
        });
        
        setIsListening(true);
      } catch (error) {
        console.error('Failed to start listening:', error);
        setError('Failed to start listening');
        audioContextRef.current.isListening = false;
      }
    }
  }, [isListening, analyzerReady, startRecording, handleAudioStream, cleanupAudio]);

  // Destructure state objects for cleaner JSX
  const { currentNote, hasStableNote, debugAnalyzerData } = tunerState;
  const { mlNote, mlConfidence, isProcessingML, mlModelReady, processingTime, debugMLData } = mlState;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dual Tuner</Text>
      
      {/* Classic Tuner Component */}
      <ClassicTuner 
        note={currentNote?.note || ''} 
        cents={currentNote?.cents || 0}
        frequency={currentNote?.frequency || null}
        hasStableNote={hasStableNote}
      />
      
      {/* ML Tuner Component */}
      <MLPitchDetector 
        mlNote={mlNote}
        mlConfidence={mlConfidence}
        isProcessing={isProcessingML}
        isModelReady={mlModelReady}
        processingTime={processingTime}
      />
      
      {/* Debug Display */}
      <DebugDisplay 
        analyzerData={debugAnalyzerData}
        mlData={debugMLData}
        showDebug={SHOW_DEBUG}
      />
      
      {/* Control Button */}
      <TouchableOpacity 
        style={[
          styles.listenButton, 
          isListening ? styles.listenButtonActive : null,
          !analyzerReady ? styles.buttonDisabled : null
        ]}
        onPress={toggleListening}
        disabled={!analyzerReady}
      >
        <Text style={styles.buttonText}>
          {isListening ? 'Stop Listening' : 'Start Listening'}
        </Text>
      </TouchableOpacity>
      
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
  );
}

const { width } = Dimensions.get('window');
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  
  // Classic Tuner styles
  classicTunerContainer: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
  },
  classicTunerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  needleContainer: {
    width: '100%',
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tunerScale: {
    width: '100%',
    height: 40,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleLine: {
    width: '100%',
    height: 2,
    backgroundColor: '#ddd',
    position: 'absolute',
  },
  tunerMark: {
    position: 'absolute',
    top: -20,
    fontSize: 16,
    color: '#7f8c8d',
  },
  tickMark: {
    position: 'absolute',
    width: 2,
    height: 10,
    backgroundColor: '#7f8c8d',
    bottom: 0,
  },
  needle: {
    position: 'absolute',
    width: 3,
    height: 50,
    backgroundColor: '#e74c3c',
    bottom: 0,
    transformOrigin: 'bottom',
  },
  needleActive: {
    backgroundColor: '#2ecc71',
  },
  needleInactive: {
    backgroundColor: '#e74c3c',
  },
  noteContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  noteText: {
    fontSize: 40,
    fontWeight: 'bold',
  },
  noteTextActive: {
    color: '#2ecc71',
  },
  noteTextInactive: {
    color: '#7f8c8d',
  },
  frequencyText: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 5,
  },
  
  // ML Detector styles
  mlDetectorContainer: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mlHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  mlTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  mlStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: '#2ecc71',
  },
  mlStatusLoading: {
    backgroundColor: '#f39c12',
  },
  mlStatusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  mlContentContainer: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mlProcessingContainer: {
    alignItems: 'center',
  },
  mlProcessingText: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 8,
  },
  mlResultContainer: {
    alignItems: 'center',
    width: '100%',
  },
  mlNoteText: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#3498db',
    marginBottom: 5,
  },
  mlConfidenceBar: {
    width: '80%',
    height: 6,
    backgroundColor: '#ecf0f1',
    borderRadius: 3,
    marginBottom: 5,
    overflow: 'hidden',
  },
  mlConfidenceFill: {
    height: '100%',
    borderRadius: 3,
  },
  mlConfidenceHigh: {
    backgroundColor: '#2ecc71',
  },
  mlConfidenceMedium: {
    backgroundColor: '#f39c12',
  },
  mlConfidenceLow: {
    backgroundColor: '#e74c3c',
  },
  mlConfidenceText: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  mlPlaceholderText: {
    fontSize: 14,
    color: '#7f8c8d',
    fontStyle: 'italic',
  },
  
  // Debug display styles
  debugContainer: {
    width: '90%',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  debugText: {
    fontSize: 10,
    fontFamily: 'monospace',
    marginBottom: 3,
  },
  
  // Button styles
  listenButton: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginBottom: 20,
    minWidth: 200,
    alignItems: 'center',
  },
  listenButtonActive: {
    backgroundColor: '#e74c3c',
  },
  buttonDisabled: {
    backgroundColor: '#bdc3c7',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorText: {
    marginTop: 10,
    color: '#e74c3c',
    fontSize: 14,
  },
});