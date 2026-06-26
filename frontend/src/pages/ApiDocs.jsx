import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import API from '../utils/api';
import { HiOutlinePlus, HiOutlineTrash, HiOutlineClipboardCopy } from 'react-icons/hi';
import { FaCode } from 'react-icons/fa';

export default function ApiDocs() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', permissions: ['send'] });

  useEffect(() => { fetchKeys(); }, []);

  const fetchKeys = async () => {
    try {
      const { data } = await API.get('/api/keys');
      if (data.success) setKeys(data.keys);
    } catch { console.error("API Error"); } finally { setLoading(false); }
  };

  const createKey = async (e) => {
    e.preventDefault();
    try {
      await API.post('/api/keys', form);
      setShowModal(false);
      setForm({ name: '', permissions: ['send'] });
      fetchKeys();
    } catch (err) { console.error(err); }
  };

  const deleteKey = async (id) => {
    if (!confirm('Delete this API key?')) return;
    try { await API.delete(`/api/keys/${id}`); fetchKeys(); } catch (err) { console.error(err); }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const endpoints = [
    { method: 'POST', path: '/api/api/send', desc: 'Send a WhatsApp message', body: { to: '919876543210', message: 'Hello', sessionId: '...' } },
    { method: 'POST', path: '/api/api/send-bulk', desc: 'Send bulk messages', body: { contacts: [{ phone: '919876543210' }], message: 'Hello' } },
    { method: 'POST', path: '/api/api/contacts', desc: 'Create a contact', body: { name: 'John', phone: '919876543210' } },
    { method: 'GET', path: '/api/api/reports', desc: 'Get message reports', params: { status: 'sent', limit: 10 } },
    { method: 'POST', path: '/api/api/webhook', desc: 'Trigger webhook', body: { event: 'message.sent', data: {} } },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">API Documentation</h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">Integrate RSendix.pro Smart Bulk Messaging with your apps</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary px-3 sm:px-4 py-2 rounded-xl text-white text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2">
          <HiOutlinePlus /> <span className="hidden sm:inline">Create API Key</span><span className="sm:hidden">API Key</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-white font-semibold">Your API Keys</h3>
          {keys.map(key => (
            <motion.div key={key._id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="glass-card p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-white font-medium">{key.name}</p>
                <button onClick={() => deleteKey(key._id)} className="text-red-400 hover:text-red-300"><HiOutlineTrash size={16} /></button>
              </div>
              <div className="flex items-center gap-2 bg-white/5 rounded-lg p-2">
                <code className="text-xs text-purple-300 flex-1 truncate">{key.key.slice(0, 8)}...{key.key.slice(-4)}</code>
                <button onClick={() => copyToClipboard(key.key)} className="text-gray-400 hover:text-white"><HiOutlineClipboardCopy size={14} /></button>
              </div>
              <div className="flex gap-1 mt-2">
                {key.permissions?.map(p => <span key={p} className="badge badge-info text-xs">{p}</span>)}
              </div>
            </motion.div>
          ))}
          {keys.length === 0 && <p className="text-gray-500 text-sm text-center py-8">No API keys created</p>}
        </div>

        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-white font-semibold">API Endpoints</h3>
          <div className="text-sm text-gray-400 mb-4 bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
            All API requests require the header: <code className="text-purple-300">X-API-Key: your-api-key</code>
          </div>
          {endpoints.map((ep, idx) => (
            <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} className="glass-card overflow-hidden">
              <div className="p-2 sm:p-4 border-b border-white/5 flex items-center gap-3">
                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${ep.method === 'GET' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                  {ep.method}
                </span>
                <code className="text-purple-300 text-sm">{ep.path}</code>
              </div>
              <div className="p-2 sm:p-4">
                <p className="text-gray-400 text-xs sm:text-sm mb-3">{ep.desc}</p>
                {ep.body && (
                  <div className="bg-[#0f0f1a] rounded-lg p-3">
                    <pre className="text-xs text-gray-300">{JSON.stringify(ep.body, null, 2)}</pre>
                  </div>
                )}
                {ep.params && (
                  <div className="bg-[#0f0f1a] rounded-lg p-3">
                    <pre className="text-xs text-gray-300">{JSON.stringify(ep.params, null, 2)}</pre>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {showModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-md border border-white/10" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">Create API Key</h2>
            <form onSubmit={createKey} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-300 mb-2">Key Name</label><input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
              <div><label className="block text-sm font-medium text-gray-300 mb-2">Permissions</label>
                <div className="space-y-2">
                  {['send', 'campaign', 'contacts', 'reports', 'webhook'].map(p => (
                    <label key={p} className="flex items-center gap-2 text-sm text-gray-300">
                      <input type="checkbox" checked={form.permissions.includes(p)} onChange={e => {
                        if (e.target.checked) setForm({ ...form, permissions: [...form.permissions, p] });
                        else setForm({ ...form, permissions: form.permissions.filter(x => x !== p) });
                      }} className="rounded" />
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2 rounded-xl border border-white/10 text-gray-300">Cancel</button>
                <button type="submit" className="btn-primary px-6 py-2 rounded-xl text-white">Create</button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
