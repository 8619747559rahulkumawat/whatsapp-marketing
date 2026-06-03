import { useState, useEffect } from 'react';
import API from '../utils/api';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlinePlay } from 'react-icons/hi';

export default function FollowUp() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [form, setForm] = useState({
    name: '', campaignId: '', sessionId: '', message: '',
    waitHours: 24, maxFollowUps: 3, isActive: true
  });
  const [running, setRunning] = useState(null);

  useEffect(() => { fetchRules(); fetchCampaigns(); fetchSessions(); }, []);

  const fetchRules = async () => {
    try { const { data } = await API.get('/follow-up'); if (data.success) setRules(data.rules); }
    catch { console.error('Operation failed'); } finally { setLoading(false); }
  };

  const fetchCampaigns = async () => {
    try { const { data } = await API.get('/campaigns'); if (data.success) setCampaigns(data.campaigns || []); } catch { console.error('Operation failed'); }
  };

  const fetchSessions = async () => {
    try { const { data } = await API.get('/sessions'); if (data.success) setSessions(data.sessions); } catch { console.error('Operation failed'); }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', campaignId: '', sessionId: '', message: '', waitHours: 24, maxFollowUps: 3, isActive: true });
    setShowModal(true);
  };

  const openEdit = (rule) => {
    setEditing(rule);
    setForm({
      name: rule.name || '', campaignId: rule.campaignId || '', sessionId: rule.sessionId || '',
      message: rule.message, waitHours: rule.waitHours, maxFollowUps: rule.maxFollowUps, isActive: rule.isActive
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editing) await API.put(`/follow-up/${editing._id}`, form);
      else await API.post('/follow-up', form);
      setShowModal(false);
      fetchRules();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this follow-up rule?')) return;
    try { await API.delete(`/follow-up/${id}`); fetchRules(); } catch { console.error('Operation failed'); }
  };

  const runRule = async (id) => {
    setRunning(id);
    try {
      const { data } = await API.post(`/follow-up/${id}/run`);
      alert(`Follow-up sent: ${data.sent} messages, ${data.skipped} skipped`);
      fetchRules();
    } catch (err) {
      alert(err.response?.data?.message || 'Run failed');
    } finally { setRunning(null); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Follow-up Reminder</h1>
          <p className="text-gray-400 text-sm mt-1">Auto-follow up with contacts who didn't reply</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <HiOutlinePlus /> New Rule
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        {rules.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <HiOutlinePlay className="mx-auto text-4xl mb-3 opacity-50" />
            <p className="text-lg">No follow-up rules</p>
            <p className="text-sm mt-1">Create a rule to automatically follow up with non-repliers</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="table-header">
                <th className="p-4 text-left">Name</th>
                <th className="p-4 text-left">Wait (hrs)</th>
                <th className="p-4 text-left">Max</th>
                <th className="p-4 text-left">Message</th>
                <th className="p-4 text-left">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr></thead>
              <tbody>
                {rules.map(rule => (
                  <tr key={rule._id} className="border-t border-white/5 hover:bg-white/5 transition">
                    <td className="p-4 text-white font-medium">{rule.name || '-'}</td>
                    <td className="p-4 text-gray-300">{rule.waitHours}h</td>
                    <td className="p-4 text-gray-300">{rule.maxFollowUps}</td>
                    <td className="p-4 text-gray-400 text-sm max-w-[200px] truncate">{rule.message}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${rule.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button onClick={() => runRule(rule._id)} disabled={running === rule._id}
                        className="p-2 text-purple-400 hover:text-purple-300 transition disabled:opacity-50">
                        {running === rule._id ? <span className="animate-spin">⟳</span> : <HiOutlinePlay />}
                      </button>
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
            <h2 className="text-xl font-bold text-white mb-4">{editing ? 'Edit Rule' : 'New Follow-up Rule'}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Rule Name</label>
                <input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., Day 1 follow-up" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Campaign (optional)</label>
                  <select className="input-field" value={form.campaignId} onChange={e => setForm({ ...form, campaignId: e.target.value })}>
                    <option value="">All Campaigns</option>
                    {campaigns.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Session</label>
                  <select className="input-field" value={form.sessionId} onChange={e => setForm({ ...form, sessionId: e.target.value })}>
                    <option value="">Select</option>
                    {sessions.filter(s => s.status === 'connected').map(s => (
                      <option key={s._id} value={s.sessionId}>{s.name || s.sessionId}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Wait Hours</label>
                  <input type="number" className="input-field" value={form.waitHours} onChange={e => setForm({ ...form, waitHours: Number(e.target.value) })}
                    min={1} max={720} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Max Follow-ups</label>
                  <input type="number" className="input-field" value={form.maxFollowUps} onChange={e => setForm({ ...form, maxFollowUps: Number(e.target.value) })}
                    min={1} max={10} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Follow-up Message *</label>
                <textarea className="input-field h-24 resize-none" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}
                  required placeholder="Namaste {name}, aapka reply nahi aaya..." />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} className="rounded" />
                <label className="text-sm text-gray-300">Active</label>
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
