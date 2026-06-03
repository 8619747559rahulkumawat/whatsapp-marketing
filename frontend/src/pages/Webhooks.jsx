import { useState, useEffect, useCallback } from 'react';
import API from '../utils/api';
import { HiOutlinePlus, HiOutlineTrash, HiOutlineX, HiOutlineCode, HiOutlinePlay } from 'react-icons/hi';
import { useToast } from '../contexts/ToastContext';

const EVENTS = ['contact.created', 'deal.updated', 'deal.stage_changed', 'message.sent', 'campaign.completed', 'form.submitted', 'meeting.created', 'task.completed'];

export default function Webhooks() {
  const toast = useToast();
  const [webhooks, setWebhooks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', url: '', events: [] });

  const fetch = useCallback(async () => {
    const r = await API.get('/webhooks/api');
    if (r.data.success) setWebhooks(r.data.webhooks);
  }, []);
  useEffect(() => { fetch(); }, [fetch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await API.post('/webhooks/api', form);
      toast.success('Webhook created');
      setShowForm(false);
      setForm({ name: '', url: '', events: [] });
      fetch();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const toggleEvent = (ev) => {
    setForm({ ...form, events: form.events.includes(ev) ? form.events.filter(e => e !== ev) : [...form.events, ev] });
  };

  const testWebhook = async (id) => {
    try {
      const r = await API.post(`/webhooks/api/${id}/test`);
      toast.success(r.data.message);
    } catch (err) { toast.error(err.response?.data?.message || 'Test failed'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this webhook?')) return;
    await API.delete(`/webhooks/api/${id}`);
    fetch();
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><HiOutlineCode /> API & Webhooks</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm"><HiOutlinePlus /> New Webhook</button>
      </div>
      <div className="space-y-3">
        {webhooks.map(w => (
          <div key={w._id} className="glass-card rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-white font-semibold">{w.name}</h3>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${w.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{w.isActive ? 'Active' : 'Inactive'}</span>
              </div>
              <p className="text-gray-400 text-xs truncate font-mono">{w.url}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {(w.events || []).map(ev => <span key={ev} className="text-[10px] bg-white/5 text-gray-400 px-1.5 py-0.5 rounded-full">{ev}</span>)}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => testWebhook(w._id)} className="text-xs px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 flex items-center gap-1"><HiOutlinePlay size={12} /> Test</button>
              <button onClick={() => handleDelete(w._id)} className="text-gray-500 hover:text-red-400"><HiOutlineTrash size={16} /></button>
            </div>
          </div>
        ))}
        {webhooks.length === 0 && <p className="text-gray-500 text-center py-8">No webhooks configured</p>}
      </div>
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-bold text-white">New Webhook</h2><button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white p-1"><HiOutlineX size={20} /></button></div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" placeholder="Webhook Name *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="input-field w-full" />
              <input type="url" placeholder="Endpoint URL *" value={form.url} onChange={e => setForm({...form, url: e.target.value})} required className="input-field w-full font-mono text-sm" />
              <div>
                <p className="text-xs text-gray-500 mb-2">Events to listen:</p>
                <div className="grid grid-cols-2 gap-1">
                  {EVENTS.map(ev => (
                    <label key={ev} className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer hover:text-white p-1 rounded">
                      <input type="checkbox" checked={form.events.includes(ev)} onChange={() => toggleEvent(ev)} className="accent-purple-500" />
                      {ev}
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" className="btn-primary w-full py-3 rounded-xl font-semibold">Create Webhook</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
