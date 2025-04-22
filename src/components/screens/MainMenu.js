// src/components/screens/MainMenu.js
import React, { useContext } from 'react'
import { View, Image, StyleSheet, Pressable, Text } from 'react-native'
import Theme from '../layout/Theme'
import { ThemeContext } from '../layout/ThemeContext'

export const MainMenu = ({ navigation }) => {
  const { currentTheme } = useContext(ThemeContext)

  return (
    <Theme>
      <Image
        source={require('../../../assets/piano.jpg')}
        style={styles.image}
      />
      <View style={styles.buttonsContainer}>
        {[
          { title: 'TUNER',   to: 'Screen1' },
          { title: 'PRESS',  to: 'Screen2' },
          { title: 'SETTINGS', to: 'Screen3' },
        ].map(({title,to}) => (
          <Pressable
            key={to}
            style={[styles.btn, { backgroundColor: currentTheme.textColor }]}
            onPress={() => navigation.navigate(to)}
          >
            <Text style={[styles.btnText, { color: currentTheme.backgroundColor }]}>
              {title}
            </Text>
          </Pressable>
        ))}
      </View>
    </Theme>
  )
}

const styles = StyleSheet.create({
  image: {
    width: 250, height: 250, resizeMode: 'contain',
    alignSelf: 'center', marginTop: 50
  },
  buttonsContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
    width: '80%',
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

export default MainMenu
