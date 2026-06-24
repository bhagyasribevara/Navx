import React, { useState, useEffect, useRef, useContext } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, Dimensions, 
  Modal, TextInput, FlatList, KeyboardAvoidingView, Platform,
  Animated, Keyboard, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chatWithAI, searchRooms, getBlocks } from '../api';
import { ThemeContext } from '../context/ThemeContext';
import { useGeofence } from '../context/GeofenceContext';
import { useLiveMeet } from '../context/LiveMeetContext';
import { navigationRef } from '../utils/navigation';

const { width, height } = Dimensions.get('window');

const DEFAULT_CHIPS = [
  { label: '📍 Find Library', query: 'Where is the library?' },
  { label: '🍽️ Cafeteria', query: 'Take me to the cafeteria' },
  { label: '🚻 Washroom', query: 'Where is the nearest washroom?' },
  { label: '🅿️ Parking', query: 'Where is the parking area?' },
  { label: '♿ Access', query: 'Show me accessible routes' },
  { label: '🚨 Emergency', query: 'Where is the nearest emergency exit?' },
];

export default function AIChatOverlay() {
  const { colors } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  const { activeCampusId } = useGeofence();
  const navigation = useNavigation();
  const { showMeetModal, setShowMeetModal } = useLiveMeet() || {};

  const [currentRouteName, setCurrentRouteName] = useState(null);

  useEffect(() => {
    const checkRoute = () => {
      if (navigationRef.isReady()) {
        const route = navigationRef.getCurrentRoute();
        setCurrentRouteName(route?.name || null);
      }
    };

    // Check once initially
    checkRoute();

    // Listen for state changes
    const unsubscribe = navigationRef.addListener('state', checkRoute);
    return unsubscribe;
  }, []);

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [chips, setChips] = useState(DEFAULT_CHIPS);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  
  const slideAnim = useRef(new Animated.Value(height)).current;
  const flatListRef = useRef(null);

  // Initialize session
  useEffect(() => {
    const initSession = async () => {
      let id = await AsyncStorage.getItem('navx_ai_session');
      if (!id) {
        id = 'user_' + Math.random().toString(36).substring(2, 10);
        await AsyncStorage.setItem('navx_ai_session', id);
      }
      setSessionId(id);

      const savedMsgs = await AsyncStorage.getItem('navx_ai_messages');
      if (savedMsgs) {
        try {
          setMessages(JSON.parse(savedMsgs));
        } catch (e) {}
      } else {
        // Initial welcome
        setMessages([{
          id: 'welcome',
          role: 'ai',
          text: "Hi! I'm NavX AI, your campus navigation assistant. Ask me to find rooms, events, or facilities!",
          timestamp: new Date().toISOString()
        }]);
      }
    };
    initSession();
  }, []);

  // Save messages
  useEffect(() => {
    if (messages.length > 0) {
      AsyncStorage.setItem('navx_ai_messages', JSON.stringify(messages));
    }
  }, [messages]);

  const openChat = () => {
    setIsOpen(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 60,
      friction: 12
    }).start();
  };

  const closeChat = () => {
    Keyboard.dismiss();
    Animated.timing(slideAnim, {
      toValue: height,
      duration: 300,
      useNativeDriver: true
    }).start(() => setIsOpen(false));
  };

  const handleSend = async (overrideMessage) => {
    const msg = overrideMessage || input.trim();
    if (!msg || isLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: msg,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const data = await chatWithAI(msg, sessionId, activeCampusId, { source: 'mobile_app' });

      const aiMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: data.text,
        action: data.action,
        destination: data.destination,
        locations: data.locations || [],
        suggestions: data.suggestions || [],
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, aiMessage]);

      if (data.suggestions?.length > 0) {
        setChips(data.suggestions.map(s => ({ label: s, query: s })));
      }
    } catch (err) {
      console.error('AI Error:', err);
      setMessages(prev => [...prev, {
        id: (Date.now() + 2).toString(),
        role: 'ai',
        text: "Sorry, I couldn't connect. Please try again later.",
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const handleAction = async (action, destination, startAR = false) => {
    closeChat();
    if (action === 'navigate' && destination) {
      if (!activeCampusId) {
        navigation.navigate('Map');
        return;
      }
      try {
        // First check if the destination is a precise block name
        const blocks = await getBlocks(activeCampusId);
        const matchedBlock = blocks.find(b => b.name.toLowerCase().trim() === destination.toLowerCase().trim());
        
        if (matchedBlock) {
          navigation.navigate('Map', { blockId: matchedBlock._id, campusId: activeCampusId });
          return;
        }

        const results = await searchRooms(destination, activeCampusId);

        // Check if there is an exact room name or room number match in the results
        const exactMatch = results && results.find(r => 
          r.name.toLowerCase().trim() === destination.toLowerCase().trim() ||
          (r.roomNumber && r.roomNumber.toLowerCase().trim() === destination.toLowerCase().trim())
        );

        if (exactMatch) {
          navigation.navigate('Navigation', { room: exactMatch, campusId: activeCampusId, startAR });
          return;
        }

        // If there is exactly one perfect match, bypass the search screen and jump directly to Navigation
        if (results && results.length === 1) {
          navigation.navigate('Navigation', { room: results[0], campusId: activeCampusId, startAR });
          return;
        } 
        
        if (results && results.length > 1) {
          // If multiple rooms were returned, check if they all belong to the EXACT same Block
          // This happens when the user clicks a generic block name like "CSE block" or "Boys Hostel"
          const firstBlockId = results[0]?.blockId?._id || results[0]?.blockId;
          const allSameBlock = firstBlockId && results.every(r => {
            const bid = r.blockId?._id || r.blockId;
            return bid === firstBlockId;
          });

          if (allSameBlock) {
            // It's a block! Open the map screen and automatically focus on this block
            navigation.navigate('Map', { blockId: firstBlockId, campusId: activeCampusId });
            return;
          }
        }

        // Fallback to Map screen to display the Campus Directory instead of the Search screen
        navigation.navigate('Map', { campusId: activeCampusId });
      } catch (err) {
        console.error('Failed to handle navigate action:', err);
        navigation.navigate('Map', { campusId: activeCampusId });
      }
    } else if (action === 'emergency') {
      navigation.navigate('Search', { initialQuery: 'exit', autoSearch: true });
    }
  };

  const handleSuggestionPress = (suggestionText, msgItem) => {
    const text = suggestionText.toLowerCase();
    const dest = msgItem.destination || (msgItem.locations && msgItem.locations[0]);
    
    if (text.includes('restroom') || text.includes('washroom')) {
      closeChat();
      navigation.navigate('Map', { showRestrooms: true, campusId: activeCampusId });
    } else if (text.includes('nearby facilities') || text.includes('show facilities') || text.includes('show nearby')) {
      closeChat();
      navigation.navigate('Search');
    } else if (text.includes('share location') || text.includes('meet friend') || text.includes('meet someone')) {
      closeChat();
      if (setShowMeetModal) {
        setShowMeetModal(true);
      }
    } else if (dest && (text.includes('ar navigation') || text.includes('start ar'))) {
      handleAction('navigate', dest, true);
    } else if (dest && text.includes('start navigation')) {
      handleAction('navigate', dest, false);
    } else if (dest && (text.includes('view route') || text.includes('route overview') || text.includes('view on map') || text.includes('view campus map') || text.includes('map view'))) {
      handleAction('navigate', dest, false);
    } else {
      handleSend(suggestionText);
    }
  };

  const handleBottomChipPress = (chip) => {
    const queryText = chip.query.toLowerCase();
    const lastAiMsg = [...messages].reverse().find(m => m.role === 'ai' && (m.destination || (m.locations && m.locations.length > 0)));
    const dest = lastAiMsg ? (lastAiMsg.destination || lastAiMsg.locations[0]) : null;
    
    if (queryText.includes('restroom') || queryText.includes('washroom')) {
      closeChat();
      navigation.navigate('Map', { showRestrooms: true, campusId: activeCampusId });
      return;
    } else if (queryText.includes('nearby facilities') || queryText.includes('show facilities') || queryText.includes('show nearby')) {
      closeChat();
      navigation.navigate('Search');
      return;
    } else if (queryText.includes('share location') || queryText.includes('meet friend') || queryText.includes('meet someone')) {
      closeChat();
      if (setShowMeetModal) {
        setShowMeetModal(true);
      }
      return;
    }

    if (dest) {
      if (queryText.includes('ar navigation') || queryText.includes('start ar')) {
        handleAction('navigate', dest, true);
        return;
      } else if (queryText.includes('start navigation')) {
        handleAction('navigate', dest, false);
        return;
      } else if (queryText.includes('view route') || queryText.includes('route overview') || queryText.includes('view on map') || queryText.includes('view campus map') || queryText.includes('map view')) {
        handleAction('navigate', dest, false);
        return;
      }
    }
    handleSend(chip.query);
  };

  const clearChat = async () => {
    setMessages([{
      id: Date.now().toString(),
      role: 'ai',
      text: "Chat cleared! How can I help you today?",
      timestamp: new Date().toISOString()
    }]);
    await AsyncStorage.removeItem('navx_ai_messages');
  };

  const renderMessage = ({ item }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAI]}>
        {!isUser && (
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>N</Text>
          </View>
        )}
        <View style={[
          styles.bubble, 
          isUser ? [styles.bubbleUser, { backgroundColor: colors.primary }] : [styles.bubbleAI, { backgroundColor: colors.card }]
        ]}>
          <Text style={[styles.messageText, isUser ? styles.messageTextUser : { color: colors.text }]}>
            {item.text.replace(/\*\*/g, '') /* Simple markdown strip */}
          </Text>
          
          {/* Prioritize Specific Room Destination Navigation */}
          {!isUser && item.action === 'navigate' && item.destination ? (
            <TouchableOpacity 
              style={[styles.actionBtn, { borderColor: colors.primary }]}
              onPress={() => handleAction(item.action, item.destination)}
            >
              <Text style={[styles.actionBtnText, { color: colors.primary }]}>🎯 Navigate to {item.destination}</Text>
            </TouchableOpacity>
          ) : (
            /* Fallback to Multiple Locations Navigation if no single destination is set */
            !isUser && item.locations && item.locations.length > 0 && (
              <View style={{ marginTop: 10, gap: 8 }}>
                {item.locations.map((loc, idx) => (
                  <TouchableOpacity 
                    key={idx}
                    style={[styles.actionBtn, { borderColor: colors.primary, marginTop: 0 }]}
                    onPress={() => handleAction('navigate', loc)}
                  >
                    <Text style={[styles.actionBtnText, { color: colors.primary }]}>🎯 Navigate to {loc}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )
          )}

          {!isUser && item.action === 'emergency' && (
             <TouchableOpacity 
             style={[styles.actionBtn, { borderColor: colors.danger, backgroundColor: 'rgba(220,38,38,0.1)' }]}
             onPress={() => handleAction('emergency', 'exit')}
           >
             <Text style={[styles.actionBtnText, { color: colors.danger }]}>🚨 Find Nearest Exit</Text>
           </TouchableOpacity>
          )}

          {!isUser && item.suggestions && item.suggestions.length > 0 && (
            <View style={styles.inlineChips}>
              {item.suggestions.slice(0, 2).map((s, i) => (
                <TouchableOpacity key={i} style={[styles.inlineChip, { borderColor: colors.primaryLight }]} onPress={() => handleSuggestionPress(s, item)}>
                  <Text style={[styles.inlineChipText, { color: colors.primary }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  const hiddenScreens = ['QRScan', 'LiveMeet', 'ARMeet'];
  const isHidden = hiddenScreens.includes(currentRouteName) || showMeetModal || !activeCampusId;

  if (isHidden) {
    return null;
  }

  return (
    <>
      {!isOpen && (
        <TouchableOpacity 
          style={[styles.fab, { 
            backgroundColor: colors.primary, 
            shadowColor: colors.primary,
            bottom: 80 + insets.bottom
          }]} 
          onPress={openChat}
          activeOpacity={0.8}
        >
          <Ionicons name="chatbubbles" size={26} color="#fff" />
        </TouchableOpacity>
      )}

      <Modal visible={isOpen} transparent animationType="none" onRequestClose={closeChat}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={closeChat} />
          
          <Animated.View style={[styles.chatContainer, { backgroundColor: colors.bg, transform: [{ translateY: slideAnim }] }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>N</Text>
              </View>
              <View style={styles.headerInfo}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>NavX AI</Text>
                <Text style={styles.headerSubtitle}>Campus Expert</Text>
              </View>
              <TouchableOpacity onPress={clearChat} style={styles.iconBtn}>
                <Ionicons name="trash-outline" size={22} color={colors.textSec} />
              </TouchableOpacity>
              <TouchableOpacity onPress={closeChat} style={styles.iconBtn}>
                <Ionicons name="close" size={26} color={colors.textSec} />
              </TouchableOpacity>
            </View>

            {/* Messages */}
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              contentContainerStyle={styles.messageList}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />

            {isLoading && (
              <View style={styles.typingIndicator}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.typingText, { color: colors.textSec }]}>NavX AI is typing...</Text>
              </View>
            )}

            {/* Suggestion Chips */}
            {!isLoading && (
              <View style={[styles.chipsScroll, { borderTopColor: colors.border }]}>
                  <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={chips.slice(0, 5)}
                    keyExtractor={(_, i) => i.toString()}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
                    renderItem={({ item }) => (
                      <TouchableOpacity 
                        style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.border }]} 
                        onPress={() => handleBottomChipPress(item)}
                      >
                        <Text style={[styles.chipText, { color: colors.textSec }]}>{item.label}</Text>
                      </TouchableOpacity>
                    )}
                  />
              </View>
            )}

            {/* Input Area */}
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View style={[styles.inputContainer, { 
                backgroundColor: colors.card, 
                borderTopColor: colors.border, 
                paddingBottom: keyboardVisible ? 8 : (insets.bottom > 0 ? insets.bottom + 8 : 12) 
              }]}>
                <TouchableOpacity 
                  style={[styles.voiceBtn, { borderColor: colors.border }]}
                  onPress={() => alert('Voice input requires native module integration. Using text for now.')}
                >
                  <Ionicons name="mic-outline" size={22} color={colors.textSec} />
                </TouchableOpacity>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.bg, color: colors.text }]}
                  placeholder="Ask me anything..."
                  placeholderTextColor={colors.textMuted}
                  value={input}
                  onChangeText={setInput}
                  onSubmitEditing={() => handleSend()}
                  returnKeyType="send"
                />
                <TouchableOpacity 
                  style={[styles.sendBtn, { backgroundColor: input.trim() ? colors.primary : colors.border }]}
                  onPress={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                >
                  <Ionicons name="send" size={18} color="#fff" style={{ marginLeft: 2 }} />
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 90, // Above tab bar
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 999,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  chatContainer: {
    height: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '500',
  },
  iconBtn: {
    padding: 8,
    marginLeft: 4,
  },
  messageList: {
    padding: 16,
    paddingBottom: 20,
    gap: 16,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    maxWidth: '85%',
  },
  messageRowUser: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  messageRowAI: {
    alignSelf: 'flex-start',
  },
  bubble: {
    padding: 14,
    borderRadius: 18,
  },
  bubbleUser: {
    borderBottomRightRadius: 4,
  },
  bubbleAI: {
    borderTopLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  messageTextUser: {
    color: '#fff',
  },
  actionBtn: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  inlineChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  inlineChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
  },
  inlineChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 8,
  },
  typingText: {
    fontSize: 13,
  },
  chipsScroll: {
    borderTopWidth: 1,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderTopWidth: 1,
    gap: 8,
  },
  voiceBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
