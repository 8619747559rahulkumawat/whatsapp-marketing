import { useState, useEffect } from 'react';
import API from '../utils/api';
import { HiOutlineRefresh, HiOutlineSparkles } from 'react-icons/hi';

export default function LeadScoring() {
  const [scores, setScores] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchScores = async () => {
    setLoading(true);
    try {
      const [s, st] = await Promise.all([
        API.get('/lead-scores'),
        API.get('/lead-scores/stats')
      ]);
      if (s.data.success) setScores(s.data.scores);
      if (st.data.success) setStats(st.data.stats);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { fetchScores(); }, []);

  const recalculateAll = async () => {
    setLoading(true);
    await API.post('/lead-scores/recalculate-all');
    fetchScores();
  };

  const scoreColor = (score) => {
    if (score >= 70) return 'text-green-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  const scoreBg = (score) => {
    if (score >= 70) return 'bg-green-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const levelColor = { hot: 'text-green-400 bg-green-500/20', warm: 'text-yellow-400 bg-yellow-500/20', cold: 'text-red-400 bg-red-500/20' };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><HiOutlineSparkles /> AI Lead Scoring</h1>
          <p className="text-gray-400 text-sm">Auto-calculated based on email, messages, meetings, deals & activity</p>
        </div>
        <button onClick={recalculateAll} disabled={loading} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm whitespace-nowrap">
          <HiOutlineRefresh className={loading ? 'animate-spin' : ''} /> Recalculate All
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {['cold', 'warm', 'hot'].map(level => {
          const s = stats.find(st => st._id === level);
          return (
            <div key={level} className="glass-card rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${levelColor[level]?.split(' ')[0] || 'text-gray-400'}`}>{s?.count || 0}</p>
              <p className="text-xs text-gray-500 capitalize mt-0.5">{level} Leads</p>
              {s?.avgScore && <p className="text-[10px] text-gray-600">Avg: {Math.round(s.avgScore)}%</p>}
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        {scores.map(s => (
          <div key={s._id} className="glass-card rounded-xl p-4 flex items-center gap-4">
            <div className={`w-14 text-center ${scoreColor(s.score)}`}>
              <p className="text-2xl font-bold">{s.score}</p>
              <p className="text-[10px]">/100</p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium">{s.contactId?.name || 'Unknown'}</p>
              <p className="text-gray-400 text-xs">{s.contactId?.phone || ''} {s.contactId?.email || ''}</p>
              <div className="w-full bg-white/10 rounded-full h-1.5 mt-2">
                <div className={`h-1.5 rounded-full ${scoreBg(s.score)}`} style={{ width: `${s.score}%` }} />
              </div>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${levelColor[s.level] || 'text-gray-400'}`}>{s.level}</span>
          </div>
        ))}
        {scores.length === 0 && !loading && <p className="text-gray-500 text-center py-8">No lead scores yet. Click "Recalculate All" to generate scores.</p>}
      </div>
    </div>
  );
}
