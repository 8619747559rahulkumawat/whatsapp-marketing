import { useState, useEffect } from 'react';
import API from '../utils/api';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineSwitchHorizontal } from 'react-icons/hi';

const matchTypes = [
  { value: 'contains', label: 'Contains' },
  { value: 'exact', label: 'Exact Match' },
  { value: 'regex', label: 'Regex' },
];

export default function AutoReply() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [form, setForm] = useState({
    name: '', keyword: '', matchType: 'contains', replyText: '',
    sessionId: '', isActive: true, oncePerContact: false
  });

  useEffect(() => { fetchRules(); fetchSessions(); }, []);

  const fetchRules = async () => {
    try { const { data } = await API.get('/auto-reply'); if (data.success) setRules(data.rules); }
    catch { console.error('Operation failed'); } finally { setLoading(false); }
  };

  const fetchSessions = async () => {
    try { const { data } = await API.get('/sessions'); if (data.success) setSessions(data.sessions); } catch { console.error('Operation failed'); }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', keyword: '', matchType: 'contains', replyText: '', sessionId: '', isActive: true, oncePerContact: false });
    setShowModal(true);
  };

  const openEdit = (rule) => {
    setEditing(rule);
    setForm({
      name: rule.name || '', keyword: rule.keyword, matchType: rule.matchType,
      replyText: rule.replyText, sessionId: rule.sessionId || '',
      isActive: rule.isActive, oncePerContact: rule.oncePerContact || false
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editing) await API.put(`/auto-reply/${editing._id}`, form);
      else await API.post('/auto-reply', form);
      setShowModal(false);
      fetchRules();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this rule?')) return;
    try { await API.delete(`/auto-reply/${id}`); fetchRules(); } catch { console.error('Operation failed'); }
  };

  const toggleActive = async (rule) => {
    try { await API.put(`/auto-reply/${rule._id}`, { isActive: !rule.isActive }); fetchRules(); } catch { console.error('Operation failed'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Auto Reply</h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">Auto-reply to incoming WhatsApp messages</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
          <HiOutlinePlus /> New Rule
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        {rules.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <HiOutlineSwitchHorizontal className="mx-auto text-4xl mb-3 opacity-50" />
            <p className="text-lg">No auto-reply rules yet</p>
            <p className="text-sm mt-1">Create a rule to automatically reply to keywords</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="table-header">
                <th className="p-2 sm:p-4 text-left whitespace-nowrap">Name</th>
                <th className="p-2 sm:p-4 text-left whitespace-nowrap">Keyword</th>
                <th className="p-2 sm:p-4 text-left whitespace-nowrap">Match</th>
                <th className="p-2 sm:p-4 text-left whitespace-nowrap">Reply</th>
                <th className="p-2 sm:p-4 text-left whitespace-nowrap">Status</th>
                <th className="p-2 sm:p-4 text-right whitespace-nowrap">Actions</th>
              </tr></thead>
              <tbody>
                {rules.map(rule => (
                  <tr key={rule._id} className="border-t border-white/5 hover:bg-white/5 transition">
                    <td className="p-2 sm:p-4 text-white font-medium whitespace-nowrap">{rule.name || '-'}</td>
                    <td className="p-2 sm:p-4 text-purple-300 font-mono text-sm whitespace-nowrap">{rule.keyword}</td>
                    <td className="p-2 sm:p-4 text-gray-400 text-sm capitalize whitespace-nowrap">{rule.matchType}</td>
                    <td className="p-2 sm:p-4 text-gray-300 text-sm max-w-[200px] truncate">{rule.replyText}</td>
                    <td className="p-2 sm:p-4 whitespace-nowrap">
                      <button onClick={() => toggleActive(rule)}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${rule.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="p-2 sm:p-4 text-right whitespace-nowrap">
                      <button onClick={() => openEdit(rule)} className="p-2 text-gray-400 hover:text-white transition"><HiOutlinePencil /></button>
                      <button onClick={() => handleDelete(rule._id)} className="p-2 text-gray-400 hover:text-red-400 transition"><HiOutlineTrash /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="glass-card p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">{editing ? 'Edit Rule' : 'New Auto-Reply Rule'}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Rule Name (optional)</label>
                <input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., Greeting reply" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Keyword *</label>
                  <input className="input-field" value={form.keyword} onChange={e => setForm({ ...form, keyword: e.target.value })} required placeholder="e.g., hello" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Match Type</label>
                  <select className="input-field" value={form.matchType} onChange={e => setForm({ ...form, matchType: e.target.value })}>
                    {matchTypes.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Reply Message *</label>
                <textarea className="input-field h-24 resize-none" value={form.replyText} onChange={e => setForm({ ...form, replyText: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Session (optional)</label>
                  <select className="input-field" value={form.sessionId} onChange={e => setForm({ ...form, sessionId: e.target.value })}>
                    <option value="">All Sessions</option>
                    {sessions.filter(s => s.status === 'connected').map(s => (
                      <option key={s._id} value={s.sessionId}>{s.name || s.sessionId}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-4 pt-6">
                  <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input type="checkbox" checked={form.oncePerContact} onChange={e => setForm({ ...form, oncePerContact: e.target.checked })} className="rounded" />
                    Once per contact
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} className="rounded" />
                    Active
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">{editing ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
