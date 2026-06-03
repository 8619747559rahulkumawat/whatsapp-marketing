import { useState, useEffect, useCallback } from 'react';
import API from '../utils/api';
import { HiOutlinePlus, HiOutlineTrash, HiOutlineX } from 'react-icons/hi';
import { useToast } from '../contexts/ToastContext';

export default function SmsCampaigns() {
  const toast = useToast();
  const [campaigns, setCampaigns] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', message: '', gateway: 'twilio', recipients: '' });

  const fetch = useCallback(async () => {
    const r = await API.get('/sms-campaigns');
    if (r.data.success) setCampaigns(r.data.campaigns);
  }, []);
  useEffect(() => { fetch(); }, [fetch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const recipients = form.recipients.split('\n').filter(Boolean).map(line => {
        const [phone, name] = line.split(',');
        return { phone: phone.trim(), name: name?.trim() || '' };
      });
      await API.post('/sms-campaigns', { ...form, recipients });
      toast.success('SMS campaign created');
      setShowForm(false);
      setForm({ name: '', message: '', gateway: 'twilio', recipients: '' });
      fetch();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const sendCampaign = async (id) => {
    if (!confirm('Send this SMS campaign now?')) return;
    try {
      await API.post(`/sms-campaigns/${id}/send`);
      toast.success('SMS campaign sent!');
      fetch();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this campaign?')) return;
    await API.delete(`/sms-campaigns/${id}`);
    fetch();
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">SMS Campaigns</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm"><HiOutlinePlus /> New Campaign</button>
      </div>
      <div className="space-y-3">
        {campaigns.map(c => (
          <div key={c._id} className="glass-card rounded-xl p-4 flex items-center gap-4">
            <div className="flex-1">
              <h3 className="text-white font-semibold">{c.name}</h3>
              <p className="text-gray-400 text-sm truncate">{c.message}</p>
              <div className="flex gap-3 mt-1 text-xs text-gray-500">
                <span>{c.recipients?.length || 0} recipients</span>
                <span className="capitalize">{c.gateway}</span>
                {c.stats?.sent > 0 && <span className="text-green-400">{c.stats.sent} sent</span>}
              </div>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === 'sent' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>{c.status}</span>
            {c.status === 'draft' && <button onClick={() => sendCampaign(c._id)} className="text-xs px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400">Send</button>}
            <button onClick={() => handleDelete(c._id)} className="text-gray-500 hover:text-red-400"><HiOutlineTrash size={16} /></button>
          </div>
        ))}
        {campaigns.length === 0 && <p className="text-gray-500 text-center py-8">No SMS campaigns yet</p>}
      </div>
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-bold text-white">New SMS Campaign</h2><button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white p-1"><HiOutlineX size={20} /></button></div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" placeholder="Campaign Name *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="input-field w-full" />
              <textarea placeholder="SMS Message *" value={form.message} onChange={e => setForm({...form, message: e.target.value})} required rows={3} className="input-field w-full resize-none" />
              <select value={form.gateway} onChange={e => setForm({...form, gateway: e.target.value})} className="input-field w-full">
                <option value="twilio">Twilio</option><option value="textlocal">TextLocal</option><option value="msg91">MSG91</option>
              </select>
              <textarea placeholder="Recipients (phone, name per line)" value={form.recipients} onChange={e => setForm({...form, recipients: e.target.value})} rows={4} className="input-field w-full resize-none text-sm" />
              <button type="submit" className="btn-primary w-full py-3 rounded-xl font-semibold">Create Campaign</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
