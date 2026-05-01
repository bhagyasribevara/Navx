import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemeContext } from "../context/ThemeContext";
import { searchRooms, getCampuses, cachedGet } from "../api";

const ROOM_ICONS = {
  classroom: "school",
  office: "business",
  lab: "flask",
  restroom: "water",
  cafeteria: "restaurant",
  library: "library",
  auditorium: "megaphone",
  elevator: "arrow-up",
  stairs: "trending-up",
  corridor: "walk",
  entrance: "enter",
  exit: "exit",
  other: "location",
};

export default function SearchScreen({ navigation }) {
  const { colors } = useContext(ThemeContext);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [campusId, setCampusId] = useState(null);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    cachedGet("campuses", getCampuses).then((data) => {
      if (data.length) setCampusId(data[0]._id);
    });
  }, []);

  useEffect(() => {
    if (query.length >= 2 && campusId) {
      const timer = setTimeout(() => {
        searchRooms(query, campusId)
          .then(setResults)
          .catch(() => setResults([]));
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setResults([]);
    }
  }, [query, campusId]);

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      margin: 16,
      borderRadius: 14,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.text,
      marginLeft: 10,
    },
    resultItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    roomName: { fontSize: 15, fontWeight: "600", color: colors.text },
    roomInfo: { fontSize: 12, color: colors.textSec, marginTop: 2 },
    emptyText: {
      textAlign: "center",
      color: colors.textMuted,
      marginTop: 60,
      fontSize: 15,
    },
    emptyHint: {
      textAlign: "center",
      color: colors.textMuted,
      marginTop: 8,
      fontSize: 13,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 1,
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
  });

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={s.resultItem}
      onPress={() =>
        navigation.navigate("Map", { campusId, selectedRoom: item })
      }
    >
      <View style={[s.iconWrap, { backgroundColor: colors.primary + "15" }]}>
        <Ionicons
          name={ROOM_ICONS[item.type] || "location"}
          size={20}
          color={colors.primary}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.roomName}>{item.name}</Text>
        <Text style={s.roomInfo}>
          {item.type} {item.roomNumber ? `· #${item.roomNumber}` : ""}{" "}
          {item.blockId?.name ? `· ${item.blockId.name}` : ""}{" "}
          {item.floorId?.name ? `· ${item.floorId.name}` : ""}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );

  return (
    <View style={s.container}>
      <View style={s.searchBar}>
        <Ionicons name="search" size={20} color={colors.textMuted} />
        <TextInput
          style={s.searchInput}
          placeholder="Search rooms, labs, offices..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoFocus
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery("")}>
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {results.length > 0 ? (
        <>
          <Text style={s.sectionTitle}>Results ({results.length})</Text>
          <FlatList
            data={results}
            renderItem={renderItem}
            keyExtractor={(item) => item._id}
          />
        </>
      ) : query.length >= 2 ? (
        <Text style={s.emptyText}>No results found</Text>
      ) : (
        <View>
          <Text style={s.emptyText}>🔍</Text>
          <Text style={s.emptyHint}>
            Search for rooms, labs, offices,{"\n"}or any location on campus
          </Text>
        </View>
      )}
    </View>
  );
}
