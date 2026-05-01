import React, { useState, useEffect, useContext, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, ActivityIndicator, Animated,
  ScrollView, Platform,
} from "react-native";
import Svg, { Rect, Circle, Line, G, Text as SvgText, Path } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { ThemeContext } from "../context/ThemeContext";
import { getMapData, getCampuses, cachedGet } from "../api";
import { SHADOWS, RADIUS, ROOM_COLORS } from "../theme/designSystem";

const { width: SW, height: SH } = Dimensions.get("window");

export default function MapScreen({ navigation, route }) {
  const { colors } = useContext(ThemeContext);
  const [mapData, setMapData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [campusId, setCampusId] = useState(route.params?.campusId || null);
  const [zoom, setZoom] = useState(0.65);
  const [pan, setPan] = useState({ x: 20, y: 20 });
  const [userPos, setUserPos] = useState(null);
  const [routePath, setRoutePath] = useState(null);
  const [showLegend, setShowLegend] = useState(false);
  const [compassActive, setCompassActive] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!campusId) {
      getCampuses().then(data => {
        if (data.length) setCampusId(data[0]._id);
        setLoading(false);
      });
    }
  }, []);

  useEffect(() => {
    if (campusId) {
      setLoading(true);
      cachedGet(`mapdata_${campusId}`, () => getMapData(campusId))
        .then(data => {
          setMapData(data);
          if (data.blocks?.length) {
            setSelectedBlock(data.blocks[0]);
            const fl = data.floors?.filter(f => f.blockId === data.blocks[0]._id);
            if (fl?.length) setSelectedFloor(fl[0]);
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [campusId]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.6, duration: 1200, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: false }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, { toValue: 1, duration: 1500, useNativeDriver: false }),
        Animated.timing(dotAnim, { toValue: 0, duration: 1500, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (selectedRoom) {
      Animated.spring(sheetAnim, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }).start();
    } else {
      Animated.timing(sheetAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [selectedRoom]);

  const rooms = mapData?.rooms?.filter(r => r.floorId === selectedFloor?._id) || [];
  const nodes = mapData?.nodes?.filter(n => n.floorId === selectedFloor?._id) || [];
  const paths = mapData?.paths?.filter(p => p.floorId === selectedFloor?._id) || [];
  const blockFloors = mapData?.floors?.filter(f => f.blockId === selectedBlock?._id) || [];

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    topBar: {
      paddingTop: Platform.OS === "ios" ? 54 : 16,
      paddingHorizontal: 12, paddingBottom: 10,
      backgroundColor: colors.card,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    blockRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
    blockChip: {
      paddingHorizontal: 14, paddingVertical: 7,
      borderRadius: 99, marginRight: 6,
      backgroundColor: colors.surface,
      borderWidth: 1.5, borderColor: colors.border,
    },
    blockChipActive: { backgroundColor: colors.primary + "18", borderColor: colors.primary },
    blockText: { fontSize: 13, fontWeight: "700", color: colors.textSec },
    blockTextActive: { color: colors.primary },
    floorRow: { flexDirection: "row" },
    floorBtn: {
      paddingHorizontal: 12, paddingVertical: 5,
      borderRadius: 8, marginRight: 4,
    },
    floorBtnActive: { backgroundColor: colors.primary },
    floorText: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
    floorTextActive: { color: "#fff" },
    mapArea: { flex: 1, backgroundColor: colors.mapBg || "#060d1a" },
    // Floating controls
    floatLeft: { position: "absolute", left: 12, top: 12, gap: 8 },
    floatRight: { position: "absolute", right: 12, top: 12, gap: 8 },
    ctrlBtn: {
      width: 44, height: 44, borderRadius: RADIUS.sm,
      backgroundColor: colors.card + "EE",
      alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: colors.border,
      ...SHADOWS.md,
    },
    compassActive: { backgroundColor: colors.primary + "20", borderColor: colors.primary },
    zoomGroup: {
      backgroundColor: colors.card + "EE",
      borderRadius: RADIUS.sm, borderWidth: 1,
      borderColor: colors.border, overflow: "hidden",
      ...SHADOWS.md,
    },
    zoomBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    zoomSep: { height: 1, backgroundColor: colors.border },
    // Bottom sheet
    sheet: {
      position: "absolute", bottom: 0, left: 0, right: 0,
      backgroundColor: colors.card,
      borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
      padding: 20, paddingBottom: 34,
      borderTopWidth: 1, borderTopColor: colors.border,
      ...SHADOWS.lg,
    },
    sheetHandle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: colors.border, alignSelf: "center", marginBottom: 16,
    },
    roomTypeBadge: {
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99,
      alignSelf: "flex-start", marginBottom: 8,
    },
    roomName: { fontSize: 20, fontWeight: "800", color: colors.text, marginBottom: 2 },
    roomSub: { fontSize: 13, color: colors.textSec },
    sheetActions: { flexDirection: "row", gap: 10, marginTop: 16 },
    navBtn: {
      flex: 1, flexDirection: "row", alignItems: "center",
      backgroundColor: colors.primary, paddingVertical: 14,
      borderRadius: RADIUS.md, justifyContent: "center",
      ...SHADOWS.primary ? SHADOWS.primary(colors.primary) : {},
    },
    navBtnText: { color: "#fff", fontWeight: "700", fontSize: 15, marginLeft: 8 },
    arBtn: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: colors.primary + "18", paddingHorizontal: 18,
      paddingVertical: 14, borderRadius: RADIUS.md,
      borderWidth: 1.5, borderColor: colors.primary + "40",
    },
    // Legend
    legend: {
      position: "absolute", left: 12, bottom: 20,
      backgroundColor: colors.card + "EE",
      borderRadius: RADIUS.md, padding: 12,
      borderWidth: 1, borderColor: colors.border, ...SHADOWS.md,
    },
    legendRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
    legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
    legendLabel: { fontSize: 12, color: colors.textSec },
    emptyMap: { flex: 1, alignItems: "center", justifyContent: "center" },
  });

  if (loading) {
    return (
      <View style={[s.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textSec, marginTop: 12, fontSize: 14, fontWeight: "600" }}>Loading map data…</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Top selectors */}
      <View style={s.topBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.blockRow}>
          {mapData?.blocks?.map(block => (
            <TouchableOpacity
              key={block._id}
              style={[s.blockChip, selectedBlock?._id === block._id && s.blockChipActive]}
              onPress={() => {
                setSelectedBlock(block);
                const fl = mapData.floors?.filter(f => f.blockId === block._id);
                setSelectedFloor(fl?.[0] || null);
                setSelectedRoom(null);
              }}
            >
              <Text style={[s.blockText, selectedBlock?._id === block._id && s.blockTextActive]}>
                {block.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.floorRow}>
          {blockFloors.map(floor => (
            <TouchableOpacity
              key={floor._id}
              style={[s.floorBtn, selectedFloor?._id === floor._id && s.floorBtnActive]}
              onPress={() => { setSelectedFloor(floor); setSelectedRoom(null); }}
            >
              <Text style={[s.floorText, selectedFloor?._id === floor._id && s.floorTextActive]}>
                {floor.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* SVG Map */}
      <View style={s.mapArea}>
        {!selectedFloor ? (
          <View style={s.emptyMap}>
            <Ionicons name="map-outline" size={60} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, marginTop: 12, fontSize: 15, fontWeight: "600" }}>Select a Block & Floor</Text>
          </View>
        ) : (
          <Svg
            width={SW}
            height={SH - 200}
            viewBox={`${-pan.x} ${-pan.y} ${SW / zoom} ${(SH - 200) / zoom}`}
          >
            {/* Grid */}
            {Array.from({ length: 60 }, (_, i) => (
              <G key={`g${i}`}>
                <Line x1={i * 20} y1={0} x2={i * 20} y2={1200} stroke={colors.mapGrid || "#0f1e33"} strokeWidth={0.5} />
                <Line x1={0} y1={i * 20} x2={1200} y2={i * 20} stroke={colors.mapGrid || "#0f1e33"} strokeWidth={0.5} />
              </G>
            ))}
            {/* Nav paths */}
            {paths.map(p => {
              const nA = nodes.find(n => n._id === p.nodeA);
              const nB = nodes.find(n => n._id === p.nodeB);
              if (!nA || !nB) return null;
              return (
                <Line key={p._id} x1={nA.x} y1={nA.y} x2={nB.x} y2={nB.y}
                  stroke={colors.accent + "25"} strokeWidth={2.5} strokeDasharray="5,5" />
              );
            })}
            {/* Route path */}
            {routePath?.map((p, i) => {
              if (i === 0) return null;
              const prev = routePath[i - 1];
              return (
                <Line key={`rt${i}`} x1={prev.x} y1={prev.y} x2={p.x} y2={p.y}
                  stroke={colors.primary} strokeWidth={5} strokeLinecap="round" />
              );
            })}
            {/* Rooms */}
            {rooms.map(room => {
              const sh = room.shape;
              const isSel = selectedRoom?._id === room._id;
              const rc = ROOM_COLORS[room.type] || "#94a3b8";
              const fill = rc + (isSel ? "70" : "28");
              const stroke = isSel ? colors.primaryLight : rc;
              return (
                <G key={room._id} onPress={() => setSelectedRoom(room)}>
                  {sh.type === "circle" ? (
                    <Circle cx={sh.x + (sh.radius || 30)} cy={sh.y + (sh.radius || 30)} r={sh.radius || 30}
                      fill={fill} stroke={stroke} strokeWidth={isSel ? 2.5 : 1.5} />
                  ) : (
                    <Rect x={sh.x} y={sh.y} width={sh.width || 80} height={sh.height || 60}
                      rx={5} fill={fill} stroke={stroke} strokeWidth={isSel ? 2.5 : 1.5} />
                  )}
                  <SvgText
                    x={sh.type === "circle" ? sh.x + (sh.radius || 30) : sh.x + (sh.width || 80) / 2}
                    y={sh.type === "circle" ? sh.y + (sh.radius || 30) + 4 : sh.y + (sh.height || 60) / 2 + 4}
                    fill="#e2e8f0" fontSize={isSel ? 11 : 9} textAnchor="middle" fontWeight="600"
                  >{room.name}</SvgText>
                </G>
              );
            })}
            {/* User position */}
            {userPos && userPos.floor === selectedFloor?._id && (
              <G>
                <Circle cx={userPos.x} cy={userPos.y} r={20} fill="#6366f118" />
                <Circle cx={userPos.x} cy={userPos.y} r={10} fill="#6366f1" stroke="#fff" strokeWidth={2.5} />
              </G>
            )}
          </Svg>
        )}

        {/* Right controls */}
        <View style={s.floatRight}>
          <View style={s.zoomGroup}>
            <TouchableOpacity style={s.zoomBtn} onPress={() => setZoom(z => Math.min(3, z + 0.2))}>
              <Ionicons name="add" size={20} color={colors.text} />
            </TouchableOpacity>
            <View style={s.zoomSep} />
            <TouchableOpacity style={s.zoomBtn} onPress={() => setZoom(z => Math.max(0.2, z - 0.2))}>
              <Ionicons name="remove" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[s.ctrlBtn, compassActive && s.compassActive]}
            onPress={() => setCompassActive(!compassActive)}
          >
            <Ionicons name="compass" size={22} color={compassActive ? colors.primary : colors.text} />
          </TouchableOpacity>
        </View>

        {/* Left controls */}
        <View style={s.floatLeft}>
          <TouchableOpacity style={s.ctrlBtn} onPress={() => navigation.navigate("QRScan")}>
            <Ionicons name="qr-code" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={s.ctrlBtn} onPress={() => setShowLegend(!showLegend)}>
            <Ionicons name="layers" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Legend */}
        {showLegend && (
          <View style={s.legend}>
            {Object.entries(ROOM_COLORS).slice(0, 6).map(([type, color]) => (
              <View key={type} style={s.legendRow}>
                <View style={[s.legendDot, { backgroundColor: color }]} />
                <Text style={s.legendLabel}>{type.charAt(0).toUpperCase() + type.slice(1)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Bottom Sheet */}
      {selectedRoom && (
        <Animated.View style={[s.sheet, { transform: [{ translateY: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [200, 0] }) }] }]}>
          <View style={s.sheetHandle} />
          <TouchableOpacity style={{ position: "absolute", right: 16, top: 20 }} onPress={() => setSelectedRoom(null)}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="close" size={18} color={colors.textSec} />
            </View>
          </TouchableOpacity>
          <View style={[s.roomTypeBadge, { backgroundColor: (ROOM_COLORS[selectedRoom.type] || colors.primary) + "20" }]}>
            <Text style={{ fontSize: 11, fontWeight: "800", color: ROOM_COLORS[selectedRoom.type] || colors.primary, letterSpacing: 0.8 }}>
              {selectedRoom.type?.toUpperCase()}
            </Text>
          </View>
          <Text style={s.roomName}>{selectedRoom.name}</Text>
          <Text style={s.roomSub}>
            {selectedRoom.roomNumber ? `Room #${selectedRoom.roomNumber} · ` : ""}
            {selectedFloor?.name || ""} · {selectedBlock?.name || ""}
          </Text>
          {selectedRoom.description ? (
            <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 8, lineHeight: 18 }}>{selectedRoom.description}</Text>
          ) : null}
          <View style={s.sheetActions}>
            <TouchableOpacity
              style={s.navBtn}
              onPress={() => navigation.navigate("Navigation", { room: selectedRoom, campusId, mapData })}
            >
              <Ionicons name="navigate" size={18} color="#fff" />
              <Text style={s.navBtnText}>Navigate Here</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.arBtn} onPress={() => navigation.navigate("AR", { room: selectedRoom })}>
              <Ionicons name="camera" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
}
