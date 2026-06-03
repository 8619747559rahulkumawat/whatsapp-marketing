import { useState, useEffect } from 'react';
import API from '../utils/api';
import { HiOutlineTrash, HiOutlineSearch, HiOutlineCheckCircle, HiOutlineXCircle } from 'react-icons/hi';

export default function Cleanup() {
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState('');
  const [daysInactive, setDaysInactive] = useState(30);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    API.get('/sessions').then(({ data }) => {
      if (data.success) setSessions(data.sessions.filter(s => s.status === 'connected'));
    }).catch(() => {});
  }, []);

  const runCleanup = async () => {
    if (!sessionId) return alert('Select a session first');
    setRunning(true);
    setResult(null);
    try {
      const { data } = await API.post('/cleanup/inactive', { sessionId, daysInactive });
      setResult(data);
    } catch (err) {
      alert(err.response?.data?.message || 'Cleanup failed');
    } finally { setRunning(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Smart List Cleanup</h1>
        <p className="text-gray-400 text-sm mt-1">Remove inactive numbers that are not on WhatsApp</p>
      </div>

      <div className="glass-card p-6 max-w-xl">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">WhatsApp Session</label>
            <select className="input-field" value={sessionId} onChange={e => setSessionId(e.target.value)}>
              <option value="">Select connected session</option>
              {sessions.map(s => (
                <option key={s._id} value={s.sessionId}>{s.name || s.sessionId} ({s.phone})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Inactive days threshold</label>
            <input type="number" className="input-field" value={daysInactive} onChange={e => setDaysInactive(Number(e.target.value))} min={1} max={365} />
          </div>
          <button onClick={runCleanup} disabled={running || !sessionId} className="btn-primary flex items-center gap-2">
            {running ? <span className="animate-spin">⟳</span> : <HiOutlineTrash />}
            {running ? 'Scanning...' : 'Clean Inactive Numbers'}
          </button>
        </div>

        {result && (
          <div className="mt-6 p-4 bg-white/5 rounded-xl space-y-2">
            <h3 className="text-white font-semibold mb-3">Results</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white/5 rounded-lg text-center">
                <p className="text-2xl font-bold text-white">{result.total}</p>
                <p className="text-xs text-gray-400">Total Checked</p>
              </div>
              <div className="p-3 bg-green-500/10 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-400">{result.active}</p>
                <p className="text-xs text-gray-400">Active (WhatsApp)</p>
              </div>
              <div className="p-3 bg-yellow-500/10 rounded-lg text-center">
                <p className="text-2xl font-bold text-yellow-400">{result.inactive}</p>
                <p className="text-xs text-gray-400">Inactive (Kept)</p>
              </div>
              <div className="p-3 bg-red-500/10 rounded-lg text-center">
                <p className="text-2xl font-bold text-red-400">{result.removed}</p>
                <p className="text-xs text-gray-400">Removed</p>
              </div>
            </div>
            {result.errors?.length > 0 && (
              <div className="mt-3 p-3 bg-red-500/10 rounded-lg">
                <p className="text-sm text-red-400">{result.errors.length} errors (see console)</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
