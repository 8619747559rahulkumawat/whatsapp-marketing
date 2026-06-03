import { useState, useEffect } from 'react';
import API from '../utils/api';
import { HiOutlineMail, HiOutlineCog, HiOutlineX, HiOutlinePaperAirplane } from 'react-icons/hi';
import { useToast } from '../contexts/ToastContext';

export default function Email() {
  const toast = useToast();
  const [tab, setTab] = useState('compose');
  const [settings, setSettings] = useState({ apiKey: '', fromEmail: '', fromName: '' });
  const [compose, setCompose] = useState({ to: '', subject: '', body: '' });

  useEffect(() => {
    API.get('/email/settings').then(r => { if (r.data.success) setSettings(r.data.settings); }).catch(() => {});
  }, []);

  const sendEmail = async (e) => {
    e.preventDefault();
    try {
      await API.post('/email/send', compose);
      toast.success('Email sent successfully!');
      setCompose({ to: '', subject: '', body: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send email');
    }
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    try {
      await API.post('/email/settings', settings);
      toast.success('Email settings saved!');
    } catch (err) {
      toast.error('Failed to save settings');
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><HiOutlineMail /> Email</h1>
        <div className="flex bg-white/5 rounded-xl p-1">
          <button onClick={() => setTab('compose')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'compose' ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>Compose</button>
          <button onClick={() => setTab('settings')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'settings' ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>Settings</button>
        </div>
      </div>

      {tab === 'compose' && (
        <form onSubmit={sendEmail} className="glass-card rounded-2xl p-6 max-w-2xl space-y-4">
          <input type="email" placeholder="To *" value={compose.to} onChange={e => setCompose({...compose, to: e.target.value})} required className="input-field w-full" />
          <input type="text" placeholder="Subject *" value={compose.subject} onChange={e => setCompose({...compose, subject: e.target.value})} required className="input-field w-full" />
          <textarea placeholder="Email body..." value={compose.body} onChange={e => setCompose({...compose, body: e.target.value})} required rows={10} className="input-field w-full resize-none font-mono text-sm" />
          <div className="flex gap-3">
            <button type="submit" className="btn-primary flex items-center gap-2 px-6 py-3 rounded-xl font-semibold"><HiOutlinePaperAirplane /> Send Email</button>
            <button type="button" onClick={() => setCompose({ to: '', subject: '', body: '' })} className="px-6 py-3 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10">Clear</button>
          </div>
          <p className="text-xs text-gray-500">Powered by SendGrid (200 free emails/day)</p>
        </form>
      )}

      {tab === 'settings' && (
        <form onSubmit={saveSettings} className="glass-card rounded-2xl p-6 max-w-md space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><HiOutlineCog /> SendGrid Settings</h2>
          <input type="password" placeholder="SendGrid API Key" value={settings.apiKey || ''} onChange={e => setSettings({...settings, apiKey: e.target.value})} className="input-field w-full" />
          <input type="email" placeholder="From Email" value={settings.fromEmail || ''} onChange={e => setSettings({...settings, fromEmail: e.target.value})} className="input-field w-full" />
          <input type="text" placeholder="From Name" value={settings.fromName || ''} onChange={e => setSettings({...settings, fromName: e.target.value})} className="input-field w-full" />
          <button type="submit" className="btn-primary px-6 py-3 rounded-xl font-semibold w-full">Save Settings</button>
          <p className="text-xs text-gray-500">Get API key from <a href="https://sendgrid.com" target="_blank" rel="noreferrer" className="text-purple-400">SendGrid</a> (free: 100 emails/day)</p>
        </form>
      )}
    </div>
  );
}
