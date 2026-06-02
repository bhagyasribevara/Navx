import React, { useContext } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemeContext } from "../context/ThemeContext";

export default function ARScreen({ navigation }) {
  const { colors } = useContext(ThemeContext);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Ionicons name="construct-outline" size={80} color={colors.primary} style={styles.icon} />
      
      <Text style={[styles.title, { color: colors.text }]}>
        We are Working on this 😊
      </Text>
      <Text style={[styles.subtitle, { color: colors.textSec }]}>
        We will update soon!
      </Text>
      
      <TouchableOpacity 
        style={[styles.btn, { backgroundColor: colors.primary }]} 
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.btnText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  icon: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 30,
  },
  btn: {
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  }
});
