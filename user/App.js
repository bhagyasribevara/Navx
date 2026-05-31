import React, { useState, useContext, useCallback } from "react";
import { View, Platform } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { ThemeContext } from "./src/context/ThemeContext";
import { GeofenceProvider } from "./src/context/GeofenceContext";

import HomeScreen from "./src/screens/HomeScreen";
import MapScreen from "./src/screens/MapScreen";
import SearchScreen from "./src/screens/SearchScreen";
import NavigationScreen from "./src/screens/NavigationScreen";
import ARScreen from "./src/screens/ARScreen";
import QRScanScreen from "./src/screens/QRScanScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import FavoritesScreen from "./src/screens/FavoritesScreen";
import SplashScreen from "./src/screens/SplashScreen";
import OfflineMapsScreen from "./src/screens/OfflineMapsScreen";
import EmergencyOverlay from "./src/components/EmergencyOverlay";
import GeofenceGuard from "./src/components/GeofenceGuard";

const DARK = {
  bg: "#070B14",
  card: "#111827",
  cardElevated: "#1a2235",
  surface: "#0e1520",
  primary: "#6366f1",
  primaryLight: "#818cf8",
  primaryGlow: "rgba(99,102,241,0.25)",
  secondary: "#8b5cf6",
  accent: "#22c55e",
  text: "#f1f5f9",
  textSec: "#94a3b8",
  textMuted: "#4b5563",
  border: "#1e2d40",
  danger: "#ef4444",
  warning: "#f59e0b",
  mapBg: "#060d1a",
  mapGrid: "#0f1e33",
};

const LIGHT = {
  bg: "#f0f4ff",
  card: "#ffffff",
  cardElevated: "#ffffff",
  surface: "#eef2ff",
  primary: "#6366f1",
  primaryLight: "#818cf8",
  primaryGlow: "rgba(99,102,241,0.15)",
  secondary: "#8b5cf6",
  accent: "#16a34a",
  text: "#1e293b",
  textSec: "#475569",
  textMuted: "#94a3b8",
  border: "#e2e8f0",
  danger: "#dc2626",
  warning: "#d97706",
  mapBg: "#1a2035",
  mapGrid: "#1e2840",
};

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { colors } = useContext(ThemeContext);

  const tabIconMap = {
    Home: { active: "home", inactive: "home-outline" },
    Map: { active: "map", inactive: "map-outline" },
    Search: { active: "search", inactive: "search-outline" },
    Favorites: { active: "heart", inactive: "heart-outline" },
    Settings: { active: "settings", inactive: "settings-outline" },
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const icons = tabIconMap[route.name];
          return <Ionicons name={focused ? icons.active : icons.inactive} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 84 : 65,
          paddingBottom: Platform.OS === "ios" ? 28 : 10,
          paddingTop: 8,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
          marginTop: -2,
        },
        headerStyle: { backgroundColor: colors.card, shadowOpacity: 0, elevation: 0 },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: "Home" }} />
      <Tab.Screen name="Map" component={MapScreen} options={{ title: "Map" }} />
      <Tab.Screen name="Search" component={SearchScreen} options={{ title: "Search" }} />
      <Tab.Screen name="Favorites" component={FavoritesScreen} options={{ title: "Saved" }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [isDark, setIsDark] = useState(true);
  const [language, setLanguage] = useState("en");
  const [showSplash, setShowSplash] = useState(true);
  const colors = isDark ? DARK : LIGHT;
  const baseTheme = isDark ? DarkTheme : DefaultTheme;

  const navTheme = {
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

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <SafeAreaProvider>
      <ThemeContext.Provider value={{ colors, isDark, setIsDark, language, setLanguage }}>
        <GeofenceProvider>
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
            <NavigationContainer theme={navTheme}>
              <StatusBar style={isDark ? "light" : "dark"} />
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="MainTabs" component={MainTabs} />
                <Stack.Screen
                  name="Navigation"
                  component={NavigationScreen}
                  options={{ animation: "slide_from_bottom", gestureEnabled: true }}
                />
                <Stack.Screen
                  name="AR"
                  component={ARScreen}
                  options={{ animation: "slide_from_bottom", gestureEnabled: true }}
                />
                <Stack.Screen
                  name="QRScan"
                  component={QRScanScreen}
                  options={{ animation: "slide_from_bottom", gestureEnabled: true }}
                />
                <Stack.Screen
                  name="OfflineMaps"
                  component={OfflineMapsScreen}
                  options={{ animation: "slide_from_bottom", gestureEnabled: true }}
                />
              </Stack.Navigator>
              <EmergencyOverlay />
              <GeofenceGuard />
            </NavigationContainer>
          </SafeAreaView>
        </GeofenceProvider>
      </ThemeContext.Provider>
    </SafeAreaProvider>
  );
}
