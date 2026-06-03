import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import API from '../utils/api';
import { HiOutlineCalendar, HiOutlineClock, HiOutlineTrash, HiOutlinePlay, HiOutlinePause, HiOutlinePlus, HiOutlineRefresh } from 'react-icons/hi';
import { FaWhatsapp } from 'react-icons/fa';

export default function ScheduledCampaigns() {
  const [scheduled, setScheduled] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ campaignId: '', scheduledAt: '', scheduleType: 'once', timezone: 'Asia/Kolkata', repeatConfig: {} });

  useEffect(() => { fetchScheduled(); fetchCampaigns(); }, []);

  const fetchScheduled = async () => {
    try {
      const { data } = await API.get('/scheduler');
      if (data.success) setScheduled(data.scheduled || []);
    } catch { console.error('Operation failed'); } finally { setLoading(false); }
  };

  const fetchCampaigns = async () => {
    try {
      const { data } = await API.get('/campaigns');
      if (data.success) setCampaigns(data.campaigns || []);
    } catch { console.error('Operation failed'); }
  };

  const createSchedule = async (e) => {
    e.preventDefault();
    try {
      await API.post('/scheduler', form);
      setShowCreate(false);
      setForm({ campaignId: '', scheduledAt: '', scheduleType: 'once', timezone: 'Asia/Kolkata', repeatConfig: {} });
      fetchScheduled();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to schedule');
    }
  };

  const cancelSchedule = async (id) => {
    if (!confirm('Cancel this scheduled campaign?')) return;
    try { await API.post(`/scheduler/${id}/cancel`); fetchScheduled(); } catch { console.error('Operation failed'); }
  };

  const deleteSchedule = async (id) => {
    if (!confirm('Delete this scheduled campaign?')) return;
    try { await API.delete(`/scheduler/${id}`); fetchScheduled(); } catch { console.error('Operation failed'); }
  };

  const statusColors = { pending: 'badge-warning', processing: 'badge-info', completed: 'badge-success', failed: 'badge-danger', cancelled: 'badge-secondary' };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Scheduled Campaigns</h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">Schedule campaigns for later or recurring delivery</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary px-3 sm:px-4 py-2 rounded-xl text-white text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2">
          <HiOutlinePlus /> <span className="hidden sm:inline">Schedule Campaign</span><span className="sm:hidden">Schedule</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 sm:p-5 text-center">
          <HiOutlineCalendar className="text-2xl sm:text-3xl text-purple-400 mx-auto mb-2" />
          <p className="text-xl sm:text-2xl font-bold text-white">{scheduled.length}</p>
          <p className="text-gray-400 text-sm">Total Scheduled</p>
        </div>
        <div className="glass-card p-4 sm:p-5 text-center">
          <HiOutlineClock className="text-2xl sm:text-3xl text-yellow-400 mx-auto mb-2" />
          <p className="text-xl sm:text-2xl font-bold text-white">{scheduled.filter(s => s.status === 'pending').length}</p>
          <p className="text-gray-400 text-sm">Pending</p>
        </div>
        <div className="glass-card p-4 sm:p-5 text-center">
          <HiOutlinePlay className="text-2xl sm:text-3xl text-blue-400 mx-auto mb-2" />
          <p className="text-xl sm:text-2xl font-bold text-white">{scheduled.filter(s => s.status === 'processing').length}</p>
          <p className="text-gray-400 text-sm">Processing</p>
        </div>
        <div className="glass-card p-4 sm:p-5 text-center">
          <HiOutlineRefresh className="text-2xl sm:text-3xl text-green-400 mx-auto mb-2" />
          <p className="text-xl sm:text-2xl font-bold text-white">{scheduled.filter(s => s.scheduleType !== 'once').length}</p>
          <p className="text-gray-400 text-sm">Recurring</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 text-left text-xs text-gray-400 uppercase">
                <th className="p-2 sm:p-4 whitespace-nowrap">Campaign</th>
                <th className="p-2 sm:p-4 whitespace-nowrap">Scheduled At</th>
                <th className="p-2 sm:p-4 whitespace-nowrap">Type</th>
                <th className="p-2 sm:p-4 whitespace-nowrap">Status</th>
                <th className="p-2 sm:p-4 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {scheduled.map((s, idx) => (
                <motion.tr key={s._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.03 }} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-2 sm:p-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <FaWhatsapp className="text-green-400" />
                      <div>
                        <p className="text-white text-sm font-medium">{s.campaignId?.name || s.campaignId?._id || 'Unknown'}</p>
                        <p className="text-gray-500 text-xs">{s.campaignId?.type || ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-2 sm:p-4 whitespace-nowrap">
                    <p className="text-white text-sm">{new Date(s.scheduledAt).toLocaleString()}</p>
                    <p className="text-gray-500 text-xs">{s.timezone || 'UTC'}</p>
                  </td>
                  <td className="p-2 sm:p-4 whitespace-nowrap">
                    <span className="badge badge-info text-xs">{s.scheduleType || 'once'}</span>
                    {s.repeatConfig?.every && <p className="text-gray-500 text-xs mt-1">Every {s.repeatConfig.every} {s.repeatConfig.unit}</p>}
                  </td>
                  <td className="p-2 sm:p-4 whitespace-nowrap">
                    <span className={`badge text-xs ${statusColors[s.status] || 'badge-info'}`}>{s.status}</span>
                  </td>
                  <td className="p-2 sm:p-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {s.status === 'pending' && (
                        <button onClick={() => cancelSchedule(s._id)} className="p-1.5 rounded-lg bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20" title="Cancel">
                          <HiOutlinePause size={14} />
                        </button>
                      )}
                      <button onClick={() => deleteSchedule(s._id)} className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20" title="Delete">
                        <HiOutlineTrash size={14} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
              {scheduled.length === 0 && (
                <tr><td colSpan="5" className="text-center py-12 text-gray-500">No scheduled campaigns</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-md border border-white/10" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">Schedule Campaign</h2>
            <form onSubmit={createSchedule} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Campaign</label>
                <select className="input-field" value={form.campaignId} onChange={e => setForm({ ...form, campaignId: e.target.value })} required>
                  <option value="">Select campaign</option>
                  {campaigns.filter(c => c.status === 'draft' || c.status === 'approved').map(c => (
                    <option key={c._id} value={c._id}>{c.name} ({c.type})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Schedule Date & Time</label>
                <input type="datetime-local" className="input-field" value={form.scheduledAt} onChange={e => setForm({ ...form, scheduledAt: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
                <select className="input-field" value={form.scheduleType} onChange={e => setForm({ ...form, scheduleType: e.target.value })}>
                  <option value="once">Once</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Timezone</label>
                <select className="input-field" value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })}>
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                </select>
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button type="button" onClick={() => setShowCreate(false)} className="px-6 py-2 rounded-xl border border-white/10 text-gray-300">Cancel</button>
                <button type="submit" className="btn-primary px-6 py-2 rounded-xl text-white">Schedule</button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
