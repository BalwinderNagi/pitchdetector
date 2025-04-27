import 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
enableScreens();

import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import ScreenDemos from './src/components/screens/ScreenDemos';
import ThemeProvider from './src/components/layout/ThemeContext';
import MainMenu     from './src/components/screens/MainMenu';
import { Credits }  from './src/components/screens/Screen3';
import Screen1      from './src/components/screens/Screen1';
import Screen2      from './src/components/screens/Screen2';
import Screen3      from './src/components/screens/Screen3';
import Screen31     from './src/components/screens/Screen31';
import Screen32     from './src/components/screens/Screen32';

import { initPitchModel } from './src/utils/pitchDetector';

const Stack = createNativeStackNavigator();

export default function App() {
  useEffect(() => {
    initPitchModel()
      .then(() => console.log('Pitch model loaded'))
      .catch(err => console.error('Failed to load pitch model:', err));
  }, []);

  return (
    <ThemeProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        <Stack.Navigator initialRouteName="ScreenDemos">
          <Stack.Screen
            name="Screen1"
            component={Screen1}
            options={{ title: 'Tuner', headerTitleAlign: 'center' }}
          />
          <Stack.Screen
            name="Screen2"
            component={Screen2}
            options={{ title: 'Tutorial', headerTitleAlign: 'center' }}
          />
          <Stack.Screen
            name="Screen3"
            component={Screen3}
            options={{ title: 'Settings', headerTitleAlign: 'center' }}
          />
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
          <Stack.Screen
            name="Credits"
            component={Credits}
            options={{ title: 'Credits', headerTitleAlign: 'center' }}
          />
          <Stack.Screen
            name="Screen32"
            component={Screen32}
            options={{ title: 'Pro Mode', headerTitleAlign: 'center' }}
          />
          <Stack.Screen
            name="ScreenDemos"
            component={ScreenDemos}
            options={{ title: 'Screen Demo', headerTitleAlign: 'center' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  );
}
