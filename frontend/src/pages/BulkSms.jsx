import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import API from '../utils/api';
import { FaWhatsapp, FaUpload, FaImage, FaTrash, FaCheckCircle, FaTimesCircle, FaSpinner, FaDownload, FaRedo } from 'react-icons/fa';

export default function BulkSms() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [numbers, setNumbers] = useState('');
  const [message, setMessage] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [delay, setDelay] = useState(3000);
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState('');
  const [fileBase64, setFileBase64] = useState('');
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState([]);
  const [progress, setProgress] = useState({ total: 0, sent: 0, failed: 0 });
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const [savedContacts, setSavedContacts] = useState([]);
  const [showContacts, setShowContacts] = useState(false);

  useEffect(() => {
    fetchSessions();
    API.get('/contacts?limit=100').then(r => { if (r.data.success) setSavedContacts(r.data.contacts); }).catch(() => {});
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, []);

   const fetchSessions = async () => {
     try {
       const { data } = await API.get('/sessions');
       if (data.success) {
         const live = [];
         for (const s of data.sessions) {
           try {
             const sr = await API.get(`/sessions/${s.sessionId}/status`);
             live.push({ ...s, status: sr.data.status || s.status });
           } catch {
             live.push(s);
           }
         }
         setSessions(live);
       } else {
         console.error('Failed to fetch sessions:', data.message || 'Unknown error');
       }
     } catch (error) {
       console.error('Error in fetchSessions:', error);
     }
   };

  const handleFileSelect = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFilePreview(ev.target.result);
      setFileBase64(ev.target.result);
    };
    reader.readAsDataURL(f);
  };

  const parseNumbers = () => {
    const nums = numbers.split('\n').map(n => n.trim()).filter(n => n);
    const cleaned = nums.map(n => n.replace(/[^+\d]/g, ''));
    return [...new Set(cleaned)];
  };

  const addNumber = (phone) => {
    const existing = numbers.split('\n').map(n => n.trim()).filter(n => n);
    if (!existing.includes(phone)) {
      setNumbers(prev => prev + (prev ? '\n' : '') + phone);
    }
  };

  const dataURItoBlob = (dataURI) => {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    return new Blob([ab], { type: mimeString });
  };

  const handleSend = async () => {
    setError('');
    const parsed = parseNumbers();
    if (parsed.length === 0) { setError('At least one phone number required'); return; }
    if (!message) { setError('Message is required'); return; }
    if (!sessionId) { setError('Select a WhatsApp session'); return; }
    if (!navigator.onLine) { return; }

    setSending(true);
    setResults([]);
    setProgress({ total: parsed.length, sent: 0, failed: 0 });

    const contacts = parsed.map(p => ({ phone: p }));

    try {
      const payload = { sessionId, contacts, messageType: 'text', message, mediaUrl: '', delay };

      if (file && fileBase64) {
        const formData = new FormData();
        const blob = dataURItoBlob(fileBase64);
        formData.append('file', blob, file.name || 'image.png');
        formData.append('sessionId', sessionId);
        formData.append('contacts', JSON.stringify(contacts));
        formData.append('message', message);
        formData.append('delay', delay.toString());

        const { data } = await API.post('/messages/bulk-with-image', formData);

        if (data.results) {
          setResults(data.results);
          setProgress({ total: parsed.length, sent: data.sent || 0, failed: data.failed || 0 });
          if (data.failed > 0) {
            const errors = data.results.filter(r => r.status === 'failed').map(r => r.error).filter(Boolean);
            if (errors.length) setError('Failed: ' + errors[0]);
          }
        }
      } else {
        const { data } = await API.post('/messages/bulk', payload);

        if (data.results) {
          setResults(data.results);
          setProgress({ total: parsed.length, sent: data.sent || 0, failed: data.failed || 0 });
          if (data.failed > 0) {
            const errors = data.results.filter(r => r.status === 'failed').map(r => r.error).filter(Boolean);
            if (errors.length) setError('Failed: ' + errors[0]);
          }
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Send failed';
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  const handleReset = () => {
    setNumbers(''); setMessage(''); setFile(null); setFilePreview(''); setFileBase64('');
    setResults([]); setProgress({ total: 0, sent: 0, failed: 0 }); setError('');
  };

  const parsedCount = parseNumbers().length;
  const connectedSessions = sessions.filter(s => s.status === 'connected');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Bulk WhatsApp Messaging</h1>
          <p className="text-gray-400 text-sm mt-1">Send messages with images to multiple numbers</p>
        </div>
        <button onClick={fetchSessions} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 text-sm">
          <FaRedo size={14} /> Refresh Status
        </button>
      </div>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <FaWhatsapp className="text-whatsapp-500" /> WhatsApp Session
            </h3>
            <select className="input-field" value={sessionId} onChange={e => setSessionId(e.target.value)}>
              <option value="">-- Select Connected Session --</option>
              {connectedSessions.map(s => (
                <option key={s._id} value={s.sessionId}>{s.name} ({s.phone || s.phoneNumber || 'No phone'})</option>
              ))}
            </select>
            {connectedSessions.length === 0 && (
              <div className="mt-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-red-400 text-sm">No connected session! Go to <a href="/whatsapp" className="underline font-medium">WhatsApp Sessions</a> to connect.</p>
              </div>
            )}
            {connectedSessions.length > 0 && (
              <p className="text-green-400 text-xs mt-2 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                {connectedSessions.length} session(s) connected
              </p>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold flex items-center gap-2"><FaDownload /> Phone Numbers</h3>
              <span className="text-sm text-gray-400">{parsedCount} numbers</span>
            </div>
            {showContacts && (
              <div className="mb-4 p-3 rounded-xl bg-white/5 max-h-32 overflow-y-auto">
                <p className="text-xs text-gray-400 mb-2">Click to add:</p>
                <div className="flex flex-wrap gap-1">
                  {savedContacts.map(c => (
                    <button key={c._id} onClick={() => addNumber(c.phone)} className="px-2 py-1 text-xs rounded-lg bg-purple-500/10 text-purple-300 hover:bg-purple-500/20">
                      {c.name || c.phone}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <textarea
              className="input-field h-36 font-mono text-sm"
              value={numbers}
              onChange={e => setNumbers(e.target.value)}
              placeholder={`Phone numbers (one per line):\n919876543210\n917732837173`}
            />
            <button onClick={() => setShowContacts(!showContacts)} className="text-xs text-purple-400 hover:text-purple-300 mt-2">+ Add from contacts</button>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-6">
            <h3 className="text-white font-semibold mb-4">Delay Between Messages</h3>
            <div className="flex items-center gap-4">
              <input type="range" min="1000" max="10000" step="500" value={delay} onChange={e => setDelay(parseInt(e.target.value))} className="flex-1 accent-purple-500" />
              <span className="text-purple-300 font-mono w-16 text-right">{delay}ms</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">Higher delay = safer. Minimum 1s to avoid WhatsApp block.</p>
            <p className="text-xs text-red-400/70 mt-1">⚠️ Sending too fast WILL block your WhatsApp number. Keep 3s+ for safety.</p>
          </motion.div>
        </div>

        <div className="space-y-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-6">
            <h3 className="text-white font-semibold mb-4">Message Content</h3>
            <textarea className="input-field h-32" value={message} onChange={e => setMessage(e.target.value)} placeholder="Type your message here..." />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><FaImage /> Attach Image (Optional)</h3>
            <input type="file" ref={fileRef} accept="image/*" onChange={handleFileSelect} className="hidden" />
            {filePreview ? (
              <div className="relative">
                <img src={filePreview} alt="Preview" className="w-full h-48 object-cover rounded-xl" />
                <button onClick={() => { setFile(null); setFilePreview(''); setFileBase64(''); }} className="absolute top-2 right-2 p-2 rounded-lg bg-red-500/80 text-white hover:bg-red-600"><FaTrash size={14} /></button>
              </div>
            ) : (
              <button onClick={() => fileRef.current.click()} className="w-full h-32 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-purple-500/50 hover:text-purple-400 transition-all">
                <FaUpload size={24} className="mb-2" /><span className="text-sm">Click to upload image</span>
              </button>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <button onClick={handleSend} disabled={sending || parsedCount === 0 || !message || !sessionId}
              className="btn-whatsapp w-full py-4 rounded-xl text-white font-bold text-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed">
              {sending ? <><FaSpinner className="animate-spin" /> Sending... {progress.sent + progress.failed}/{progress.total}</>
                : <><FaWhatsapp size={24} /> Send to {parsedCount} Numbers</>}
            </button>
          </motion.div>

          {results.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Results</h3>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-green-400 flex items-center gap-1"><FaCheckCircle /> {progress.sent}</span>
                  <span className="text-red-400 flex items-center gap-1"><FaTimesCircle /> {progress.failed}</span>
                </div>
              </div>
              <div className="w-full bg-white/5 rounded-full h-3 mb-4 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-green-500 to-purple-500 transition-all duration-500" style={{ width: `${progress.total > 0 ? ((progress.sent + progress.failed) / progress.total * 100) : 0}%` }} />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {results.map((r, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 rounded-lg text-sm">
                    {r.status === 'sent' ? <FaCheckCircle className="text-green-400 flex-shrink-0" /> : <FaTimesCircle className="text-red-400 flex-shrink-0" />}
                    <span className="text-gray-300 font-mono text-xs">{r.phone}</span>
                    <span className={`ml-auto text-xs ${r.status === 'sent' ? 'text-green-400' : 'text-red-400'}`}>
                      {r.error || r.status}
                    </span>
                  </div>
                ))}
              </div>
              <button onClick={handleReset} className="mt-4 w-full px-4 py-2 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 text-sm">
                Send New Batch
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
