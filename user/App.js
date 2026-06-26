import React, { useState, useContext, useCallback, useEffect } from "react";
import { RootSiblingParent } from 'react-native-root-siblings';
import { View, Platform, Linking } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemeContext } from "./src/context/ThemeContext";
import { GeofenceProvider } from "./src/context/GeofenceContext";
import { fetchAppConfig } from "./src/api";
import { navigationRef } from "./src/utils/navigation";

import HomeScreen from "./src/screens/HomeScreen";
import MapScreen from "./src/screens/MapScreen";
import SearchScreen from "./src/screens/SearchScreen";
import NavigationScreen from "./src/screens/NavigationScreen";
import ARScreen from "./src/screens/ARScreen";
import QRScanScreen from "./src/screens/QRScanScreen";
import SettingsScreen from "./src/screens/SettingsScreen";

import SplashScreen from "./src/screens/SplashScreen";
import OfflineMapsScreen from "./src/screens/OfflineMapsScreen";
import CampaignDetailScreen from "./src/screens/CampaignDetailScreen";
import LiveMeetScreen from "./src/screens/LiveMeetScreen";
import ARMeetScreen from "./src/screens/ARMeetScreen";
import { LiveMeetProvider } from "./src/context/LiveMeetContext";
import EmergencyOverlay from "./src/components/EmergencyOverlay";
import GeofenceGuard from "./src/components/GeofenceGuard";
import NotificationBanner from "./src/components/NotificationBanner";
import AIChatOverlay from "./src/components/AIChatOverlay";

import AuthScreen from "./src/screens/AuthScreen";
import { AuthProvider, useAuth } from "./src/context/AuthContext";

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
  const insets = useSafeAreaInsets();

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
          height: Platform.OS === "ios" ? 84 : (65 + (insets.bottom > 0 ? insets.bottom : 0)),
          paddingBottom: Platform.OS === "ios" ? 28 : (10 + (insets.bottom > 0 ? insets.bottom : 0)),
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
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { colors } = useContext(ThemeContext);
  const { user, loading } = useAuth();

  useEffect(() => {
    // Intercept URLs received while app is in background/foreground
    const handleUrl = ({ url }) => {
      console.log("[AppNavigator] Deep link received:", url);
      if (url) {
        if (!user) {
          global.pendingDeepLink = url;
          console.log("[AppNavigator] User not logged in. Saved to pendingDeepLink.");
        } else {
          // Parse and navigate directly if user is logged in
          if (url.includes('meet/')) {
            const parts = url.split('meet/');
            if (parts.length > 1) {
              const sessionId = parts[1].split(/[?#]/)[0];
              if (sessionId) {
                const interval = setInterval(() => {
                  if (navigationRef.isReady()) {
                    clearInterval(interval);
                    navigationRef.navigate("LiveMeet", { sessionId });
                  }
                }, 100);
                setTimeout(() => clearInterval(interval), 5000);
              }
            }
          }
        }
      }
    };

    // Intercept initial URL if app is opened from cold start
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log("[AppNavigator] Initial deep link:", url);
        if (!user) {
          global.pendingDeepLink = url;
        } else {
          handleUrl({ url });
        }
      }
    });

    const subscription = Linking.addEventListener('url', handleUrl);
    return () => {
      subscription.remove();
    };
  }, [user]);

  // Handle pending deep links after authentication state resolves to logged-in
  useEffect(() => {
    if (user && global.pendingDeepLink) {
      const url = global.pendingDeepLink;
      global.pendingDeepLink = null;
      console.log("[AppNavigator] Processing pending deep link after login:", url);
      if (url.includes('meet/')) {
        const parts = url.split('meet/');
        if (parts.length > 1) {
          const sessionId = parts[1].split(/[?#]/)[0];
          if (sessionId) {
            const interval = setInterval(() => {
              if (navigationRef.isReady()) {
                clearInterval(interval);
                navigationRef.navigate("LiveMeet", { sessionId });
              }
            }, 100);
            setTimeout(() => clearInterval(interval), 5000);
          }
        }
      }
    }
  }, [user]);
  
  const baseTheme = DefaultTheme;
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

  const linking = {
    prefixes: ['navx://', 'https://navx.com', 'http://navx.com'],
    config: {
      screens: {
        LiveMeet: 'meet/:sessionId',
      },
    },
  };

  if (loading) {
    return <SplashScreen onFinish={() => {}} />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <NavigationContainer ref={navigationRef} theme={navTheme} linking={linking}>
        <StatusBar style="dark" />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!user ? (
            <Stack.Screen name="Auth" component={AuthScreen} options={{ animation: "fade" }} />
          ) : (
            <>
              <Stack.Screen name="MainTabs" component={MainTabs} />
              <Stack.Screen
                name="QRScan"
                component={QRScanScreen}
                options={{ animation: "fade", gestureEnabled: false }}
              />
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
                name="OfflineMaps"
                component={OfflineMapsScreen}
                options={{ animation: "slide_from_bottom", gestureEnabled: true }}
              />
              <Stack.Screen
                name="CampaignDetail"
                component={CampaignDetailScreen}
                options={{ animation: "slide_from_right" }}
              />
              <Stack.Screen
                name="Search"
                component={SearchScreen}
                options={{ animation: "slide_from_bottom", gestureEnabled: true }}
              />
              <Stack.Screen
                name="LiveMeet"
                component={LiveMeetScreen}
                options={{ animation: "slide_from_bottom", gestureEnabled: true }}
              />
              <Stack.Screen
                name="ARMeet"
                component={ARMeetScreen}
                options={{ animation: "slide_from_bottom", gestureEnabled: true }}
              />
            </>
          )}
        </Stack.Navigator>
        {user && <EmergencyOverlay />}
        {user && <GeofenceGuard />}
        {user && <NotificationBanner />}
        {user && <AIChatOverlay />}
      </NavigationContainer>
    </SafeAreaView>
  );
}

export default function App() {
  const [language, setLanguage] = useState("en");
  const [showSplash, setShowSplash] = useState(true);
  const colors = LIGHT;
  const isDark = false;

  useEffect(() => {
    fetchAppConfig().catch(err => console.warn("Failed to load app startup configuration:", err));
  }, []);

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeContext.Provider value={{ colors, isDark, language, setLanguage }}>
          <GeofenceProvider>
            <LiveMeetProvider>
              <RootSiblingParent>
                <AppNavigator />
              </RootSiblingParent>
            </LiveMeetProvider>
          </GeofenceProvider>
        </ThemeContext.Provider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
