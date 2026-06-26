# NavX User App - UI/UX Documentation

This document serves as a centralized reference for the current UI/UX features and workings of the NavX User application (Apk). Reading this will provide a comprehensive understanding of the app's interface and user flow without needing to dive deep into the codebase.

## 1. Core Architecture & Tech Stack
- **Framework**: React Native with Expo.
- **Navigation**: React Navigation (Bottom Tabs for main screens, Native Stack for overlays/modals and secondary screens).
- **Map Rendering**: Uses `react-native-webview` with an injected Leaflet HTML/JS bundle for rich, offline-capable mapping and GeoJSON rendering.
- **Animations**: `react-native-reanimated` and standard React Native `Animated` APIs for fluid interactions (springs, pulses, glass effects).

## 2. Design System (`src/theme/designSystem.js`)
The app utilizes a centralized design system for robust UI consistency.
- **Themes**: Full support for both `LIGHT` and `DARK` themes. The UI employs a highly effective modern layout with a clean **White background (in Light mode) or Deep Navy (in Dark mode)**, accented beautifully by **Purple (`#8b5cf6` in Light, `#a855f7` in Dark) for interactive elements and highlights**.
- **Interactive Animations**: Key UI components (Quick Actions, Venue Cards, Map Banners, etc.) use a custom `AnimatedPressable` wrapper. This provides a tactile "hover"/press response (scaling down slightly with opacity changes) utilizing spring physics for a more engaging UX.
- **Venue/Room Categorizations**: Colors and icons are dynamically assigned based on the building type (e.g., Campus, Hospital, Airport, Mall).
  - *Example*: A hospital "Emergency" room is assigned `#ef4444` (danger red) with an `alert-circle` icon, while an airport "Gate" is `#3b82f6` (blue) with an `airplane` icon.
- **Shadows & Elevation**: Standardized shadow tiers (`sm`, `md`, `lg`, `primary`) to provide depth, heavily used on floating action buttons, cards, and bottom sheets.
- **Typography**: Structured hierarchy from `h1` to `h4`, `body`, `caption`, and `overline` to maintain readable, modern text styling.

## 3. Main Navigation Flow (Bottom Tabs)
The primary user interface relies on a `BottomTabNavigator` with the following key tabs:
1. **Home (`HomeScreen.js`)**: 
   - A personalized dashboard featuring greetings based on time of day.
   - Quick Action buttons (Navigate, Live Meet, Scan QR, Open Map) wrapped in `AnimatedPressable` for tactile feedback and staggered entrance animations.
   - Dynamic venue categories (Campus, Hospital, etc.) to quickly filter points of interest.
   - Includes contextual widgets like a `WeatherWidget`.
2. **Map (`MapScreen.js`)**: 
   - The core mapping interface displaying indoor/outdoor GeoJSON layers.
   - Features an animated user location puck (pulse glow effect built with CSS inside the Leaflet WebView).
   - Allows users to switch floors/levels and filter map layers.
3. **Search (`SearchScreen.js`)**: 
   - For finding specific rooms, assets, or points of interest.
4. **Favorites (`FavoritesScreen.js`)**: 
   - Quick access to saved locations.
5. **Settings (`SettingsScreen.js`)**: 
   - Theme toggling, profile management, and app preferences.

## 4. Specialized Screens & Modals
- **Navigation (`NavigationScreen.js`)**: Provides turn-by-turn routing once a path is calculated.
- **AR View (`ARScreen.js` / `ARRobotGuide.js`)**: Augmented Reality overlays for navigation guidance (e.g., an AR robot guide leading the way).
- **Live Meet (`LiveMeetScreen.js` / `ARMeetScreen.js`)**: 
   - Allows users to create or join a real-time meeting session using WebSockets (`socket.io-client`).
   - Includes AR features to visually spot the person you are meeting in a crowd.
- **QR Scanner (`QRScanScreen.js`)**: 
   - Used for rapid localization (scanning a room's QR code to set the user's start point) or finding specific assets.
- **Offline Maps (`OfflineMapsScreen.js`)**: 
   - Interface for downloading and managing campus/venue map data for offline usage.

## 5. Persistent Overlays & Contextual UI
The app uses conditional overlays mounted at the root level (`App.js`) to provide immediate, context-aware information:
- **EmergencyOverlay**: Triggered during critical situations, overriding the UI to provide evacuation routes or safety protocols.
- **GeofenceGuard**: Handles transitions and notifications when entering or exiting specific geofenced areas (e.g., prompting to download a campus map).
- **NotificationBanner**: Custom in-app toast/banner notifications for alerts.
- **AIChatOverlay**: A persistent, floating AI chat assistant (bot) to help users find rooms or answer venue-related queries.

## 6. UX Patterns & Micro-interactions
- **Glassmorphism**: Extensive use of `expo-blur` (`BlurView`) for bottom tabs, overlays, and sticky headers to provide a modern, translucent aesthetic.
- **Haptic Feedback**: Uses `expo-haptics` for tactile responses on button presses, scanning success, and navigation alerts.
- **Staggered Animations**: The Home screen cards and Quick Actions use spring animations that load sequentially for a premium feel.
- **Pulse Indicators**: The user's live location on the map uses CSS keyframe animations (`pulseGlow`) to indicate active GPS tracking.

---
*Note: This documentation is intended for quick onboarding and feature reference. For detailed implementation of API endpoints, state management, and Leaflet bridge communication, refer to the respective source files in `src/`.*

## 7. Recent UI Updates
All major screens have been refactored to replace static `TouchableOpacity` components with `AnimatedPressable` for enhanced tactile feedback and fluid micro-animations. The color theme remains consistent with White (primary) and Purple (`#8b5cf6` as secondary) in Light mode, seamlessly supporting Dark mode.
- **Auth, Settings, Search, Favorites**: Updated to utilize animated wrappers for cards, chips, and list actions.
- **LiveMeet & ARMeet**: Interactive buttons updated to `AnimatedPressable`, with special care taken to preserve the Leaflet/Mapbox WebView integrity.
- **Campaign Detail**: Venue and Sub-campaign navigation buttons updated for animated touch feedback.
- **QR Scan & Offline Maps**: Action buttons (Grant Permission, Scan Again, Open Map, Delete) converted to `AnimatedPressable`.
- **Navigation Screen**: Voice toggle, AR switch, and routing controls modernized with fluid animations.
