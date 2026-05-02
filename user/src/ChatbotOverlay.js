/**
 * NavX AI Chatbot Overlay
 * A floating, dismissible chat panel that integrates into any screen.
 * Does NOT modify the host screen's layout.
 *
 * Props:
 *  visible         - boolean
 *  onClose         - fn
 *  onNavigate      - fn(room) — called when AI triggers navigation
 *  context         - object  — current map context {selectedBlock, selectedFloor, selectedRoom, campusName}
 *  rooms           - array   — current floor rooms for destination matching
 */
import React, {
  useState, useRef, useCallback, useContext, useEffect,
} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Animated, Keyboard, ActivityIndicator,
  KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from './context/ThemeContext';
import {
  sendMessageToAI, speakResponse, stopSpeaking,
  extractNavigationIntent, buildContext,
  createMessage, WELCOME_MESSAGE, QUICK_SUGGESTIONS,
} from './chatbot';

const { height: SH, width: SW } = Dimensions.get('window');

// ─── Micro-components ──────────────────────────────────────────────────────────
const Bubble = ({ msg, colors }) => {
  const isUser = msg.type === 'user';
  return (
    <View style={[
      bubbleStyles.wrap,
      isUser ? bubbleStyles.wrapUser : bubbleStyles.wrapAI,
    ]}>
      {!isUser && (
        <View style={[bubbleStyles.avatar, { backgroundColor: '#6366f115', borderColor: '#6366f130' }]}>
          <Ionicons name="sparkles" size={13} color="#818cf8" />
        </View>
      )}
      <View style={[
        bubbleStyles.bubble,
        isUser
          ? { backgroundColor: '#6366f1', borderBottomRightRadius: 4 }
          : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderBottomLeftRadius: 4 },
        msg.isError && { backgroundColor: colors.danger + '20', borderColor: colors.danger + '40' },
      ]}>
        <Text style={[
          bubbleStyles.text,
          { color: isUser ? '#fff' : colors.text },
          msg.isError && { color: colors.danger },
        ]}>
          {msg.text}
        </Text>
        <Text style={[bubbleStyles.time, { color: isUser ? 'rgba(255,255,255,0.55)' : colors.textMuted }]}>
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
};

const bubbleStyles = StyleSheet.create({
  wrap: { marginBottom: 12, flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12 },
  wrapUser: { justifyContent: 'flex-end' },
  wrapAI: { justifyContent: 'flex-start' },
  avatar: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 8, borderWidth: 1, flexShrink: 0,
  },
  bubble: { maxWidth: SW * 0.72, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  text: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  time: { fontSize: 10, marginTop: 4 },
});

// ─── Listening animation ───────────────────────────────────────────────────────
function ListeningWave({ colors }) {
  const bars = [useRef(new Animated.Value(0.4)).current, useRef(new Animated.Value(0.4)).current, useRef(new Animated.Value(0.4)).current, useRef(new Animated.Value(0.4)).current, useRef(new Animated.Value(0.4)).current];
  useEffect(() => {
    bars.forEach((bar, i) => {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.delay(i * 80),
          Animated.timing(bar, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(bar, { toValue: 0.3, duration: 350, useNativeDriver: true }),
        ])
      );
      anim.start();
    });
  }, []);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: '#ef4444', transform: [{ scaleY: bar }] }}
        />
      ))}
    </View>
  );
}

// ─── Action chips ──────────────────────────────────────────────────────────────
function ActionChips({ lastAIMsg, onNavigate, onOpenMap, onStartAR, colors }) {
  if (!lastAIMsg || lastAIMsg.type !== 'ai') return null;
  const hasNav = lastAIMsg.action === 'navigate' && lastAIMsg.destination;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, paddingBottom: 8 }}>
      {hasNav && (
        <TouchableOpacity
          onPress={() => onNavigate(lastAIMsg.destination)}
          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#22c55e18', borderColor: '#22c55e40', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 }}>
          <Ionicons name="navigate" size={13} color="#22c55e" />
          <Text style={{ color: '#22c55e', fontWeight: '700', fontSize: 12, marginLeft: 5 }}>Navigate to {lastAIMsg.destination}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        onPress={onOpenMap}
        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 }}>
        <Ionicons name="map" size={13} color={colors.primary} />
        <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12, marginLeft: 5 }}>Open Map</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onStartAR}
        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 }}>
        <Ionicons name="camera" size={13} color="#f59e0b" />
        <Text style={{ color: '#f59e0b', fontWeight: '700', fontSize: 12, marginLeft: 5 }}>AR View</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main ChatbotOverlay ───────────────────────────────────────────────────────
export default function ChatbotOverlay({
  visible,
  onClose,
  onNavigate,
  onOpenMap,
  onStartAR,
  context = {},
  rooms = [],
}) {
  const { colors } = useContext(ThemeContext);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const listRef = useRef(null);
  const slideAnim = useRef(new Animated.Value(SH)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef(null);

  // ─ Animate in/out ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: SH, duration: 280, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
      stopSpeaking();
      setIsListening(false);
    }
  }, [visible]);

  const scrollToBottom = () => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const addMessage = useCallback((msg) => {
    setMessages(prev => [...prev, msg]);
    scrollToBottom();
  }, []);

  // ─ Handle text send ────────────────────────────────────────────────────────
  const handleSend = useCallback(async (text) => {
    const trimmed = (text || inputText).trim();
    if (!trimmed || isLoading) return;

    Keyboard.dismiss();
    setInputText('');
    setShowSuggestions(false);

    const userMsg = createMessage('user', trimmed);
    addMessage(userMsg);
    setIsLoading(true);

    try {
      const ctx = buildContext(context);
      const aiResp = await sendMessageToAI(trimmed, ctx);

      const aiMsg = createMessage('ai', aiResp.text, {
        action: aiResp.action,
        destination: aiResp.destination,
        isError: aiResp.isError,
      });
      addMessage(aiMsg);

      // TTS
      if (voiceEnabled && !aiResp.isError) speakResponse(aiResp.text);

      // Auto-navigate if AI detected intent and room is found
      if (aiResp.action === 'navigate' && aiResp.destination && onNavigate) {
        const matched = extractNavigationIntent(aiResp, rooms);
        if (matched?._id) {
          setTimeout(() => onNavigate(matched), 1200);
        }
      }
    } catch {
      addMessage(createMessage('ai', "Something went wrong. Try again!", { isError: true }));
    } finally {
      setIsLoading(false);
    }
  }, [inputText, isLoading, context, rooms, voiceEnabled, addMessage, onNavigate]);

  // ─ Voice input (Expo AudioRecording / fallback) ────────────────────────────
  const handleMicPress = useCallback(async () => {
    if (isListening) {
      setIsListening(false);
      // In a real implementation with expo-av or @react-native-voice/voice,
      // you'd stop recording here and send the transcript.
      // For now we show a prompt.
      addMessage(createMessage('system', '🎤 Voice input stopped. (Install @react-native-voice for full voice support)', {}));
    } else {
      setIsListening(true);
      stopSpeaking();
      // Simulated voice — in production use @react-native-voice/voice
      setTimeout(() => {
        setIsListening(false);
        // Prompt user to type since Voice module requires native setup
        inputRef.current?.focus();
      }, 3000);
    }
  }, [isListening, addMessage]);

  const lastAIMsg = [...messages].reverse().find(m => m.type === 'ai');

  const s = StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 998 },
    panel: {
      position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 999,
      height: SH * 0.78,
      backgroundColor: colors.bg,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      overflow: 'hidden',
    },
    handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    avatarWrap: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: '#6366f118', alignItems: 'center', justifyContent: 'center',
      borderWidth: 1.5, borderColor: '#6366f130', marginRight: 10,
    },
    headerTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.text },
    headerSub: { fontSize: 11, color: '#22c55e', fontWeight: '600' },
    messageList: { flex: 1, paddingTop: 12 },
    suggestions: {
      paddingHorizontal: 12, paddingBottom: 10,
    },
    suggesTitle: { fontSize: 11, color: colors.textMuted, fontWeight: '700', marginBottom: 8, paddingHorizontal: 2 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 14, paddingVertical: 8,
      backgroundColor: colors.card,
      borderWidth: 1, borderColor: colors.border,
      borderRadius: 20,
    },
    chipText: { fontSize: 12, fontWeight: '600', color: colors.textSec },
    inputRow: {
      flexDirection: 'row', alignItems: 'flex-end',
      paddingHorizontal: 12, paddingVertical: 10,
      borderTopWidth: 1, borderTopColor: colors.border,
      backgroundColor: colors.card, gap: 8,
    },
    textInput: {
      flex: 1, minHeight: 42, maxHeight: 100,
      backgroundColor: colors.surface,
      borderWidth: 1.5, borderColor: colors.border,
      borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10,
      fontSize: 14, color: colors.text,
    },
    iconBtn: {
      width: 42, height: 42, borderRadius: 21,
      alignItems: 'center', justifyContent: 'center',
    },
    sendBtn: { backgroundColor: '#6366f1' },
    micBtn: { backgroundColor: isListening ? '#ef444418' : colors.surface, borderWidth: 1, borderColor: isListening ? '#ef4444' : colors.border },
    listeningBar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      paddingVertical: 8, gap: 8, backgroundColor: '#ef444410',
    },
    typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginHorizontal: 2 },
  });

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <Animated.View style={[s.backdrop, { opacity: backdropAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      {/* Panel */}
      <Animated.View style={[s.panel, { transform: [{ translateY: slideAnim }] }]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>

          {/* Drag handle */}
          <View style={s.handle} />

          {/* Header */}
          <View style={s.header}>
            <View style={s.avatarWrap}>
              <Ionicons name="sparkles" size={18} color="#818cf8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.headerTitle}>NavX Assistant</Text>
              <Text style={s.headerSub}>● AI Powered · Gemini</Text>
            </View>
            <TouchableOpacity
              onPress={() => setVoiceEnabled(!voiceEnabled)}
              style={[s.iconBtn, { backgroundColor: voiceEnabled ? '#22c55e15' : colors.surface, borderWidth: 1, borderColor: voiceEnabled ? '#22c55e30' : colors.border }]}>
              <Ionicons name={voiceEnabled ? 'volume-high' : 'volume-mute'} size={18} color={voiceEnabled ? '#22c55e' : colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={[s.iconBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginLeft: 6 }]}>
              <Ionicons name="close" size={20} color={colors.textSec} />
            </TouchableOpacity>
          </View>

          {/* Listening indicator */}
          {isListening && (
            <View style={s.listeningBar}>
              <ListeningWave colors={colors} />
              <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '700' }}>Listening…</Text>
            </View>
          )}

          {/* Messages */}
          <FlatList
            ref={listRef}
            data={messages}
            style={s.messageList}
            keyExtractor={m => m.id}
            renderItem={({ item }) => <Bubble msg={item} colors={colors} />}
            onContentSizeChange={scrollToBottom}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={() => (
              <>
                {isLoading && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8, gap: 8 }}>
                    <View style={[s.avatarWrap, { width: 28, height: 28 }]}>
                      <Ionicons name="sparkles" size={13} color="#818cf8" />
                    </View>
                    <View style={{ backgroundColor: colors.card, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: colors.border }}>
                      <ActivityIndicator size="small" color={colors.primary} />
                    </View>
                  </View>
                )}
                {/* Action chips */}
                <ActionChips
                  lastAIMsg={lastAIMsg}
                  onNavigate={dest => {
                    const matched = extractNavigationIntent({ action: 'navigate', destination: dest }, rooms);
                    onNavigate?.(matched || { name: dest });
                  }}
                  onOpenMap={onOpenMap}
                  onStartAR={onStartAR}
                  colors={colors}
                />
                {/* Quick Suggestions */}
                {showSuggestions && messages.length <= 2 && (
                  <View style={s.suggestions}>
                    <Text style={s.suggesTitle}>QUICK ACTIONS</Text>
                    <View style={s.chipRow}>
                      {QUICK_SUGGESTIONS.map((s, i) => (
                        <TouchableOpacity key={i} style={s} onPress={() => handleSend(s.message)}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSec }}>{s.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}
          />

          {/* Input */}
          <View style={s.inputRow}>
            <TouchableOpacity style={[s.iconBtn, s.micBtn]} onPress={handleMicPress}>
              <Ionicons name={isListening ? 'stop-circle' : 'mic'} size={20} color={isListening ? '#ef4444' : colors.textSec} />
            </TouchableOpacity>
            <TextInput
              ref={inputRef}
              style={s.textInput}
              placeholder="Ask me anything…"
              placeholderTextColor={colors.textMuted}
              value={inputText}
              onChangeText={setInputText}
              multiline
              returnKeyType="send"
              onSubmitEditing={() => handleSend()}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[s.iconBtn, s.sendBtn, (!inputText.trim() || isLoading) && { opacity: 0.5 }]}
              onPress={() => handleSend()}
              disabled={!inputText.trim() || isLoading}>
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </>
  );
}
