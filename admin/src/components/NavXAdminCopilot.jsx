/**
 * NavX Admin Copilot AI — Autonomous Dashboard & Campus Advisor
 * Features:
 * - 3D NavX AI Robot Icon (identical to User Home Screen)
 * - Persistent MongoDB Chat History via CopilotChat
 * - Multi-Language Support (English, Telugu, Hindi) with Speech Recognition
 * - Explicit Plan Review (Understanding, Accept & Reject buttons)
 * - Real React Router Workspace Navigation
 * - Sleek Modern Dark Glassmorphic Theme
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAdminPageContext } from './AdminPageContext';
import './NavXAdminCopilot.css';

// ─── Icons ───────────────────────────────────────────────────────────────
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);
const ImageIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline>
  </svg>
);
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);
const MicIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
    <line x1="12" y1="19" x2="12" y2="23"></line>
    <line x1="8" y1="23" x2="16" y2="23"></line>
  </svg>
);
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const API_BASE = '/api';

function renderMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/### (.*?)\n/g, '<h4 class="copilot-md-h4">$1</h4>')
    .replace(/## (.*?)\n/g, '<h3 class="copilot-md-h3">$1</h3>')
    .replace(/# (.*?)\n/g, '<h2 class="copilot-md-h2">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="copilot-inline-code">$1</code>')
    .replace(/^• /gm, '• ')
    .replace(/\n/g, '<br/>');
}

export default function NavXAdminCopilot({ admin }) {
  const { pageContext } = useAdminPageContext();
  const navigate = useNavigate();
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    return localStorage.getItem('navx_admin_copilot_lang') || 'auto';
  });

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [messages, isLoading]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  // Load chat history from MongoDB CopilotChat
  useEffect(() => {
    if (admin && (admin._id || admin.id)) {
      const adminId = admin._id || admin.id;
      axios.get(`${API_BASE}/adminAi/chat/history?adminId=${adminId}`)
        .then(res => {
          if (res.data?.success && Array.isArray(res.data.history) && res.data.history.length > 0) {
            const loaded = res.data.history.map((item, idx) => {
              const role = (item.role === 'model' || item.role === 'ai') ? 'ai' : 'user';
              let text = item.text || '';
              if (!text && item.parts && Array.isArray(item.parts)) {
                text = item.parts.find(p => p.text)?.text || '';
              }
              return {
                id: item._id || item.id || `msg_${idx}_${Date.now()}`,
                role,
                text,
                image: item.image || null,
                proposedAction: item.proposedAction || null,
                actionStatus: item.actionStatus || (item.proposedAction ? 'pending' : null),
                timestamp: item.timestamp ? new Date(item.timestamp) : new Date()
              };
            });
            setMessages(loaded);
          }
        })
        .catch(err => {
          if (err.response?.status !== 404) {
            console.warn("Notice fetching admin copilot chat history:", err.message);
          }
        });
    }
  }, [admin]);

  const handleLanguageChange = (lang) => {
    setSelectedLanguage(lang);
    localStorage.setItem('navx_admin_copilot_lang', lang);
  };

  if (!admin) return null;

  const handleOpen = () => {
    setIsOpen(true);
    setIsClosing(false);
    setTimeout(() => inputRef.current?.focus(), 400);
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
    }, 300);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendMessage = async (overrideMessage) => {
    const msg = overrideMessage || input.trim();
    if ((!msg && !selectedImage) || isLoading) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      text: msg,
      image: selectedImage,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    const imageToSend = selectedImage;
    clearImage();
    setIsLoading(true);

    try {
      const response = await axios.post(`${API_BASE}/adminAi/chat`, {
        message: msg,
        image: imageToSend,
        language: selectedLanguage,
        adminData: {
          id: admin._id || admin.id,
          role: admin.role,
          campusId: admin.campusId?._id || admin.campusId || admin.campus?._id,
          campusName: admin.campus?.campusName || admin.campus?.name,
        },
        pageContext,
      });

      const data = response.data;
      const aiMessage = {
        id: Date.now() + 1,
        role: 'ai',
        text: data.text || "I processed your request.",
        proposedAction: data.proposedAction || null,
        actionStatus: data.proposedAction ? 'pending' : null,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      console.error('Admin Copilot error:', err);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'ai',
        text: 'Failed to connect to the Admin AI backend. Error: ' + (err.response?.data?.error || err.message),
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        const reader = new FileReader();
        reader.onloadend = () => setSelectedImage(reader.result);
        reader.readAsDataURL(file);
        e.preventDefault();
        break;
      }
    }
  };

  // Speech Recognition with multi-lingual support
  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support Speech Recognition. Please use Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    // Set recognition language based on active selection
    if (selectedLanguage === 'te') {
      recognition.lang = 'te-IN';
    } else if (selectedLanguage === 'hi') {
      recognition.lang = 'hi-IN';
    } else if (selectedLanguage === 'en') {
      recognition.lang = 'en-US';
    } else {
      recognition.lang = 'en-IN'; // Default Indian English / Multilingual recognition
    }

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev + (prev ? ' ' : '') + transcript);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  // Clear Chat History from State and MongoDB
  const clearChat = async () => {
    if (window.confirm("Are you sure you want to clear your chat history? This will remove all previous conversations from the database.")) {
      setMessages([]);
      if (admin && (admin._id || admin.id)) {
        try {
          const adminId = admin._id || admin.id;
          await axios.delete(`${API_BASE}/adminAi/chat`, { data: { adminId } });
        } catch (err) {
          console.error("Failed to delete chat history:", err);
        }
      }
    }
  };

  // ─── Plan Execution: Accept & Execute ────────────────────────────────────
  const handleAcceptPlan = async (msgId, action) => {
    try {
      setIsLoading(true);
      // Mark action as accepted locally
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, actionStatus: 'accepted' } : m));

      const res = await axios.post(`${API_BASE}/adminAi/execute`, {
        action,
        adminData: {
          id: admin._id || admin.id,
          role: admin.role,
          campusId: admin.campusId?._id || admin.campusId || admin.campus?._id,
        }
      });

      // Post execution outcome bubble
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'ai',
        text: res.data.message || 'Plan executed successfully.',
        timestamp: new Date()
      }]);

      if (res.data.refreshMap) {
        window.dispatchEvent(new CustomEvent('navx-map-refresh', {
          detail: { blockId: res.data.payload?.blockId, campusId: res.data.payload?.campusId }
        }));
      }

      // Router Navigation Guard & Routing
      const pathParts = location.pathname.split('/').filter(Boolean);
      const isCampusWorkspace = pathParts[0] === 'campus' && pathParts.length >= 2;
      const campusCode = isCampusWorkspace ? pathParts[1] : (admin.campus?.campusCode || admin.campusCode);
      const campusId = action.payload?.campusId || admin.campusId?._id || admin.campusId || admin.campus?._id;

      if (action.type === 'OPEN_MAP_EDITOR' || action.type === 'NAVIGATE_TO_EDITOR') {
        if (isCampusWorkspace && campusCode) {
          navigate(`/campus/${campusCode}/editor/${campusId}`);
        } else if (campusId) {
          navigate(`/editor/${campusId}`);
        }
      } else if (action.type === 'OPEN_VENUE_MANAGER') {
        if (isCampusWorkspace && campusCode) {
          navigate(`/campus/${campusCode}/venues`);
        } else {
          navigate('/campus');
        }
      } else if (action.type === 'OPEN_CAMPAIGNS') {
        if (isCampusWorkspace && campusCode) {
          navigate(`/campus/${campusCode}/campaigns`);
        } else {
          navigate('/campaigns');
        }
      } else if (action.type === 'OPEN_FACULTY') {
        if (isCampusWorkspace && campusCode) {
          navigate(`/campus/${campusCode}/faculty`);
        }
      } else if (action.type === 'OPEN_TIMETABLE') {
        if (isCampusWorkspace && campusCode) {
          navigate(`/campus/${campusCode}/timetable`);
        }
      }

    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'ai',
        text: 'Action execution failed: ' + (err.response?.data?.error || err.message),
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Plan Execution: Reject / Cancel ─────────────────────────────────────
  const handleRejectPlan = (msgId, action) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, actionStatus: 'rejected' } : m));
    setMessages(prev => [...prev, {
      id: Date.now(),
      role: 'ai',
      text: `❌ **Plan Cancelled**: The proposed action **"${action.title || action.type}"** was rejected. No changes were made to the database. How else can I assist you?`,
      timestamp: new Date()
    }]);
  };

  const formatActionPayload = (payload) => {
    if (!payload || typeof payload !== 'object') return null;
    return Object.entries(payload)
      .filter(([k]) => k !== 'campusId' && k !== 'startDate' && k !== 'endDate')
      .map(([k, v]) => `• ${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`)
      .join('\n');
  };

  return (
    <div className="navx-admin-copilot">
      {/* Floating Action Button (FAB) featuring the 3D NavX AI Robot */}
      {!isOpen && (
        <button 
          className="copilot-fab" 
          onClick={handleOpen} 
          title="Open NavX Admin Copilot"
          aria-label="NavX Admin Copilot"
        >
          <div className="copilot-fab-glow" />
          <img 
            src="/navx_ai_logo.png" 
            alt="NavX AI" 
            className="copilot-fab-img" 
          />
        </button>
      )}

      {/* Copilot Modal Window */}
      {isOpen && (
        <div className={`copilot-window ${isClosing ? 'closing' : ''}`}>
          {/* Header */}
          <div className="copilot-header">
            <div className="copilot-header-avatar">
              <img src="/navx_ai_logo.png" alt="NavX AI Logo" />
            </div>
            <div className="copilot-header-info">
              <div className="copilot-header-title-row">
                <span className="copilot-header-title">NavX Copilot</span>
                <span className="copilot-badge">AI 2.0</span>
              </div>
              <div className="copilot-header-status">
                {pageContext?.title ? `Context: ${pageContext.title}` : 'Ready to assist'}
              </div>
            </div>

            {/* Language Selector */}
            <div className="copilot-lang-selector" title="Switch Language">
              <select 
                value={selectedLanguage} 
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="copilot-lang-select"
              >
                <option value="auto">🌐 Auto</option>
                <option value="en">🇺🇸 EN</option>
                <option value="te">🇮🇳 తెలుగు</option>
                <option value="hi">🇮🇳 हिंदी</option>
              </select>
            </div>

            <div className="copilot-header-actions">
              <button className="copilot-header-btn" onClick={clearChat} title="Clear Chat History">
                <TrashIcon />
              </button>
              <button className="copilot-header-btn" onClick={handleClose} title="Close">
                <CloseIcon />
              </button>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="copilot-messages">
            {messages.length === 0 ? (
              <div className="copilot-welcome">
                <div className="copilot-welcome-avatar">
                  <img src="/navx_ai_logo.png" alt="NavX AI" />
                </div>
                <h3>Welcome to NavX Copilot</h3>
                <p>
                  I am your autonomous campus administration assistant. I can inspect pages, create campaigns, guide map editing, and optimize schedules.
                </p>

                <div className="copilot-quick-prompts">
                  <button onClick={() => handleSendMessage('Create a campaign named Annual Sports Day on 20-09-2026 to 25-09-2026 at Ground')}>
                    📢 <strong>Create Campaign:</strong> Annual Sports Day
                  </button>
                  <button onClick={() => handleSendMessage('How do I add a new room or edit the 3D map?')}>
                    🗺️ <strong>3D Map Guidance:</strong> How to add a room
                  </button>
                  <button onClick={() => handleSendMessage('Generate an Entry QR Code for this campus')}>
                    📱 <strong>QR Codes:</strong> Generate campus QR code
                  </button>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`copilot-message ${msg.role}`}>
                  <div className="copilot-msg-avatar">
                    {msg.role === 'ai' ? (
                      <img src="/navx_ai_logo.png" alt="NavX AI" />
                    ) : (
                      'A'
                    )}
                  </div>
                  <div className="copilot-msg-content">
                    {msg.image && (
                      <div className="copilot-msg-image">
                        <img src={msg.image} alt="Upload" />
                      </div>
                    )}
                    {msg.text && (
                      <div 
                        className="copilot-msg-bubble" 
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }} 
                      />
                    )}

                    {/* Proposed Plan Card with Admin Permission Controls */}
                    {msg.proposedAction && (
                      <div className={`copilot-action-card ${msg.actionStatus || 'pending'}`}>
                        <div className="copilot-action-header">
                          <span className="copilot-action-badge">ACTION PLAN</span>
                          <span className="copilot-action-title">
                            {msg.proposedAction.title || msg.proposedAction.type}
                          </span>
                        </div>

                        {/* Plan Understanding / Explanation */}
                        {msg.proposedAction.understanding && (
                          <div className="copilot-action-understanding">
                            <strong>Understanding:</strong> {msg.proposedAction.understanding}
                          </div>
                        )}

                        {/* Payload Parameters */}
                        {msg.proposedAction.payload && (
                          <div className="copilot-action-payload">
                            {formatActionPayload(msg.proposedAction.payload)}
                          </div>
                        )}

                        {/* Accept & Reject Action Buttons */}
                        {msg.actionStatus === 'pending' || !msg.actionStatus ? (
                          <div className="copilot-action-buttons">
                            <button 
                              className="copilot-accept-btn" 
                              onClick={() => handleAcceptPlan(msg.id, msg.proposedAction)}
                              title="Confirm and execute this plan"
                            >
                              <CheckIcon /> Accept & Execute
                            </button>
                            <button 
                              className="copilot-reject-btn" 
                              onClick={() => handleRejectPlan(msg.id, msg.proposedAction)}
                              title="Reject and cancel this plan"
                            >
                              <XIcon /> Reject / Cancel
                            </button>
                          </div>
                        ) : msg.actionStatus === 'accepted' ? (
                          <div className="copilot-plan-status accepted">
                            <CheckIcon /> Plan Approved & Executed
                          </div>
                        ) : (
                          <div className="copilot-plan-status rejected">
                            <XIcon /> Plan Rejected by Admin
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {isLoading && (
              <div className="copilot-typing-wrapper">
                <div className="copilot-msg-avatar">
                  <img src="/navx_ai_logo.png" alt="NavX AI" />
                </div>
                <div className="copilot-typing">
                  <div className="copilot-typing-dot" />
                  <div className="copilot-typing-dot" />
                  <div className="copilot-typing-dot" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="copilot-input-container">
            {selectedImage && (
              <div className="copilot-image-preview">
                <img src={selectedImage} alt="Preview" />
                <button className="copilot-image-preview-close" onClick={clearImage}>
                  <CloseIcon />
                </button>
              </div>
            )}
            <div className="copilot-input-area">
              <button 
                className="copilot-attach-btn" 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isLoading} 
                title="Attach Image / Screenshot"
              >
                <ImageIcon />
              </button>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleImageChange}
              />

              <button 
                className={`copilot-mic-btn ${isListening ? 'listening' : ''}`} 
                onClick={toggleListening} 
                disabled={isLoading} 
                title={isListening ? "Listening... Click to stop" : "Voice Input (Speech to Text)"}
              >
                <MicIcon />
              </button>

              <input
                ref={inputRef}
                className="copilot-input"
                type="text"
                placeholder={
                  selectedLanguage === 'te' 
                    ? "మీ ప్రశ్నను ఇక్కడ టైప్ చేయండి..." 
                    : selectedLanguage === 'hi' 
                    ? "अपना प्रश्न यहाँ लिखें..." 
                    : "Ask Copilot... (English, తెలుగు, हिंदी)"
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                disabled={isLoading}
              />

              <button 
                className="copilot-send-btn" 
                onClick={() => handleSendMessage()} 
                disabled={(!input.trim() && !selectedImage) || isLoading}
                title="Send Message"
              >
                <SendIcon />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
