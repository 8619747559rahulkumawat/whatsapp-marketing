import { useState, useEffect, useCallback } from 'react';
import API from '../utils/api';
import { HiOutlinePlus, HiOutlineTrash, HiOutlineX, HiOutlineFlag } from 'react-icons/hi';
import { useToast } from '../contexts/ToastContext';

export default function Goals() {
  const toast = useToast();
  const [goals, setGoals] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'revenue', target: '', period: 'monthly', description: '' });

  const fetch = useCallback(async () => {
    const r = await API.get('/goals');
    if (r.data.success) setGoals(r.data.goals);
  }, []);
  useEffect(() => { fetch(); }, [fetch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await API.post('/goals', { ...form, target: parseFloat(form.target) });
      toast.success('Goal created');
      setShowForm(false);
      setForm({ title: '', type: 'revenue', target: '', period: 'monthly', description: '' });
      fetch();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this goal?')) return;
    await API.delete(`/goals/${id}`);
    fetch();
  };

  const progressPercent = (g) => g.target > 0 ? Math.min(Math.round((g.current / g.target) * 100), 100) : 0;
  const progressColor = (p) => p >= 80 ? 'bg-green-500' : p >= 50 ? 'bg-yellow-500' : 'bg-blue-500';

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><HiOutlineFlag /> Goal Tracking</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm"><HiOutlinePlus /> New Goal</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {goals.map(g => {
          const pct = progressPercent(g);
          return (
            <div key={g._id} className="glass-card rounded-xl p-5 border border-white/5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-white font-semibold">{g.title}</h3>
                  <p className="text-xs text-gray-500 capitalize">{g.type} • {g.period}</p>
                </div>
                <button onClick={() => handleDelete(g._id)} className="text-gray-500 hover:text-red-400"><HiOutlineTrash size={16} /></button>
              </div>
              <div className="flex items-end justify-between mb-2">
                <span className="text-2xl font-bold text-white">{g.current?.toLocaleString()}</span>
                <span className="text-gray-400 text-sm">/ {g.target?.toLocaleString()} {g.unit}</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2.5">
                <div className={`h-2.5 rounded-full transition-all ${progressColor(pct)}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="text-right text-xs text-gray-500 mt-1">{pct}% complete</p>
            </div>
          );
        })}
        {goals.length === 0 && <p className="text-gray-500 col-span-2 text-center py-8">No goals set yet</p>}
      </div>
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-bold text-white">New Goal</h2><button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white p-1"><HiOutlineX size={20} /></button></div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" placeholder="Goal Title *" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required className="input-field w-full" />
              <textarea placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} className="input-field w-full resize-none" />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="input-field">
                  <option value="revenue">Revenue</option><option value="deals">Deals</option><option value="leads">Leads</option><option value="messages">Messages</option><option value="meetings">Meetings</option>
                </select>
                <select value={form.period} onChange={e => setForm({...form, period: e.target.value})} className="input-field">
                  <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option>
                </select>
              </div>
              <input type="number" placeholder="Target *" value={form.target} onChange={e => setForm({...form, target: e.target.value})} required className="input-field w-full" />
              <button type="submit" className="btn-primary w-full py-3 rounded-xl font-semibold">Create Goal</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
