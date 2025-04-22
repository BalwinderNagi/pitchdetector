// src/components/screens/Screen2.js
import React, { useContext } from 'react'
import { Text } from 'react-native'
import Theme from '../layout/Theme'
import { ThemeContext } from '../layout/ThemeContext'

export const Screen2 = () => {
  const { currentTheme } = useContext(ThemeContext)
  return (
    <Theme>
      <Text style={{ color: currentTheme.textColor }}>TEST SCREEN 2</Text>
    </Theme>
  )
}

export default Screen2
