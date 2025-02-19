import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { StyleSheet } from "react-native";
import Screen1 from "./src/components/screens/Screen1";
import Screen2 from "./src/components/screens/Screen2";
import Screen3 from "./src/components/screens/Screen3";
import Screen31 from "./src/components/screens/Screen31";
import MainMenu from "./src/components/screens/MainMenu";
import ThemeProvider from "./src/components/layout/ThemeContext";

const Stack = createNativeStackNavigator();

export const App = () => {
  return (
    <ThemeProvider>
    <NavigationContainer>
      <Stack.Navigator initialRouteName="MainMenu">
        <Stack.Screen name="Screen1" component={Screen1} />
        <Stack.Screen name="Screen2" component={Screen2} />
        <Stack.Screen name="Screen3" component={Screen3} />
        <Stack.Screen 
          name="Screen31" 
          component={Screen31}
          options={{ title: "Light/Dark Mode", headerTitleAlign: "center" }}
        />
        <Stack.Screen
          name="MainMenu"
          component={MainMenu}
          options={{ title: "Piano Tuning App", headerTitleAlign: "center" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
    </ThemeProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "plum",
    alignItems: "center",
    justifyContent: "center",
  },
});

export default App;
