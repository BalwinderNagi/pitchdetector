import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Button, Image } from 'react-native';
import Screen1 from "./src/components/screens/Screen1";
import Screen2 from "./src/components/screens/Screen2";

const Stack = createNativeStackNavigator()

export const App = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Screen2">
        <Stack.Screen name="Screen1" component={Screen1} />
        <Stack.Screen name="Screen2" component={Screen2} />
      </Stack.Navigator>
    <View style={{flex: 1, backgroundColor: "white", padding: 80, justifyContent: 'center', gap: 20}}>
      <Button title="test" onPress={() => console.log("Button pressed")} color="black"/>
      <StatusBar style="auto" />
      <Button title="Press" onPress={() => console.log("Button pressed")} color="black"/>
      <StatusBar style="auto" />
      <Button title="Press" onPress={() => console.log("Button pressed")} color="black"/>
      <StatusBar style="auto" />
    </View>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
    container: {
    flex: 1,
    backgroundColor: 'plum',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default App;