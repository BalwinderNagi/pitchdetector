// src/components/screens/Screen31.js
import React, { useContext } from 'react'
import { View, StyleSheet, Pressable, Text } from 'react-native'
import Theme from '../layout/Theme'
import { ThemeContext } from '../layout/ThemeContext'

export const Screen31 = () => {
  const { isDarkMode, toggleTheme, currentTheme } = useContext(ThemeContext)

  return (
    <Theme>
      <View style={styles.container}>
        <Pressable
          style={[styles.btn, { backgroundColor: currentTheme.textColor }]}
          onPress={() => isDarkMode && toggleTheme()}
        >
          <Text style={[styles.btnText, { color: currentTheme.backgroundColor }]}>
            LIGHT
          </Text>
        </Pressable>

        <Pressable
          style={[styles.btn, { backgroundColor: currentTheme.textColor }]}
          onPress={() => !isDarkMode && toggleTheme()}
        >
          <Text style={[styles.btnText, { color: currentTheme.backgroundColor }]}>
            DARK
          </Text>
        </Pressable>
      </View>
    </Theme>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
    width: '60%',
    alignSelf: 'center'
  },
  btn: {
    paddingVertical: 14,
    borderRadius: 6,
    alignItems: 'center'
  },
  btnText: {
    fontSize: 16,
    fontWeight: '600'
  }
})

export default Screen31
