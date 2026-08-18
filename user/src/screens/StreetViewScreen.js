import React, { useState, useContext, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  StatusBar, Platform, Dimensions
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SW, height: SH } = Dimensions.get('window');

// Resolve API base URL same way as api.js
function getApiBase() {
  let Constants = null;
  try { Constants = require('expo-constants').default; } catch (e) {}
  
  let devHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
  if (Constants?.expoConfig?.hostUri) {
    devHost = Constants.expoConfig.hostUri.split(':')[0];
  }

  let apiBase = process.env.EXPO_PUBLIC_API_BASE_URL || `http://${devHost}:5001/api`;
  
  if (__DEV__ && (!process.env.EXPO_PUBLIC_API_BASE_URL || 
      process.env.EXPO_PUBLIC_API_BASE_URL.includes('localhost') || 
      process.env.EXPO_PUBLIC_API_BASE_URL.includes('127.0.0.1'))) {
    apiBase = `http://${devHost}:5001/api`;
  }
  
  return apiBase;
}

export default function StreetViewScreen({ navigation, route }) {
  const { colors } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  const webViewRef = useRef(null);
  
  const { floorId, startNodeId, floorName, blockName } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const apiBase = getApiBase();
  
  // Build the viewer URL
  const viewerUrl = `${apiBase}/streetView/viewer?floorId=${floorId || ''}${startNodeId ? `&nodeId=${startNodeId}` : ''}&apiBase=${encodeURIComponent(apiBase)}`;

  const handleLoadEnd = useCallback(() => {
    setLoading(false);
  }, []);

  const handleError = useCallback((syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    setLoading(false);
    setError(nativeEvent.description || 'Failed to load Street View');
  }, []);

  const handleHttpError = useCallback((syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    if (nativeEvent.statusCode >= 400) {
      setLoading(false);
      setError(`Server error (${nativeEvent.statusCode})`);
    }
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* WebView Viewer */}
      {!error && (
        <WebView
          ref={webViewRef}
          source={{ uri: viewerUrl }}
          style={styles.webview}
          onLoadEnd={handleLoadEnd}
          onError={handleError}
          onHttpError={handleHttpError}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          startInLoadingState={false}
          originWhitelist={['*']}
          scalesPageToFit={true}
          allowsFullscreenVideo={false}
          bounces={false}
          overScrollMode="never"
          // Allow touch gestures for orbit controls
          scrollEnabled={false}
          nestedScrollEnabled={false}
        />
      )}

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#8b5cf6" />
          <Text style={styles.loadingText}>Loading Street View...</Text>
          {floorName && (
            <Text style={styles.loadingSubtext}>
              {blockName ? `${blockName} · ` : ''}{floorName}
            </Text>
          )}
        </View>
      )}

      {/* Error State */}
      {error && (
        <View style={styles.errorOverlay}>
          <Ionicons name="warning-outline" size={48} color="#f87171" />
          <Text style={styles.errorTitle}>Unable to Load</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              setError(null);
              setLoading(true);
              webViewRef.current?.reload();
            }}
          >
            <Ionicons name="refresh" size={18} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Top Bar (Back button + Title) */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={styles.titleContainer}>
          <Text style={styles.titleText} numberOfLines={1}>
            Street View
          </Text>
          {floorName && (
            <Text style={styles.subtitleText} numberOfLines={1}>
              {blockName ? `${blockName} · ` : ''}{floorName}
            </Text>
          )}
        </View>

        <View style={styles.spacer} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  loadingSubtext: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginTop: 6,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    zIndex: 20,
  },
  errorTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
  },
  errorText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8b5cf6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 24,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 30,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  titleText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  subtitleText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  spacer: {
    width: 40,
  },
});
