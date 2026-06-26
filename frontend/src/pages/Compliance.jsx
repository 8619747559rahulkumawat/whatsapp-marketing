import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import API from '../utils/api';
import { HiOutlineSearch, HiOutlineDownload, HiOutlineShieldCheck, HiOutlineBan, HiOutlineCheckCircle, HiOutlineXCircle } from 'react-icons/hi';

export default function Compliance() {
  const [activeTab, setActiveTab] = useState('logs');
  const [logs, setLogs] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState('');
  const [dndCheck, setDndCheck] = useState({ phone: '', result: null, checking: false });

  const fetchLogs = useCallback(async () => {
    try {
      const params = `?page=${page}&limit=20${filter ? `&type=${filter}` : ''}`;
      const { data } = await API.get(`/compliance${params}`);
      if (data.success) { setLogs(data.logs); setTotalPages(data.pagination.pages); }
    } catch { console.error('Operation failed'); } finally { setLoading(false); }
  }, [page, filter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const fetchSubscribers = async () => {
    try {
      const { data } = await API.get('/compliance/subscribers');
      if (data.success) setSubscribers(data.subscribers);
    } catch { console.error('Operation failed'); }
  };

  useEffect(() => { if (activeTab === 'subscribers') fetchSubscribers(); }, [activeTab]);

  const checkDND = async () => {
    if (!dndCheck.phone) return;
    setDndCheck({ ...dndCheck, checking: true, result: null });
    try {
      const { data } = await API.get(`/compliance/dnd/check/${dndCheck.phone}`);
      setDndCheck({ ...dndCheck, result: data, checking: false });
    } catch (err) { setDndCheck({ ...dndCheck, checking: false, result: { isDND: false, error: err.response?.data?.message || err.message } }); }
  };

  const exportLogs = () => {
    const csv = 'Date,Type,Phone,Method,Keyword,Status\n' +
      logs.map(l => `"${new Date(l.timestamp).toISOString()}","${l.type}","${l.phone}","${l.method}","${l.keyword || ''}","${l.processed ? 'Processed' : 'Pending'}"`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'compliance-logs.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const tabs = [
    { id: 'logs', label: 'Consent Logs', icon: HiOutlineShieldCheck },
    { id: 'dnd', label: 'DND Check', icon: HiOutlineBan },
    { id: 'subscribers', label: 'Subscribers', icon: HiOutlineCheckCircle },
    { id: 'gdpr', label: 'GDPR Requests', icon: HiOutlineDownload }
  ];

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">Compliance Suite</h1>
        <p className="text-gray-400 text-xs sm:text-sm mt-1">Manage opt-in/opt-out, DND, and GDPR compliance</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
              <Icon /> {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {['', 'opt_in', 'opt_out', 'gdpr_request'].map(t => (
                <button key={t} onClick={() => { setFilter(t); setPage(1); }}
                  className={`px-3 py-1 rounded-lg text-xs ${filter === t ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}>
                  {t || 'All'}
                </button>
              ))}
            </div>
            <button onClick={exportLogs} className="flex items-center gap-1 sm:gap-2 px-3 py-2 rounded-xl bg-green-500/10 text-green-400 text-xs sm:text-sm hover:bg-green-500/20">
              <HiOutlineDownload /> Export CSV
            </button>
          </div>
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="table-header">
                  <th className="p-2 sm:p-4 text-left whitespace-nowrap">Date</th>
                  <th className="p-2 sm:p-4 text-left whitespace-nowrap">Type</th>
                  <th className="p-2 sm:p-4 text-left whitespace-nowrap">Phone</th>
                  <th className="p-2 sm:p-4 text-left whitespace-nowrap">Method</th>
                  <th className="p-2 sm:p-4 text-left whitespace-nowrap">Keyword</th>
                  <th className="p-2 sm:p-4 text-left whitespace-nowrap">Status</th>
                </tr></thead>
                <tbody>
                  {logs.map((l, idx) => (
                    <tr key={l._id} className="table-row">
                      <td className="p-2 sm:p-4 text-gray-400 text-sm whitespace-nowrap">{new Date(l.timestamp).toLocaleString()}</td>
                      <td className="p-2 sm:p-4 whitespace-nowrap"><span className={`badge text-xs ${l.type === 'opt_in' ? 'badge-success' : l.type === 'opt_out' ? 'badge-danger' : 'badge-info'}`}>{l.type}</span></td>
                      <td className="p-2 sm:p-4 text-gray-300 text-sm whitespace-nowrap">{l.phone}</td>
                      <td className="p-2 sm:p-4 text-gray-400 text-sm capitalize whitespace-nowrap">{l.method}</td>
                      <td className="p-2 sm:p-4 text-gray-400 text-sm whitespace-nowrap">{l.keyword || '-'}</td>
                      <td className="p-2 sm:p-4 whitespace-nowrap">{l.processed ? <span className="badge badge-success text-xs">Processed</span> : <span className="badge badge-warning text-xs">Pending</span>}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-500">No compliance logs found</td></tr>}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 p-4 border-t border-white/5">
                {Array.from({ length: totalPages }, (_, i) => (
                  <button key={i} onClick={() => setPage(i + 1)} className={`w-8 h-8 rounded-lg text-sm ${page === i + 1 ? 'bg-purple-600 text-white' : 'text-gray-400 hover:bg-white/5'}`}>{i + 1}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'dnd' && (
        <div className="max-w-lg">
          <div className="glass-card p-4 sm:p-6">
            <h3 className="text-white font-semibold mb-4">DND Check</h3>
            <p className="text-gray-400 text-sm mb-4">Check if a phone number has opted out (DND)</p>
            <div className="flex gap-3">
              <input className="input-field" placeholder="Enter phone number..." value={dndCheck.phone} onChange={e => setDndCheck({ ...dndCheck, phone: e.target.value })} />
              <button onClick={checkDND} disabled={dndCheck.checking} className="btn-primary px-6 py-2 rounded-xl text-white whitespace-nowrap">
                {dndCheck.checking ? 'Checking...' : 'Check'}
              </button>
            </div>
            {dndCheck.result && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`mt-4 p-4 rounded-xl ${dndCheck.result.error ? 'bg-yellow-500/10 border border-yellow-500/20' : dndCheck.result.isDND ? 'bg-red-500/10 border border-red-500/20' : 'bg-green-500/10 border border-green-500/20'}`}>
                <div className="flex items-center gap-2">
                  {dndCheck.result.error ? <HiOutlineXCircle className="text-yellow-400 text-xl" /> : dndCheck.result.isDND ? <HiOutlineXCircle className="text-red-400 text-xl" /> : <HiOutlineCheckCircle className="text-green-400 text-xl" />}
                  <span className={dndCheck.result.error ? 'text-yellow-400' : dndCheck.result.isDND ? 'text-red-400' : 'text-green-400'}>
                    {dndCheck.result.error || (dndCheck.result.isDND ? 'Number is DND (opted out)' : 'Number is not in DND list')}
                  </span>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'subscribers' && (
        <div className="glass-card p-4 sm:p-6">
          <h3 className="text-white font-semibold mb-4">Subscriber Management</h3>
          {subscribers.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No subscribers yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="table-header">
                  <th className="p-2 sm:p-3 text-left whitespace-nowrap">Phone</th>
                  <th className="p-2 sm:p-3 text-left whitespace-nowrap">Status</th>
                  <th className="p-2 sm:p-3 text-left whitespace-nowrap">Source</th>
                  <th className="p-2 sm:p-3 text-left whitespace-nowrap">Subscribed</th>
                </tr></thead>
                <tbody>
                  {subscribers.map(s => (
                    <tr key={s._id} className="table-row">
                      <td className="p-2 sm:p-3 text-gray-300 whitespace-nowrap">{s.phone}</td>
                      <td className="p-2 sm:p-3 whitespace-nowrap"><span className={`badge text-xs ${s.status === 'subscribed' ? 'badge-success' : 'badge-danger'}`}>{s.status}</span></td>
                      <td className="p-2 sm:p-3 text-gray-400 text-sm capitalize whitespace-nowrap">{s.source}</td>
                      <td className="p-2 sm:p-3 text-gray-400 text-sm whitespace-nowrap">{new Date(s.subscribedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'gdpr' && (
        <div className="max-w-2xl">
          <div className="glass-card p-4 sm:p-6">
            <h3 className="text-white font-semibold mb-4">GDPR Data Requests</h3>
            <p className="text-gray-400 text-sm mb-4">Manage data access, export, and deletion requests</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { type: 'access', label: 'Access Request', desc: 'View all data stored for a contact', handler: () => alert('GDPR Access Request - Contact support@example.com') },
                { type: 'export', label: 'Export Data', desc: 'Export contact data in CSV format', handler: () => alert('GDPR Export - Contact support@example.com') },
                { type: 'deletion', label: 'Right to Erasure', desc: 'Permanently delete contact data', handler: () => alert('GDPR Deletion - Contact support@example.com') }
              ].map(item => (
                <div key={item.type} className="bg-white/5 rounded-xl p-4 text-center hover:bg-white/10 transition-all cursor-pointer" onClick={item.handler}>
                  <h4 className="text-white font-medium mb-2">{item.label}</h4>
                  <p className="text-gray-400 text-xs mb-3">{item.desc}</p>
                  <button onClick={item.handler} className="text-xs btn-primary px-4 py-2 rounded-lg text-white">Request</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
