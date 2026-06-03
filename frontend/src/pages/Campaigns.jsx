import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import API from '../utils/api';
import { HiOutlinePlus, HiOutlinePlay, HiOutlinePause, HiOutlineTrash } from 'react-icons/hi';
import { FaRocket, FaWhatsapp } from 'react-icons/fa';

const campaignTypes = ['bulk', 'dp', 'button', 'premium', 'brand', 'scheduled'];
const messageTypes = ['text', 'image', 'video', 'document', 'audio'];

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: '', type: 'bulk', sessionId: '', messageType: 'text',
    message: '', delay: 2000, isPersonalized: false, contactIds: [], groupIds: [], buttons: []
  });
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [campRes, sessRes, contRes, grpRes] = await Promise.all([
        API.get('/campaigns'),
        API.get('/sessions'),
        API.get('/contacts?limit=200'),
        API.get('/contacts/groups')
      ]);
      if (campRes.data.success) setCampaigns(campRes.data.campaigns);
      if (sessRes.data.success) setSessions(sessRes.data.sessions);
      if (contRes.data.success) setContacts(contRes.data.contacts);
      if (grpRes.data.success) setGroups(grpRes.data.groups);
    } catch { } finally { setLoading(false); }
  };

  const handleAction = async (id, action) => {
    try {
      await API.post(`/campaigns/${id}/${action}`);
      fetchData();
    } catch { }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this campaign?')) return;
    try {
      await API.delete(`/campaigns/${id}`);
      fetchData();
    } catch { }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await API.post('/campaigns', form);
      setShowModal(false);
      setForm({ name: '', type: 'bulk', sessionId: '', messageType: 'text', message: '', delay: 2000, isPersonalized: false, contactIds: [], groupIds: [], buttons: [] });
      fetchData();
    } catch { }
  };

  const getStatusBadge = (status) => {
    const styles = { draft: 'badge-info', running: 'badge-success', paused: 'badge-warning', completed: 'badge-purple', failed: 'badge-danger', cancelled: 'badge-warning' };
    return `badge ${styles[status] || 'badge-info'}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Campaigns</h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">Manage your WhatsApp campaigns</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary px-3 sm:px-4 py-2 rounded-xl text-white text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2">
          <HiOutlinePlus /> <span className="hidden sm:inline">New Campaign</span><span className="sm:hidden">Campaign</span>
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="p-2 sm:p-4 text-left whitespace-nowrap">Name</th>
                <th className="p-2 sm:p-4 text-left whitespace-nowrap">Type</th>
                <th className="p-2 sm:p-4 text-left whitespace-nowrap">Status</th>
                <th className="p-2 sm:p-4 text-left whitespace-nowrap">Sent</th>
                <th className="p-2 sm:p-4 text-left whitespace-nowrap">Delivered</th>
                <th className="p-2 sm:p-4 text-left whitespace-nowrap">Failed</th>
                <th className="p-2 sm:p-4 text-left whitespace-nowrap">Created</th>
                <th className="p-2 sm:p-4 text-left whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((camp, idx) => (
                <motion.tr
                  key={camp._id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="table-row"
                >
                  <td className="p-2 sm:p-4 whitespace-nowrap">
                    <Link to={`/campaigns/${camp._id}`} className="text-white font-medium hover:text-purple-400">{camp.name}</Link>
                  </td>
                  <td className="p-2 sm:p-4 whitespace-nowrap"><span className="capitalize text-sm text-gray-300">{camp.type}</span></td>
                  <td className="p-2 sm:p-4 whitespace-nowrap"><span className={getStatusBadge(camp.status)}>{camp.status}</span></td>
                  <td className="p-2 sm:p-4 text-gray-300 whitespace-nowrap">{camp.sentCount}</td>
                  <td className="p-2 sm:p-4 text-gray-300 whitespace-nowrap">{camp.deliveredCount}</td>
                  <td className="p-2 sm:p-4 text-gray-300 whitespace-nowrap">{camp.failedCount}</td>
                  <td className="p-2 sm:p-4 text-gray-400 text-sm whitespace-nowrap">{new Date(camp.createdAt).toLocaleDateString()}</td>
                  <td className="p-2 sm:p-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {camp.status === 'draft' && (
                        <button onClick={() => handleAction(camp._id, 'start')} className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20" title="Start"><HiOutlinePlay size={16} /></button>
                      )}
                      {camp.status === 'running' && (
                        <button onClick={() => handleAction(camp._id, 'pause')} className="p-2 rounded-lg bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20" title="Pause"><HiOutlinePause size={16} /></button>
                      )}
                      {camp.status === 'paused' && (
                        <button onClick={() => handleAction(camp._id, 'resume')} className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20" title="Resume"><HiOutlinePlay size={16} /></button>
                      )}
                      {(camp.status === 'draft' || camp.status === 'failed' || camp.status === 'completed') && (
                        <button onClick={() => handleDelete(camp._id)} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20" title="Delete"><HiOutlineTrash size={16} /></button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
              {campaigns.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-gray-500">No campaigns yet. Create your first campaign!</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/10" onClick={e => e.stopPropagation()}>
              <h2 className="text-xl font-bold text-white mb-6">Create New Campaign</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Campaign Name</label>
                    <input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Campaign Type</label>
                    <select className="input-field" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                      {campaignTypes.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Message Type</label>
                    <select className="input-field" value={form.messageType} onChange={e => setForm({ ...form, messageType: e.target.value })}>
                      {messageTypes.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">WhatsApp Session</label>
                    <select className="input-field" value={form.sessionId} onChange={e => setForm({ ...form, sessionId: e.target.value })} required>
                      <option value="">Select Session</option>
                      {sessions.filter(s => s.status === 'connected').map(s => (
                        <option key={s._id} value={s._id}>{s.name} ({s.phoneNumber || 'No phone'})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Delay (ms)</label>
                     <input type="number" className="input-field" value={form.delay} onChange={e => setForm({ ...form, delay: parseInt(e.target.value) })} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Message Content</label>
                  <textarea className="input-field h-24" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="Use {name}, {phone}, {email} for personalization" required />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={form.isPersonalized} onChange={e => setForm({ ...form, isPersonalized: e.target.checked })} className="rounded" />
                  <label className="text-sm text-gray-300">Enable Personalization</label>
                </div>
                <div className="flex gap-3 justify-end pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5">Cancel</button>
                  <button type="submit" className="btn-primary px-6 py-2 rounded-xl text-white">Create Campaign</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
