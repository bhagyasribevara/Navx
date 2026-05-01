import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator, Animated } from 'react-native';
import Svg, { Rect, Circle, Line, G, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../../App';
import { getMapData, getCampuses, cachedGet } from '../api';

const { width: SW, height: SH } = Dimensions.get('window');
const COLORS = {
  classroom: '#3b82f6', office: '#8b5cf6', lab: '#22c55e', restroom: '#f59e0b',
  cafeteria: '#ef4444', library: '#06b6d4', auditorium: '#ec4899', elevator: '#6366f1',
  stairs: '#f97316', corridor: '#64748b80', entrance: '#10b981', exit: '#ef4444', other: '#94a3b8'
};

export default function MapScreen({ navigation, route }) {
  const { colors } = useContext(ThemeContext);
  const [mapData, setMapData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [campusId, setCampusId] = useState(route.params?.campusId || null);
  const [campuses, setCampuses] = useState([]);
  const [zoom, setZoom] = useState(0.6);
  const [panOffset, setPanOffset] = useState({ x: 20, y: 20 });
  const [userPosition, setUserPosition] = useState(null);
  const [routePath, setRoutePath] = useState(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!campusId) {
      getCampuses().then(data => { setCampuses(data); if (data.length) setCampusId(data[0]._id); setLoading(false); });
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
            const bFloors = data.floors?.filter(f => f.blockId === data.blocks[0]._id);
            if (bFloors?.length) setSelectedFloor(bFloors[0]);
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [campusId]);

  // Pulse animation for user position
  useEffect(() => {
    if (userPosition) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.5, duration: 1000, useNativeDriver: false }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: false }),
        ])
      ).start();
    }
  }, [userPosition]);

  const currentFloorRooms = mapData?.rooms?.filter(r => r.floorId === selectedFloor?._id) || [];
  const currentFloorNodes = mapData?.nodes?.filter(n => n.floorId === selectedFloor?._id) || [];
  const currentFloorPaths = mapData?.paths?.filter(p => p.floorId === selectedFloor?._id) || [];
  const blockFloors = mapData?.floors?.filter(f => f.blockId === selectedBlock?._id) || [];

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    blockBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginRight: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    blockBtnActive: { backgroundColor: colors.primary + '20', borderColor: colors.primary },
    blockBtnText: { fontSize: 12, fontWeight: '600', color: colors.textSec },
    blockBtnTextActive: { color: colors.primary },
    floorBar: { flexDirection: 'row', padding: 8, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
    floorBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6, marginRight: 4 },
    floorBtnActive: { backgroundColor: colors.primary },
    floorBtnText: { fontSize: 12, fontWeight: '600', color: colors.textSec },
    floorBtnTextActive: { color: '#fff' },
    mapArea: { flex: 1, backgroundColor: '#080c16' },
    controls: { position: 'absolute', right: 12, top: 12, gap: 6 },
    ctrlBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
    bottomSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, borderTopWidth: 1, borderTopColor: colors.border },
    roomName: { fontSize: 18, fontWeight: '700', color: colors.text },
    roomType: { fontSize: 12, color: colors.primary, fontWeight: '600', textTransform: 'uppercase', marginTop: 2 },
    navBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 12, justifyContent: 'center' },
    navBtnText: { fontSize: 14, fontWeight: '700', color: '#fff', marginLeft: 8 },
  });

  if (loading) {
    return <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color={colors.primary} /><Text style={{ color: colors.textSec, marginTop: 12 }}>Loading map...</Text></View>;
  }

  return (
    <View style={s.container}>
      {/* Block selector */}
      <View style={s.topBar}>
        {mapData?.blocks?.map(block => (
          <TouchableOpacity key={block._id} style={[s.blockBtn, selectedBlock?._id === block._id && s.blockBtnActive]}
            onPress={() => {
              setSelectedBlock(block);
              const bFloors = mapData.floors?.filter(f => f.blockId === block._id);
              setSelectedFloor(bFloors?.[0] || null);
              setSelectedRoom(null);
            }}>
            <Text style={[s.blockBtnText, selectedBlock?._id === block._id && s.blockBtnTextActive]}>{block.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Floor selector */}
      <View style={s.floorBar}>
        {blockFloors.map(floor => (
          <TouchableOpacity key={floor._id} style={[s.floorBtn, selectedFloor?._id === floor._id && s.floorBtnActive]}
            onPress={() => { setSelectedFloor(floor); setSelectedRoom(null); }}>
            <Text style={[s.floorBtnText, selectedFloor?._id === floor._id && s.floorBtnTextActive]}>{floor.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* SVG Map */}
      <View style={s.mapArea}>
        <Svg width={SW} height={SH - 200} viewBox={`${-panOffset.x} ${-panOffset.y} ${SW / zoom} ${(SH - 200) / zoom}`}>
          {/* Grid */}
          {Array.from({ length: 50 }, (_, i) => (
            <G key={`grid-${i}`}>
              <Line x1={i * 20} y1={0} x2={i * 20} y2={1000} stroke="#1a2040" strokeWidth={0.5} />
              <Line x1={0} y1={i * 20} x2={1000} y2={i * 20} stroke="#1a2040" strokeWidth={0.5} />
            </G>
          ))}

          {/* Nav paths */}
          {currentFloorPaths.map(p => {
            const nA = currentFloorNodes.find(n => n._id === p.nodeA);
            const nB = currentFloorNodes.find(n => n._id === p.nodeB);
            if (!nA || !nB) return null;
            return <Line key={p._id} x1={nA.x} y1={nA.y} x2={nB.x} y2={nB.y} stroke="#22c55e30" strokeWidth={2} strokeDasharray="4,4" />;
          })}

          {/* Route path */}
          {routePath && routePath.map((p, i) => {
            if (i === 0) return null;
            const prev = routePath[i - 1];
            return <Line key={`route-${i}`} x1={prev.x} y1={prev.y} x2={p.x} y2={p.y} stroke="#6366f1" strokeWidth={4} />;
          })}

          {/* Rooms */}
          {currentFloorRooms.map(room => {
            const sh = room.shape;
            const isSelected = selectedRoom?._id === room._id;
            const fillColor = (COLORS[room.type] || '#3b82f6') + (isSelected ? '80' : '30');
            const strokeColor = isSelected ? '#818cf8' : (COLORS[room.type] || '#3b82f6');

            return (
              <G key={room._id} onPress={() => setSelectedRoom(room)}>
                {sh.type === 'circle' ? (
                  <Circle cx={sh.x + (sh.radius || 30)} cy={sh.y + (sh.radius || 30)} r={sh.radius || 30}
                    fill={fillColor} stroke={strokeColor} strokeWidth={isSelected ? 3 : 1.5} />
                ) : (
                  <Rect x={sh.x} y={sh.y} width={sh.width || 80} height={sh.height || 60} rx={4}
                    fill={fillColor} stroke={strokeColor} strokeWidth={isSelected ? 3 : 1.5} />
                )}
                <SvgText x={sh.type === 'circle' ? sh.x + (sh.radius || 30) : sh.x + (sh.width || 80) / 2}
                  y={sh.type === 'circle' ? sh.y + (sh.radius || 30) + 4 : sh.y + (sh.height || 60) / 2 + 4}
                  fill="#e2e8f0" fontSize={10} textAnchor="middle" fontWeight="600">{room.name}</SvgText>
              </G>
            );
          })}

          {/* User position */}
          {userPosition && userPosition.floor === selectedFloor?._id && (
            <G>
              <Circle cx={userPosition.x} cy={userPosition.y} r={16} fill="#6366f120" />
              <Circle cx={userPosition.x} cy={userPosition.y} r={8} fill="#6366f1" stroke="#fff" strokeWidth={2} />
            </G>
          )}
        </Svg>

        {/* Zoom controls */}
        <View style={s.controls}>
          <TouchableOpacity style={s.ctrlBtn} onPress={() => setZoom(z => Math.min(3, z + 0.2))}>
            <Ionicons name="add" size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={s.ctrlBtn} onPress={() => setZoom(z => Math.max(0.2, z - 0.2))}>
            <Ionicons name="remove" size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={s.ctrlBtn} onPress={() => navigation.navigate('QRScan')}>
            <Ionicons name="qr-code" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom sheet - room info */}
      {selectedRoom && (
        <View style={s.bottomSheet}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={s.roomName}>{selectedRoom.name}</Text>
              <Text style={s.roomType}>{selectedRoom.type}</Text>
              {selectedRoom.roomNumber ? <Text style={{ fontSize: 13, color: colors.textSec, marginTop: 2 }}>Room #{selectedRoom.roomNumber}</Text> : null}
              {selectedRoom.description ? <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>{selectedRoom.description}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => setSelectedRoom(null)} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.navBtn}
            onPress={() => navigation.navigate('Navigation', { room: selectedRoom, campusId, mapData })}>
            <Ionicons name="navigate" size={18} color="#fff" />
            <Text style={s.navBtnText}>Navigate Here</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
