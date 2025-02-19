import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View, Button } from "react-native";

export const Screen3 = ({navigation}) => {
  // ---------------- Initialisations ----------------
  // ---------------- State ----------------
  // ---------------- Handlers ----------------
  // ---------------- View ----------------
  return (
    <View style={styles.container}>
      {/* PRO MODE row */}
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
          title="LIGHT/DARK MODE"
          onPress={() => navigation.navigate('Screen31')}
          color="black"
        />
        <StatusBar style="auto" />
        <Button
          title="Press"
          onPress={() => navigation.navigate('Screen2')}
          color="black"
        />
        <StatusBar style="auto" />
        <Button
          title="SETTINGS"
          onPress={() => navigation.navigate('Screen3')}
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
    padding: 20,
  },
  row: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 20, 
  },
});

export default Screen3;
