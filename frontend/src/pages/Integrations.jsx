import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import API from '../utils/api';
import { HiOutlinePlus, HiOutlineTrash, HiOutlineLink, HiOutlineCode, HiOutlineClipboardCopy, HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineRefresh } from 'react-icons/hi';
import { FaPuzzlePiece, FaPlug, FaRocket } from 'react-icons/fa';

export default function Integrations() {
  const [activeTab, setActiveTab] = useState('webhooks');
  const [webhooks, setWebhooks] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);
  const [webhookForm, setWebhookForm] = useState({ name: '', url: '', events: ['message.sent'] });
  const [apiForm, setApiForm] = useState({ name: '', permissions: ['send'] });
  const [testResult, setTestResult] = useState(null);

  useEffect(() => { fetchData(); }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'webhooks') {
        const { data } = await API.get('/integration/webhooks');
        if (data.success) setWebhooks(data.webhooks);
      } else {
        const { data } = await API.get('/integration/api-keys');
        if (data.success) setApiKeys(data.keys);
      }
    } catch { console.error('Operation failed'); } finally { setLoading(false); }
  };

  const createWebhook = async (e) => {
    e.preventDefault();
    try {
      await API.post('/integration/webhooks', webhookForm);
      setShowWebhookModal(false);
      setWebhookForm({ name: '', url: '', events: ['message.sent'] });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create webhook');
    }
  };

  const deleteWebhook = async (id) => {
    if (!confirm('Delete this webhook?')) return;
    try { await API.delete(`/integration/webhooks/${id}`); fetchData(); } catch { console.error('Operation failed'); }
  };

  const testWebhook = async (id) => {
    try {
      const { data } = await API.post(`/integration/webhooks/${id}/test`);
      setTestResult({ success: true, message: data.message });
      setTimeout(() => setTestResult(null), 3000);
    } catch (err) {
      setTestResult({ success: false, message: err.response?.data?.message || 'Test failed' });
      setTimeout(() => setTestResult(null), 3000);
    }
  };

  const createApiKey = async (e) => {
    e.preventDefault();
    try {
      await API.post('/integration/api-keys', apiForm);
      setShowApiModal(false);
      setApiForm({ name: '', permissions: ['send'] });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create API key');
    }
  };

  const deleteApiKey = async (id) => {
    if (!confirm('Delete this API key?')) return;
    try { await API.delete(`/integration/api-keys/${id}`); fetchData(); } catch { console.error('Operation failed'); }
  };

  const copyToClipboard = (text) => { navigator.clipboard.writeText(text); };

  const availableEvents = ['message.sent', 'message.delivered', 'message.failed', 'message.read', 'campaign.started', 'campaign.completed', 'campaign.failed', 'contact.added', 'contact.updated'];

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">Integration Hub</h1>
        <p className="text-gray-400 text-xs sm:text-sm mt-1">Connect your apps with webhooks and API keys</p>
      </div>

      {testResult && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl ${testResult.success ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
          {testResult.message}
        </motion.div>
      )}

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setActiveTab('webhooks')}
          className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${activeTab === 'webhooks' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
          <HiOutlineLink /> Webhooks
        </button>
        <button onClick={() => setActiveTab('api')}
          className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${activeTab === 'api' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
          <HiOutlineCode /> API Keys
        </button>
        <button onClick={() => setActiveTab('marketplace')}
          className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${activeTab === 'marketplace' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
          <FaPlug /> Integration Marketplace
        </button>
      </div>

      {activeTab === 'webhooks' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowWebhookModal(true)} className="btn-primary px-3 sm:px-4 py-2 rounded-xl text-white text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2">
              <HiOutlinePlus /> Add Webhook
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {webhooks.map((wh, idx) => (
              <motion.div key={wh._id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} className="glass-card p-4 sm:p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                      <HiOutlineLink className="text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">{wh.name}</h3>
                      <span className={`badge text-xs ${wh.isActive ? 'badge-success' : 'badge-danger'}`}>{wh.isActive ? 'Active' : 'Inactive'}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 mb-3">
                  <code className="text-xs text-purple-300 break-all">{wh.url}</code>
                </div>
                <div className="flex flex-wrap gap-1 mb-3">
                  {wh.events?.map(e => <span key={e} className="badge badge-info text-xs">{e}</span>)}
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                  <span>Secret: <code className="text-purple-300">{wh.secret?.substring(0, 8)}...</code></span>
                  <span>{wh.failureCount || 0} failures</span>
                </div>
                <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                  <button onClick={() => testWebhook(wh._id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-xs hover:bg-blue-500/20">
                    <HiOutlineRefresh size={12} /> Test
                  </button>
                  <button onClick={() => deleteWebhook(wh._id)} className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 ml-auto">
                    <HiOutlineTrash size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
            {webhooks.length === 0 && <div className="col-span-2 text-center py-12 text-gray-500">No webhooks configured</div>}
          </div>

          {showWebhookModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowWebhookModal(false)}>
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-md border border-white/10" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-white mb-4">Add Webhook</h2>
                <form onSubmit={createWebhook} className="space-y-4">
                  <div><label className="block text-sm font-medium text-gray-300 mb-2">Webhook Name</label><input className="input-field" value={webhookForm.name} onChange={e => setWebhookForm({ ...webhookForm, name: e.target.value })} required /></div>
                  <div><label className="block text-sm font-medium text-gray-300 mb-2">URL</label><input type="url" className="input-field" value={webhookForm.url} onChange={e => setWebhookForm({ ...webhookForm, url: e.target.value })} required placeholder="https://your-app.com/webhook" /></div>
                  <div><label className="block text-sm font-medium text-gray-300 mb-2">Events</label>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                      {availableEvents.map(e => (
                        <label key={e} className="flex items-center gap-2 text-sm text-gray-300">
                          <input type="checkbox" checked={webhookForm.events.includes(e)} onChange={e2 => {
                            if (e2.target.checked) setWebhookForm(f => ({ ...f, events: [...f.events, e] }));
                            else setWebhookForm(f => ({ ...f, events: f.events.filter(x => x !== e) }));
                          }} className="rounded" />
                          {e}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end pt-4">
                    <button type="button" onClick={() => setShowWebhookModal(false)} className="px-6 py-2 rounded-xl border border-white/10 text-gray-300">Cancel</button>
                    <button type="submit" className="btn-primary px-6 py-2 rounded-xl text-white">Create</button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </div>
      )}

      {activeTab === 'api' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowApiModal(true)} className="btn-primary px-3 sm:px-4 py-2 rounded-xl text-white text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2">
              <HiOutlinePlus /> Create API Key
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {apiKeys.map((key, idx) => (
              <motion.div key={key._id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} className="glass-card p-4 sm:p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                      <HiOutlineCode className="text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">{key.name}</h3>
                      <span className={`badge text-xs ${key.isActive !== false ? 'badge-success' : 'badge-danger'}`}>{key.isActive !== false ? 'Active' : 'Inactive'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-white/5 rounded-lg p-3 mb-3">
                  <code className="text-xs text-purple-300 flex-1 truncate">{key.key}</code>
                  <button onClick={() => copyToClipboard(key.key)} className="text-gray-400 hover:text-white"><HiOutlineClipboardCopy size={14} /></button>
                </div>
                <div className="flex flex-wrap gap-1 mb-3">
                  {key.permissions?.map(p => <span key={p} className="badge badge-info text-xs">{p}</span>)}
                </div>
                <div className="flex items-center text-xs text-gray-400">
                  <span>Last used: {key.lastUsed ? new Date(key.lastUsed).toLocaleDateString() : 'Never'}</span>
                  <button onClick={() => deleteApiKey(key._id)} className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 ml-auto">
                    <HiOutlineTrash size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
            {apiKeys.length === 0 && <div className="col-span-2 text-center py-12 text-gray-500">No API keys created</div>}
          </div>

          {showApiModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowApiModal(false)}>
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-md border border-white/10" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-white mb-4">Create API Key</h2>
                <form onSubmit={createApiKey} className="space-y-4">
                  <div><label className="block text-sm font-medium text-gray-300 mb-2">Key Name</label><input className="input-field" value={apiForm.name} onChange={e => setApiForm({ ...apiForm, name: e.target.value })} required /></div>
                  <div><label className="block text-sm font-medium text-gray-300 mb-2">Permissions</label>
                    <div className="space-y-2">
                      {['send', 'campaign', 'contacts', 'reports', 'webhook'].map(p => (
                        <label key={p} className="flex items-center gap-2 text-sm text-gray-300">
                          <input type="checkbox" checked={apiForm.permissions.includes(p)} onChange={e => {
                            if (e.target.checked) setApiForm(f => ({ ...f, permissions: [...f.permissions, p] }));
                            else setApiForm(f => ({ ...f, permissions: f.permissions.filter(x => x !== p) }));
                          }} className="rounded" />
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end pt-4">
                    <button type="button" onClick={() => setShowApiModal(false)} className="px-6 py-2 rounded-xl border border-white/10 text-gray-300">Cancel</button>
                    <button type="submit" className="btn-primary px-6 py-2 rounded-xl text-white">Create</button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </div>
      )}

      {activeTab === 'marketplace' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { name: 'Zapier', desc: 'Connect with 5000+ apps via Zapier', icon: FaPuzzlePiece, color: 'text-orange-400', status: 'Coming Soon' },
            { name: 'Make (Integromat)', desc: 'Automate workflows with Make', icon: FaRocket, color: 'text-blue-400', status: 'Coming Soon' },
            { name: 'REST API', desc: 'Direct API access for custom integrations', icon: HiOutlineCode, color: 'text-green-400', status: 'Available', docs: true },
            { name: 'Webhooks', desc: 'Real-time event notifications', icon: HiOutlineLink, color: 'text-purple-400', status: 'Available' }
          ].map((item, idx) => (
            <motion.div key={item.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} className="glass-card p-4 sm:p-5 text-center glass-card-hover">
              <item.icon className={`text-3xl sm:text-4xl ${item.color} mx-auto mb-3`} />
              <h3 className="text-white font-semibold mb-2">{item.name}</h3>
              <p className="text-gray-400 text-xs mb-4">{item.desc}</p>
              <span className={`badge text-xs ${item.status === 'Available' ? 'badge-success' : 'badge-warning'}`}>{item.status}</span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
