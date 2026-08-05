import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { AdminProvider } from './src/context/AdminContext';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import SpatialStudioScanner from './src/screens/SpatialStudioScanner';
import ScanReviewScreen from './src/screens/ScanReviewScreen';
import CampaignsScreen from './src/screens/CampaignsScreen';
import EmergencyScreen from './src/screens/EmergencyScreen';
import QRGeneratorScreen from './src/screens/QRGeneratorScreen';
import AdminBuildingsScreen from './src/screens/AdminBuildingsScreen';
import AdminAnalyticsScreen from './src/screens/AdminAnalyticsScreen';
import AdminRecordingsScreen from './src/screens/AdminRecordingsScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <AdminProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Stack.Navigator 
          initialRouteName="Login"
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#ffffff' },
            animation: 'slide_from_right'
          }}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="SpatialStudio" component={SpatialStudioScanner} />
          <Stack.Screen name="ScanReview" component={ScanReviewScreen} />
          <Stack.Screen name="AdminRecordings" component={AdminRecordingsScreen} />
          <Stack.Screen name="Campaigns" component={CampaignsScreen} />
          <Stack.Screen name="Emergency" component={EmergencyScreen} />
          <Stack.Screen name="QRGenerator" component={QRGeneratorScreen} />
          <Stack.Screen name="Buildings" component={AdminBuildingsScreen} />
          <Stack.Screen name="Analytics" component={AdminAnalyticsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </AdminProvider>
  );
}
