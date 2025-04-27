import React, { useContext } from 'react'
import { ScrollView, View, Image, Text, StyleSheet, Dimensions, Linking } from 'react-native'
import Theme from '../layout/Theme'
import { ThemeContext } from '../layout/ThemeContext'
import tutorialImg from '../../../assets/TutorialScreenshot.png'
import neuralNetworkExample from '../../../assets/neuralNetworkExample.png'

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

        <Image
          source={neuralNetworkExample}
          style={[styles.image, { width: screenWidth * 0.9 }]}
          resizeMode="contain"
        />

        <View style={styles.textWrapper}>
          <Text style={[styles.description, { color: currentTheme.textColor }]}>
            A neural network is a virtual brain made of nodes, which are organized in three layers: the input layer, the hidden layer(s), and the output layer. In this context, the input layer takes in the audio from your phone. The data then flows forward through one or more hidden layers, where each connection has a small “weight” that adjusts how strongly one neuron’s output influences the next. Finally, the output layer gives us a prediction and consists of 12 nodes (one for each note in an octave of a piano). We don’t actually know what happens inside the hidden layers—it’s all just numbers that can’t be directly read. This app uses TensorFlow, a neural-network framework available for both Python and JavaScript. The model was trained on TinySOL, a high-quality per-note instrument sample library with thousands of short, annotated recordings of real acoustic and electric instruments.
          </Text>
          <Text
            style={[styles.description, styles.link, { color: currentTheme.primary }]}
            onPress={() => Linking.openURL('https://zenodo.org/records/3633012')}
          >
            TinySOL Dataset Link
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
    marginBottom: 30,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  link: {
    marginTop: 10,
    textDecorationLine: 'underline',
  },
})
