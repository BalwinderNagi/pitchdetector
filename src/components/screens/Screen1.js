// src/components/screens/Screen1.js
import React, { useContext, useState, useEffect, useRef } from 'react'
import { View, Pressable, Text, StyleSheet, Dimensions } from 'react-native'
import { Audio } from 'expo-av'
import Theme from '../layout/Theme'
import { ThemeContext } from '../layout/ThemeContext'

// 13-key layout
const keys = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B','C']

export const Screen1 = () => {
  const { currentTheme, isDarkMode } = useContext(ThemeContext)
  const [count, setCount] = useState(1)
  const [bpm, setBpm] = useState(100)
  const [metroOn, setMetroOn] = useState(false)
  const intervalRef = useRef(null)
  const soundRef = useRef(null)

  // Load click sound on mount
  useEffect(() => {
    (async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require('../../../assets/click.wav')
        )
        soundRef.current = sound
      } catch (e) {
        console.warn('Audio load error:', e)
      }
    })()
    return () => {
      clearInterval(intervalRef.current)
      soundRef.current?.unloadAsync()
    }
  }, [])

  // Metronome tick
  useEffect(() => {
    clearInterval(intervalRef.current)
    const tick = () => {
      const s = soundRef.current
      if (!s) return
      s.setPositionAsync(0)
        .then(() => s.playAsync())
        .catch(e => console.warn('Play error:', e))
    }
    if (metroOn) {
      tick() // immediate tick
      intervalRef.current = setInterval(tick, Math.round(60000 / bpm))
    }
    return () => clearInterval(intervalRef.current)
  }, [metroOn, bpm])

  // Keyboard layout
  const whiteKeys = keys.filter(k => !k.includes('#'))
  const blackKeys = keys.filter(k => k.includes('#'))
  const screenWidth = Dimensions.get('window').width
  const keyWidth = screenWidth / whiteKeys.length

  // Colors
  const whiteBG = isDarkMode ? '#000' : '#fff'
  const whiteBorder = isDarkMode ? '#fff' : '#000'
  const blackBG = isDarkMode ? '#fff' : '#000'

  return (
    <Theme>
      {/* Keyboard */}
      <View style={styles.keyboardContainer}>
        {whiteKeys.map((note, i) => (
          <Pressable
            key={note + i}
            onPress={() => console.log(`You pressed ${note}`)}
            style={[
              styles.whiteKey,
              { width: keyWidth, backgroundColor: whiteBG, borderColor: whiteBorder }
            ]}
          >
            <Text style={[styles.whiteLabel, { color: currentTheme.textColor }]}> {note} </Text>
          </Pressable>
        ))}
        {blackKeys.map((note, idx) => {
          const pos = whiteKeys.indexOf(note.replace('#',''))
          return (
            <Pressable
              key={note + idx}
              onPress={() => console.log(`You pressed ${note}`)}
              style={[
                styles.blackKey,
                {
                  left: keyWidth * (pos + 1) - keyWidth * 0.25,
                  width: keyWidth * 0.5,
                  backgroundColor: blackBG
                }
              ]}
            />
          )
        })}
      </View>

      {/* Counter & Metronome Controls */}
      <View style={styles.controlsContainer}>
        <View style={styles.control}>
          <Pressable onPress={() => setCount(c => Math.max(1, c - 1))} style={[styles.ctrlBtn, { backgroundColor: currentTheme.textColor }]}>  
            <Text style={[styles.ctrlText, { color: currentTheme.backgroundColor }]}>-</Text>
          </Pressable>
          <Text style={[styles.ctrlValue, { color: currentTheme.textColor }]}>{count}</Text>
          <Pressable onPress={() => setCount(c => c + 1)} style={[styles.ctrlBtn, { backgroundColor: currentTheme.textColor }]}>  
            <Text style={[styles.ctrlText, { color: currentTheme.backgroundColor }]}>+</Text>
          </Pressable>
        </View>

        <View style={styles.control}>
          <Pressable onPress={() => setBpm(b => Math.max(5, b - 5))} style={[styles.ctrlBtn, { backgroundColor: currentTheme.textColor }]}>  
            <Text style={[styles.ctrlText, { color: currentTheme.backgroundColor }]}>-</Text>
          </Pressable>
          <Text style={[styles.ctrlValue, { color: currentTheme.textColor }]}>{bpm} BPM</Text>
          <Pressable onPress={() => setBpm(b => b + 5)} style={[styles.ctrlBtn, { backgroundColor: currentTheme.textColor }]}>  
            <Text style={[styles.ctrlText, { color: currentTheme.backgroundColor }]}>+</Text>
          </Pressable>
        </View>
      </View>

      {/* Toggle Metronome */}
      <Pressable onPress={() => setMetroOn(on => !on)} style={[styles.toggleBtn, { backgroundColor: currentTheme.textColor }]}>  
        <Text style={[styles.toggleText, { color: currentTheme.backgroundColor }]}>
          {metroOn ? 'Stop Metronome' : 'Start Metronome'}
        </Text>
      </Pressable>
    </Theme>
  )
}

export default Screen1

const styles = StyleSheet.create({
  keyboardContainer: { flexDirection: 'row', position: 'relative', height: 200, width: '100%', alignSelf: 'center' },
  whiteKey: { borderWidth: 1, height: '100%', justifyContent: 'flex-end' },
  blackKey: { position: 'absolute', height: '60%', borderRadius: 3, zIndex: 1 },
  whiteLabel: { alignSelf: 'center', marginBottom: 8, fontSize: 12 },
  controlsContainer: { flexDirection: 'row', justifyContent: 'space-around', padding: 20 },
  control: { flexDirection: 'row', alignItems: 'center' },
  ctrlBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  ctrlText: { fontSize: 24, fontWeight: '600' },
  ctrlValue: { marginHorizontal: 12, fontSize: 16, fontWeight: '500' },
  toggleBtn: { alignSelf: 'center', padding: 12, borderRadius: 6, marginTop: 10 },
  toggleText: { fontSize: 16, fontWeight: '600' }
})