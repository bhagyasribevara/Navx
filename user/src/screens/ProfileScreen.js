import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, ActivityIndicator, Alert, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { SHADOWS } from '../theme/designSystem';
import { LinearGradient } from 'expo-linear-gradient';
import AnimatedPressable from '../components/AnimatedPressable';

export default function ProfileScreen({ navigation }) {
  const { colors } = useContext(ThemeContext);
  const { user, updateUser } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName || user?.username || '');
  const [mobileNumber, setMobileNumber] = useState(user?.mobileNumber || '');
  const [profileImage, setProfileImage] = useState(user?.profileImage || null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1, 
    });

    if (!result.canceled && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      
      try {
        const manipResult = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 400 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        setProfileImage(`data:image/jpeg;base64,${manipResult.base64}`);
      } catch (error) {
        Alert.alert('Error', 'Failed to process image');
        console.log(error);
      }
    }
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Validation Error', 'Full Name is required');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/app-auth/update-profile', {
        fullName: fullName.trim(),
        mobileNumber: mobileNumber.trim(),
        profileImage
      });

      if (res.data.success) {
        if (updateUser) {
          updateUser(res.data.user);
        }
        Alert.alert('Success', 'Profile updated successfully', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else {
        Alert.alert('Error', res.data.error || 'Update failed');
      }
    } catch (e) {
      console.log('Error updating profile', e);
      Alert.alert('Error', e.response?.data?.error || 'Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#ffffff' },
    content: { padding: 20 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, marginTop: 40 },
    backBtn: {
      width: 40, height: 40, borderRadius: 12, backgroundColor: colors.card,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: colors.border, ...SHADOWS.sm
    },
    title: { fontSize: 24, fontWeight: '800', color: colors.text, marginLeft: 16 },
    avatarContainer: {
      alignSelf: 'center', alignItems: 'center', marginBottom: 30
    },
    avatarWrapper: {
      width: 120, height: 120, borderRadius: 60,
      backgroundColor: colors.card,
      borderWidth: 3, borderColor: colors.primary,
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', ...SHADOWS.md,
      position: 'relative'
    },
    avatarImg: { width: '100%', height: '100%' },
    editBadge: {
      position: 'absolute', bottom: 0, right: -10,
      backgroundColor: colors.primary, width: 36, height: 36,
      borderRadius: 18, alignItems: 'center', justifyContent: 'center',
      borderWidth: 3, borderColor: colors.background
    },
    inputGroup: { marginBottom: 20 },
    label: { fontSize: 13, fontWeight: '700', color: colors.textSec, marginBottom: 8, marginLeft: 4 },
    input: {
      backgroundColor: colors.card, borderRadius: 14,
      paddingHorizontal: 16, paddingVertical: 14,
      fontSize: 16, color: colors.text,
      borderWidth: 1, borderColor: colors.border, ...SHADOWS.sm
    },
    saveBtn: {
      backgroundColor: colors.primary, borderRadius: 16,
      paddingVertical: 16, alignItems: 'center', marginTop: 30,
      ...SHADOWS.primary()
    },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    readOnlyInput: { backgroundColor: colors.background, opacity: 0.8 }
  });

  return (
    <View style={s.container}>
      <LinearGradient
        colors={['rgba(139, 92, 246, 0.22)', 'rgba(99, 102, 241, 0.10)', 'rgba(255, 255, 255, 0)']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 380 }}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <AnimatedPressable style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </AnimatedPressable>
          <Text style={s.title}>Profile</Text>
        </View>

        <View style={s.avatarContainer}>
          <AnimatedPressable style={s.avatarWrapper} onPress={pickImage} disabled={loading}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={s.avatarImg} />
            ) : (
              <Ionicons name="person" size={60} color={colors.primary} />
            )}
            <View style={s.editBadge}>
              <Ionicons name="camera" size={18} color="#fff" />
            </View>
          </AnimatedPressable>
        </View>

      <View style={s.inputGroup}>
        <Text style={s.label}>FULL NAME</Text>
        <TextInput
          style={s.input}
          value={fullName}
          onChangeText={setFullName}
          placeholder="Enter your full name"
          placeholderTextColor={colors.textMuted}
          editable={!loading}
        />
      </View>

      <View style={s.inputGroup}>
        <Text style={s.label}>MOBILE NUMBER</Text>
        <TextInput
          style={s.input}
          value={mobileNumber}
          onChangeText={setMobileNumber}
          placeholder="Enter mobile number"
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
          editable={!loading}
        />
      </View>

      {user?.role === 'student' && (
        <>
          <View style={s.inputGroup}>
            <Text style={s.label}>COLLEGE EMAIL</Text>
            <TextInput
              style={[s.input, s.readOnlyInput]}
              value={user?.collegeEmail || ''}
              editable={false}
            />
          </View>

          <View style={s.inputGroup}>
            <Text style={s.label}>COLLEGE ID (ROLL NUMBER)</Text>
            <TextInput
              style={[s.input, s.readOnlyInput]}
              value={user?.collegeId || user?.rollNumber || ''}
              editable={false}
            />
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={[s.inputGroup, { flex: 1 }]}>
              <Text style={s.label}>DEPARTMENT</Text>
              <TextInput
                style={[s.input, s.readOnlyInput]}
                value={user?.department || ''}
                editable={false}
              />
            </View>
            <View style={[s.inputGroup, { flex: 0.6 }]}>
              <Text style={s.label}>SEM</Text>
              <TextInput
                style={[s.input, s.readOnlyInput]}
                value={user?.semester || ''}
                editable={false}
              />
            </View>
            <View style={[s.inputGroup, { flex: 0.6 }]}>
              <Text style={s.label}>SEC</Text>
              <TextInput
                style={[s.input, s.readOnlyInput]}
                value={user?.section || ''}
                editable={false}
              />
            </View>
          </View>
        </>
      )}

      <AnimatedPressable style={s.saveBtn} onPress={handleSave} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={s.saveBtnText}>Save Profile</Text>
        )}
      </AnimatedPressable>
      </ScrollView>
    </View>
  );
}
