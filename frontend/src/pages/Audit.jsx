import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import API from '../utils/api';
import { HiOutlineTrash, HiOutlineFilter, HiOutlineClock, HiOutlineUser, HiOutlineGlobe } from 'react-icons/hi';

export default function Audit() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ action: '', entity: '', days: 7 });

  useEffect(() => { fetchLogs(); fetchStats(); }, []);

  const fetchLogs = async () => {
    try {
      const params = new URLSearchParams();
      if (filter.action) params.append('action', filter.action);
      if (filter.entity) params.append('entity', filter.entity);
      if (filter.days) params.append('days', filter.days);
      const { data } = await API.get(`/audit?${params}`);
      if (data.success) setLogs(data.logs);
    } catch { console.error("API Error"); } finally { setLoading(false); }
  };

  const fetchStats = async () => {
    try {
      const { data } = await API.get('/audit/stats');
      if (data.success) setStats(data.stats);
    } catch (err) { console.error(err); }
  };

  const clearLogs = async () => {
    if (!confirm('Clear all audit logs? This cannot be undone.')) return;
    try { await API.delete('/audit/clear'); setLogs([]); setStats(null); } catch (err) { console.error(err); }
  };

  const actionColors = {
    create: 'text-green-400 bg-green-500/10',
    update: 'text-blue-400 bg-blue-500/10',
    delete: 'text-red-400 bg-red-500/10',
    login: 'text-purple-400 bg-purple-500/10',
    export: 'text-yellow-400 bg-yellow-500/10',
    send: 'text-cyan-400 bg-cyan-500/10',
  };

  const entityIcons = {
    User: HiOutlineUser,
    Campaign: HiOutlineGlobe,
    Template: HiOutlineGlobe,
    Payment: HiOutlineGlobe,
    default: HiOutlineClock,
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Audit Log</h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">Track all actions performed in your organization</p>
        </div>
        <button onClick={clearLogs} className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs sm:text-sm">
          <HiOutlineTrash size={16} /> Clear Logs
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Events', value: stats.totalLogs || 0 },
            { label: 'Today', value: stats.todayCount || 0 },
            { label: 'Unique Users', value: stats.uniqueUsers || 0 },
            { label: 'Unique Actions', value: stats.uniqueActions || 0 },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass-card p-4 text-center">
              <p className="text-xl sm:text-2xl font-bold text-white">{s.value}</p>
              <p className="text-gray-400 text-xs">{s.label}</p>
            </motion.div>
          ))}
        </div>
      )}

      <div className="glass-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <HiOutlineFilter className="text-gray-400" />
          <select className="input-field w-auto text-sm" value={filter.action} onChange={e => setFilter({ ...filter, action: e.target.value })}>
            <option value="">All Actions</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="login">Login</option>
            <option value="export">Export</option>
            <option value="send">Send</option>
          </select>
          <select className="input-field w-auto text-sm" value={filter.entity} onChange={e => setFilter({ ...filter, entity: e.target.value })}>
            <option value="">All Entities</option>
            <option value="Campaign">Campaign</option>
            <option value="Template">Template</option>
            <option value="Contact">Contact</option>
            <option value="Payment">Payment</option>
            <option value="User">User</option>
            <option value="Webhook">Webhook</option>
          </select>
          <select className="input-field w-auto text-sm" value={filter.days} onChange={e => setFilter({ ...filter, days: e.target.value })}>
            <option value={1}>Last 24 hours</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button onClick={fetchLogs} className="btn-primary px-3 sm:px-4 py-2 rounded-xl text-white text-xs sm:text-sm">Apply</button>
        </div>
      </div>

      <div className="space-y-2">
        {logs.map((log, idx) => {
          const Icon = entityIcons[log.entity] || entityIcons.default;
          return (
            <motion.div key={log._id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.02 }} className="glass-card p-4 flex items-start gap-4">
              <div className={`p-2 rounded-lg ${actionColors[log.action] || 'text-gray-400 bg-white/5'}`}>
                <Icon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white text-sm font-medium">{log.user?.name || log.user?.email || 'System'}</span>
                  <span className="text-gray-400 text-xs">{log.user?.role && `(${log.user.role})`}</span>
                  <span className={`badge text-xs ${actionColors[log.action] || ''}`}>{log.action}</span>
                  <span className="badge badge-info text-xs">{log.entity}</span>
                </div>
                <p className="text-gray-400 text-xs mt-1">{log.description}</p>
                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <div className="mt-2 bg-white/5 rounded-lg p-2">
                    <pre className="text-xs text-gray-500 overflow-x-auto">{JSON.stringify(log.metadata, null, 2)}</pre>
                  </div>
                )}
                <p className="text-gray-500 text-xs mt-1">
                  {new Date(log.createdAt).toLocaleString()} · <span className="font-mono">{log.ip || 'N/A'}</span>
                </p>
              </div>
            </motion.div>
          );
        })}
        {logs.length === 0 && <div className="text-center py-12 text-gray-500">No audit logs found</div>}
      </div>
    </div>
  );
}
