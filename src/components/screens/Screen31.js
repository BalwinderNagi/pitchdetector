import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View, Button } from "react-native";

export const Screen31 = () => {
  // ---------------- Initialisations ----------------
  // ---------------- State ----------------
  // ---------------- Handlers ----------------
  // ---------------- View ----------------
  return (
      <View
        style={{
          flex: 1,
          backgroundColor: "white",
          padding: 80,
          justifyContent: "center",
          alignSelf: "center",
          gap: 20,
          width: 500,
        }}
      >
        <Button
          title="LIGHT"
          onPress={() => navigation.navigate('Screen1')}
          color="black"
        />
        <StatusBar style="auto" />
        <Button
          title="DARK"
          onPress={() => navigation.navigate('Screen2')}
          color="black"
        />
        <StatusBar style="auto" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
});

export default Screen31;
