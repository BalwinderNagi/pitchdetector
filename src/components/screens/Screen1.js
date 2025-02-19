import { StatusBar } from 'expo-status-bar';
import React, { useContext } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ThemeContext } from '../layout/ThemeContext';

export const Screen1 = () => {
  const { currentTheme, toggleTheme, isDarkMode } = useContext(ThemeContext);

  return (
    <View>
      <Text style={{ color: currentTheme.textColor }}>
        This screen is {isDarkMode ? 'Dark' : 'Light'}
      </Text>
      <Button title="Toggle Theme" onPress={toggleTheme} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Screen1;