import React, { useContext } from 'react'
import { View, StyleSheet, Pressable, Text } from 'react-native'
import Theme from '../layout/Theme'
import { ThemeContext } from '../layout/ThemeContext'

export const Screen3 = ({ navigation }) => {
  const { currentTheme } = useContext(ThemeContext)

  return (
    <Theme>
      <View style={styles.container}>
        {[
          { title: 'LIGHT/DARK MODE', to: 'Screen31' },
          { title: 'CREDITS',          to: 'Credits'   },
          { title: 'PRO MODE',         to: 'Screen32'   },
        ].map(({ title, to }) => (
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


export const Credits = () => {
  const { currentTheme } = useContext(ThemeContext)
  return (
    <Theme>
      <View style={styles.creditsContainer}>
        <Text style={[styles.creditsText, { color: currentTheme.textColor }]}>
          A neural network pitch detection system designed by Balwinderjeet Singh Nagi.
        </Text>
      </View>
    </Theme>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
    width: '80%',
    alignSelf: 'center',
  },
  btn: {
    paddingVertical: 14,
    borderRadius: 6,
    alignItems: 'center',
  },
  btnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  creditsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  creditsText: {
    fontSize: 18,
    textAlign: 'center',
  },
})

export default Screen3
