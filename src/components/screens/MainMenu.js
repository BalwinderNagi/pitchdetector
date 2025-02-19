import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View, Button } from "react-native";

export const MainMenu = () => {
  // ---------------- Initialisations ----------------
  // ---------------- State ----------------
  // ---------------- Handlers ----------------
  // ---------------- View ----------------
  return (
    <View style={styles.container}>
      <View
        style={{
          flex: 1,
          backgroundColor: "white",
          padding: 80,
          justifyContent: "center",
          gap: 20,
          width: 500,
        }}
      >
        <Button
          title="test"
          onPress={() => console.log("Button pressed")}
          color="black"
        />
        <StatusBar style="auto" />
        <Button
          title="Press"
          onPress={() => console.log("Button pressed")}
          color="black"
        />
        <StatusBar style="auto" />
        <Button
          title="Press"
          onPress={() => console.log("Button pressed")}
          color="black"
        />
        <StatusBar style="auto" />
      </View>
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
  },
});

export default MainMenu;
