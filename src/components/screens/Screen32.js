// src/components/screens/Screen32.js
import React, { useContext } from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import Theme from '../layout/Theme';
import { ThemeContext } from '../layout/ThemeContext';

export const Screen32 = () => {
  const {
    currentTheme,
    isDarkMode,
    proMode,
    toggleProMode
  } = useContext(ThemeContext);

  // decide styles based on dark mode + proMode
  const boxBg = isDarkMode
    ? (proMode ? '#000' : '#fff')
    : (proMode ? '#fff' : '#000');
  const textColor = isDarkMode
    ? (proMode ? '#fff' : '#000')
    : (proMode ? '#000' : '#fff');

  return (
    <Theme>
      <View style={styles.container}>
        <View style={[styles.box, { backgroundColor: boxBg }]}>
          <Text style={[styles.boxText, { color: textColor }]}>
            Pro Mode {proMode ? 'On' : 'Off'}
          </Text>
        </View>
        <Switch
          value={proMode}
          onValueChange={toggleProMode}
          thumbColor={proMode ? currentTheme.textColor : '#ccc'}
          trackColor={{
            true:  currentTheme.textColor + '55',
            false: '#999'
          }}
          style={styles.switch}
        />
      </View>
    </Theme>
  );
};

const styles = StyleSheet.create({
  container: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
    flexDirection:  'row',
    gap:            12,
  },
  box: {
    paddingHorizontal: 12,
    paddingVertical:   8,
    borderRadius:      6,
    borderWidth:       2,
    borderColor:       '#000',
  },
  boxText: {
    fontSize: 18,
    fontWeight: '600',
  },
  switch: {
    marginLeft: 8,
  }
});

export default Screen32;
