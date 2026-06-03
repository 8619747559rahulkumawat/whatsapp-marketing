import { useState, useEffect, useCallback } from 'react';
import API from '../utils/api';
import { HiOutlinePlus, HiOutlineTrash, HiOutlineX, HiOutlinePaperAirplane, HiOutlineChartBar } from 'react-icons/hi';
import { useToast } from '../contexts/ToastContext';

export default function EmailCampaigns() {
  const toast = useToast();
  const [campaigns, setCampaigns] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', subject: '', body: '', recipients: '' });

  const fetch = useCallback(async () => {
    const r = await API.get('/email-campaigns');
    if (r.data.success) setCampaigns(r.data.campaigns);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const recipients = form.recipients.split('\n').filter(Boolean).map(line => {
        const [email, name] = line.split(',');
        return { email: email.trim(), name: name?.trim() || '' };
      });
      await API.post('/email-campaigns', { ...form, recipients });
      toast.success('Campaign created');
      setShowForm(false);
      setForm({ name: '', subject: '', body: '', recipients: '' });
      fetch();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const sendCampaign = async (id) => {
    if (!confirm('Send this campaign now?')) return;
    try {
      await API.post(`/email-campaigns/${id}/send`);
      toast.success('Campaign sent!');
      fetch();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this campaign?')) return;
    await API.delete(`/email-campaigns/${id}`);
    fetch();
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><HiOutlinePaperAirplane /> Email Campaigns</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm whitespace-nowrap"><HiOutlinePlus /> New Campaign</button>
      </div>
      <div className="space-y-3">
        {campaigns.map(c => (
          <div key={c._id} className="glass-card rounded-xl p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-semibold">{c.name}</h3>
                <p className="text-gray-400 text-sm truncate">{c.subject}</p>
                <div className="flex gap-4 mt-1 text-xs text-gray-500">
                  <span>To: {c.recipients?.length || 0} recipients</span>
                  {c.status === 'sent' && <span className="text-green-400">Sent: {c.stats?.sent}</span>}
                  <span className="text-blue-400">Opened: {c.stats?.opened || 0}</span>
                  <span className="text-yellow-400">Clicked: {c.stats?.clicked || 0}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === 'sent' ? 'bg-green-500/20 text-green-400' : c.status === 'sending' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'}`}>{c.status}</span>
                {c.status === 'draft' && <button onClick={() => sendCampaign(c._id)} className="text-xs px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30">Send</button>}
                <button onClick={() => handleDelete(c._id)} className="text-gray-500 hover:text-red-400 p-1.5"><HiOutlineTrash size={16} /></button>
              </div>
            </div>
          </div>
        ))}
        {campaigns.length === 0 && <p className="text-gray-500 text-center py-8">No email campaigns yet</p>}
      </div>
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">New Email Campaign</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white p-1"><HiOutlineX size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" placeholder="Campaign Name *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="input-field w-full" />
              <input type="text" placeholder="Email Subject *" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} required className="input-field w-full" />
              <textarea placeholder="Email Body (HTML supported) *" value={form.body} onChange={e => setForm({...form, body: e.target.value})} required rows={6} className="input-field w-full resize-none font-mono text-sm" />
              <div>
                <p className="text-xs text-gray-500 mb-1">Recipients (one per line: email, name)</p>
                <textarea placeholder="email1@example.com, John&#10;email2@example.com, Jane" value={form.recipients} onChange={e => setForm({...form, recipients: e.target.value})} rows={4} className="input-field w-full resize-none text-sm" />
              </div>
              <button type="submit" className="btn-primary w-full py-3 rounded-xl font-semibold">Create Campaign</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
