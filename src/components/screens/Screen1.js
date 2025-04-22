// src/components/screens/Screen1.js
import React, { useContext, useState, useEffect, useRef } from 'react'
import { View, Pressable, Text, StyleSheet, Dimensions } from 'react-native'
import { Audio } from 'expo-av'
import Theme from '../layout/Theme'
import { ThemeContext } from '../layout/ThemeContext'

// 13-key layout (C to C) with unique IDs
const keys = [
  { note: 'C',  id: 'C4' },
  { note: 'C#', id: 'Csharp4' },
  { note: 'D',  id: 'D4' },
  { note: 'D#', id: 'Dsharp4' },
  { note: 'E',  id: 'E4' },
  { note: 'F',  id: 'F4' },
  { note: 'F#', id: 'Fsharp4' },
  { note: 'G',  id: 'G4' },
  { note: 'G#', id: 'Gsharp4' },
  { note: 'A',  id: 'A4' },
  { note: 'A#', id: 'Asharp4' },
  { note: 'B',  id: 'B4' },
  { note: 'C',  id: 'C5' }
]

export const Screen1 = () => {
  const { currentTheme, isDarkMode } = useContext(ThemeContext)
  const [count, setCount] = useState(1)
  const [bpm, setBpm] = useState(100)
  const [metroOn, setMetroOn] = useState(true)
  const intervalRef = useRef(null)
  const soundRef = useRef(new Audio.Sound())

  // Load click sound once
  useEffect(() => {
    ;(async () => {
      try {
        await soundRef.current.loadAsync(require('../../../../assets/click.wav'))
      } catch {};
    })()
    return () => {
      clearInterval(intervalRef.current)
      soundRef.current.unloadAsync()
    }
  }, [])

  // Manage metronome interval
  useEffect(() => {
    clearInterval(intervalRef.current)
    if (metroOn) {
      intervalRef.current = setInterval(async () => {
        try { await soundRef.current.replayAsync() } catch {}
      }, 60000 / bpm)
    }
    return () => clearInterval(intervalRef.current)
  }, [bpm, metroOn])

  // Keyboard layout
  const whiteKeys = keys.filter(k => !k.note.includes('#'))
  const blackKeys = keys.filter(k => k.note.includes('#'))
  const SCREEN_WIDTH = Dimensions.get('window').width
  const keyWidth = SCREEN_WIDTH / whiteKeys.length

  // Inverted colors in dark mode
  const whiteKeyBG = isDarkMode ? '#000' : '#fff'
  const whiteKeyBorder = isDarkMode ? '#fff' : '#000'
  const blackKeyBG = isDarkMode ? '#fff' : '#000'

  return (
    <Theme>
      {/* Piano keyboard */}
      <View style={styles.keyboardContainer}>
        {whiteKeys.map(({note,id}) => (
          <Pressable
            key={id}
            onPress={() => console.log(`You pressed ${note}`)}
            style={[
              styles.whiteKey,
              {
                width: keyWidth,
                backgroundColor: whiteKeyBG,
                borderColor: whiteKeyBorder
              }
            ]}
          >
            <Text style={[styles.whiteLabel, { color: currentTheme.textColor }]}>  
              {note}
            </Text>
          </Pressable>
        ))}
        {blackKeys.map(({note,id}) => {
          const whiteIndex = whiteKeys.findIndex(w => w.note === note.replace('#',''))
          return (
            <Pressable
              key={id}
              onPress={() => console.log(`You pressed ${note}`)}
              style={[
                styles.blackKey,
                {
                  left: keyWidth * (whiteIndex + 1) - keyWidth * 0.25,
                  width: keyWidth * 0.5,
                  backgroundColor: blackKeyBG
                }
              ]}
            />
          )
        })}
      </View>

      {/* Controls: Counter and Metronome */}
      <View style={styles.controlsContainer}>
        {/* Counter */}
        <View style={styles.control}>
          <Pressable
            style={[styles.ctrlBtn, { backgroundColor: currentTheme.textColor }]}
            onPress={() => setCount(c => Math.max(1, c - 1))}
          >
            <Text style={[styles.ctrlText, { color: currentTheme.backgroundColor }]}>
              -
            </Text>
          </Pressable>
          <Text style={[styles.ctrlValue, { color: currentTheme.textColor }]}>  
            {count}
          </Text>
          <Pressable
            style={[styles.ctrlBtn, { backgroundColor: currentTheme.textColor }]}
            onPress={() => setCount(c => c + 1)}
          >
            <Text style={[styles.ctrlText, { color: currentTheme.backgroundColor }]}>
              +
            </Text>
          </Pressable>
        </View>

        {/* Metronome */}
        <View style={styles.control}>
          <Pressable
            style={[styles.ctrlBtn, { backgroundColor: currentTheme.textColor }]}
            onPress={() => setBpm(b => Math.max(5, b - 5))}
          >
            <Text style={[styles.ctrlText, { color: currentTheme.backgroundColor }]}>-</Text>
          </Pressable>
          <Text style={[styles.ctrlValue, { color: currentTheme.textColor }]}>  
            {bpm} BPM
          </Text>
          <Pressable
            style={[styles.ctrlBtn, { backgroundColor: currentTheme.textColor }]}
            onPress={() => setBpm(b => b + 5)}
          >
            <Text style={[styles.ctrlText, { color: currentTheme.backgroundColor }]}>+</Text>
          </Pressable>
        </View>
      </View>

      {/* Toggle Metronome Button */}
      <Pressable
        style={[styles.toggleBtn, { backgroundColor: currentTheme.textColor }]}
        onPress={() => setMetroOn(on => !on)}
      >
        <Text style={[styles.toggleText, { color: currentTheme.backgroundColor }]}>  
          {metroOn ? 'Stop Metronome' : 'Start Metronome'}
        </Text>
      </Pressable>
    </Theme>
  )
}

export default Screen1

const styles = StyleSheet.create({
  keyboardContainer: {
    flexDirection: 'row',
    position: 'relative',
    height: 200,
    width: '100%',
    alignSelf: 'center'
  },
  whiteKey: {
    borderWidth: 1,
    height: '100%',
    justifyContent: 'flex-end'
  },
  blackKey: {
    position: 'absolute',
    height: '60%',
    borderRadius: 3,
    zIndex: 1
  },
  whiteLabel: {
    alignSelf: 'center',
    marginBottom: 8,
    fontSize: 12
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20
  },
  control: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  ctrlBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  ctrlText: {
    fontSize: 24,
    fontWeight: '600'
  },
  ctrlValue: {
    marginHorizontal: 12,
    fontSize: 16,
    fontWeight: '500'
  }
})
