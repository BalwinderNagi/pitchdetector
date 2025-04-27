import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Button, StyleSheet, TouchableOpacity } from 'react-native';
import { useAudioRecorder } from '@siteed/expo-audio-stream';
import { decode as atob } from 'base-64';
import { initPitchModel, predictFromPCM } from '../../utils/pitchDetector';

// Extended interface matching the actual runtime structure
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

export default function PitchDetectorScreen() {
  const [currentPitch, setCurrentPitch] = useState<string>('');
  const [confidence, setConfidence] = useState<number>(0);
  const [modelReady, setModelReady] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  
  // Custom recording state management (more reliable than library state)
  const [isRecordingLocal, setIsRecordingLocal] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // References for reliable state access in callbacks
  const isRecordingRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const latestDataTimeRef = useRef<number>(0);
  
  // Get the audio recorder hook
  const {
    startRecording,
    stopRecording,
    isRecording,
    durationMs
  } = useAudioRecorder({
    logger: console
  });

  // Initialize the model when component mounts
  useEffect(() => {
    const setupModel = async () => {
      try {
        await initPitchModel();
        setModelReady(true);
        console.log('Pitch model loaded');
      } catch (error) {
        console.error('Failed to initialize pitch model:', error);
        setProcessingError('Failed to load pitch model');
      }
    };

    setupModel();
    
    // Clean up on unmount
    return () => {
      cleanupRecording();
    };
  }, []);

  // Cleanup function to ensure we stop recording and clear timers
  const cleanupRecording = () => {
    console.log('Cleaning up recording session');
    
    // Stop the timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Stop recording if active
    if (isRecordingRef.current) {
      stopRecording().catch(err => 
        console.error('Error stopping recording during cleanup:', err)
      );
      isRecordingRef.current = false;
      setIsRecordingLocal(false);
    }
  };

  // Process audio data with debouncing to prevent UI lag
  const handleAudioStream = async (event: ExtendedAudioEvent) => {
    try {
      // Skip processing if we've processed data recently (reduces CPU load)
      const now = Date.now();
      if (now - latestDataTimeRef.current < 100) { // Only process every 100ms
        return;
      }
      latestDataTimeRef.current = now;

      // The audio data is in the 'encoded' field according to the logs
      if (!event.encoded && !event.data) {
        console.warn('No audio data found in event');
        return;
      }
      
      let audioData = event.encoded || event.data;
      
      if (!audioData || typeof audioData !== 'string') {
        console.warn('Invalid audio data format:', typeof audioData);
        return;
      }
      
      // Convert the base64 string to Int16Array
      const binary = atob(audioData);
      const buffer = new ArrayBuffer(binary.length);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < binary.length; i++) {
        view[i] = binary.charCodeAt(i);
      }
      const int16Data = new Int16Array(buffer);
      
      // Process audio buffer with the model
      const [pitch, conf] = await predictFromPCM(int16Data);
      
      // Update state with prediction results
      setCurrentPitch(pitch);
      setConfidence(conf);
    } catch (error) {
      console.error('Error processing audio:', error);
    }
  };

  // Start recording with proper initialization
  const handleStartRecording = async () => {
    if (!modelReady) {
      console.log('Model not ready yet');
      return;
    }

    if (isRecordingRef.current) {
      console.log('Already recording, stopping first');
      await handleStopRecording();
    }

    setProcessingError(null);
    
    try {
      console.log('Starting recording');
      
      // Reset timer state
      startTimeRef.current = Date.now();
      setElapsedTime(0);
      
      // Start a timer to update the UI
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      timerRef.current = setInterval(() => {
        if (startTimeRef.current > 0) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setElapsedTime(elapsed);
        }
      }, 1000);
      
      // Update our recording state
      isRecordingRef.current = true;
      setIsRecordingLocal(true);
      
      // Start the actual recording
      await startRecording({
        sampleRate: 16000,
        channels: 1,
        filename: 'wav',
        onAudioStream: handleAudioStream
      });
      
      console.log('Recording started successfully');
    } catch (error) {
      console.error('Error starting recording:', error);
      setProcessingError('Failed to start recording');
      cleanupRecording();
    }
  };

  // Stop recording with proper cleanup
  const handleStopRecording = async () => {
    console.log('Attempting to stop recording');
    
    try {
      // Call the library's stop function
      await stopRecording();
      console.log('Recording stopped successfully');
    } catch (error) {
      console.error('Error stopping recording:', error);
      setProcessingError('Failed to stop recording');
    } finally {
      // Always clean up our local state
      cleanupRecording();
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pitch Detector</Text>
      
      <View style={styles.pitchDisplay}>
        <Text style={styles.pitchText}>
          {currentPitch ? `Pitch: ${currentPitch}` : 'No pitch detected'}
        </Text>
        <Text style={styles.confidenceText}>
          {confidence > 0 ? `Confidence: ${confidence.toFixed(2)}` : ''}
        </Text>
        {isRecordingLocal && (
          <Text style={styles.recordingText}>
            Recording: {elapsedTime}s
          </Text>
        )}
        {processingError && (
          <Text style={styles.errorText}>{processingError}</Text>
        )}
      </View>
      
      <View style={styles.controls}>
        {!isRecordingLocal ? (
          <TouchableOpacity 
            style={[styles.button, !modelReady && styles.buttonDisabled]}
            onPress={handleStartRecording}
            disabled={!modelReady}
          >
            <Text style={styles.buttonText}>Start Listening</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={[styles.button, styles.stopButton]}
            onPress={handleStopRecording}
          >
            <Text style={styles.buttonText}>Stop Listening</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {!modelReady && (
        <Text style={styles.loadingText}>Loading model...</Text>
      )}
    </View>
  );
}

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
    marginBottom: 30,
    color: '#333',
  },
  pitchDisplay: {
    alignItems: 'center',
    marginBottom: 40,
    padding: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pitchText: {
    fontSize: 30,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2c3e50',
  },
  confidenceText: {
    fontSize: 18,
    color: '#7f8c8d',
    marginBottom: 10,
  },
  recordingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#e74c3c',
    fontWeight: 'bold',
  },
  errorText: {
    marginTop: 10,
    fontSize: 14,
    color: '#e74c3c',
    fontWeight: 'bold',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '90%',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#bdc3c7',
  },
  stopButton: {
    backgroundColor: '#e74c3c',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingText: {
    marginTop: 20,
    color: '#7f8c8d',
    fontSize: 16,
  }
});