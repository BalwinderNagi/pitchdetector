// src/components/screens/Screen2.js
import React, { useContext } from 'react'
import { ScrollView, View, Image, Text, StyleSheet, Dimensions } from 'react-native'
import Theme from '../layout/Theme'
import { ThemeContext } from '../layout/ThemeContext'

// adjust this path if your assets folder sits elsewhere
import tutorialImg from '../../../assets/TutorialScreenshot.png'

export const Screen2 = () => {
  const { currentTheme } = useContext(ThemeContext)
  const screenWidth = Dimensions.get('window').width

  return (
    <Theme>
      <ScrollView contentContainerStyle={styles.container}>
        <Image
          source={tutorialImg}
          style={[styles.image, { width: screenWidth * 0.9 }]}
          resizeMode="contain"
        />
        <View style={styles.textWrapper}>
          <Text style={[styles.description, { color: currentTheme.textColor }]}>
            1. The pitch gauge will switch back and forth and get closer to the center, the more accurate the pitch is{'\n\n'}
            2. This number will give the pitch of the audio being interpreted by the microphone{'\n\n'}
            3. Here is the layout of the piano, where if you press a certain key, it will choose that pitch for the gauge and help you correct the pitch{'\n\n'}
            4. Here is the Metronome/Counter, with +/- buttons to help you adjust the metronome bpm and the counter number{'\n\n'}
            5. This button starts and stops the metronome{'\n\n'}
            6. This button activates and deactivates the users microphone, enabling and disabling the pitch detector
          </Text>
        </View>
      </ScrollView>
    </Theme>
  )
}

export default Screen2

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingBottom: 40,
    backgroundColor: 'transparent',
  },
  image: {
    height: 400,
    marginTop: 20,
    marginBottom: 30,
  },
  textWrapper: {
    paddingHorizontal: 20,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
})
