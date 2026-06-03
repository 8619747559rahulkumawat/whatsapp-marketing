import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import API from '../utils/api';
import { HiOutlinePlus, HiOutlineTrash, HiOutlinePlay, HiOutlinePause, HiOutlineCog, HiOutlineDuplicate } from 'react-icons/hi';
import { FaRobot, FaProjectDiagram } from 'react-icons/fa';

export default function Automation() {
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', trigger: { type: 'contact_added', config: {} } });

  useEffect(() => { fetchFlows(); }, []);

  const fetchFlows = async () => {
    try {
      const { data } = await API.get('/automation');
      if (data.success) setFlows(data.flows);
    } catch { console.error('Operation failed'); } finally { setLoading(false); }
  };

  const createFlow = async (e) => {
    e.preventDefault();
    try {
      await API.post('/automation', form);
      setShowModal(false);
      setForm({ name: '', description: '', trigger: { type: 'contact_added', config: {} } });
      fetchFlows();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create flow');
    }
  };

  const deleteFlow = async (id) => {
    if (!confirm('Delete this automation flow?')) return;
    try { await API.delete(`/automation/${id}`); fetchFlows(); } catch { console.error('Operation failed'); }
  };

  const toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    try { await API.put(`/automation/${id}/status`, { status: newStatus }); fetchFlows(); } catch { console.error('Operation failed'); }
  };

  const triggerLabels = {
    contact_added: 'When contact is added',
    message_received: 'When message is received',
    campaign_completed: 'When campaign completes',
    scheduled: 'Scheduled',
    webhook: 'Webhook trigger',
    tag_added: 'When tag is added'
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Automation Builder</h1>
          <p className="text-gray-400 text-sm mt-1">Create visual automation flows for your campaigns</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary px-4 py-2 rounded-xl text-white text-sm font-medium flex items-center gap-2">
          <HiOutlinePlus /> Create Flow
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5 text-center">
          <FaProjectDiagram className="text-3xl text-purple-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{flows.length}</p>
          <p className="text-gray-400 text-sm">Total Flows</p>
        </div>
        <div className="glass-card p-5 text-center">
          <HiOutlinePlay className="text-3xl text-green-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{flows.filter(f => f.status === 'active').length}</p>
          <p className="text-gray-400 text-sm">Active</p>
        </div>
        <div className="glass-card p-5 text-center">
          <HiOutlineCog className="text-3xl text-blue-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{flows.filter(f => f.status === 'draft').length}</p>
          <p className="text-gray-400 text-sm">Drafts</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {flows.map((flow, idx) => (
          <motion.div key={flow._id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} className="glass-card p-5 glass-card-hover">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <FaRobot className="text-purple-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">{flow.name}</h3>
                  <span className={`badge text-xs ${flow.status === 'active' ? 'badge-success' : flow.status === 'paused' ? 'badge-warning' : 'badge-info'}`}>{flow.status}</span>
                </div>
              </div>
            </div>
            {flow.description && <p className="text-gray-400 text-sm mb-3">{flow.description}</p>}
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
              <span className="badge badge-purple">{triggerLabels[flow.trigger?.type] || flow.trigger?.type}</span>
              {flow.isDrip && <span className="badge badge-info">Drip Campaign</span>}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
              <span>{flow.nodes?.length || 0} nodes</span>
              <span>·</span>
              <span>{flow.stats?.totalExecutions || 0} executions</span>
            </div>
            <div className="flex items-center gap-2 pt-3 border-t border-white/5">
              <button onClick={() => toggleStatus(flow._id, flow.status)} className={`p-2 rounded-lg ${flow.status === 'active' ? 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20' : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'}`} title={flow.status === 'active' ? 'Pause' : 'Activate'}>
                {flow.status === 'active' ? <HiOutlinePause size={14} /> : <HiOutlinePlay size={14} />}
              </button>
              <button className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20" title="Edit Flow"><HiOutlineCog size={14} /></button>
              <button className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20" title="Duplicate"><HiOutlineDuplicate size={14} /></button>
              <button onClick={() => deleteFlow(flow._id)} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 ml-auto" title="Delete"><HiOutlineTrash size={14} /></button>
            </div>
          </motion.div>
        ))}
        {flows.length === 0 && <div className="col-span-full text-center py-12 text-gray-500">No automation flows yet. Create your first flow!</div>}
      </div>

      {showModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-md border border-white/10" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">Create Automation Flow</h2>
            <form onSubmit={createFlow} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Flow Name</label>
                <input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                <textarea className="input-field h-20" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Trigger</label>
                <select className="input-field" value={form.trigger.type} onChange={e => setForm({ ...form, trigger: { ...form.trigger, type: e.target.value } })}>
                  <option value="contact_added">When contact is added</option>
                  <option value="message_received">When message is received</option>
                  <option value="campaign_completed">When campaign completes</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="webhook">Webhook trigger</option>
                  <option value="tag_added">When tag is added</option>
                </select>
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2 rounded-xl border border-white/10 text-gray-300">Cancel</button>
                <button type="submit" className="btn-primary px-6 py-2 rounded-xl text-white">Create Flow</button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
