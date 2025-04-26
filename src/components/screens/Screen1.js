// src/components/screens/Screen1.js
import React, { useContext, useState, useEffect, useRef } from 'react'
import { View, Pressable, Text, StyleSheet, Dimensions, Alert } from 'react-native'
import { Audio } from 'expo-av'
import * as FileSystem from 'expo-file-system'
import Theme from '../layout/Theme'
import { ThemeContext } from '../layout/ThemeContext'
import PitchGauge from '../layout/PitchGauge'            // ← new

// 12-key layout (no duplicate 'C')
const enumKeys = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']

export const Screen1 = () => {
  const { currentTheme, isDarkMode } = useContext(ThemeContext)

  // UI state
  const [count, setCount]         = useState(1)
  const [bpm, setBpm]             = useState(100)
  const [metroOn, setMetroOn]     = useState(false)
  const [listening, setListening] = useState(false)
  const [currentNote, setCurrentNote] = useState(null)   // ← new

  const intervalRef  = useRef(null)
  const soundRef     = useRef(null)
  const recordingRef = useRef(null)

  // (1) load click sound
  useEffect(() => {
    ;(async () => {
      const { sound } = await Audio.Sound.createAsync(require('../../../assets/click.wav'))
      soundRef.current = sound
    })()
    return () => {
      clearInterval(intervalRef.current)
      soundRef.current?.unloadAsync()
      stopRecording()
    }
  }, [])

  // (2) request mic permissions
  useEffect(() => {
    ;(async () => {
      const { status } = await Audio.requestPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Mic permission', 'Microphone permission is required to detect pitch.')
        return
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
        shouldDuckAndroid: true,
      })
    })()
  }, [])

  // (3) metronome
  useEffect(() => {
    clearInterval(intervalRef.current)
    const tick = () => {
      const s = soundRef.current
      if (!s) return
      s.setPositionAsync(0).then(() => s.playAsync()).catch(() => {})
    }
    if (metroOn) {
      tick()
      intervalRef.current = setInterval(tick, Math.round(60000 / bpm))
    }
    return () => clearInterval(intervalRef.current)
  }, [metroOn, bpm])

  // (4) start streaming PCM ↓
  const startRecording = async () => {
    try {
      const recording = new Audio.Recording()
      await recording.prepareToRecordAsync({
        ios: {
          extension: '.caf',
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        android: {
          extension: '.wav',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_PCM_16BIT,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_PCM_16BIT,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
        },
      })

      recording.setOnRecordingStatusUpdate(async status => {
        if (status.isRecording) {
          const uri = recording.getURI()
          // read raw PCM as base64
          const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })
          // TODO: decode base64→PCM buffer & run your TFLite helper
          const [note, conf] = await predictOneAsync(base64)
          setCurrentNote(note)    // ← update the gauge
        }
      })
      recording.setProgressUpdateInterval(100)
      await recording.startAsync()
      recordingRef.current = recording
      setListening(true)
    } catch (e) {
      console.error('Recording start error', e)
    }
  }

  const stopRecording = async () => {
    try {
      const rec = recordingRef.current
      if (!rec) return
      await rec.stopAndUnloadAsync()
      recordingRef.current = null
    } catch {}
    setListening(false)
  }

  // (5) piano keyboard layout
  const whiteKeys = enumKeys.filter(k => !k.includes('#'))
  const blackKeys = enumKeys.filter(k => k.includes('#'))
  const screenWidth = Dimensions.get('window').width
  const keyWidth = screenWidth / whiteKeys.length

  // (6) colors
  const whiteBG    = isDarkMode ? '#000' : '#fff'
  const whiteBorder= isDarkMode ? '#fff' : '#000'
  const blackBG    = isDarkMode ? '#fff' : '#000'

  return (
    <Theme>
      {/* ————— piano keys ————— */}
      <View style={styles.keyboardContainer}>
        {whiteKeys.map((note,i)=>(
          <Pressable
            key={note+i}
            onPress={()=>console.log(`Pressed ${note}`)}
            style={[styles.whiteKey, { width:keyWidth, backgroundColor:whiteBG, borderColor:whiteBorder }]}
          >
            <Text style={[styles.whiteLabel, { color: currentTheme.textColor }]}>{note}</Text>
          </Pressable>
        ))}
        {blackKeys.map((note,idx)=>{
          const pos = whiteKeys.indexOf(note.replace('#',''))
          return (
            <Pressable
              key={note+idx}
              onPress={()=>console.log(`Pressed ${note}`)}
              style={[styles.blackKey,{
                left: keyWidth*(pos+1)-keyWidth*0.25,
                width:keyWidth*0.5,
                backgroundColor:blackBG
              }]}
            />
          )
        })}
      </View>

      {/* ————— gauge ————— */}
      <PitchGauge note={currentNote} />

      {/* ————— controls ————— */}
      <View style={styles.controlsContainer}>
        {/* count */}
        <View style={styles.control}>
          <Pressable onPress={()=>setCount(c=>Math.max(1,c-1))} style={[styles.ctrlBtn,{backgroundColor:currentTheme.textColor}]}>
            <Text style={[styles.ctrlText,{color:currentTheme.backgroundColor}]}>-</Text>
          </Pressable>
          <Text style={[styles.ctrlValue,{color:currentTheme.textColor}]}>{count}</Text>
          <Pressable onPress={()=>setCount(c=>c+1)} style={[styles.ctrlBtn,{backgroundColor:currentTheme.textColor}]}>
            <Text style={[styles.ctrlText,{color:currentTheme.backgroundColor}]}>+</Text>
          </Pressable>
        </View>

        {/* bpm */}
        <View style={styles.control}>
          <Pressable onPress={()=>setBpm(b=>Math.max(5,b-5))} style={[styles.ctrlBtn,{backgroundColor:currentTheme.textColor}]}>
            <Text style={[styles.ctrlText,{color:currentTheme.backgroundColor}]}>-</Text>
          </Pressable>
          <Text style={[styles.ctrlValue,{color:currentTheme.textColor}]}>{bpm} BPM</Text>
          <Pressable onPress={()=>setBpm(b=>b+5)} style={[styles.ctrlBtn,{backgroundColor:currentTheme.textColor}]}>
            <Text style={[styles.ctrlText,{color:currentTheme.backgroundColor}]}>+</Text>
          </Pressable>
        </View>
      </View>

      {/* ————— buttons ————— */}
      <Pressable onPress={()=>setMetroOn(on=>!on)} style={[styles.toggleBtn,{backgroundColor:currentTheme.textColor}]}>
        <Text style={[styles.toggleText,{color:currentTheme.backgroundColor}]}>{metroOn?'Stop Metronome':'Start Metronome'}</Text>
      </Pressable>

      <Pressable onPress={()=>listening?stopRecording():startRecording()} style={[styles.toggleBtn,{backgroundColor:currentTheme.textColor,marginTop:6}]}>
        <Text style={[styles.toggleText,{color:currentTheme.backgroundColor}]}>{listening?'Stop Listening':'Start Listening'}</Text>
      </Pressable>
    </Theme>
  )
}

export default Screen1

const styles = StyleSheet.create({
  keyboardContainer: { flexDirection:'row', position:'relative', height:200, width:'100%', alignSelf:'center' },
  whiteKey:          { borderWidth:1, height:'100%', justifyContent:'flex-end' },
  blackKey:          { position:'absolute', height:'60%', borderRadius:3, zIndex:1 },
  whiteLabel:        { alignSelf:'center', marginBottom:8, fontSize:12 },
  controlsContainer: { flexDirection:'row', justifyContent:'space-around', padding:20 },
  control:           { flexDirection:'row', alignItems:'center' },
  ctrlBtn:           { width:40, height:40, borderRadius:20, justifyContent:'center', alignItems:'center' },
  ctrlText:          { fontSize:24, fontWeight:'600' },
  ctrlValue:         { marginHorizontal:12, fontSize:16, fontWeight:'500' },
  toggleBtn:         { alignSelf:'center', padding:12, borderRadius:6, marginTop:10 },
  toggleText:        { fontSize:16, fontWeight:'600' },
})
