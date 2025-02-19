import React, { useContext } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { ThemeContext } from '../../ThemeContext'; // Adjust path as needed

const Theme = ({ children }) => {
  // Pull the active theme from context
  const { currentTheme } = useContext(ThemeContext);

  return (
    <View style={[styles.screen, { backgroundColor: currentTheme.backgroundColor }]}>
      {children}
      <StatusBar style="light" />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 15,
    // You can omit a backgroundColor here if you set it from currentTheme
  },
});

export default Theme;