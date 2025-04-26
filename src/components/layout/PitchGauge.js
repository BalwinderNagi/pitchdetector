import React from 'react'
import { View, Text, Dimensions, StyleSheet } from 'react-native'
import Svg, { Circle, Line } from 'react-native-svg'

// full screen width → radius for half‐circle
const { width: SCREEN_W } = Dimensions.get('window')
const R = SCREEN_W * 0.4       // gauge radius
const STROKE = 4

// chromatic mapping:
const CHROMA = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']

export default function PitchGauge({ note }) {
  // find note index (0–11)
  const idx = CHROMA.indexOf(note)
  const pct = idx < 0 ? 0 : idx / (CHROMA.length - 1)  // 0–1
  // map to angle from -90° (left) to +90° (right)
  const angle = (pct * 180 - 90) * (Math.PI/180)
  // compute needle tip
  const x2 = R + (R - STROKE) * Math.cos(angle)
  const y2 = R + (R - STROKE) * Math.sin(angle)

  return (
    <View style={styles.container}>
      <Text style={styles.noteLabel}>{note || '–'}</Text>

      <Svg width={R*2 + STROKE} height={R + STROKE}>
        {/* semicircular track */}
        <Circle
          cx={R + STROKE/2}
          cy={R + STROKE/2}
          r={R - STROKE/2}
          stroke="#aaa"
          strokeWidth={STROKE}
          fill="none"
        />
        {/* needle */}
        <Line
          x1={R + STROKE/2}
          y1={R + STROKE/2}
          x2={x2}
          y2={y2}
          stroke="crimson"
          strokeWidth={STROKE}
        />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 16,
  },
  noteLabel: {
    fontSize: 48,
    fontWeight: '700',
    marginBottom: 8,
  },
})
