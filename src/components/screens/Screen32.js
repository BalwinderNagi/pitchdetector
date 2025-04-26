// src/components/screens/Screen32.js
import React, { useState, useContext } from 'react'
import { View, Text, StyleSheet, Switch } from 'react-native'
import Theme from '../layout/Theme'
import { ThemeContext } from '../layout/ThemeContext'

export const Screen32 = () => {
  const { currentTheme, isDarkMode } = useContext(ThemeContext)
  const [isProOn, setIsProOn] = useState(false)

  // decide styles based on dark mode + toggle state
  const boxBg = isDarkMode
    ? (isProOn ? '#fff' : '#000')
    : (isProOn ? '#000' : '#fff')
  const textColor = isDarkMode
    ? (isProOn ? '#000' : '#fff')
    : (isProOn ? '#fff' : '#000')

  return (
    <Theme>
      <View style={styles.container}>
        <View style={[styles.box, { backgroundColor: boxBg }]}>
          <Text style={[styles.boxText, { color: textColor }]}>
            Pro Mode {isProOn ? 'On' : 'Off'}
          </Text>
        </View>
        <Switch
          value={isProOn}
          onValueChange={setIsProOn}
          thumbColor={isProOn ? currentTheme.textColor : '#ccc'}
          trackColor={{
            true: currentTheme.textColor + '55',
            false: '#999'
          }}
          style={styles.switch}
        />
      </View>
    </Theme>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12
  },
  box: {
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  boxText: {
    fontSize: 18
  },
  switch: {
    marginLeft: 8
  }
})

export default Screen32
