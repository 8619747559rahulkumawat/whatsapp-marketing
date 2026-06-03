import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import API from '../utils/api';
import { HiOutlinePhone, HiOutlineChartBar, HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineRefresh, HiOutlineCurrencyDollar } from 'react-icons/hi';
import { FaWhatsapp, FaSms } from 'react-icons/fa';

export default function SmsFallback() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [testResult, setTestResult] = useState(null);

  useEffect(() => { fetchLogs(); fetchStats(); }, []);

  const fetchLogs = async () => {
    try {
      const { data } = await API.get('/sms-fallback/logs');
      if (data.success) setLogs(data.logs || []);
    } catch { console.error('Operation failed'); } finally { setLoading(false); }
  };

  const fetchStats = async () => {
    try {
      const { data } = await API.get('/sms-fallback/stats');
      if (data.success) setStats(data.stats);
    } catch { console.error('Operation failed'); }
  };

  const testFallback = async () => {
    if (!testPhone || !testMessage) return;
    setTestResult(null);
    try {
      const { data } = await API.post('/sms-fallback/test', { to: testPhone, message: testMessage });
      setTestResult(data);
    } catch (err) {
      setTestResult({ success: false, result: { error: err.response?.data?.message || err.message } });
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">WhatsApp → SMS Fallback</h1>
          <p className="text-gray-400 text-sm mt-1">Ensure message delivery via SMS when WhatsApp fails</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 text-blue-400 text-sm">
          <HiOutlinePhone /> {stats?.total || 0} total fallbacks
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-card p-5 text-center">
            <FaSms className="text-3xl text-purple-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{stats.total}</p>
            <p className="text-gray-400 text-sm">Total SMS Sent</p>
          </div>
          <div className="glass-card p-5 text-center">
            <HiOutlineCheckCircle className="text-3xl text-green-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{stats.sent}</p>
            <p className="text-gray-400 text-sm">Delivered</p>
          </div>
          <div className="glass-card p-5 text-center">
            <HiOutlineXCircle className="text-3xl text-red-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{stats.failed}</p>
            <p className="text-gray-400 text-sm">Failed</p>
          </div>
          <div className="glass-card p-5 text-center">
            <HiOutlineCurrencyDollar className="text-3xl text-yellow-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">${stats.totalCost?.toFixed(4) || '0.00'}</p>
            <p className="text-gray-400 text-sm">Total Cost</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="glass-card p-5">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2"><FaSms className="text-purple-400" /> Fallback Logs</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.map((log, idx) => (
                <motion.div key={log._id || idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${log.smsStatus === 'sent' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                      {log.smsStatus === 'sent' ? <HiOutlineCheckCircle className="text-green-400" /> : <HiOutlineXCircle className="text-red-400" />}
                    </div>
                    <div>
                      <p className="text-white text-sm">{log.to || log.phone}</p>
                      <p className="text-gray-500 text-xs">{log.content?.substring(0, 50)}</p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <p>{new Date(log.createdAt).toLocaleString()}</p>
                    {log.cost && <p>${log.cost.toFixed(4)}</p>}
                  </div>
                </motion.div>
              ))}
              {logs.length === 0 && <div className="text-center py-8 text-gray-500">No fallback logs yet</div>}
            </div>
          </div>
        </div>

        <div>
          <div className="glass-card p-5">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2"><HiOutlinePhone className="text-purple-400" /> Test Fallback</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Phone Number</label>
                <input className="input-field" value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="+1234567890" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Message</label>
                <textarea className="input-field h-24" value={testMessage} onChange={e => setTestMessage(e.target.value)} placeholder="Test message..." />
              </div>
              <button onClick={testFallback} className="btn-primary w-full px-4 py-2 rounded-xl text-white flex items-center justify-center gap-2">
                <HiOutlineRefresh /> Test SMS Fallback
              </button>
              {testResult && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded-xl text-sm ${testResult.success ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                  {testResult.success ? 'SMS sent successfully!' : `Failed: ${testResult.result?.error || 'Unknown error'}`}
                </motion.div>
              )}
            </div>
          </div>

          <div className="glass-card p-5 mt-4">
            <h3 className="text-white font-semibold mb-2">How it works</h3>
            <ul className="text-gray-400 text-sm space-y-2">
              <li className="flex items-start gap-2"><HiOutlineCheckCircle className="text-green-400 mt-0.5 flex-shrink-0" /> WhatsApp message is sent</li>
              <li className="flex items-start gap-2"><HiOutlineCheckCircle className="text-green-400 mt-0.5 flex-shrink-0" /> If delivery fails, SMS fallback triggers</li>
              <li className="flex items-start gap-2"><HiOutlineCheckCircle className="text-green-400 mt-0.5 flex-shrink-0" /> SMS sent via Twilio or local gateway</li>
              <li className="flex items-start gap-2"><HiOutlineCheckCircle className="text-green-400 mt-0.5 flex-shrink-0" /> Delivery status logged</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
