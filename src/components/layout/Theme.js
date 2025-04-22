// src/components/layout/Theme.js
import React, { useContext } from 'react'
import { View, StatusBar, StyleSheet } from 'react-native'
import { ThemeContext } from './ThemeContext'

const Theme = ({ children }) => {
  const { currentTheme, isDarkMode } = useContext(ThemeContext)
  return (
    <View style={[styles.screen, { backgroundColor: currentTheme.backgroundColor }]}>
      {children}
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 15 }
})

export default Theme
