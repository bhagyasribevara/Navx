import React, { useState, useContext } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { ThemeContext } from "../context/ThemeContext";
import { scanQRCode } from "../api";

export default function QRScanScreen({ navigation }) {
  const { colors } = useContext(ThemeContext);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [result, setResult] = useState(null);

  const handleBarCodeScanned = async ({ type, data }) => {
    if (scanned) return;
    setScanned(true);

    try {
      const qrData = await scanQRCode(data);
      setResult(qrData);
      Alert.alert(
        "📍 Position Set!",
        `Location: ${qrData.label || data}\nFloor: ${qrData.floorId?.name || "Unknown"}\nBlock: ${qrData.blockId?.name || "Unknown"}\nPosition: (${qrData.position.x}, ${qrData.position.y})`,
        [
          {
            text: "Navigate",
            onPress: () =>
              navigation.navigate("Map", {
                userPosition: qrData.position,
                floorId: qrData.floorId?._id,
              }),
          },
          { text: "Scan Again", onPress: () => setScanned(false) },
        ],
      );
    } catch (err) {
      Alert.alert(
        "QR Not Found",
        "This QR code is not registered in the navigation system.",
        [
          { text: "Scan Again", onPress: () => setScanned(false) },
          { text: "Cancel", onPress: () => navigation.goBack() },
        ],
      );
    }
  };

  if (!permission?.granted) {
    return (
      <View style={[s.center, { backgroundColor: colors.bg }]}>
        <Ionicons name="qr-code" size={48} color={colors.textMuted} />
        <Text style={[s.title, { color: colors.text }]}>
          Camera Access Required
        </Text>
        <Text style={[s.desc, { color: colors.textSec }]}>
          Scan QR codes placed around the building to set your position
        </Text>
        <TouchableOpacity
          style={[s.permBtn, { backgroundColor: colors.primary }]}
          onPress={requestPermission}
        >
          <Text style={s.permBtnText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ marginTop: 12 }}
          onPress={() => navigation.goBack()}
        >
          <Text style={{ color: colors.textMuted }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
      />

      {/* Overlay */}
      <View style={s.overlay}>
        {/* Top bar */}
        <View style={s.topBar}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={s.topTitle}>Scan QR Code</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Scan frame */}
        <View style={s.scanArea}>
          <View style={s.scanFrame}>
            <View style={[s.corner, s.cornerTL]} />
            <View style={[s.corner, s.cornerTR]} />
            <View style={[s.corner, s.cornerBL]} />
            <View style={[s.corner, s.cornerBR]} />
          </View>
          <Text style={s.scanHint}>
            {scanned
              ? "✅ QR Code detected!"
              : "Point camera at a NavX QR code"}
          </Text>
        </View>

        {/* Bottom info */}
        <View style={s.bottomInfo}>
          <View style={s.infoCard}>
            <Ionicons name="information-circle" size={20} color="#6366f1" />
            <Text style={s.infoText}>
              QR codes are placed at entrances, corridors, and key locations to
              set your indoor position
            </Text>
          </View>
          {scanned && (
            <TouchableOpacity
              style={s.rescanBtn}
              onPress={() => setScanned(false)}
            >
              <Ionicons name="refresh" size={18} color="#6366f1" />
              <Text style={s.rescanText}>Scan Another</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: { fontSize: 20, fontWeight: "700", marginTop: 16 },
  desc: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 30,
    lineHeight: 20,
  },
  permBtn: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
  },
  permBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  scanArea: { alignItems: "center" },
  scanFrame: { width: 250, height: 250, position: "relative" },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: "#6366f1",
    borderWidth: 3,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 8,
  },
  scanHint: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    marginTop: 20,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
  bottomInfo: { padding: 20, paddingBottom: 40 },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(26,32,53,0.9)",
    padding: 14,
    borderRadius: 14,
    gap: 10,
  },
  infoText: { flex: 1, color: "#94a3b8", fontSize: 13, lineHeight: 18 },
  rescanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(99,102,241,0.15)",
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.3)",
  },
  rescanText: { color: "#818cf8", fontWeight: "600", fontSize: 14 },
});
