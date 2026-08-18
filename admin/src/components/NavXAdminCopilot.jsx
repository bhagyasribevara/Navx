/**
 * NavX Admin Copilot AI — Premium Floating Dashboard Advisor
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAdminPageContext } from './AdminPageContext';
import './NavXAdminCopilot.css';

// ─── Icons ───────────────────────────────────────────────────────────────
const SparklesIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" />
  </svg>
);
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

const API_BASE = '/api';

function renderMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^• /gm, '• ')
    .replace(/\n/g, '<br/>');
}

export default function NavXAdminCopilot({ admin }) {
  const { pageContext } = useAdminPageContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [sessionId] = useState(() => 'admin_copilot_' + Math.random().toString(36).substring(2, 10));

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


  useEffect(() => {
    // Fetch chat history
    if (admin && (admin._id || admin.id)) {
      const adminId = admin._id || admin.id;
      axios.get(`${API_BASE}/adminAi/chat/history?adminId=${adminId}`)
        .then(res => {
          if (res.data.history && res.data.history.length > 0) {
            const loadedMessages = [];
            let idCounter = Date.now();
            res.data.history.forEach(item => {
              if (item.role === 'user') {
                const text = item.parts.find(p => p.text)?.text || '';
                const inlineData = item.parts.find(p => p.inlineData)?.inlineData;
                let img = null;
                if (inlineData) {
                  img = `data:${inlineData.mimeType};base64,${inlineData.data}`;
                }
                loadedMessages.push({
                  id: idCounter++,
                  role: 'user',
                  text: text,
                  image: img,
                  timestamp: new Date()
                });
              } else if (item.role === 'model') {
                const textPart = item.parts.find(p => p.text)?.text || '{}';
                try {
                  const parsed = JSON.parse(textPart);
                  loadedMessages.push({
                    id: idCounter++,
                    role: 'ai',
                    text: parsed.text || '',
                    proposedAction: parsed.proposedAction || null,
                    timestamp: new Date()
                  });
                } catch {
                  loadedMessages.push({
                    id: idCounter++,
                    role: 'ai',
                    text: textPart,
                    timestamp: new Date()
                  });
                }
              }
            });
            setMessages(loadedMessages);
          }
        })
        .catch(err => {
          // Gracefully fallback when chat history is empty or endpoint is uninitialized
          if (err.response?.status !== 404) {
            console.warn("Notice fetching chat history:", err.message);
          }
        });
    }
  }, [admin]);

  // Ensure only authenticated admins can use this component
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
        adminData: {
          id: admin._id || admin.id,
          role: admin.role,
          campusId: admin.campusId?._id || admin.campusId,
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

  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support Speech Recognition. Please try Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    // Omit setting lang to allow the browser to auto-detect based on user's system 
    // or use its multi-lingual capabilities. Alternatively, "en-IN" works well for mixed english/hindi/telugu in Chrome.
    recognition.lang = 'en-IN'; 

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev + (prev ? ' ' : '') + transcript);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const clearChat = async () => {
    if (window.confirm("Are you sure you want to clear chat history? This will delete it from the database permanently to free up space.")) {
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

  const executeProposedAction = async (action) => {
    try {
      setIsLoading(true);
      const res = await axios.post(`${API_BASE}/adminAi/execute`, {
        action,
        adminData: {
          role: admin.role,
          campusId: admin.campusId?._id || admin.campusId,
        }
      });
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'ai',
        text: res.data.message || 'Action executed successfully.',
        image: res.data.image || null,
        timestamp: new Date()
      }]);
      
      if (res.data.refreshMap) {
        window.dispatchEvent(new CustomEvent('navx-map-refresh', {
          detail: { blockId: res.data.blockId, floorId: res.data.floorId }
        }));
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

  const formatActionPayload = (payload) => {
    return Object.entries(payload).map(([k, v]) => `• ${k}: ${v}`).join('\n');
  };

  return (
    <div className="navx-admin-copilot">
      {!isOpen && (
        <button className="copilot-fab" onClick={handleOpen} title="NavX Admin Copilot">
          <SparklesIcon />
        </button>
      )}

      {isOpen && (
        <div className={`copilot-window ${isClosing ? 'closing' : ''}`}>
          <div className="copilot-header">
            <div className="copilot-header-icon"><SparklesIcon /></div>
            <div className="copilot-header-info">
              <div className="copilot-header-title">Admin Copilot</div>
              <div className="copilot-header-status">
                {pageContext.pageName ? `Analyzing: ${pageContext.pageName}` : 'Ready to assist'}
              </div>
            </div>
            <div className="copilot-header-actions">
              <button className="copilot-header-btn" onClick={clearChat} title="Clear Chat">
                <TrashIcon />
              </button>
              <button className="copilot-header-btn" onClick={handleClose} title="Close">
                <CloseIcon />
              </button>
            </div>
          </div>

          <div className="copilot-messages">
            {messages.length === 0 ? (
              <div className="copilot-welcome">
                <div className="copilot-welcome-icon"><SparklesIcon /></div>
                <h3>Admin Assistant</h3>
                <p>I can analyze this dashboard, suggest improvements, and manage campus events. Try asking:</p>
                <div className="copilot-quick-prompts">
                  <button onClick={() => handleSendMessage('What does this chart mean?')}>What does this chart mean?</button>
                  <button onClick={() => handleSendMessage('How can I improve this page?')}>How can I improve this page?</button>
                  <button onClick={() => handleSendMessage('Generate an executive summary')}>Generate an executive summary</button>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`copilot-message ${msg.role}`}>
                  <div className="copilot-msg-avatar">{msg.role === 'ai' ? <SparklesIcon /> : 'A'}</div>
                  <div className="copilot-msg-content">
                    {msg.image && (
                      <div className="copilot-msg-image">
                        <img src={msg.image} alt="User Upload" style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: '8px' }} />
                      </div>
                    )}
                    {msg.text && (
                      <div className="copilot-msg-bubble" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }} />
                    )}
                    
                    {msg.proposedAction && (
                      <div className="copilot-action-card">
                        <div className="copilot-action-title">Proposed Action: {msg.proposedAction.type}</div>
                        <div className="copilot-action-payload">
                          {formatActionPayload(msg.proposedAction.payload)}
                        </div>
                        <button className="copilot-confirm-btn" onClick={() => executeProposedAction(msg.proposedAction)}>
                          Confirm & Execute
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            
            {isLoading && (
              <div className="copilot-typing">
                <div className="copilot-typing-dot" />
                <div className="copilot-typing-dot" />
                <div className="copilot-typing-dot" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

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
              <button className="copilot-attach-btn" onClick={() => fileInputRef.current?.click()} disabled={isLoading} title="Attach Image">
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
                title={isListening ? "Listening..." : "Click to speak"}
              >
                <MicIcon />
              </button>
              <input
                ref={inputRef}
                className="copilot-input"
                type="text"
                placeholder="Ask Copilot about this dashboard... (paste images here)"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                disabled={isLoading}
              />
              <button className="copilot-send-btn" onClick={() => handleSendMessage()} disabled={(!input.trim() && !selectedImage) || isLoading}>
                <SendIcon />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
