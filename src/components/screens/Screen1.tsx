import React, { useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Pressable,
  Text,
  StyleSheet,
  Dimensions,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { decode as atob } from 'base-64';
import { useAudioRecorder } from '@siteed/expo-audio-studio';
import Theme from '../layout/Theme';
import { ThemeContext } from '../layout/ThemeContext';
import PitchGauge from '../layout/PitchGauge';
import clickSound from '../../../assets/click.wav';
import { detectPitch, NotePitch, initAudioProcessor } from '../../utils/pitchAnalyzer';

const enumKeys = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

// Debug mode - set to true for development, false for production
const SHOW_DEBUG = false;

// Types for audio event
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

// Reusable buffer for performance optimization
const REUSABLE_BUFFERS = {
  buffer: new ArrayBuffer(16384),
  view: new Uint8Array(16384),
  int16Data: new Int16Array(8192)
};

// Debug Display Component
const DebugDisplay = React.memo(({ 
  debugData, 
  showDebug 
}: { 
  debugData: any, 
  showDebug: boolean 
}) => {
  if (!showDebug) return null;
  
  return (
    <View style={styles.debugContainer}>
      <Text style={styles.debugTitle}>Debug Info</Text>
      <Text style={styles.debugText}>{JSON.stringify(debugData, null, 2)}</Text>
    </View>
  );
});

export const Screen1 = () => {
  const {
    currentTheme,
    isDarkMode,
    proMode
  } = useContext(ThemeContext);

  const [count, setCount] = useState(1);
  const [bpm, setBpm] = useState(100);
  const [metroOn, setMetroOn] = useState(false);
  const [listening, setListening] = useState(false);
  const [currentNote, setCurrentNote] = useState<string | null>(null);
  const [hasStableNote, setHasStableNote] = useState(false);
  const [cents, setCents] = useState(0);
  const [frequency, setFrequency] = useState<number | null>(null);
  const [analyzerReady, setAnalyzerReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugData, setDebugData] = useState<any>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  
  // Get audio recorder from hook
  const {
    startRecording,
    stopRecording,
    isRecording,
  } = useAudioRecorder({
    logger: console
  });
  
  // Audio context for pitch detection
  const audioContextRef = useRef({
    isListening: false,
    streamId: '',
    noteHistory: [] as NotePitch[],
    noSignalTimeout: null as NodeJS.Timeout | null,
    throttleMS: 0,
    lastProcessTime: 0,
    stableCount: 0,
    previousNote: '',
    analysisCount: 0,
    volumeLevel: 0
  });

  // Initialize audio components
  useEffect(() => {
    // Initialize metronome
    (async () => {
      const { sound } = await Audio.Sound.createAsync(clickSound);
      soundRef.current = sound;
    })();

    // Initialize pitch analyzer
    (async () => {
      try {
        await initAudioProcessor();
        setAnalyzerReady(true);
        if (SHOW_DEBUG) {
          setDebugData(prev => ({...prev, analyzerStatus: 'Audio analyzer ready'}));
        }
        console.log('Audio analyzer ready');
      } catch (err) {
        console.error('Failed to initialize pitch analyzer:', err);
        setError('Failed to initialize audio processor');
        if (SHOW_DEBUG) {
          setDebugData(prev => ({...prev, analyzerError: String(err)}));
        }
      }
    })();
    
    return () => {
      cleanupAudio();
      clearInterval(intervalRef.current);
      soundRef.current?.unloadAsync();
    };
  }, []);

  // Setup audio permissions
  useEffect(() => {
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Mic permission',
          'Microphone permission is required to detect pitch.'
        );
        if (SHOW_DEBUG) {
          setDebugData(prev => ({...prev, permissionStatus: status}));
        }
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
        shouldDuckAndroid: true,
      });
    })();
  }, []);

  // Metronome setup
  useEffect(() => {
    clearInterval(intervalRef.current);
    const tick = () => {
      const s = soundRef.current;
      if (!s) return;
      s.setPositionAsync(0).then(() => s.playAsync()).catch(() => {});
    };
    if (metroOn) {
      tick();
      intervalRef.current = setInterval(
        tick,
        Math.round(60000 / bpm)
      );
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [metroOn, bpm]);

  // Fast base64 to PCM conversion for audio processing
  const fastBase64ToPCM = useCallback((base64Data: string): Int16Array => {
    try {
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
      if (SHOW_DEBUG) {
        setDebugData(prev => ({...prev, conversionError: String(error)}));
      }
      return new Int16Array(0);
    }
  }, []);

  // Calculate signal level from PCM data
  const calculateSignalLevel = useCallback((pcmData: Int16Array): number => {
    let sum = 0;
    const sampleSize = Math.min(pcmData.length, 1000); // Use a smaller sample size for speed
    
    for (let i = 0; i < sampleSize; i++) {
      sum += Math.abs(pcmData[i] / 32768); // Normalize to [0,1]
    }
    
    return sum / sampleSize;
  }, []);

  // Process analyzer results with note stability detection
  const processAnalyzerResult = useCallback((analyzerResult: NotePitch | null) => {
    if (!analyzerResult) return;
    
    // Reset no signal timeout
    if (audioContextRef.current.noSignalTimeout) {
      clearTimeout(audioContextRef.current.noSignalTimeout);
    }
    
    // Set new timeout to clear display if no signal
    audioContextRef.current.noSignalTimeout = setTimeout(() => {
      setHasStableNote(false);
      setCurrentNote(null);
      setCents(0);
      setFrequency(null);
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
    
    // Update state with current note info
    setCurrentNote(mostFrequentNote);
    setFrequency(avgFreq);
    setCents(avgCents);
    setHasStableNote(isStable);
    
    if (SHOW_DEBUG) {
      setDebugData(prev => ({
        ...prev,
        currentNote: mostFrequentNote,
        frequency: avgFreq.toFixed(1),
        cents: avgCents.toFixed(1),
        isStable,
        stableCount: audioContextRef.current.stableCount,
        noteOccurrences
      }));
    }
  }, []);

  // Process audio data from the stream
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
        if (int16Data.length < 2048) {
          if (SHOW_DEBUG) {
            setDebugData(prev => ({...prev, dataLength: int16Data.length, status: 'Insufficient data length'}));
          }
          return;
        }
        
        // Calculate signal strength - skip processing very quiet audio
        const signalLevel = calculateSignalLevel(int16Data);
        audioContextRef.current.volumeLevel = signalLevel;
        
        if (signalLevel < 0.005) {
          // Very quiet - likely no sound - skip processing
          if (SHOW_DEBUG) {
            setDebugData(prev => ({...prev, signalLevel, status: 'Signal too weak'}));
          }
          return;
        }
        
        // Process with frequency analyzer
        if (analyzerReady) {
          // Every few updates, dynamically adjust throttle based on processing time
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
              setDebugData(prev => ({
                ...prev,
                analyzerResult: analyzerResult ? {
                  note: analyzerResult.note,
                  freq: analyzerResult.frequency.toFixed(1),
                  cents: analyzerResult.cents,
                  time: new Date().toISOString().substring(11, 23)
                } : { noResult: true },
                processingTime: processingTime.toFixed(1),
                throttleMS: audioContextRef.current.throttleMS,
                signalLevel: signalLevel.toFixed(3),
                dataLength: int16Data.length,
                status: 'Processing'
              }));
            }
            
            // Process result
            processAnalyzerResult(analyzerResult);
          } else {
            // Normal processing without metrics
            const analyzerResult = await detectPitch(int16Data);
            processAnalyzerResult(analyzerResult);
          }
        } else {
          if (SHOW_DEBUG) {
            setDebugData(prev => ({...prev, analyzerReady, status: 'Analyzer not ready'}));
          }
        }
      } catch (error) {
        console.log('Buffer processing error:', error);
        if (SHOW_DEBUG) {
          setDebugData(prev => ({...prev, processingError: String(error)}));
        }
      }
    } catch (error) {
      console.error('Audio processing error:', error);
      if (SHOW_DEBUG) {
        setDebugData(prev => ({...prev, streamError: String(error)}));
      }
    }
  }, [analyzerReady, fastBase64ToPCM, calculateSignalLevel, processAnalyzerResult]);

  // Start/stop listening with the useAudioRecorder hook
  const toggleListening = useCallback(async () => {
    if (listening) {
      cleanupAudio();
    } else {
      if (!analyzerReady) {
        setError('Audio analyzer not initialized yet');
        return;
      }
      
      setError(null);
      audioContextRef.current.isListening = true;
      audioContextRef.current.noteHistory = [];
      audioContextRef.current.throttleMS = 0; // Start with no throttling
      audioContextRef.current.stableCount = 0;
      audioContextRef.current.previousNote = '';
      audioContextRef.current.streamId = '';
      
      try {
        // Start recording with continuous mode
        await startRecording({
          sampleRate: 16000,
          channels: 1,
          filename: 'wav',
          onAudioStream: handleAudioStream
        });
        
        setListening(true);
        
        if (SHOW_DEBUG) {
          setDebugData(prev => ({...prev, recordingStatus: 'Started', time: new Date().toISOString()}));
        }
      } catch (error) {
        console.error('Failed to start listening:', error);
        setError('Failed to start listening');
        audioContextRef.current.isListening = false;
        
        if (SHOW_DEBUG) {
          setDebugData(prev => ({...prev, recordingError: String(error)}));
        }
      }
    }
  }, [listening, analyzerReady, startRecording, handleAudioStream]);

  // Audio cleanup
  const cleanupAudio = useCallback(() => {
    try {
      if (isRecording) {
        stopRecording().catch(err => {
          console.log('Error stopping recording:', err);
          if (SHOW_DEBUG) {
            setDebugData(prev => ({...prev, stopError: String(err)}));
          }
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
    audioContextRef.current.stableCount = 0;
    audioContextRef.current.previousNote = '';
    audioContextRef.current.streamId = '';
    
    setListening(false);
    setCurrentNote(null);
    setCents(0);
    setFrequency(null);
    setHasStableNote(false);
    
    if (SHOW_DEBUG) {
      setDebugData(prev => ({...prev, status: 'Cleaned up', time: new Date().toISOString()}));
    }
  }, [isRecording, stopRecording]);

  // UI rendering
  const whiteKeys = enumKeys.filter(k => !k.includes('#'));
  const blackKeys = enumKeys.filter(k => k.includes('#'));
  const screenWidth = Dimensions.get('window').width;
  const keyWidth = screenWidth / whiteKeys.length;

  const whiteBG = isDarkMode ? '#000' : '#fff';
  const whiteBorder = isDarkMode ? '#fff' : '#000';
  const blackBG = isDarkMode ? '#fff' : '#000';

  return (
    <Theme>
      <View
        style={[
          styles.keyboardContainer,
          { width: keyWidth * whiteKeys.length }
        ]}
      >
        {whiteKeys.map((note, i) => (
          <Pressable
            key={note + i}
            onPress={() => console.log(`Pressed ${note}`)}
            style={[
              styles.whiteKey,
              {
                width: keyWidth,
                backgroundColor: whiteBG,
                borderColor: whiteBorder
              }
            ]}
          >
            <Text
              style={[
                styles.whiteLabel,
                { color: currentTheme.textColor }
              ]}
            >
              {note}
            </Text>
          </Pressable>
        ))}
        {blackKeys.map((note, idx) => {
          const pos = whiteKeys.indexOf(note.replace('#',''));
          return (
            <Pressable
              key={note + idx}
              onPress={() => console.log(`Pressed ${note}`)}
              style={[
                styles.blackKey,
                {
                  left: keyWidth * (pos + 1) - keyWidth * 0.25,
                  width: keyWidth * 0.5,
                  backgroundColor: blackBG
                }
              ]}
            />
          );
        })}
      </View>

      <PitchGauge 
        note={currentNote} 
        cents={cents} 
        hasStableNote={hasStableNote} 
      />

      <Text style={[styles.gaugeLabel, { color: currentTheme.textColor }]}>
        {currentNote || '-'}
        {frequency && hasStableNote && (
          <Text style={[styles.frequencyText, { color: currentTheme.textColor }]}>
            {` (${frequency.toFixed(1)} Hz)`}
          </Text>
        )}
      </Text>

      {/* Debug panel */}
      <DebugDisplay 
        debugData={debugData}
        showDebug={SHOW_DEBUG}
      />

      {proMode && (
        <>
          <View style={styles.controlsContainer}>
            <View style={styles.control}>
              <Pressable
                onPress={() => setCount(c => Math.max(1, c - 1))}
                style={[
                  styles.ctrlBtn,
                  { backgroundColor: currentTheme.textColor }
                ]}
              >
                <Text
                  style={[
                    styles.ctrlText,
                    { color: currentTheme.backgroundColor }
                  ]}
                >
                  –
                </Text>
              </Pressable>
              <Text
                style={[
                  styles.ctrlValue,
                  { color: currentTheme.textColor }
                ]}
              >
                {count}
              </Text>
              <Pressable
                onPress={() => setCount(c => c + 1)}
                style={[
                  styles.ctrlBtn,
                  { backgroundColor: currentTheme.textColor }
                ]}
              >
                <Text
                  style={[
                    styles.ctrlText,
                    { color: currentTheme.backgroundColor }
                  ]}
                >
                  +
                </Text>
              </Pressable>
            </View>

            <View style={styles.control}>
              <Pressable
                onPress={() => setBpm(b => Math.max(5, b - 5))}
                style={[
                  styles.ctrlBtn,
                  { backgroundColor: currentTheme.textColor }
                ]}
              >
                <Text
                  style={[
                    styles.ctrlText,
                    { color: currentTheme.backgroundColor }
                  ]}
                >
                  –
                </Text>
              </Pressable>
              <Text
                style={[
                  styles.ctrlValue,
                  { color: currentTheme.textColor }
                ]}
              >
                {bpm} BPM
              </Text>
              <Pressable
                onPress={() => setBpm(b => b + 5)}
                style={[
                  styles.ctrlBtn,
                  { backgroundColor: currentTheme.textColor }
                ]}
              >
                <Text
                  style={[
                    styles.ctrlText,
                    { color: currentTheme.backgroundColor }
                  ]}
                >
                  +
                </Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={() => setMetroOn(on => !on)}
            style={[
              styles.toggleBtn,
              { backgroundColor: currentTheme.textColor }
            ]}
          >
            <Text
              style={[
                styles.toggleText,
                { color: currentTheme.backgroundColor }
              ]}
            >
              {metroOn ? 'Stop Metronome' : 'Start Metronome'}
            </Text>
          </Pressable>
        </>
      )}

      <Pressable
        onPress={toggleListening}
        style={[
          styles.toggleBtn,
          {
            backgroundColor: currentTheme.textColor,
            marginTop: 6
          }
        ]}
      >
        <Text
          style={[
            styles.toggleText,
            { color: currentTheme.backgroundColor }
          ]}
        >
          {listening ? 'Stop Listening' : 'Start Listening'}
        </Text>
      </Pressable>
      
      {!analyzerReady && (
        <View style={styles.initializing}>
          <ActivityIndicator size="small" color={currentTheme.textColor} />
          <Text style={[styles.initText, { color: currentTheme.textColor }]}>
            Initializing audio analyzer...
          </Text>
        </View>
      )}
      
      {error && (
        <Text style={[styles.errorText, { color: currentTheme.textColor }]}>
          {error}
        </Text>
      )}
    </Theme>
  );
};

export default Screen1;

const styles = StyleSheet.create({
  keyboardContainer: {
    flexDirection: 'row',
    position: 'relative',
    height: 200,
    alignSelf: 'center'
  },
  whiteKey: { borderWidth: 1, height: '100%', justifyContent: 'flex-end' },
  blackKey: { position: 'absolute', height: '60%', borderRadius: 3, zIndex: 1 },
  whiteLabel: { alignSelf: 'center', marginBottom: 8, fontSize: 12 },

  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20
  },
  control: { flexDirection: 'row', alignItems: 'center' },

  ctrlBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  ctrlText: { fontSize: 24, fontWeight: '600' },
  ctrlValue: { marginHorizontal: 12, fontSize: 16, fontWeight: '500' },

  toggleBtn: {
    alignSelf: 'center',
    padding: 12,
    borderRadius: 6,
    marginTop: 10
  },
  toggleText: { fontSize: 16, fontWeight: '600' },

  gaugeLabel: {
    alignSelf: 'center',
    marginTop: -40,
    fontSize: 24,
    fontWeight: '600'
  },
  frequencyText: {
    fontSize: 16,
    fontWeight: '400'
  },
  errorText: {
    alignSelf: 'center',
    marginTop: 10,
    fontSize: 14,
    fontWeight: '500'
  },
  
  // Debug styles
  debugContainer: {
    width: '90%',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 8,
    padding: 10,
    alignSelf: 'center',
    marginVertical: 10
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5
  },
  debugText: {
    fontSize: 10,
    fontFamily: 'monospace'
  },
  
  // Loading indicator
  initializing: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10
  },
  initText: {
    marginLeft: 10,
    fontSize: 14
  }
});