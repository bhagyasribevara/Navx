# AI Skill - Creating a UI Component

This guide details component creation conventions for the React Native mobile app and the React web dashboard.

---

## 1. React Native Component Guidelines (User App)

### Directory
- Save shared UI overlays, indicators, or lists in `user/src/components/`.

### Styling
- Avoid inline styles. Define structured `StyleSheet` objects at the bottom of the file using the local theme values:
```javascript
import React, { useContext } from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemeContext } from '../context/ThemeContext';

export default function CardComponent({ children }) {
  const { colors } = useContext(ThemeContext);
  
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  }
});
```

---

## 2. React Web Component Guidelines (Admin App)

### Directory
- Save components under `admin/src/components/`.

### Styling
- Use TailwindCSS classes for flexible positioning and responsive sizing, conforming to theme designs:
```jsx
export default function TableHeader({ title }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-200">
      <h2 className="text-xl font-extrabold text-gray-800">{title}</h2>
    </div>
  );
}
```
