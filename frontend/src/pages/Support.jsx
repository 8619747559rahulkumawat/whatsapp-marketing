import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import API from '../utils/api';
import { connectSocket } from '../utils/socket';
import { useAuth } from '../contexts/AuthContext';
import { FaWhatsapp, FaPaperPlane, FaSmile, FaPaperclip, FaTimes, FaDownload, FaArrowLeft, FaUserCircle } from 'react-icons/fa';

const EMOJIS = ['😊','👍','❤️','😂','🔥','🎉','🙏','😍','🤣','💀','😎','🥳','😅','🤔','👌','✌️','💪','🤝','😭','🥺','😤','🤩','😱','🤗','😴','🤪','😈','💩','👻','👋','🙌','🤲','💯','✅','❌','⭐','🌈','🎯','🔥','💀','👑','🚀','💰','📱','💻','📞','✉️','📷','🎬','🏆','🥇','💎','😡','🥶','🤡','💔','🗿','✨','🕊️','🔴','🟢','🔵','🟡'];
const STICKERS = ['👍', '❤️', '😂', '😍', '🔥', '🎉', '🙏', '💀','😎', '🥳', '🤔', '👌', '💪', '🤝', '😭', '🥺','😤', '🤩', '😱', '🤗', '😴', '🤪', '😈', '💩','👻', '👋', '🙌', '🤲', '💯', '✅', '❌', '⭐'];

export default function Support() {
  const { user } = useAuth();
  const isClient = user?.role !== 'admin' && user?.role !== 'super_admin';
  if (isClient) return <ClientChat user={user} />;
  return <AdminSupport />;
}

function formatFileSize(url) {
  if (!url) return '';
  return (url.split('/').pop() || 'File').length > 20 ? url.split('/').pop().slice(0, 17) + '...' : url.split('/').pop();
}

function ClientChat({ user }) {
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [loading, setLoading] = useState(true);
  const chatEndRef = useRef(null);
  const emojiRef = useRef(null);
  const fileInputRef = useRef(null);

  const fetchMessages = useCallback(async () => {
    try {
      const { data } = await API.get('/chat/support', { timeout: 10000 });
      if (data.success) {
        setMessages(prev => {
          const existing = new Map(prev.map(m => [m._id, m]));
          for (const msg of data.messages) {
            if (!existing.has(msg._id)) existing.set(msg._id, msg);
          }
          return [...existing.values()];
        });
        const adminMsg = data.messages.find(m => m.senderRole === 'admin' || m.senderRole === 'super_admin');
        if (adminMsg) {
          const adminId = adminMsg.senderId?._id || adminMsg.senderId;
          if (adminId) API.put(`/chat/read/${adminId}`).catch(() => {});
        }
      }
    } catch (err) {
      console.error('fetchMessages error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
    const socket = connectSocket();
    if (user?._id && socket?.connected) {
      socket.emit('join:user', user._id);
    }
    const handleChatNew = (chat) => {
      const uid = user?._id;
      if (!uid) return;
      const sid = chat.senderId?._id || chat.senderId;
      const rid = chat.receiverId?._id || chat.receiverId;
      const sidStr = typeof sid === 'string' ? sid : sid?.toString();
      const ridStr = typeof rid === 'string' ? rid : rid?.toString();
      const uidStr = typeof uid === 'string' ? uid : uid?.toString();
      if (sidStr === uidStr || ridStr === uidStr) {
        setMessages(prev => {
          if (prev.some(m => m._id === chat._id)) return prev;
          return [...prev, chat];
        });
        if (chat.senderRole === 'admin' || chat.senderRole === 'super_admin') {
          const adminId = chat.senderId?._id || chat.senderId;
          if (adminId && adminId !== uidStr) API.put(`/chat/read/${adminId}`).catch(() => {});
        }
      }
    };
    socket?.on('chat:new', handleChatNew);
    socket?.on('chat:read:update', ({ messageId, read }) => {
      setMessages(prev => prev.map(msg => msg._id === messageId ? { ...msg, read } : msg));
    });
    const handleConnect = () => {
      if (user?._id) socket.emit('join:user', user._id);
      fetchMessages();
    };
    socket?.on('connect', handleConnect);
    const loadingTimer = setTimeout(() => setLoading(false), 8000);
    return () => {
      clearTimeout(loadingTimer);
      socket?.off('chat:new', handleChatNew);
      socket?.off('chat:read:update');
      socket?.off('connect', handleConnect);
    };
  }, [user, fetchMessages]);

  useEffect(() => {
    const handleClick = (e) => { if (emojiRef.current && !emojiRef.current.contains(e.target)) { setShowEmoji(false); setShowStickers(false); } };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSend = async () => {
    const text = replyText.trim();
    if (!text || sending) return;
    const textSnapshot = text;
    setReplyText(''); setSending(true);
    try {
      const { data } = await API.post('/chat/send', { message: text });
      if (data.success) {
        setMessages(prev => {
          if (prev.find(m => m._id === data.chat._id)) return prev;
          return [...prev, data.chat];
        });
      }
    } catch {
      setReplyText(textSnapshot);
    } finally { setSending(false); }
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    for (const file of files) {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      const isAudio = file.type.startsWith('audio/');
      const mediaType = isImage ? 'image' : isVideo ? 'video' : isAudio ? 'audio' : 'document';
      const icon = isImage ? '📷' : isVideo ? '🎬' : isAudio ? '🎵' : '📎';
      const msg = `${icon} ${file.name}`;
      const fd = new FormData();
      fd.append('file', file);
      try {
        const { data: uploadData } = await API.post('/upload', fd);
        if (uploadData.success) {
          const res = await API.post('/chat/send', { message: msg, mediaUrl: uploadData.file.path, mediaType });
          if (res.data.success) {
            setMessages(prev => {
              if (prev.find(m => m._id === res.data.chat._id)) return prev;
              return [...prev, res.data.chat];
            });
          }
        }
      } catch (err) {
        console.error('fileUpload error:', err);
      }
    }
    e.target.value = '';
  };

  const handleEmojiClick = (emoji) => {
    setReplyText(prev => prev + emoji);
    setShowEmoji(false);
    setShowStickers(false);
  };

  const handleStickerClick = (sticker) => {
    setReplyText(sticker);
    setShowStickers(false);
    setShowEmoji(false);
    setTimeout(() => handleSend(), 100);
  };

  const formatDate = (date) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const renderMediaContent = (msg) => {
    if (!msg.mediaUrl) return null;
    const ext = msg.mediaUrl.split('.').pop()?.toLowerCase();
    if (['jpg','jpeg','png','gif','webp'].includes(ext)) {
      return <img src={msg.mediaUrl} alt="" className="max-w-full rounded-lg my-1 max-h-60 object-cover" loading="lazy" />;
    }
    if (['mp4','webm','mov'].includes(ext)) {
      return (
        <div className="relative my-1">
          <video src={msg.mediaUrl} controls className="max-w-full rounded-lg max-h-60" />
        </div>
      );
    }
    if (['mp3','wav','ogg'].includes(ext)) {
      return (
        <div className="my-1 p-2 bg-white/5 rounded-lg">
          <audio src={msg.mediaUrl} controls className="w-full h-8" />
        </div>
      );
    }
    return (
      <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-2 my-1 p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors text-sm">
        <FaDownload className="text-purple-400" />
        <span className="text-gray-300 truncate">{formatFileSize(msg.mediaUrl)}</span>
      </a>
    );
  };

  const getMsgTime = (msg) => {
    if (msg.timestamp) return new Date(msg.timestamp);
    return new Date(msg.createdAt);
  };

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  return (
    <div className="h-[calc(100vh-7rem)] glass-card overflow-hidden flex flex-col">
      <div className="p-4 border-b border-white/10 bg-white/5 flex items-center gap-3 flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
          <FaWhatsapp className="text-purple-400 text-lg" />
        </div>
        <div>
          <p className="text-white font-medium">Support</p>
          <p className="text-gray-400 text-xs">We typically reply within a few hours</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-gray-400">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16">
            <FaWhatsapp className="text-5xl text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No messages yet</p>
            <p className="text-gray-500 text-xs mt-1">Send a message to start chatting</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.senderRole === 'user';
            const showDate = idx === 0 || formatDate(getMsgTime(msg)) !== formatDate(getMsgTime(messages[idx - 1]));
            return (
              <div key={msg._id || idx}>
                {showDate && <div className="text-center my-2"><span className="text-[11px] bg-white/10 text-gray-300 px-3 py-1 rounded-full">{formatDate(getMsgTime(msg))}</span></div>}
                <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-2.5 rounded-2xl text-sm ${isMe ? 'bg-purple-600 text-white rounded-br-sm' : 'bg-white/10 text-gray-200 rounded-bl-sm'}`}>
                    <p className="text-[10px] text-purple-300 font-bold mb-1">{isMe ? 'YOU' : 'ADMIN'}</p>
                    {renderMediaContent(msg)}
                    <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                    <p className={`text-[10px] mt-1 flex items-center gap-1 ${isMe ? 'text-purple-300 justify-end' : 'text-gray-500'}`}>
                      {getMsgTime(msg).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {isMe && <span className={msg.read ? 'text-blue-400' : ''}>{msg.read ? '✓✓' : '✓'}</span>}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      <div ref={emojiRef} className="relative flex-shrink-0">
        {showEmoji && (
          <div className="p-2 border-t border-white/10 bg-[#1a1a2e]">
            <div className="flex gap-2 mb-2">
              <button onClick={() => { setShowStickers(false); }} className={`px-3 py-1 rounded-lg text-xs ${!showStickers ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>Emoji</button>
              <button onClick={() => { setShowStickers(true); }} className={`px-3 py-1 rounded-lg text-xs ${showStickers ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>Stickers</button>
            </div>
            <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
              {(showStickers ? STICKERS : EMOJIS).map((e, i) => (
                <button key={i} onClick={() => showStickers ? handleStickerClick(e) : handleEmojiClick(e)}
                  className={`${showStickers ? 'text-2xl' : 'text-xl'} hover:scale-125 transition-transform p-0.5`}>{e}</button>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 border-t border-white/10 bg-white/5">
          <div className="flex items-center gap-2">
            <button onClick={() => { setShowEmoji(!showEmoji); setShowStickers(false); }}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all">
              <FaSmile size={18} />
            </button>
            <button onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all">
              <FaPaperclip size={18} />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.zip,.txt,.csv" multiple className="hidden" onChange={handleFileUpload} />
            <input className="input-field flex-1 text-sm" placeholder="Type a message..." value={replyText}
              onChange={e => setReplyText(e.target.value)}
              onKeyDown={handleKeyDown} />
            <button onClick={handleSend} disabled={sending || !replyText.trim()}
              className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center hover:bg-purple-500 disabled:opacity-50 transition-all">
              <FaPaperPlane size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminSupport() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [msgLoading, setMsgLoading] = useState(false);
  const chatEndRef = useRef(null);
  const emojiRef = useRef(null);
  const fileInputRef = useRef(null);

  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await API.get('/chat/support/users');
      if (data.success) setUsers(data.users);
    } catch (err) {
      console.error('fetchUsers error:', err);
    } finally { setLoading(false); }
  }, []);

  const fetchMessages = useCallback(async (userId) => {
    setMsgLoading(true);
    try {
      const { data } = await API.get(`/chat/support?userId=${userId}`, { timeout: 10000 });
      if (data.success) {
        setMessages(prev => {
          const existing = new Map(prev.map(m => [m._id, m]));
          for (const msg of data.messages) {
            if (!existing.has(msg._id)) existing.set(msg._id, msg);
          }
          return [...existing.values()];
        });
        if (userId) API.put(`/chat/read/${userId}`).catch(() => {});
      }
    } catch (err) {
      console.error('fetchMessages error:', err);
    } finally { setMsgLoading(false); }
  }, []);

  useEffect(() => {
    fetchUsers();
    const socket = connectSocket();
    if (socket) socket.emit('join:admin');
    const handleChatNew = (chat) => {
      if (selectedUser) {
        const otherId = selectedUser._id;
        const sid = chat.senderId?._id || chat.senderId;
        const sidStr = typeof sid === 'string' ? sid : sid?.toString();
        if (sidStr === otherId?.toString()) {
          API.put(`/chat/read/${otherId}`).catch(() => {});
          fetchMessages(otherId);
        }
      }
      fetchUsers();
    };
    socket?.on('chat:new', handleChatNew);
    socket?.on('chat:read:update', ({ messageId, read }) => {
      setMessages(prev => prev.map(msg => msg._id === messageId ? { ...msg, read } : msg));
    });
    const handleConnect = () => {
      socket.emit('join:admin');
      if (selectedUser) fetchMessages(selectedUser._id);
      fetchUsers();
    };
    socket?.on('connect', handleConnect);
    const loadingTimer = setTimeout(() => setMsgLoading(false), 8000);
    return () => {
      clearTimeout(loadingTimer);
      socket?.off('chat:new', handleChatNew);
      socket?.off('chat:read:update');
      socket?.off('connect', handleConnect);
    };
  }, [selectedUser, fetchUsers, fetchMessages]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    const handleClick = (e) => { if (emojiRef.current && !emojiRef.current.contains(e.target)) { setShowEmoji(false); setShowStickers(false); } };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectUser = (u) => {
    setSelectedUser(u);
    fetchMessages(u._id);
  };

  const handleSend = async () => {
    const text = replyText.trim();
    if (!text || sending || !selectedUser) return;
    setReplyText(''); setSending(true);
    try {
      const { data } = await API.post('/chat/send', { message: text, receiverId: selectedUser._id });
      if (data.success) {
        setMessages(prev => [...prev, data.chat]);
        fetchUsers();
      }
    } catch (err) {
      console.error('handleSend error:', err);
    } finally { setSending(false); }
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files?.length || !selectedUser) return;
    for (const file of files) {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      const isAudio = file.type.startsWith('audio/');
      const mediaType = isImage ? 'image' : isVideo ? 'video' : isAudio ? 'audio' : 'document';
      const icon = isImage ? '📷' : isVideo ? '🎬' : isAudio ? '🎵' : '📎';
      const msg = `${icon} ${file.name}`;
      const fd = new FormData();
      fd.append('file', file);
      try {
        const { data: uploadData } = await API.post('/upload', fd);
        if (uploadData.success) {
          const res = await API.post('/chat/send', { message: msg, mediaUrl: uploadData.file.path, mediaType, receiverId: selectedUser._id });
          if (res.data.success) {
            setMessages(prev => [...prev, res.data.chat]);
          }
        }
      } catch (err) {
        console.error('fileUpload error:', err);
      }
    }
    e.target.value = '';
  };

  const updateMessageRead = async (msgId, read) => {
    if (!msgId || typeof msgId !== 'string') return;
    setMessages(prev => prev.map(msg => msg._id === msgId ? { ...msg, read } : msg));
    try {
      await API.put(`/chat/message/${msgId}/read`, { read });
    } catch (err) {
      console.error('updateMessageRead error:', err);
      if (selectedUser?._id) fetchMessages(selectedUser._id);
    }
  };

  const handleEmojiClick = (emoji) => {
    setReplyText(prev => prev + emoji);
    setShowEmoji(false);
    setShowStickers(false);
  };

  const handleStickerClick = (sticker) => {
    setReplyText(sticker);
    setShowStickers(false);
    setShowEmoji(false);
    setTimeout(() => handleSend(), 100);
  };

  const formatDate = (date) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const renderMediaContent = (msg) => {
    if (!msg.mediaUrl) return null;
    const ext = msg.mediaUrl.split('.').pop()?.toLowerCase();
    if (['jpg','jpeg','png','gif','webp'].includes(ext)) {
      return <img src={msg.mediaUrl} alt="" className="max-w-full rounded-lg my-1 max-h-60 object-cover" loading="lazy" />;
    }
    if (['mp4','webm','mov'].includes(ext)) {
      return (
        <div className="relative my-1">
          <video src={msg.mediaUrl} controls className="max-w-full rounded-lg max-h-60" />
        </div>
      );
    }
    if (['mp3','wav','ogg'].includes(ext)) {
      return (
        <div className="my-1 p-2 bg-white/5 rounded-lg">
          <audio src={msg.mediaUrl} controls className="w-full h-8" />
        </div>
      );
    }
    return (
      <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-2 my-1 p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors text-sm">
        <FaDownload className="text-purple-400" />
        <span className="text-gray-300 truncate">{formatFileSize(msg.mediaUrl)}</span>
      </a>
    );
  };

  if (!selectedUser) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Support Chat</h1>
            <p className="text-gray-400 text-sm mt-1">Manage client support conversations</p>
          </div>
        </div>
        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-3 inline-block" />
            <p className="text-gray-400">Loading conversations...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16">
            <FaWhatsapp className="text-5xl text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No support conversations yet</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {users.map((u, idx) => (
              <motion.div key={u._id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}
                onClick={() => selectUser(u)}
                className="glass-card p-4 flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-all">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <FaUserCircle className="text-purple-400 text-lg" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{u.name || 'Unknown User'}</p>
                  <p className="text-gray-400 text-xs truncate">{u.lastMessage || 'No messages'}</p>
                </div>
                <div className="text-xs text-gray-500 flex-shrink-0">
                  {u.lastTime ? new Date(u.lastTime).toLocaleDateString() : ''}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-7rem)] glass-card overflow-hidden flex flex-col">
      <div className="p-4 border-b border-white/10 bg-white/5 flex items-center gap-3 flex-shrink-0">
        <button onClick={() => { setSelectedUser(null); setMessages([]); }}
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all mr-1">
          <FaArrowLeft size={16} />
        </button>
        <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
          <FaUserCircle className="text-purple-400 text-lg" />
        </div>
        <div>
          <p className="text-white font-medium">{selectedUser.name || 'User'}</p>
          <p className="text-gray-400 text-xs">Support conversation</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {msgLoading ? (
          <div className="text-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-gray-400">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16">
            <FaWhatsapp className="text-5xl text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No messages yet</p>
            <p className="text-gray-500 text-xs mt-1">Send a reply to start the conversation</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.senderRole === 'admin' || msg.senderRole === 'super_admin';
            const showDate = idx === 0 || formatDate(msg.createdAt) !== formatDate(messages[idx - 1]?.createdAt);
            return (
              <div key={msg._id || idx}>
                {showDate && <div className="text-center my-2"><span className="text-[11px] bg-white/10 text-gray-300 px-3 py-1 rounded-full">{formatDate(msg.createdAt)}</span></div>}
                <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div
                    onClick={() => updateMessageRead(msg._id, true)}
                    onDoubleClick={() => updateMessageRead(msg._id, false)}
                    className={`max-w-[80%] p-2.5 rounded-2xl text-sm cursor-pointer ${isMe ? 'bg-purple-600 text-white rounded-br-sm' : 'bg-white/10 text-gray-200 rounded-bl-sm'}`}>
                    <p className="text-[10px] text-purple-300 font-bold mb-1">{isMe ? 'YOU' : selectedUser.name?.split(' ')[0] || 'USER'}</p>
                    {renderMediaContent(msg)}
                    <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                    <p className={`text-[10px] mt-1 flex items-center gap-1 ${isMe ? 'text-purple-300 justify-end' : 'text-gray-500'}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {!isMe && <span className={msg.read ? 'text-blue-400' : 'text-yellow-400'}>{msg.read ? 'Seen' : 'Unseen'}</span>}
                      {isMe && <span className={msg.read ? 'text-blue-400' : ''}>{msg.read ? '✓✓' : '✓'}</span>}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      <div ref={emojiRef} className="relative flex-shrink-0">
        {showEmoji && (
          <div className="p-2 border-t border-white/10 bg-[#1a1a2e]">
            <div className="flex gap-2 mb-2">
              <button onClick={() => { setShowStickers(false); }} className={`px-3 py-1 rounded-lg text-xs ${!showStickers ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>Emoji</button>
              <button onClick={() => { setShowStickers(true); }} className={`px-3 py-1 rounded-lg text-xs ${showStickers ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>Stickers</button>
            </div>
            <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
              {(showStickers ? STICKERS : EMOJIS).map((e, i) => (
                <button key={i} onClick={() => showStickers ? handleStickerClick(e) : handleEmojiClick(e)}
                  className={`${showStickers ? 'text-2xl' : 'text-xl'} hover:scale-125 transition-transform p-0.5`}>{e}</button>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 border-t border-white/10 bg-white/5">
          <div className="flex items-center gap-2">
            <button onClick={() => { setShowEmoji(!showEmoji); setShowStickers(false); }}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all">
              <FaSmile size={18} />
            </button>
            <button onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all">
              <FaPaperclip size={18} />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.zip,.txt,.csv" multiple className="hidden" onChange={handleFileUpload} />
            <input className="input-field flex-1 text-sm" placeholder="Type a reply..." value={replyText}
              onChange={e => setReplyText(e.target.value)}
              onKeyDown={handleKeyDown} />
            <button onClick={handleSend} disabled={sending || !replyText.trim()}
              className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center hover:bg-purple-500 disabled:opacity-50 transition-all">
              <FaPaperPlane size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
