import React, { useState, useContext } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { ThemeContext } from "./src/context/ThemeContext";

import HomeScreen from "./src/screens/HomeScreen";
import MapScreen from "./src/screens/MapScreen";
import SearchScreen from "./src/screens/SearchScreen";
import NavigationScreen from "./src/screens/NavigationScreen";
import ARScreen from "./src/screens/ARScreen";
import QRScanScreen from "./src/screens/QRScanScreen";
import SettingsScreen from "./src/screens/SettingsScreen";

const DARK = {
  bg: "#0a0e1a",
  card: "#1a2035",
  surface: "#111827",
  primary: "#6366f1",
  secondary: "#818cf8",
  accent: "#22c55e",
  text: "#f1f5f9",
  textSec: "#94a3b8",
  textMuted: "#64748b",
  border: "#2a3352",
  danger: "#ef4444",
  warning: "#f59e0b",
};
const LIGHT = {
  bg: "#f8fafc",
  card: "#ffffff",
  surface: "#f1f5f9",
  primary: "#6366f1",
  secondary: "#818cf8",
  accent: "#22c55e",
  text: "#1e293b",
  textSec: "#475569",
  textMuted: "#94a3b8",
  border: "#e2e8f0",
  danger: "#ef4444",
  warning: "#f59e0b",
};

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { colors } = useContext(ThemeContext);
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === "Home")
            iconName = focused ? "home" : "home-outline";
          else if (route.name === "Map")
            iconName = focused ? "map" : "map-outline";
          else if (route.name === "Search")
            iconName = focused ? "search" : "search-outline";
          else if (route.name === "Settings")
            iconName = focused ? "settings" : "settings-outline";
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 60,
          paddingBottom: 8,
        },
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: "NavX" }}
      />
      <Tab.Screen name="Map" component={MapScreen} options={{ title: "Map" }} />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{ title: "Search" }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: "Settings" }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [isDark, setIsDark] = useState(true);
  const [language, setLanguage] = useState("en");
  const colors = isDark ? DARK : LIGHT;
  const baseTheme = isDark ? DarkTheme : DefaultTheme;

  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: colors.primary,
      background: colors.bg,
      card: colors.card,
      text: colors.text,
      border: colors.border,
      notification: colors.danger,
    },
  };

  return (
    <ThemeContext.Provider
      value={{ colors, isDark, setIsDark, language, setLanguage }}
    >
      <NavigationContainer theme={navigationTheme}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen
            name="Navigation"
            component={NavigationScreen}
            options={{ animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="AR"
            component={ARScreen}
            options={{ animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="QRScan"
            component={QRScanScreen}
            options={{ animation: "slide_from_bottom" }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeContext.Provider>
  );
}
