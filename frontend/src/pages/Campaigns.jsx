import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import API from '../utils/api';
import { HiOutlinePlus, HiOutlinePlay, HiOutlinePause, HiOutlineTrash } from 'react-icons/hi';
import { useAutoSave } from '../hooks/useAutoSave';
import FormField from '../components/FormField';

const campaignTypes = ['bulk', 'dp', 'button', 'premium', 'brand', 'scheduled'];
const messageTypes = ['text', 'image', 'video', 'document', 'audio'];

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: '', type: 'bulk', sessionId: '', messageType: 'text',
    message: '', delay: 2000, minDelaySeconds: 20, maxDelaySeconds: 45, dailyLimit: 200,
    requireOptIn: true, appendOptOut: true, stopOnHighFailureRate: true,
    isPersonalized: false, contactIds: [], groupIds: [], buttons: []
  });
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [draftIndicator, setDraftIndicator] = useState(false);

  const { restore, clearDraft, hasDraft } = useAutoSave('campaign_draft', form);

  const handleChange = useCallback((name, value) => {
    setForm(prev => ({ ...prev, [name]: value }));
  }, []);

  const toggleSelection = useCallback((field, id) => {
    setForm(prev => {
      const current = prev[field] || [];
      const exists = current.includes(id);
      return {
        ...prev,
        [field]: exists ? current.filter(item => item !== id) : [...current, id]
      };
    });
  }, []);

  useEffect(() => {
    if (hasDraft()) {
      const saved = restore();
      if (saved && saved.name) {
        if (confirm('You have an unsaved campaign draft. Would you like to restore it?')) {
          setForm(saved);
        } else {
          clearDraft();
        }
      }
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!showModal || !form.name) return;
    setDraftIndicator(false);
    const timer = setTimeout(() => {
      setDraftIndicator(true);
    }, 2000);
    const innerTimer = setTimeout(() => setDraftIndicator(false), 4000);
    return () => { clearTimeout(timer); clearTimeout(innerTimer); setDraftIndicator(false); };
  }, [form, showModal]);

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
    } catch { console.error("API Error"); } finally { setLoading(false); }
  };

  const handleAction = async (id, action) => {
    try {
      await API.post(`/campaigns/${id}/${action}`);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this campaign?')) return;
    try {
      await API.delete(`/campaigns/${id}`);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await API.post('/campaigns', form);
      clearDraft();
      setShowModal(false);
      setForm({
        name: '', type: 'bulk', sessionId: '', messageType: 'text',
        message: '', delay: 2000, minDelaySeconds: 20, maxDelaySeconds: 45, dailyLimit: 200,
        requireOptIn: true, appendOptOut: true, stopOnHighFailureRate: true,
        isPersonalized: false, contactIds: [], groupIds: [], buttons: []
      });
      fetchData();
    } catch (err) { console.error(err); }
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
                <th className="p-2 sm:p-4 text-left whitespace-nowrap">Skipped</th>
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
                  <td className="p-2 sm:p-4 text-gray-300 whitespace-nowrap">{camp.skippedCount || 0}</td>
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
                <tr><td colSpan={9} className="p-8 text-center text-gray-500">No campaigns yet. Create your first campaign!</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/10" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Create New Campaign</h2>
                <AnimatePresence>
                  {draftIndicator && (
                    <motion.span
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-xs text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full"
                    >
                      Draft saved
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                <FormField label="Campaign Name" name="name" value={form.name} onChange={handleChange} required />
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Campaign Type" name="type">
                    <select className="input-field" value={form.type} onChange={e => handleChange('type', e.target.value)}>
                      {campaignTypes.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Message Type" name="messageType">
                    <select className="input-field" value={form.messageType} onChange={e => handleChange('messageType', e.target.value)}>
                      {messageTypes.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
                    </select>
                  </FormField>
                  <FormField label="WhatsApp Session" name="sessionId">
                    <select className="input-field" value={form.sessionId} onChange={e => handleChange('sessionId', e.target.value)} required>
                      <option value="">Select Session</option>
                      {sessions.filter(s => s.status === 'connected').map(s => (
                        <option key={s._id} value={s._id}>{s.name} ({s.phoneNumber || 'No phone'})</option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Daily Limit" name="dailyLimit" type="number" value={form.dailyLimit} onChange={handleChange} />
                  <FormField label="Min Delay (sec)" name="minDelaySeconds" type="number" value={form.minDelaySeconds} onChange={handleChange} />
                  <FormField label="Max Delay (sec)" name="maxDelaySeconds" type="number" value={form.maxDelaySeconds} onChange={handleChange} />
                </div>
                <FormField label="Message Content" name="message">
                  <textarea className="input-field h-24" value={form.message} onChange={e => handleChange('message', e.target.value)} placeholder="Use {name}, {phone}, {email} for personalization" required />
                </FormField>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <h3 className="text-sm font-semibold text-white">Select Groups</h3>
                      <span className="text-xs text-gray-500">{form.groupIds.length} selected</span>
                    </div>
                    <div className="max-h-44 overflow-y-auto space-y-2">
                      {groups.map(group => (
                        <label key={group._id} className="flex items-center justify-between gap-3 rounded-lg bg-black/10 px-3 py-2 text-sm text-gray-300">
                          <span className="truncate">{group.name}</span>
                          <span className="flex items-center gap-2 text-xs text-gray-500">
                            {group.contactCount || 0}
                            <input
                              type="checkbox"
                              checked={form.groupIds.includes(group._id)}
                              onChange={() => toggleSelection('groupIds', group._id)}
                              className="rounded"
                            />
                          </span>
                        </label>
                      ))}
                      {groups.length === 0 && <p className="text-sm text-gray-500">No groups found. Create a group from Contacts first.</p>}
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <h3 className="text-sm font-semibold text-white">Select Contacts</h3>
                      <span className="text-xs text-gray-500">{form.contactIds.length} selected</span>
                    </div>
                    <div className="max-h-44 overflow-y-auto space-y-2">
                      {contacts.map(contact => (
                        <label key={contact._id} className="flex items-center justify-between gap-3 rounded-lg bg-black/10 px-3 py-2 text-sm text-gray-300">
                          <span className="min-w-0">
                            <span className="block truncate">{contact.name || contact.phone}</span>
                            <span className="block truncate text-xs text-gray-500">{contact.phone}</span>
                          </span>
                          <input
                            type="checkbox"
                            checked={form.contactIds.includes(contact._id)}
                            onChange={() => toggleSelection('contactIds', contact._id)}
                            className="rounded flex-shrink-0"
                          />
                        </label>
                      ))}
                      {contacts.length === 0 && <p className="text-sm text-gray-500">No contacts found. Add/import contacts first.</p>}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    ['isPersonalized', 'Enable Personalization'],
                    ['requireOptIn', 'Send Only Opted-In Contacts'],
                    ['appendOptOut', 'Add STOP Opt-Out Text'],
                    ['stopOnHighFailureRate', 'Pause On High Failure Rate']
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm text-gray-300 bg-white/5 rounded-xl px-3 py-2">
                      <input type="checkbox" checked={!!form[key]} onChange={e => handleChange(key, e.target.checked)} className="rounded" />
                      {label}
                    </label>
                  ))}
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
