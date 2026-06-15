/**
 * NavX AI Chat — Premium Floating Chatbot Component
 * A glassmorphism-styled AI assistant widget for the NavX admin panel.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import './NavXAIChat.css';

// ─── Icons (inline SVGs to avoid extra dependencies) ────────────────────────
const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const ChatIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const MicIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

const MicOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="1" y1="1" x2="23" y2="23" /><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17" />
    <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

// ─── Default Chips ──────────────────────────────────────────────────────────
const DEFAULT_CHIPS = [
  { label: '📍 Find Library', query: 'Where is the library?' },
  { label: '🍽️ Cafeteria', query: 'Take me to the cafeteria' },
  { label: '🚻 Washroom', query: 'Where is the nearest washroom?' },
  { label: '🅿️ Parking', query: 'Where is the parking area?' },
  { label: '🎉 Events', query: 'Any events happening nearby?' },
  { label: '🤝 Live Meet', query: 'How does Live Meet work?' },
  { label: '🎯 Navigate', query: 'How do I navigate inside campus?' },
  { label: '♿ Access', query: 'Show me accessible routes' },
  { label: '🚨 Emergency', query: 'Where is the nearest emergency exit?' },
];

// ─── API Base ───────────────────────────────────────────────────────────────
const API_BASE = '/api';

// ─── Simple Markdown Renderer ───────────────────────────────────────────────
function renderMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^• /gm, '• ')
    .replace(/\n/g, '<br/>');
}

// ─── Format Time ────────────────────────────────────────────────────────────
function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════
export default function NavXAIChat({ campusId, campusName }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('navx_ai_dark_mode');
    return saved ? JSON.parse(saved) : true; // Default to dark mode
  });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sessionId] = useState(() => 'admin_' + Math.random().toString(36).substring(2, 10));
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [chips, setChips] = useState(DEFAULT_CHIPS);
  const [isRecording, setIsRecording] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  // ─── Auto-scroll to bottom ────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  // ─── Save dark mode preference ────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('navx_ai_dark_mode', JSON.stringify(darkMode));
  }, [darkMode]);

  // ─── Load session from sessionStorage ─────────────────────────────────
  useEffect(() => {
    const saved = sessionStorage.getItem('navx_ai_messages');
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  // ─── Save messages to sessionStorage ──────────────────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem('navx_ai_messages', JSON.stringify(messages));
    }
  }, [messages]);

  // ─── Initialize Speech Recognition ───────────────────────────────────
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-IN'; // Supports English, Hindi, Telugu mix

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsRecording(false);
        // Auto-send after voice input
        setTimeout(() => {
          handleSendMessage(transcript);
        }, 300);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // ─── Open/Close Handlers ──────────────────────────────────────────────
  const handleOpen = () => {
    setIsOpen(true);
    setIsClosing(false);
    setHasNewMessage(false);
    setTimeout(() => inputRef.current?.focus(), 400);
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
    }, 300);
  };

  // ─── Send Message ─────────────────────────────────────────────────────
  const handleSendMessage = async (overrideMessage) => {
    const msg = overrideMessage || input.trim();
    if (!msg || isLoading) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      text: msg,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${API_BASE}/ai/chat`, {
        message: msg,
        sessionId,
        campusId: campusId || undefined,
        context: {
          source: 'admin_panel',
          campusName: campusName || undefined,
        },
      });

      const data = response.data;

      const aiMessage = {
        id: Date.now() + 1,
        role: 'ai',
        text: data.text || "I'm here to help! What would you like to know about the campus?",
        action: data.action,
        destination: data.destination,
        suggestions: data.suggestions || [],
        language: data.language,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);

      // Update chips based on AI suggestions
      if (data.suggestions && data.suggestions.length > 0) {
        setChips(data.suggestions.map(s => ({
          label: s,
          query: s,
        })));
      }

      if (!isOpen) {
        setHasNewMessage(true);
      }
    } catch (err) {
      console.error('AI Chat error:', err);
      setError(err.response?.data?.text || 'Failed to connect. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Handle Key Press ─────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ─── Handle Chip Click ───────────────────────────────────────────────
  const handleChipClick = (query) => {
    setInput(query);
    handleSendMessage(query);
  };

  // ─── Handle Voice ─────────────────────────────────────────────────────
  const toggleVoice = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in your browser.');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  // ─── Clear Chat ───────────────────────────────────────────────────────
  const clearChat = async () => {
    setMessages([]);
    sessionStorage.removeItem('navx_ai_messages');
    try {
      await axios.delete(`${API_BASE}/ai/chat/${sessionId}`);
    } catch (e) {}
  };

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className={`navx-ai-chat ${darkMode ? 'dark-mode' : ''}`}>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          className={`navx-ai-fab ${isOpen ? 'open' : ''}`}
          onClick={handleOpen}
          title="NavX AI Assistant"
          id="navx-ai-fab"
        >
          <ChatIcon />
          {hasNewMessage && <div className="navx-ai-fab-badge" />}
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className={`navx-ai-chat-window ${isClosing ? 'closing' : ''}`}>
          {/* Header */}
          <div className="navx-ai-header">
            <div className="navx-ai-avatar">N</div>
            <div className="navx-ai-header-info">
              <div className="navx-ai-header-title">NavX AI</div>
              <div className="navx-ai-header-status">
                <span className="navx-ai-status-dot" />
                Campus Navigation Expert
              </div>
            </div>
            <div className="navx-ai-header-actions">
              <button
                className="navx-ai-header-btn"
                onClick={() => setDarkMode(!darkMode)}
                title={darkMode ? 'Light Mode' : 'Dark Mode'}
              >
                {darkMode ? <SunIcon /> : <MoonIcon />}
              </button>
              <button
                className="navx-ai-header-btn"
                onClick={clearChat}
                title="Clear Chat"
              >
                <TrashIcon />
              </button>
              <button
                className="navx-ai-header-btn"
                onClick={handleClose}
                title="Close"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="navx-ai-messages">
            {messages.length === 0 ? (
              <WelcomeScreen onChipClick={handleChipClick} />
            ) : (
              <>
                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    onSuggestionClick={handleChipClick}
                  />
                ))}
              </>
            )}

            {/* Typing Indicator */}
            {isLoading && (
              <div className="navx-ai-typing">
                <div className="navx-ai-msg-avatar" style={{
                  background: 'linear-gradient(135deg, #6366f1, #7c3aed)',
                  color: 'white',
                  width: 30, height: 30, borderRadius: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700
                }}>N</div>
                <div className="navx-ai-typing-bubble">
                  <div className="navx-ai-typing-dot" />
                  <div className="navx-ai-typing-dot" />
                  <div className="navx-ai-typing-dot" />
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="navx-ai-error">
                ⚠️ {error}
                <button onClick={() => { setError(null); handleSendMessage(messages[messages.length - 1]?.text); }}>
                  Retry
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Chips */}
          {messages.length > 0 && !isLoading && (
            <div className="navx-ai-chips">
              {chips.slice(0, 5).map((chip, i) => (
                <button
                  key={i}
                  className="navx-ai-chip"
                  onClick={() => handleChipClick(chip.query)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}

          {/* Input Area */}
          <div className="navx-ai-input-area">
            <button
              className={`navx-ai-voice-btn ${isRecording ? 'recording' : ''}`}
              onClick={toggleVoice}
              title={isRecording ? 'Stop Recording' : 'Voice Input'}
            >
              {isRecording ? <MicOffIcon /> : <MicIcon />}
            </button>
            <div className="navx-ai-input-wrapper">
              <input
                ref={inputRef}
                className="navx-ai-input"
                type="text"
                placeholder={isRecording ? '🎙️ Listening...' : 'Ask me anything about campus...'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading || isRecording}
                id="navx-ai-input"
              />
            </div>
            <button
              className="navx-ai-send-btn"
              onClick={() => handleSendMessage()}
              disabled={!input.trim() || isLoading}
              title="Send"
              id="navx-ai-send"
            >
              <SendIcon />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Welcome Screen
// ═══════════════════════════════════════════════════════════════════════════
function WelcomeScreen({ onChipClick }) {
  return (
    <div className="navx-ai-welcome">
      <div className="navx-ai-welcome-icon">N</div>
      <h3>Welcome to NavX AI</h3>
      <p>
        I'm your smart campus navigation assistant. Ask me about locations, routes, events, or any campus facility!
      </p>
      <div className="navx-ai-welcome-chips">
        {DEFAULT_CHIPS.slice(0, 6).map((chip, i) => (
          <button
            key={i}
            className="navx-ai-chip"
            onClick={() => onChipClick(chip.query)}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Message Bubble
// ═══════════════════════════════════════════════════════════════════════════
function MessageBubble({ message, onSuggestionClick }) {
  const { role, text, action, destination, suggestions, timestamp } = message;

  return (
    <div className={`navx-ai-message ${role}`}>
      <div className="navx-ai-msg-avatar">
        {role === 'ai' ? 'N' : '👤'}
      </div>
      <div className="navx-ai-msg-content">
        <div
          className="navx-ai-msg-bubble"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
        />

        {/* Action Button (for navigation responses) */}
        {role === 'ai' && action === 'navigate' && destination && (
          <div className="navx-ai-msg-actions">
            <button
              className="navx-ai-action-btn"
              onClick={() => onSuggestionClick(`Navigate to ${destination}`)}
            >
              🎯 Navigate to {destination}
            </button>
          </div>
        )}

        {role === 'ai' && action === 'emergency' && (
          <div className="navx-ai-msg-actions">
            <button
              className="navx-ai-action-btn"
              onClick={() => onSuggestionClick('Show nearest emergency exit')}
              style={{ borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444', background: 'rgba(239, 68, 68, 0.08)' }}
            >
              🚨 Nearest Exit
            </button>
            <button
              className="navx-ai-action-btn"
              onClick={() => onSuggestionClick('Where is the medical room?')}
              style={{ borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444', background: 'rgba(239, 68, 68, 0.08)' }}
            >
              🏥 Medical Room
            </button>
          </div>
        )}

        {/* Inline Suggestions */}
        {role === 'ai' && suggestions && suggestions.length > 0 && (
          <div className="navx-ai-inline-suggestions">
            {suggestions.slice(0, 3).map((s, i) => (
              <button
                key={i}
                className="navx-ai-inline-chip"
                onClick={() => onSuggestionClick(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="navx-ai-msg-time">
          {formatTime(timestamp)}
        </div>
      </div>
    </div>
  );
}
