import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import API from '../utils/api';
import { connectSocket, onReconnect } from '../utils/socket';
import { FaWhatsapp, FaPlus, FaTrash, FaRedo, FaQrcode, FaMobileAlt, FaCheckCircle, FaUser, FaPhone, FaVideo, FaPhoneSlash, FaLink } from 'react-icons/fa';
import { HiOutlineStop, HiOutlineRefresh } from 'react-icons/hi';
import { useAuth } from '../contexts/AuthContext';

export default function WhatsAppSessions() {
  const { user: currentUser } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [connectMode, setConnectMode] = useState('qr');
  const [pairingSession, setPairingSession] = useState(null);
  const [pairingPhone, setPairingPhone] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [pairingLoading, setPairingLoading] = useState(false);
  
  // Sockets aur timers ke liye Refs (Anti-leak)
  const socketRef = useRef(null);
  const qrTimerRef = useRef(null);
  const jitsiRef = useRef(null);

  const [callSession, setCallSession] = useState(null);
  const [callPhone, setCallPhone] = useState('');
  const [callType, setCallType] = useState('video');
  const [callActive, setCallActive] = useState(false);
  const [callRoom, setCallRoom] = useState('');

  // Sessions fetch karne ka function
  const fetchSessions = async () => {
    try {
      const { data } = await API.get('/sessions');
      if (data.success) {
        setSessions(data.sessions);
        // Pehle se majood socket connection use karein
        if (socketRef.current) {
          data.sessions.forEach(s => socketRef.current.emit('join:session', s.sessionId));
        }
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => {
    // Socket ko sirf ek baar connect karein aur ref me save karein
    const socket = connectSocket();
    socketRef.current = socket;

    fetchSessions();

    // Socket Events Listeners
    socket.on('session:update', (data) => {
      try {
        setSessions(prev => prev.map(s =>
          s.sessionId === data.sessionId ? { ...s, status: data.status, phoneNumber: data.phone || s.phoneNumber } : s
        ));
      } catch (error) {
        console.error('Error in session:update handler:', error);
      }
    });

    socket.on('qr:generated', (data) => {
      try {
        setSessions(prev => prev.map(s =>
          s.sessionId === data.sessionId ? { ...s, qrCode: data.qr, qr: data.qr, status: 'connecting' } : s
        ));
      } catch (error) {
        console.error('Error in qr:generated handler:', error);
      }
    });

    socket.on('session:connected', (data) => {
      fetchSessions();
    });

    socket.on('session:disconnected', (data) => {
      setSessions(prev => prev.map(s =>
        s.sessionId === data.sessionId ? { ...s, status: 'disconnected', qrCode: '' } : s
      ));
    });

    socket.on('pairing:code', (data) => {
      setPairingCode(prev => data.pairingCode);
      setPairingLoading(false);
    });

    const unsubReconnect = onReconnect(() => {
      fetchSessions();
    });

    // Polling (30s) and QR auto-refresh for connecting sessions
    const pollInterval = setInterval(fetchSessions, 30000);

    // Auto-refresh QR for connecting sessions every 5s
    const qrRefreshInterval = setInterval(() => {
      setSessions(prev => {
        const connecting = prev.filter(s => s.status === 'connecting' && !s.qrCode && !s.qr);
        if (connecting.length === 0) return prev;
        connecting.forEach(s => {
          API.get(`/sessions/${s.sessionId}/qr`).then(({ data }) => {
            if (data.qr) {
              setSessions(inner => inner.map(x =>
                x.sessionId === s.sessionId ? { ...x, qrCode: data.qr, qr: data.qr, status: data.status } : x
              ));
            }
          }).catch(() => {});
        });
        return prev;
      });
    }, 5000);

    return () => {
      socket.off('session:update');
      socket.off('qr:generated');
      socket.off('session:connected');
      socket.off('session:disconnected');
      socket.off('pairing:code');
      clearInterval(pollInterval);
      clearInterval(qrRefreshInterval);
      if (qrTimerRef.current) clearInterval(qrTimerRef.current);
      unsubReconnect();
    };
  }, []);

  const createSession = async () => {
    try {
      const { data } = await API.post('/sessions', { name: sessionName });
      setShowNewModal(false);
      setSessionName('');
      setSessions(prev => [data.session, ...prev]);
      
      if (socketRef.current) {
        socketRef.current.emit('join:session', data.session.sessionId);
      }

      // If pairing mode selected, immediately open pairing code modal
      if (connectMode === 'pairing') {
        setTimeout(() => {
          setPairingSession(data.session.sessionId);
          setPairingPhone('');
          setPairingCode('');
        }, 500);
      }
    } catch (error) {
      console.error('Error creating session:', error);
      alert('Failed to create session: ' + (error.response?.data?.message || error.message));
    }
  };

  const disconnectSession = async (id) => {
    try {
      await API.post(`/sessions/${id}/disconnect`);
      fetchSessions();
    } catch (error) {
      console.error('Error disconnecting session:', error);
      alert('Failed to disconnect session: ' + (error.response?.data?.message || error.message));
    }
  };

  const reconnectSession = async (id) => {
    try {
      await API.post(`/sessions/${id}/reconnect`);
      if (socketRef.current) {
        socketRef.current.emit('join:session', id);
      }
      setSessions(prev => prev.map(s =>
        s.sessionId === id ? { ...s, status: 'connecting' } : s
      ));
    } catch (error) {
      console.error('Error reconnecting session:', error);
      alert('Failed to reconnect session: ' + (error.response?.data?.message || error.message));
    }
  };

  const deleteSession = async (id) => {
    if (!confirm('Delete this session permanently?')) return;
    try {
      await API.delete(`/sessions/${id}`);
      fetchSessions();
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Failed to delete session: ' + (error.response?.data?.message || error.message));
    }
  };

  const refreshQr = async (id) => {
    try {
      const { data } = await API.get(`/sessions/${id}/qr`);
      setSessions(prev => prev.map(s =>
        s.sessionId === id ? { ...s, qrCode: data.qr, qr: data.qr, status: data.status } : s
      ));
    } catch (error) {
      console.error('Error refreshing QR:', error);
    }
  };

  const startSessionCall = async () => {
    if (!callPhone.trim() || !callSession) return;
    const room = `rsendix_call_${Date.now()}`;
    const link = `https://meet.jit.si/${room}`;
    const msg = `${callType === 'audio' ? '🔊 Audio' : '📹 Video'} Call\nJoin: ${link}`;
    try {
      await API.post('/messages/send', { sessionId: callSession.sessionId, to: callPhone, messageType: 'text', message: msg });
    } catch (error) {
      console.error('Error sending call invite message:', error);
    }
    setCallRoom(room);
    setCallActive(true);
    setCallSession(null);
    setCallPhone('');
    setTimeout(() => initJitsi(room, callType), 500);
  };

  const initJitsi = (room, type) => {
    const existing = document.querySelector('#session-jitsi-container iframe');
    if (existing) existing.remove();
    const loadJitsi = () => {
      const container = document.getElementById('session-jitsi-container');
      if (!container) return;
      const options = {
        roomName: room,
        parentNode: container,
        configOverrides: { startWithAudioMuted: false, startWithVideoMuted: type === 'audio', prejoinPageEnabled: false },
        interfaceConfigOverrides: { SHOW_JITSI_WATERMARK: false, SHOW_WATERMARK_FOR_GUESTS: false },
      };
      jitsiRef.current = new window.JitsiMeetExternalAPI('meet.jit.si', options);
      jitsiRef.current.addListener('readyToClose', endSessionCall);
      jitsiRef.current.addListener('videoConferenceLeft', endSessionCall);
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

  const endSessionCall = () => {
    if (jitsiRef.current) { 
      try { jitsiRef.current.dispose(); } catch { console.error('Operation failed'); } 
      jitsiRef.current = null; 
    }
    const container = document.getElementById('session-jitsi-container');
    if (container) container.innerHTML = '';
    setCallActive(false);
    setCallRoom('');
  };

  const [chatSession, setChatSession] = useState(null);
  const [chatPhone, setChatPhone] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  const loadChat = async () => {
    if (!chatSession || !chatPhone.trim()) return;
    setChatLoading(true);
    try {
      const phone = chatPhone.replace(/[^0-9]/g, '');
      const { data } = await API.get(`/sessions/${chatSession}/chat/${phone}@s.whatsapp.net?limit=100`);
      if (data.success) setChatMessages(data.messages || []);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to load chat');
    } finally { setChatLoading(false); }
  };

  const exportChat = async () => {
    if (!chatMessages.length) return;
    try {
      const rows = chatMessages.map(m => ({
        'Sender': m.isMe ? 'Me' : m.senderPhone,
        'Content': m.content,
        'Type': m.type,
        'Timestamp': new Date(m.timestamp).toLocaleString(),
        'Direction': m.isMe ? 'Sent' : 'Received'
      }));
      const csv = ['Sender,Content,Type,Timestamp,Direction', ...rows.map(r =>
        `"${r.Sender}","${r.Content.replace(/"/g, '""')}","${r.Type}","${r.Timestamp}","${r.Direction}"`
      )].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `chat-${chatPhone}.csv`; a.click();
    } catch (err) { alert('Export failed'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">WhatsApp Sessions</h1>
          <p className="text-gray-400 text-sm mt-1">Connect your WhatsApp for multi-device messaging</p>
        </div>
        <button onClick={() => { setShowNewModal(true); setConnectMode('qr'); }} className="btn-whatsapp px-4 py-2 rounded-xl text-white text-sm font-medium flex items-center gap-2">
          <FaPlus /> Add Session
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {sessions.map((session, idx) => (
          <motion.div
            key={session._id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="glass-card overflow-hidden"
          >
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                    session.status === 'connected' ? 'bg-green-500/20 text-green-400' :
                    session.status === 'connecting' ? 'bg-yellow-500/20 text-yellow-400 animate-pulse' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {session.status === 'connected' ? <FaCheckCircle /> : <FaWhatsapp />}
                  </div>
                  <div>
                    <p className="text-white font-medium text-lg">{session.name}</p>
                    <p className="text-sm text-gray-400">{session.phone || session.phoneNumber || 'Not connected'}</p>
                    {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && session.userId?.name && (
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <FaUser size={10} /> {session.userId.name} {session.userId.phone ? `(${session.userId.phone})` : ''}
                      </p>
                    )}
                  </div>
                </div>
                <span className={`w-3 h-3 rounded-full ${
                  session.status === 'connected' ? 'bg-green-400 shadow-lg shadow-green-500/30' :
                  session.status === 'connecting' ? 'bg-yellow-400 animate-pulse shadow-lg shadow-yellow-500/30' :
                  'bg-gray-500'
                }`} />
              </div>

              <div className="flex items-center justify-between text-sm mb-4 p-3 rounded-xl bg-white/5">
                <span className="text-gray-400">Status</span>
                <span className={`font-semibold capitalize ${
                  session.status === 'connected' ? 'text-green-400' :
                  session.status === 'connecting' ? 'text-yellow-400' :
                  'text-gray-400'
                }`}>
                  {session.status === 'connecting' ? 'Connecting...' : session.status}
                </span>
              </div>

              {(session.status === 'connecting' && (session.qrCode || session.qr)) && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-3 text-yellow-400 text-sm">
                    <FaMobileAlt />
                    <span>Open WhatsApp &gt; Linked Devices &gt; Scan</span>
                  </div>
                  <div className="flex flex-col items-center p-4 rounded-xl bg-white">
                    <img src={session.qrCode || session.qr} alt="WhatsApp QR" className="w-48 h-48" />
                    <div className="flex gap-2 mt-3 w-full">
                      <button onClick={() => {
                        const qrLink = `${window.location.origin}/qr/${session.sessionId}`;
                        navigator.clipboard?.writeText(qrLink);
                        alert('QR Link copied! Share this link with anyone to scan.');
                      }} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-xs font-medium transition-all">
                        <FaLink size={12} /> Copy QR Link
                      </button>
                      <button onClick={() => {
                        window.open(`${window.location.origin}/qr/${session.sessionId}`, '_blank');
                      }} className="flex items-center justify-center px-3 py-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 text-xs transition-all">
                        <FaQrcode size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 mt-2">
                {session.status === 'connected' && (
                  <>
                    <button onClick={() => { setChatSession(session.sessionId); setChatPhone(''); setChatMessages([]); }}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-sm font-medium transition-all">
                      <FaWhatsapp size={14} /> Chat
                    </button>
                    <button onClick={() => { setCallSession(session); setCallType('audio'); setCallPhone(''); }}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 text-sm font-medium transition-all">
                      <FaPhone size={14} /> Audio
                    </button>
                    <button onClick={() => { setCallSession(session); setCallType('video'); setCallPhone(''); }}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 text-sm font-medium transition-all">
                      <FaVideo size={14} /> Video
                    </button>
                    <button onClick={() => disconnectSession(session.sessionId)}
                      className="flex items-center justify-center px-3 py-2.5 rounded-lg bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-all">
                      <HiOutlineStop size={16} />
                    </button>
                  </>
                )}
                {session.status === 'disconnected' && (
                  <button onClick={() => reconnectSession(session.sessionId)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 text-sm font-medium transition-all">
                    <FaRedo size={14} /> Reconnect
                  </button>
                )}
                {session.status === 'connecting' && (
                  <>
                    <button onClick={() => refreshQr(session.sessionId)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-sm font-medium transition-all">
                      <HiOutlineRefresh size={16} /> Refresh QR
                    </button>
                    <button onClick={() => { setPairingSession(session.sessionId); setPairingPhone(''); setPairingCode(''); }}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 text-sm font-medium transition-all">
                      <FaLink size={14} /> Pair Code
                    </button>
                  </>
                )}
                <button onClick={() => deleteSession(session.sessionId)}
                  className="flex items-center justify-center px-3 py-2.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all">
                  <FaTrash size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
        {sessions.length === 0 && !loading && (
          <div className="col-span-full text-center py-20">
            <FaWhatsapp className="text-6xl text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg font-medium">No WhatsApp Sessions</p>
            <p className="text-gray-500 text-sm mt-2">Click "Add Session" to connect your WhatsApp</p>
          </div>
        )}
      </div>

      {/* New Session Modal */}
      {showNewModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowNewModal(false)}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-sm border border-white/10" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/20 text-green-400 flex items-center justify-center text-xl"><FaWhatsapp /></div>
              <div>
                <h2 className="text-lg font-bold text-white">New WhatsApp Session</h2>
                <p className="text-gray-400 text-sm">Choose connection method</p>
              </div>
            </div>
            <div className="space-y-4">
              <input className="input-field" placeholder="Session name (optional)" value={sessionName} onChange={e => setSessionName(e.target.value)} autoFocus />
              
              <div className="flex gap-2 bg-white/5 rounded-xl p-1">
                <button onClick={() => setConnectMode('qr')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${connectMode === 'qr' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>
                  <FaQrcode size={14} /> QR Scan
                </button>
                <button onClick={() => setConnectMode('pairing')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${connectMode === 'pairing' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>
                  <FaLink size={14} /> Pairing Link
                </button>
              </div>

              {connectMode === 'pairing' && (
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-sm text-purple-300 text-left">
                  <FaLink className="inline mr-2" />After creating, you'll enter a phone number and get a pairing code to share.
                </div>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <button onClick={() => setShowNewModal(false)} className="px-5 py-2.5 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5">Cancel</button>
                <button onClick={createSession} className="px-5 py-2.5 rounded-xl bg-green-600 text-white font-medium flex items-center gap-2"><FaPlus size={14} /> Create</button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Call Phone Input Modal */}
      {callSession && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setCallSession(null)}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-sm border border-white/10" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${callType === 'audio' ? 'bg-green-500/20 text-green-400' : 'bg-purple-500/20 text-purple-400'}`}>
                {callType === 'audio' ? <FaPhone /> : <FaVideo />}
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{callType === 'audio' ? 'Audio' : 'Video'} Call</h2>
                <p className="text-gray-400 text-sm">Session: {callSession.name}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Phone Number</label>
                <input className="input-field" placeholder="e.g., 919876543210" value={callPhone} onChange={e => setCallPhone(e.target.value)} autoFocus />
                <p className="text-xs text-gray-500 mt-1">Enter number with country code (without +)</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm text-blue-300">
                <FaWhatsapp className="inline mr-2" />A WhatsApp message will be sent with the call link.
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button onClick={() => setCallSession(null)} className="px-5 py-2.5 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5">Cancel</button>
                <button onClick={startSessionCall} disabled={!callPhone.trim()}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 text-white font-medium disabled:opacity-50 flex items-center gap-2">
                  {callType === 'audio' ? <FaPhone size={14} /> : <FaVideo size={14} />} Start Call
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Pairing Code Modal */}
      {pairingSession && !pairingCode && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => { setPairingSession(null); setPairingCode(''); }}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-sm border border-white/10" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center text-xl"><FaLink /></div>
              <div>
                <h2 className="text-lg font-bold text-white">Link with Phone Number</h2>
                <p className="text-gray-400 text-sm">Enter the phone number to pair</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Phone Number (with country code)</label>
                <input className="input-field" placeholder="e.g., 919876543210" value={pairingPhone} onChange={e => setPairingPhone(e.target.value)} autoFocus />
                <p className="text-xs text-gray-500 mt-1">Without + sign. e.g., 919876543210 for India</p>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button onClick={() => { setPairingSession(null); setPairingCode(''); }} className="px-5 py-2.5 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5">Cancel</button>
                <button onClick={async () => {
                  if (!pairingPhone.trim()) return;
                  setPairingLoading(true);
                  try {
                    const { data } = await API.post(`/sessions/${pairingSession}/pairing-code`, { phone: pairingPhone });
                    if (data.success) setPairingCode(data.pairingCode);
                    else alert(data.message || 'Failed to generate pairing code');
                  } catch (error) {
                    alert('Error: ' + (error.response?.data?.message || error.message));
                  }
                  setPairingLoading(false);
                }} disabled={!pairingPhone.trim() || pairingLoading}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 text-white font-medium disabled:opacity-50 flex items-center gap-2">
                  {pairingLoading ? 'Generating...' : <><FaLink size={14} /> Generate Code</>}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Pairing Code Display */}
      {pairingCode && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => { setPairingSession(null); setPairingCode(''); }}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#1a1a2e] rounded-2xl p-8 w-full max-w-sm border border-white/10 text-center" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-3xl mx-auto mb-4"><FaCheckCircle /></div>
            <h2 className="text-xl font-bold text-white mb-2">Pairing Code</h2>
            <p className="text-gray-400 text-sm mb-6">Share this code with the recipient. They open WhatsApp &gt; Linked Devices &gt; Link with Phone Number</p>
            <div className="bg-white/5 rounded-xl p-6 mb-6">
              <p className="text-3xl font-mono font-bold text-green-400 tracking-widest select-all">{pairingCode}</p>
            </div>
            <div className="space-y-3 mb-4">
              <button onClick={() => {
                navigator.clipboard?.writeText(pairingCode);
                alert('Code copied to clipboard!');
              }} className="w-full px-6 py-3 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-500 transition-all flex items-center justify-center gap-2">
                <FaLink size={14} /> Copy Code
              </button>
              <button onClick={() => {
                const waLink = `https://wa.me/?text=${encodeURIComponent('Your WhatsApp pairing code is: ' + pairingCode + '\n\nOpen WhatsApp → Linked Devices → Link with Phone Number → Enter this code')}`;
                navigator.clipboard?.writeText(waLink);
                alert('Shareable link copied! Send this link to anyone.');
              }} className="w-full px-6 py-3 rounded-xl bg-green-600 text-white font-medium hover:bg-green-500 transition-all flex items-center justify-center gap-2">
                <FaWhatsapp size={14} /> Copy Share Link
              </button>
              <button onClick={() => {
                const waLink = `https://wa.me/?text=${encodeURIComponent('Your WhatsApp pairing code is: ' + pairingCode + '\n\nOpen WhatsApp → Linked Devices → Link with Phone Number → Enter this code')}`;
                window.open(waLink, '_blank');
              }} className="w-full px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 transition-all flex items-center justify-center gap-2">
                <FaWhatsapp size={14} /> Share via WhatsApp
              </button>
            </div>
            <button onClick={() => { setPairingSession(null); setPairingCode(''); }} className="px-6 py-2.5 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 w-full">
              Close
            </button>
          </motion.div>
        </motion.div>
      )}

      {/* Chat History Modal */}
      {chatSession && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => { setChatSession(null); setChatMessages([]); }}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-2xl border border-white/10 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Chat History</h2>
              <button onClick={() => { setChatSession(null); setChatMessages([]); }} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="flex gap-2 mb-4">
              <input className="input-field flex-1" placeholder="Enter phone number (with country code)" value={chatPhone}
                onChange={e => setChatPhone(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadChat()} />
              <button onClick={loadChat} disabled={chatLoading || !chatPhone.trim()}
                className="btn-primary px-4 py-2 rounded-xl text-white flex items-center gap-2 disabled:opacity-50">
                {chatLoading ? <span className="animate-spin">⏳</span> : <FaWhatsapp />} Load
              </button>
              <button onClick={exportChat} disabled={!chatMessages.length}
                className="px-3 py-2 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-30" title="Export Excel">
                <HiOutlineDownload size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
              {chatMessages.length === 0 && !chatLoading && (
                <div className="text-center py-12 text-gray-500">Enter a phone number and click Load to view chat</div>
              )}
              {chatLoading && <div className="text-center py-12 text-gray-400"><span className="animate-spin inline-block">⏳</span> Loading messages...</div>}
              {chatMessages.map((m, idx) => (
                <motion.div key={m.msgId || idx} initial={{ opacity: 0, x: m.isMe ? 20 : -20 }} animate={{ opacity: 1, x: 0 }}
                  className={`flex ${m.isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-2xl ${m.isMe ? 'bg-purple-600/20 rounded-tr-sm' : 'bg-white/5 rounded-tl-sm'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-medium text-gray-500">{m.isMe ? 'Me' : m.senderPhone}</span>
                      <span className="text-[9px] text-gray-600">{new Date(m.timestamp).toLocaleString()}</span>
                      {m.type !== 'text' && <span className="badge text-[9px] px-1.5 bg-blue-500/20 text-blue-300 rounded">{m.type}</span>}
                    </div>
                    <p className="text-sm text-gray-200 break-words">{m.content}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Jitsi Call Overlay */}
      {callActive && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
          <div className="relative w-full max-w-5xl h-[85vh] bg-black rounded-2xl overflow-hidden mx-4">
            <div className="absolute top-4 right-4 z-20 flex items-center gap-3">
              <span className="text-white/70 text-sm bg-black/50 px-3 py-1.5 rounded-full">
                {callType === 'audio' ? '🔊 Audio Call' : '📹 Video Call'}
              </span>
              <button onClick={endSessionCall}
                className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-500 shadow-lg hover:scale-105 transition-all">
                <FaPhoneSlash size={18} />
              </button>
            </div>
            <div id="session-jitsi-container" className="w-full h-full" />
          </div>
        </div>
      )}
    </div>
  );
}