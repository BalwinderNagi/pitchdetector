import React from 'react';
import { View, Text, Dimensions, StyleSheet } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

const { width: SCREEN_W } = Dimensions.get('window');
const R = SCREEN_W * 0.4;
const STROKE = 4;

const CHROMA = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

interface PitchGaugeProps {
  note: string | null;
  cents: number;
  hasStableNote: boolean;
}

export default function PitchGauge({ note, cents, hasStableNote }: PitchGaugeProps) {
  const idx = CHROMA.indexOf(note ?? '');
  const pct = idx < 0 ? 0 : idx / (CHROMA.length - 1);
  const angle = (pct * 180 - 90) * (Math.PI / 180);

  const x2 = R + (R - STROKE) * Math.cos(angle);
  const y2 = R + (R - STROKE) * Math.sin(angle);

  return (
    <View style={styles.container}>
      <Text style={styles.noteLabel}>
        {note ?? '–'}
      </Text>

      {hasStableNote && (
        <Text style={styles.centsLabel}>
          {cents > 0 ? `+${cents.toFixed(1)}¢` : `${cents.toFixed(1)}¢`}
        </Text>
      )}

      <Svg width={R * 2 + STROKE} height={R + STROKE}>
        <Circle
          cx={R + STROKE / 2}
          cy={R + STROKE / 2}
          r={R - STROKE / 2}
          stroke="#aaa"
          strokeWidth={STROKE}
          fill="none"
        />
        <Line
          x1={R + STROKE / 2}
          y1={R + STROKE / 2}
          x2={x2}
          y2={y2}
          stroke={hasStableNote ? 'crimson' : '#ccc'}
          strokeWidth={STROKE}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 16,
  },
  noteLabel: {
    fontSize: 48,
    fontWeight: '700',
    marginBottom: 4,
  },
  centsLabel: {
    fontSize: 18,
    fontWeight: '500',
    color: 'gray',
    marginBottom: 8,
  },
});
