// App.js
import React, { useEffect } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { StatusBar } from 'expo-status-bar'
import Screen1 from './src/components/screens/Screen1'
import Screen2 from './src/components/screens/Screen2'
import Screen3 from './src/components/screens/Screen3'
import Screen31 from './src/components/screens/Screen31'
import MainMenu from './src/components/screens/MainMenu'
import ThemeProvider from './src/components/layout/ThemeContext'

// 1️⃣ Import your JS helper (not TS) that wraps the TFLite interpreter:
import { initPitchModel } from './src/utils/pitchDetector'

const Stack = createNativeStackNavigator()

export default function App() {
  // 2️⃣ Kick off model loading at app start:
  useEffect(() => {
    initPitchModel()
      .then(() => console.log('✅ Pitch model loaded'))
      .catch(err => console.error('❌ Failed to load pitch model:', err))
  }, [])

  return (
    <ThemeProvider>
      <NavigationContainer>
        <StatusBar style="auto" />

        <Stack.Navigator initialRouteName="MainMenu">
          <Stack.Screen name="Screen1" component={Screen1} />
          <Stack.Screen name="Screen2" component={Screen2} />
          <Stack.Screen name="Screen3" component={Screen3} />
          <Stack.Screen 
            name="Screen31" 
            component={Screen31}
            options={{ title: 'Light/Dark Mode', headerTitleAlign: 'center' }}
          />
          <Stack.Screen
            name="MainMenu"
            component={MainMenu}
            options={{ title: 'Piano Tuning App', headerTitleAlign: 'center' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  )
}

