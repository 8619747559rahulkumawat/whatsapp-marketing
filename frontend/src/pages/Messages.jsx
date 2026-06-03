import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import API from '../utils/api';
import { FaWhatsapp, FaPaperPlane } from 'react-icons/fa';

export default function Messages() {
  const [messages, setMessages] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSendModal, setShowSendModal] = useState(false);
  const [form, setForm] = useState({ to: '', message: '', sessionId: '' });
  const [sending, setSending] = useState(false);

  useEffect(() => { fetchData(); }, []);

   const fetchData = async () => {
     try {
       const [msgRes, sessRes] = await Promise.all([API.get('/messages?limit=50'), API.get('/sessions')]);
       if (msgRes.data.success) setMessages(msgRes.data.messages);
       else console.error('Failed to fetch messages:', msgRes.data?.message || 'Unknown error');
       if (sessRes.data.success) setSessions(sessRes.data.sessions);
       else console.error('Failed to fetch sessions:', sessRes.data?.message || 'Unknown error');
     } catch (error) {
       console.error('Error in fetchData:', error);
     } finally { setLoading(false); }
   };

  const handleSend = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const { data } = await API.post('/messages/send', form);
      if (!data.success) { alert(data.message || 'Send failed'); return; }
      setShowSendModal(false);
      setForm({ to: '', message: '', sessionId: '' });
      fetchData();
    } catch (e) { alert(e.response?.data?.message || e.message || 'Send failed'); } finally { setSending(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Messages</h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">Message history and send new messages</p>
        </div>
        <button onClick={() => setShowSendModal(true)} className="btn-whatsapp px-3 sm:px-4 py-2 rounded-xl text-white text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2">
          <FaPaperPlane /> <span className="hidden sm:inline">Send Message</span><span className="sm:hidden">Send</span>
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="table-header">
              <th className="p-2 sm:p-4 text-left whitespace-nowrap">To</th>
              <th className="p-2 sm:p-4 text-left whitespace-nowrap">Content</th>
              <th className="p-2 sm:p-4 text-left whitespace-nowrap">Type</th>
              <th className="p-2 sm:p-4 text-left whitespace-nowrap">Status</th>
              <th className="p-2 sm:p-4 text-left whitespace-nowrap">Sent At</th>
            </tr></thead>
            <tbody>
              {messages.map((msg, idx) => (
                <motion.tr key={msg._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.02 }} className="table-row">
                  <td className="p-2 sm:p-4 whitespace-nowrap"><div className="flex items-center gap-2"><FaWhatsapp className="text-whatsapp-500" /><span className="text-gray-300">{msg.to}</span></div></td>
                  <td className="p-2 sm:p-4 text-gray-400 text-sm max-w-xs truncate">{msg.content}</td>
                  <td className="p-2 sm:p-4 whitespace-nowrap"><span className="capitalize text-sm text-gray-300">{msg.messageType}</span></td>
                  <td className="p-2 sm:p-4 whitespace-nowrap"><span className={`badge ${msg.status === 'sent' ? 'badge-info' : msg.status === 'delivered' ? 'badge-success' : msg.status === 'failed' ? 'badge-danger' : 'badge-warning'}`}>{msg.status}</span></td>
                  <td className="p-2 sm:p-4 text-gray-400 text-sm whitespace-nowrap">{msg.sentAt ? new Date(msg.sentAt).toLocaleString() : '-'}</td>
                </motion.tr>
              ))}
              {messages.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-500">No messages yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showSendModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowSendModal(false)}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-md border border-white/10" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">Send WhatsApp Message</h2>
            <form onSubmit={handleSend} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">WhatsApp Session</label>
                <select className="input-field" value={form.sessionId} onChange={e => setForm({ ...form, sessionId: e.target.value })} required>
                  <option value="">Select</option>
                  {sessions.filter(s => s.status === 'connected').map(s => (
                    <option key={s._id} value={s.sessionId}>{s.name} ({s.phoneNumber || 'No phone'})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Phone Number</label>
                <input className="input-field" placeholder="e.g., 919876543210" value={form.to} onChange={e => setForm({ ...form, to: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Message</label>
                <textarea className="input-field h-24" placeholder="Type your message..." value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} required />
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button type="button" onClick={() => setShowSendModal(false)} className="px-6 py-2 rounded-xl border border-white/10 text-gray-300">Cancel</button>
                <button type="submit" disabled={sending} className="btn-whatsapp px-6 py-2 rounded-xl text-white flex items-center gap-2">
                  <FaPaperPlane size={14} /> {sending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
