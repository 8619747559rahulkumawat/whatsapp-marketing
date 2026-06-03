import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import API from '../utils/api';
import { connectSocket } from '../utils/socket';
import { resetUnread } from '../stores/chatStore';
import { useAuth } from '../contexts/AuthContext';
import { FaWhatsapp, FaPaperPlane, FaUser, FaSmile, FaPaperclip, FaReply, FaTrash, FaStar, FaSearch, FaTimes, FaDownload, FaPhone, FaVideo, FaPhoneSlash } from 'react-icons/fa';
import { HiOutlineDotsVertical } from 'react-icons/hi';

const EMOJIS = ['😊','👍','❤️','😂','🔥','🎉','🙏','😍','🤣','💀','😎','🥳','😅','🤔','👌','✌️','💪','🤝','😭','🥺','😤','🤩','😱','🤗','😴','🤪','😈','💩','👻','👋','🙌','🤲','💯','✅','❌','⭐','🌈','🎯','🔥','💀','👑','🚀','💰','📱','💻','📞','✉️','📷','🎬','🏆','🥇','💎','😡','🥶','🤡','💔','🗿','✨','🕊️','🔴','🟢','🔵','🟡'];
const STICKERS = ['👍', '❤️', '😂', '😍', '🔥', '🎉', '🙏', '💀', '😎', '🥳', '🤔', '👌', '💪', '🤝', '😭', '🥺', '😤', '🤩', '😱', '🤗', '😴', '🤪', '😈', '💩', '👻', '👋', '🙌', '🤲', '💯', '✅', '❌', '⭐', '🎯', '👑', '🚀'];

export default function LiveChat() {
   const [conversations, setConversations] = useState([]);
   const [selectedConv, setSelectedConv] = useState(null);
   const [replyText, setReplyText] = useState('');
   const [sending, setSending] = useState(false);
   const chatEndRef = useRef(null);
   const selectedConvRef = useRef(null);
   const [search, setSearch] = useState('');
   const [searchConv, setSearchConv] = useState('');
   const [sessions, setSessions] = useState([]);
   const [showEmoji, setShowEmoji] = useState(false);
   const [showStickers, setShowStickers] = useState(false);
   const [replyTo, setReplyTo] = useState(null);
   const [pinned, setPinned] = useState(() => JSON.parse(localStorage.getItem('pinned_chats') || '[]'));
   const [searchMsg, setSearchMsg] = useState('');
   const fileInputRef = useRef(null);
   const emojiRef = useRef(null);
   const { user } = useAuth();
   const [showMobileList, setShowMobileList] = useState(true);
   const [callStatus, setCallStatus] = useState('idle');
   const [callType, setCallType] = useState('video');
   const [roomName, setRoomName] = useState('');
   const [incomingCall, setIncomingCall] = useState(null);
   const jitsiRef = useRef(null);
   const jitsiContainerRef = useRef(null);

   useEffect(() => {
     resetUnread();
     fetchData();
     const socket = connectSocket();
     const userId = user?._id;
      const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
     if (isAdmin) {
       socket.emit('join:admin');
     } else if (userId) {
       socket.emit('join:user', userId);
     }
     const handleConnect = () => {
       if (isAdmin) {
         socket.emit('join:admin');
       } else if (userId) {
         socket.emit('join:user', userId);
       }
       fetchData();
     };
     socket.on('connect', handleConnect);
     socket.on('chat:new', fetchData);
      socket.on('call:incoming', (data) => {
        if (!document.hidden) setIncomingCall(data);
      });
      socket.on('call:accepted', ({ room }) => {
        setCallStatus('connected');
      });
      socket.on('call:ended', () => {
        endCall();
      });
      socket.on('call:ringing', () => {
        // could play sound here
      });
      socket.on('chat:read:update', ({ messageId, read }) => {
       setConversations(prev => prev.map(conv => {
         const messages = (conv.messages || []).map(msg => msg._id === messageId ? { ...msg, read } : msg);
         return { ...conv, messages, unread: messages.filter(msg => msg.senderRole === 'user' && !msg.read).length };
       }));
       setSelectedConv(prev => prev ? {
         ...prev,
         messages: (prev.messages || []).map(msg => msg._id === messageId ? { ...msg, read } : msg)
       } : prev);
     });
     const visibilityHandler = () => { if (!document.hidden) fetchData(); };
     document.addEventListener('visibilitychange', visibilityHandler);
     return () => { socket.off('chat:new', fetchData); socket.off('chat:read:update'); socket.off('connect', handleConnect); document.removeEventListener('visibilitychange', visibilityHandler); };
   }, [user?._id]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [selectedConv]);
  useEffect(() => { localStorage.setItem('pinned_chats', JSON.stringify(pinned)); }, [pinned]);
  useEffect(() => {
    const handleClick = (e) => { if (emojiRef.current && !emojiRef.current.contains(e.target)) { setShowEmoji(false); setShowStickers(false); } };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchProfilePics = async (convs, activeSessions) => {
    if (!convs.length || !activeSessions?.length) return;
    const sessionId = activeSessions[0].sessionId;
    for (const conv of convs) {
      if (conv.userId?.startsWith('wa_') && !conv.profilePic) {
        const phone = conv.fullPhone || conv.userId.replace('wa_', '');
        API.get(`/sessions/${sessionId}/profile/${phone}`).then(({ data }) => {
          if (data.success) {
            setConversations(prev => prev.map(c =>
              c.userId === conv.userId
                ? { ...c, profilePic: data.profilePic || c.profilePic, userName: data.contactName || c.userName, user: { ...c.user, name: data.contactName || c.user?.name || c.userName } }
                : c
            ));
            if (selectedConv?.userId === conv.userId) {
              setSelectedConv(prev => ({
                ...prev,
                profilePic: data.profilePic || prev.profilePic,
                userName: data.contactName || prev.userName,
                user: { ...prev.user, name: data.contactName || prev.user?.name || prev.userName }
              }));
            }
          }
        }).catch(e => console.warn('Profile fetch failed for', phone, e.message));
      }
    }
  };

  const fetchData = async () => {
    try {
      const [chatRes, msgRes, sessRes] = await Promise.all([
        API.get('/chat'), API.get('/messages?limit=200'), API.get('/sessions')
      ]);
      const connectedSessions = sessRes.data.success ? sessRes.data.sessions.filter(s => s.status === 'connected') : [];
      if (sessRes.data.success) setSessions(connectedSessions);
      if (msgRes.data.success && chatRes.data.success) {
        const convs = mergeConversations(chatRes.data.conversations || [], msgRes.data.messages || []);
        fetchProfilePics(convs, connectedSessions);
      }
    } catch (err) { console.error(err); }
  };

  const mergeConversations = (chatConvs, whatsappMsgs) => {
    const convMap = {};
    chatConvs.forEach(c => {
      let key = c.user?._id || c._id;
      if (!key) return;
      let userName = c.user?.name || c.user?.phone || 'Unknown';
      let profilePic = c.profilePic || c.user?.profilePic || '';
      if (typeof key === 'string' && key.startsWith('wa_')) {
        let p = key.slice(3);
        if (p.startsWith('91') && p.length > 10) p = p.slice(2);
        key = 'wa_' + p;
        if (userName.startsWith('91') && userName.length > 10) userName = userName.slice(2);
      }
      if (!convMap[key]) convMap[key] = { userId: key, userName, profilePic, fullPhone: c.fullPhone || '', userEmail: c.user?.email || '', messages: [], lastTime: c.lastTime, pinned: pinned.includes(key), unread: 0, user: c.user || {} };
      (c.messages || []).forEach(m => {
        convMap[key].messages.push({ _id: m._id, message: m.message, senderRole: m.senderRole, senderName: m.senderName, createdAt: m.createdAt, read: m.read, mediaUrl: m.mediaUrl || '' });
        if (m.senderRole === 'user' && !m.read) convMap[key].unread++;
      });
    });
    whatsappMsgs.forEach(m => {
      const rawPhone = m.to?.replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '') || '';
      if (!rawPhone) return;
      let phone = rawPhone;
      if (phone.startsWith('91') && phone.length > 10) phone = phone.slice(2);
      const key = `wa_${phone}`;
      if (!convMap[key]) convMap[key] = { userId: key, userName: phone, fullPhone: rawPhone, userEmail: 'WhatsApp', messages: [], lastTime: m.sentAt || m.createdAt, pinned: pinned.includes(key), profilePic: '' };
      const isSent = m.status === 'sent' || m.status === 'delivered' || m.status === 'read';
      convMap[key].messages.push({ _id: m._id, message: m.content || '', senderRole: isSent ? 'admin' : 'user', senderName: isSent ? 'You' : phone, createdAt: m.sentAt || m.createdAt, mediaUrl: m.mediaUrl || '' });
      if (new Date(m.sentAt || m.createdAt) > new Date(convMap[key].lastTime || 0)) convMap[key].lastTime = m.sentAt || m.createdAt;
    });
    const convs = Object.values(convMap);
    convs.forEach(c => {
      c.messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const seen = new Set();
      c.messages = c.messages.filter(m => {
        const key = m._id;
        if (seen.has(key)) return false;
        seen.add(key);
        const dup = c.messages.some(other => {
          if (other._id === m._id) return false;
          const timeDiff = Math.abs(new Date(other.createdAt) - new Date(m.createdAt));
          return other.message === m.message && other.senderRole === m.senderRole && timeDiff < 3000;
        });
        if (dup) return false;
        return true;
      });
    });
    convs.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || new Date(b.lastTime) - new Date(a.lastTime));
    setConversations(convs);
    const currentId = selectedConv?.userId || selectedConvRef.current?.userId;
    if (currentId) {
      const updated = convs.find(c => c.userId === currentId);
      if (updated) { setSelectedConv(updated); selectedConvRef.current = updated; }
    }
    return convs;
  };

  const startCall = async (type) => {
    if (!selectedConv) return;
    const room = `rsendix_${selectedConv.userId}_${Date.now()}`;
    setRoomName(room);
    setCallType(type);
    setCallStatus('calling');
    const link = `https://meet.jit.si/${room}`;
    if (selectedConv.userId?.startsWith('wa_')) {
      const phone = selectedConv.fullPhone || selectedConv.userId.replace('wa_', '');
      const msg = `🔊 ${type === 'audio' ? 'Audio' : 'Video'} Call\nJoin: ${link}`;
      const optimisticMsg = { _id: Date.now(), message: msg, senderRole: 'admin', senderName: 'You', createdAt: new Date() };
      setSelectedConv(prev => ({ ...prev, messages: [...(prev?.messages || []), optimisticMsg] }));
      setConversations(prev => prev.map(c => c.userId === selectedConv.userId ? { ...c, messages: [...(c.messages || []), optimisticMsg], lastTime: new Date() } : c));
      try {
        await API.post('/messages/send', { sessionId: sessions[0]?.sessionId, to: phone, messageType: 'text', message: msg });
      } catch (err) { console.error(err); }
    } else {
      const socket = connectSocket();
      socket.emit('call:offer', { room, userId: selectedConv.userId, type, fromName: user?.name || 'Admin' });
    }
    setTimeout(() => setCallStatus('connected'), 1000);
    initJitsi(room, type);
  };

  const initJitsi = (room, type) => {
    const existing = document.querySelector('#jitsi-container iframe');
    if (existing) existing.remove();
    const loadJitsi = () => {
      if (!document.getElementById('jitsi-container')) return;
      const domain = 'meet.jit.si';
      const options = {
        roomName: room,
        parentNode: document.getElementById('jitsi-container'),
        configOverrides: {
          startWithAudioMuted: false,
          startWithVideoMuted: type === 'audio',
          prejoinPageEnabled: false,
          toolbarButtons: ['microphone', 'camera', 'desktop', 'fullscreen', 'tileview', 'chat', 'raisehand'],
        },
        interfaceConfigOverrides: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          TOOLBAR_ALWAYS_VISIBLE: true,
          DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
        },
      };
      jitsiRef.current = new window.JitsiMeetExternalAPI(domain, options);
      jitsiRef.current.addListener('readyToClose', endCall);
      jitsiRef.current.addListener('videoConferenceLeft', endCall);
    };
    if (window.JitsiMeetExternalAPI) {
      loadJitsi();
    } else {
      const script = document.createElement('script');
      script.src = 'https://meet.jit.si/external_api.js';
      script.async = true;
      script.onload = loadJitsi;
      document.head.appendChild(script);
    }
  };

  const endCall = () => {
    if (jitsiRef.current) {
      try { jitsiRef.current.dispose(); } catch (err) { console.error(err); }
      jitsiRef.current = null;
    }
    const container = document.getElementById('jitsi-container');
    if (container) container.innerHTML = '';
    setCallStatus('idle');
    setRoomName('');
    setIncomingCall(null);
    const socket = connectSocket();
    if (selectedConv) socket.emit('call:end', { userId: selectedConv.userId });
  };

  const acceptIncomingCall = () => {
    if (!incomingCall) return;
    setRoomName(incomingCall.room);
    setCallType(incomingCall.type);
    setCallStatus('connected');
    const socket = connectSocket();
    socket.emit('call:accept', { room: incomingCall.room });
    initJitsi(incomingCall.room, incomingCall.type);
  };

  const handleSend = async () => {
    if (!replyText.trim() || !selectedConv) return;
    const text = replyText;
    const msgText = replyTo ? `↩️ ${replyTo.message}\n${text}` : text;
    setReplyText(''); setReplyTo(null); setSending(true);
    const optimisticMsg = { _id: Date.now(), message: text, senderRole: 'admin', senderName: 'You', createdAt: new Date() };
    setSelectedConv(prev => ({ ...prev, messages: [...(prev?.messages || []), optimisticMsg] }));
    setConversations(prev => prev.map(c => c.userId === selectedConv.userId ? { ...c, messages: [...(c.messages || []), optimisticMsg], lastTime: new Date() } : c));
    try {
      if (selectedConv.userId?.startsWith('wa_')) {
        const phone = selectedConv.fullPhone || selectedConv.userId.replace('wa_', '');
        if (sessions.length > 0) {
          const { data } = await API.post('/messages/send', { sessionId: sessions[0].sessionId, to: phone, messageType: 'text', message: msgText });
          if (!data.success) { alert(data.message || 'Send failed'); return; }
        } else {
          alert('No WhatsApp session connected. Please connect a session first.');
          return;
        }
      } else {
        const { data } = await API.post('/chat/send', { message: msgText, receiverId: selectedConv.userId });
        if (data.success) {
          setSelectedConv(prev => ({ ...prev, messages: [...(prev.messages || []).filter(m => m._id !== optimisticMsg._id), data.chat] }));
          setConversations(prev => prev.map(c => c.userId === selectedConv.userId ? { ...c, messages: [...(c.messages || []).filter(m => m._id !== optimisticMsg._id), data.chat], lastTime: new Date() } : c));
        }
      }
    } catch (e) {
      setSelectedConv(prev => ({ ...prev, messages: (prev.messages || []).filter(m => m._id !== optimisticMsg._id) }));
      setConversations(prev => prev.map(c => c.userId === selectedConv.userId ? { ...c, messages: (c.messages || []).filter(m => m._id !== optimisticMsg._id) } : c));
      alert(e.response?.data?.message || e.message || 'Send failed');
    } finally { setSending(false); }
  };

  const handleStickerSend = async (sticker) => {
    if (!selectedConv) return;
    setReplyText(sticker);
    setShowStickers(false);
    setShowEmoji(false);
    setTimeout(() => {
      handleSend();
    }, 50);
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files?.length || !selectedConv) return;
    for (const file of files) {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      const isAudio = file.type.startsWith('audio/');
      const mediaType = isImage ? 'image' : isVideo ? 'video' : isAudio ? 'audio' : 'document';
      const icon = isImage ? '🖼️' : isVideo ? '🎬' : isAudio ? '🎵' : '📎';
      const msg = `${icon} ${file.name}`;
      const optimisticMsg = { _id: Date.now(), message: msg, senderRole: 'admin', senderName: 'You', createdAt: new Date(), mediaType };
      setSelectedConv(prev => ({ ...prev, messages: [...(prev?.messages || []), optimisticMsg] }));
      setConversations(prev => prev.map(c => c.userId === selectedConv.userId ? { ...c, messages: [...(c.messages || []), optimisticMsg], lastTime: new Date() } : c));
      const fd = new FormData();
      fd.append('file', file);
      try {
        const { data } = await API.post('/upload', fd);
        if (!data.success) { alert('Upload failed'); continue; }
        if (selectedConv.userId?.startsWith('wa_')) {
          if (sessions.length > 0) {
            const waType = mediaType === 'document' ? 'document' : mediaType;
            await API.post('/messages/send', { sessionId: sessions[0].sessionId, to: selectedConv.fullPhone || selectedConv.userId.replace('wa_', ''), messageType: waType, message: msg, mediaUrl: data.file.path });
          } else {
            alert('No WhatsApp session connected. Please connect a session first.');
          }
        } else {
          await API.post('/chat/send', { message: msg, receiverId: selectedConv.userId, mediaUrl: data.file.path, mediaType });
        }
        fetchData();
      } catch (err) {
        console.error('fileUpload error:', err);
      }
    }
    e.target.value = '';
  };

  const handleDelete = async (msgId) => {
    try {
      await API.delete(`/chat/${msgId}`);
      setSelectedConv(prev => ({ ...prev, messages: prev.messages.map(m => m._id === msgId ? { ...m, message: '[Deleted]' } : m) }));
    } catch (err) {
      console.error('delete error:', err);
    }
  };

  const updateMessageRead = async (msgId, read) => {
    if (!msgId || typeof msgId !== 'string') return;
    const applyRead = (conv) => ({
      ...conv,
      messages: (conv.messages || []).map(m => m._id === msgId ? { ...m, read } : m),
      unread: (conv.messages || []).map(m => m._id === msgId ? { ...m, read } : m).filter(m => m.senderRole === 'user' && !m.read).length
    });
    setSelectedConv(prev => prev ? applyRead(prev) : prev);
    setConversations(prev => prev.map(c => applyRead(c)));
    try {
      await API.put(`/chat/message/${msgId}/read`, { read });
    } catch {
      fetchData();
    }
  };

  const handleDeleteConv = async (userId, e) => {
    e.stopPropagation();
    if (!confirm('Delete this conversation?')) return;
    try {
      const { data } = await API.delete(`/chat/conversation/${encodeURIComponent(userId)}`);
      if (data.success) {
        setConversations(prev => prev.filter(c => c.userId !== userId));
        if (selectedConv?.userId === userId) setSelectedConv(null);
      }
    } catch (err) { console.error(err); }
  };

  const togglePin = (userId) => {
    setPinned(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
    setConversations(prev => prev.map(c => c.userId === userId ? { ...c, pinned: !c.pinned } : c));
  };

  const formatDate = (date) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const renderMediaContent = (msg) => {
    if (!msg.mediaUrl) return null;
    const ext = msg.mediaUrl.split('.').pop()?.toLowerCase();
    const mt = msg.mediaType || '';
    if (mt === 'image' || ['jpg','jpeg','png','gif','webp'].includes(ext)) {
      return <img src={msg.mediaUrl} alt="" className="max-w-full rounded-lg my-1 max-h-72 object-cover" loading="lazy" />;
    }
    if (mt === 'video' || ['mp4','webm','mov'].includes(ext)) {
      return (
        <div className="relative my-1">
          <video src={msg.mediaUrl} controls className="max-w-full rounded-lg max-h-72" />
        </div>
      );
    }
    if (mt === 'audio' || ['mp3','wav','ogg'].includes(ext)) {
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
        <span className="text-gray-300 truncate">{msg.mediaUrl.split('/').pop() || 'File'}</span>
      </a>
    );
  };

  const filteredConvs = conversations.filter(c =>
    c.userName?.toLowerCase().includes(search.toLowerCase())
  );
  const searchedMsgs = selectedConv?.messages?.filter(m =>
    searchMsg && m.message?.toLowerCase().includes(searchMsg.toLowerCase())
  ) || [];

  return (
    <div className="h-[calc(100dvh-7rem)] min-h-[400px] flex gap-4 relative">
      {/* Chat List */}
      <div className={`${showMobileList ? 'flex' : 'hidden'} md:flex w-full md:w-80 flex-shrink-0 glass-card overflow-hidden flex-col absolute md:relative inset-0 z-10 md:z-auto ${!showMobileList && 'md:flex'}`}>
        <div className="p-3 border-b border-white/10">
          <h2 className="text-white font-semibold mb-2">Chats</h2>
          <input className="input-field text-sm" placeholder="Search chats..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredConvs.map((conv, idx) => (
            <motion.div key={conv.userId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.02 }}
              onClick={() => { selectedConvRef.current = conv; setSelectedConv(conv); setShowMobileList(false); setSearchMsg(''); setConversations(prev => prev.map(c => c.userId === conv.userId ? { ...c, unread: 0 } : c)); API.put('/chat/read/' + encodeURIComponent(conv.userId)).catch(() => {}); }}
              className={`p-3 border-b border-white/5 cursor-pointer hover:bg-white/5 group relative ${selectedConv?.userId === conv.userId ? 'bg-purple-600/20 border-l-2 border-l-purple-500' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="relative">
                  {conv.profilePic ? (
                    <img src={conv.profilePic} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center"><FaUser className="text-purple-400 text-sm" /></div>
                  )}
                  {conv.pinned && <FaStar className="absolute -top-1 -right-1 text-yellow-400 text-[10px]" />}
                  {conv.unread > 0 && <span className="absolute -bottom-1 -right-1 bg-red-500 text-white text-[9px] font-bold px-1 rounded-full min-w-[16px] text-center leading-4">{conv.unread}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between items-center">
                    <p className="text-white font-medium text-sm truncate flex items-center gap-1">
                      {conv.pinned && <FaStar className="text-yellow-400 text-[10px]" />}
                      {conv.user?.name || conv.userName}
                    </p>
                    <span className="text-[10px] text-gray-500">{conv.lastTime ? new Date(conv.lastTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  </div>
                  <p className="text-gray-400 text-xs truncate">{conv.messages[conv.messages.length - 1]?.message}</p>
                </div>
                 <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button onClick={(e) => { e.stopPropagation(); togglePin(conv.userId); }}
                     className={`p-1.5 rounded-lg text-xs ${conv.pinned ? 'text-yellow-400 bg-yellow-500/10' : 'text-gray-400 hover:text-yellow-400 hover:bg-white/10'}`}>
                     <FaStar size={12} />
                   </button>
                    {(user?.role === 'admin' || user?.role === 'super_admin') && (
                      <button onClick={(e) => handleDeleteConv(conv.userId, e)}
                        className="p-1.5 rounded-lg text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/10">
                        <FaTrash size={12} />
                      </button>
                    )}
                  </div>
               </div>
            </motion.div>
          ))}
          {filteredConvs.length === 0 && <div className="text-center py-8 text-gray-500 text-sm">No conversations</div>}
        </div>
      </div>

      {/* Chat Window */}
      <div className={`${!showMobileList && selectedConv ? 'flex' : 'hidden'} md:flex flex-1 glass-card overflow-hidden flex-col absolute md:relative inset-0 md:inset-auto z-10 md:z-auto`}>
        {selectedConv ? (
          <>
            {/* Header */}
            <div className="p-3 border-b border-white/10 bg-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => setShowMobileList(true)} className="md:hidden text-gray-400 hover:text-white mr-1">
                  <FaTimes size={14} />
                </button>
                {selectedConv.profilePic ? (
                  <img src={selectedConv.profilePic} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center"><FaUser className="text-purple-400 text-sm" /></div>
                )}
                <div><p className="text-white font-medium text-sm">{selectedConv.user?.name || selectedConv.userName}</p><p className="text-gray-400 text-[11px]">{selectedConv.userEmail}</p></div>
              </div>
                <div className="flex items-center gap-2">
                   {(user?.role === 'admin' || user?.role === 'super_admin') && (
                    <>
                      <button onClick={() => startCall('audio')} className="p-2 rounded-lg text-green-400 hover:bg-green-500/10" title="Audio Call"><FaPhone size={14} /></button>
                      <button onClick={() => startCall('video')} className="p-2 rounded-lg text-purple-400 hover:bg-purple-500/10" title="Video Call"><FaVideo size={14} /></button>
                    </>
                  )}
                  <button onClick={() => setSearchMsg(prev => prev ? '' : '🔍')} className="text-gray-400 hover:text-white text-sm"><FaSearch size={14} /></button>
                  <button onClick={() => togglePin(selectedConv.userId)} className={`text-sm ${selectedConv.pinned ? 'text-yellow-400' : 'text-gray-400 hover:text-yellow-400'}`}><FaStar size={14} /></button>
                  {(user?.role === 'admin' || user?.role === 'super_admin') && (
                    <button onClick={() => handleDeleteConv(selectedConv.userId)}
                      className="p-1.5 rounded-lg text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/10">
                      <FaTrash size={12} />
                    </button>
                  )}
                </div>
            </div>

            {/* Search in chat */}
            {searchMsg && (
              <div className="px-3 py-2 bg-purple-900/20 border-b border-purple-500/20 flex items-center gap-2">
                <FaSearch className="text-purple-400 text-xs" />
                <input className="bg-transparent text-sm text-white flex-1 outline-none" placeholder="Search in chat..." value={searchMsg.replace('🔍','')} onChange={e => setSearchMsg(e.target.value)} autoFocus />
                <button onClick={() => setSearchMsg('')} className="text-gray-400 hover:text-white"><FaTimes size={12} /></button>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {searchMsg ? (
                searchedMsgs.length > 0 ? searchedMsgs.map((msg, idx) => (
                  <div key={msg._id || idx} className={`text-sm p-2 rounded-lg ${msg.senderRole === 'admin' ? 'text-right' : ''}`}>
                    <span className="text-purple-400">{msg.message}</span>
                    <span className="text-gray-500 text-[10px] ml-2">{new Date(msg.createdAt).toLocaleTimeString()}</span>
                  </div>
                )) : <div className="text-center text-gray-500 text-sm py-8">No results</div>
              ) : (
                selectedConv.messages?.map((msg, idx) => {
                  const isAdmin = msg.senderRole === 'admin' || msg.senderRole === 'super_admin';
                  const showDate = idx === 0 || formatDate(msg.createdAt) !== formatDate(selectedConv.messages[idx - 1]?.createdAt);
                  const isDeleted = msg.message === '[Deleted]';
                  return (
                    <div key={msg._id || idx}>
                      {showDate && <div className="text-center my-2"><span className="text-[11px] bg-white/10 text-gray-300 px-3 py-1 rounded-full">{formatDate(msg.createdAt)}</span></div>}
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className={`flex ${isAdmin ? 'justify-end' : 'justify-start'} group`}>
                        <div
                          onClick={() => (user?.role === 'admin' || user?.role === 'super_admin') && updateMessageRead(msg._id, true)}
                          onDoubleClick={() => (user?.role === 'admin' || user?.role === 'super_admin') && updateMessageRead(msg._id, false)}
                          className={`max-w-[75%] p-2.5 rounded-2xl text-sm relative ${user?.role === 'admin' || user?.role === 'super_admin' ? 'cursor-pointer' : ''} ${isDeleted ? 'bg-gray-800/50 text-gray-500 italic' : isAdmin ? 'bg-purple-700/40 text-white rounded-br-sm' : 'bg-gray-700/40 text-gray-200 rounded-bl-sm'}`}>
                          {!isDeleted && <p className={`text-[10px] font-medium mb-0.5 ${isAdmin ? 'text-purple-300' : 'text-purple-400'}`}>{isAdmin ? 'You' : (msg.senderName || selectedConv.userName)}</p>}
                          {!isDeleted && (msg.mediaUrl ? renderMediaContent(msg) : <p>{msg.message}</p>)}
                          {isDeleted && <p className="text-gray-500 italic">[Deleted]</p>}
                          <div className="flex items-center justify-end gap-1 mt-1">
                            {isAdmin && !isDeleted && (
                              <button onClick={() => setReplyTo(msg)} className="opacity-0 group-hover:opacity-100 text-[10px] text-purple-400 hover:text-purple-300"><FaReply size={10} /></button>
                            )}
                            {isAdmin && !isDeleted && (
                              <button onClick={() => handleDelete(msg._id)} className="opacity-0 group-hover:opacity-100 text-[10px] text-red-400 hover:text-red-300"><FaTrash size={10} /></button>
                            )}
                            <span className="text-[10px] text-gray-500">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {(user?.role === 'admin' || user?.role === 'super_admin') && !isDeleted && !isAdmin && (
                              <span className={`text-[10px] ${msg.read ? 'text-blue-400' : 'text-yellow-400'}`}>{msg.read ? 'Seen' : 'Unseen'}</span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Reply indicator */}
            {replyTo && (
              <div className="px-4 py-1.5 bg-purple-900/30 border-t border-purple-500/20 flex items-center gap-2 text-xs">
                <FaReply className="text-purple-400" /><span className="text-gray-400 flex-1 truncate">{replyTo.message}</span>
                <button onClick={() => setReplyTo(null)} className="text-gray-500 hover:text-white"><FaTimes size={12} /></button>
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-white/10 bg-white/5">
              <div className="flex items-center gap-2">
                <button onClick={() => { setShowEmoji(!showEmoji); setShowStickers(false); }} className="text-gray-400 hover:text-white"><FaSmile size={18} /></button>
                <button onClick={() => fileInputRef.current?.click()} className="text-gray-400 hover:text-white"><FaPaperclip size={18} /></button>
                <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.zip,.txt,.csv" multiple className="hidden" onChange={handleFileUpload} />
                <input className="input-field flex-1 text-sm" placeholder="Type a message..." value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()} />
                <button onClick={handleSend} disabled={sending || !replyText.trim()}
                  className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center hover:bg-purple-500 disabled:opacity-50">
                  <FaPaperPlane size={13} />
                </button>
              </div>
              {showEmoji && (
                <div ref={emojiRef} className="mt-2 p-2 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex gap-2 mb-2">
                    <button onClick={() => setShowStickers(false)} className={`px-3 py-1 rounded-lg text-xs ${!showStickers ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>Emoji</button>
                    <button onClick={() => setShowStickers(true)} className={`px-3 py-1 rounded-lg text-xs ${showStickers ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>Stickers</button>
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
                    {(showStickers ? STICKERS : EMOJIS).map((e, i) => (
                      <button key={i} onClick={() => showStickers ? handleStickerSend(e) : setReplyText(prev => prev + e)}
                        className={`${showStickers ? 'text-2xl' : 'text-xl'} hover:scale-125 transition-transform`}>{e}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center"><FaWhatsapp className="text-6xl text-gray-600 mx-auto mb-4" /><p className="text-gray-400">Select a chat to start</p></div>
          </div>
        )}
      </div>

      {/* Jitsi Call Overlay */}
      {callStatus !== 'idle' && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
          <div className="relative w-full max-w-5xl h-[85vh] bg-black rounded-2xl overflow-hidden mx-4">
            <div className="absolute top-4 right-4 z-20 flex items-center gap-3">
              <span className="text-white/70 text-sm bg-black/50 px-3 py-1.5 rounded-full">
                {callType === 'audio' ? '🔊 Audio Call' : '📹 Video Call'}
              </span>
              <button onClick={endCall}
                className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-500 shadow-lg hover:scale-105 transition-all">
                <FaPhoneSlash size={18} />
              </button>
            </div>
            <div id="jitsi-container" ref={jitsiContainerRef} className="w-full h-full" />
          </div>
        </div>
      )}

      {/* Incoming Call Notification */}
      {incomingCall && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="bg-gradient-to-b from-[#1e0b4a] to-[#0d0221] rounded-2xl p-8 w-full max-w-sm mx-4 text-center border border-purple-500/20 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <FaPhone className="text-green-400 text-2xl" />
            </div>
            <h3 className="text-white text-lg font-bold mb-2">Incoming Call</h3>
            <p className="text-gray-400 text-sm mb-6">{incomingCall.type === 'audio' ? '🔊 Audio' : '📹 Video'} call from <span className="text-purple-400 font-medium">{selectedConv?.user?.name || selectedConv?.userName || 'User'}</span></p>
            <p className="text-gray-500 text-xs mb-4">Room: {incomingCall.room?.slice(0, 20)}...</p>
            <div className="flex gap-4 justify-center">
              <button onClick={() => { setIncomingCall(null); }}
                className="px-6 py-3 rounded-xl bg-red-600/20 text-red-400 border border-red-500/20 hover:bg-red-600/30 transition-all font-medium">
                Decline
              </button>
              <button onClick={acceptIncomingCall}
                className="px-6 py-3 rounded-xl bg-green-600/20 text-green-400 border border-green-500/20 hover:bg-green-600/30 transition-all font-medium flex items-center gap-2">
                <FaPhone className="text-sm" /> Accept
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
