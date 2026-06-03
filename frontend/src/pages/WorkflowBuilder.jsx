import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import API from '../utils/api';
import { HiOutlinePlus, HiOutlineTrash, HiOutlinePlay, HiOutlinePause, HiOutlineCog, HiOutlineDuplicate, HiOutlineSave, HiOutlineTemplate, HiOutlineLightningBolt, HiOutlineClock, HiOutlineFilter, HiOutlineCode, HiOutlineChat, HiOutlineMail } from 'react-icons/hi';
import { FaRobot, FaProjectDiagram, FaWhatsapp, FaSms } from 'react-icons/fa';

const NODE_TYPES = [
  { type: 'send_message', label: 'Send Message', icon: FaWhatsapp, color: 'green', description: 'Send a WhatsApp message', bgClass: 'bg-green-500/20', iconClass: 'text-green-400' },
  { type: 'send_sms', label: 'Send SMS', icon: FaSms, color: 'blue', description: 'Send SMS fallback', bgClass: 'bg-blue-500/20', iconClass: 'text-blue-400' },
  { type: 'condition', label: 'Condition', icon: HiOutlineFilter, color: 'yellow', description: 'Branch based on conditions', bgClass: 'bg-yellow-500/20', iconClass: 'text-yellow-400' },
  { type: 'delay', label: 'Delay', icon: HiOutlineClock, color: 'orange', description: 'Wait before next step', bgClass: 'bg-orange-500/20', iconClass: 'text-orange-400' },
  { type: 'webhook', label: 'Webhook', icon: HiOutlineCode, color: 'purple', description: 'Call external API', bgClass: 'bg-purple-500/20', iconClass: 'text-purple-400' },
  { type: 'update_contact', label: 'Update Contact', icon: HiOutlineCog, color: 'indigo', description: 'Update contact fields', bgClass: 'bg-indigo-500/20', iconClass: 'text-indigo-400' },
  { type: 'add_tag', label: 'Add Tag', icon: HiOutlineTemplate, color: 'pink', description: 'Tag the contact', bgClass: 'bg-pink-500/20', iconClass: 'text-pink-400' },
];

export default function WorkflowBuilder() {
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFlow, setSelectedFlow] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [showNewFlow, setShowNewFlow] = useState(false);
  const [showNodePicker, setShowNodePicker] = useState(false);
  const [editingNode, setEditingNode] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', trigger: { type: 'contact_added', config: {} } });
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => { fetchFlows(); }, []);

  const fetchFlows = async () => {
    try {
      const { data } = await API.get('/automation');
      if (data.success) setFlows(data.flows || []);
    } catch { console.error('Operation failed'); } finally { setLoading(false); }
  };

  const selectFlow = async (flow) => {
    setSelectedFlow(flow);
    try {
      const { data } = await API.get(`/automation/${flow._id}`);
      if (data.success) {
        setNodes(data.flow?.nodes || []);
        setEdges(data.flow?.edges || []);
      }
    } catch {
      setNodes(flow.nodes || []);
      setEdges(flow.edges || []);
    }
  };

  const createFlow = async (e) => {
    e.preventDefault();
    try {
      const { data } = await API.post('/automation', form);
      if (data.success) {
        setShowNewFlow(false);
        setForm({ name: '', description: '', trigger: { type: 'contact_added', config: {} } });
        fetchFlows();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create flow');
    }
  };

  const saveFlow = async () => {
    if (!selectedFlow) return;
    setSaving(true);
    try {
      await API.put(`/automation/${selectedFlow._id}`, { nodes, edges });
      fetchFlows();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    try { await API.put(`/automation/${id}/status`, { status: newStatus }); fetchFlows(); } catch { console.error('Operation failed'); }
  };

  const deleteFlow = async (id) => {
    if (!confirm('Delete this flow?')) return;
    try { await API.delete(`/automation/${id}`); fetchFlows(); if (selectedFlow?._id === id) setSelectedFlow(null); } catch { console.error('Operation failed'); }
  };

  const addNode = (type) => {
    const newNode = {
      _id: `node_${Date.now()}`,
      type: type.type,
      label: type.label,
      config: {},
      position: { x: 100 + nodes.length * 20, y: 100 + nodes.length * 60 },
    };
    setNodes([...nodes, newNode]);
    setShowNodePicker(false);
  };

  const removeNode = (nodeId) => {
    setNodes(nodes.filter(n => n._id !== nodeId));
    setEditingNode(null);
  };

  const updateNodeConfig = (nodeId, config) => {
    setNodes(nodes.map(n => n._id === nodeId ? { ...n, config: { ...n.config, ...config } } : n));
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
          <h1 className="text-2xl font-bold text-white">Visual Flow Builder</h1>
          <p className="text-gray-400 text-sm mt-1">Design automation workflows with drag & drop</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowNewFlow(true)} className="btn-primary px-4 py-2 rounded-xl text-white text-sm font-medium flex items-center gap-2">
            <HiOutlinePlus /> New Flow
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-2">
          <h2 className="text-white font-semibold text-sm mb-3">Your Flows</h2>
          {flows.map((flow, idx) => (
            <motion.div key={flow._id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }}
              className={`glass-card p-3 cursor-pointer glass-card-hover ${selectedFlow?._id === flow._id ? 'border-purple-500/50' : ''}`}
              onClick={() => selectFlow(flow)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FaProjectDiagram className="text-purple-400 text-sm" />
                  <span className="text-white text-sm font-medium">{flow.name}</span>
                </div>
                <span className={`badge text-[10px] ${flow.status === 'active' ? 'badge-success' : flow.status === 'paused' ? 'badge-warning' : 'badge-info'}`}>
                  {flow.status}
                </span>
              </div>
              <p className="text-gray-500 text-xs mt-1">{triggerLabels[flow.trigger?.type] || flow.trigger?.type} · {flow.nodes?.length || 0} nodes</p>
            </motion.div>
          ))}
          {flows.length === 0 && <div className="text-center py-6 text-gray-500 text-sm">No flows yet</div>}
        </div>

        <div className="lg:col-span-3">
          {selectedFlow ? (
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-white font-semibold">{selectedFlow.name}</h2>
                  <span className="badge text-xs">{triggerLabels[selectedFlow.trigger?.type] || selectedFlow.trigger?.type}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowNodePicker(true)} className="p-2 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20" title="Add Node">
                    <HiOutlinePlus size={16} />
                  </button>
                  <button onClick={saveFlow} disabled={saving} className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20" title="Save Flow">
                    <HiOutlineSave size={16} />
                  </button>
                  <button onClick={() => toggleStatus(selectedFlow._id, selectedFlow.status)}
                    className={`p-2 rounded-lg ${selectedFlow.status === 'active' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-green-500/10 text-green-400'} hover:opacity-80`} title={selectedFlow.status === 'active' ? 'Pause' : 'Activate'}>
                    {selectedFlow.status === 'active' ? <HiOutlinePause size={16} /> : <HiOutlinePlay size={16} />}
                  </button>
                  <button onClick={() => deleteFlow(selectedFlow._id)} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20" title="Delete">
                    <HiOutlineTrash size={16} />
                  </button>
                </div>
              </div>

              <div ref={canvasRef} className="min-h-[400px] bg-[#0a0a15] rounded-xl border border-white/5 p-6 space-y-4">
                {nodes.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                    <FaProjectDiagram className="text-5xl mb-4 text-purple-400/30" />
                    <p className="mb-4">No nodes yet. Add your first step!</p>
                    <button onClick={() => setShowNodePicker(true)} className="btn-primary px-4 py-2 rounded-xl text-white text-sm">Add Node</button>
                  </div>
                )}

                {nodes.map((node, idx) => {
                  const nodeDef = NODE_TYPES.find(nt => nt.type === node.type);
                  const Icon = nodeDef?.icon || FaRobot;
                  return (
                    <motion.div key={node._id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      className="relative">
                      {idx > 0 && <div className="absolute -top-4 left-1/2 w-px h-4 bg-purple-500/30" />}
                      <div
                      onClick={() => setEditingNode(node)}
                      className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all hover:border-purple-500/50 ${editingNode?._id === node._id ? 'border-purple-500 bg-purple-500/10' : 'bg-white/5 border-white/10'}`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${nodeDef?.bgClass || 'bg-purple-500/20'}`}>
                          <Icon className={`${nodeDef?.iconClass || 'text-purple-400'}`} />
                        </div>
                        <div className="flex-1">
                          <p className="text-white text-sm font-medium">{node.label || node.type}</p>
                          {node.config?.message && <p className="text-gray-500 text-xs truncate">{node.config.message}</p>}
                          {node.type === 'delay' && node.config?.duration && <p className="text-gray-500 text-xs">Wait: {node.config.duration}ms</p>}
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); removeNode(node._id); }} className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20">
                          <HiOutlineTrash size={14} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {editingNode && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white font-semibold text-sm">Configure: {editingNode.label}</h3>
                    <button onClick={() => setEditingNode(null)} className="text-gray-400 hover:text-white text-xs">Close</button>
                  </div>
                  {editingNode.type === 'send_message' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm text-gray-300 mb-1">Message</label>
                        <textarea className="input-field h-24" value={editingNode.config?.message || ''} onChange={e => updateNodeConfig(editingNode._id, { message: e.target.value })} placeholder="Enter message text..." />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-300 mb-1">Template (optional)</label>
                        <select className="input-field" value={editingNode.config?.templateId || ''} onChange={e => updateNodeConfig(editingNode._id, { templateId: e.target.value })}>
                          <option value="">No template</option>
                        </select>
                      </div>
                    </div>
                  )}
                  {editingNode.type === 'delay' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm text-gray-300 mb-1">Duration</label>
                        <input type="number" className="input-field" value={editingNode.config?.duration || 5000} onChange={e => updateNodeConfig(editingNode._id, { duration: parseInt(e.target.value) })} />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-300 mb-1">Unit</label>
                        <select className="input-field" value={editingNode.config?.unit || 'ms'} onChange={e => updateNodeConfig(editingNode._id, { unit: e.target.value })}>
                          <option value="ms">Milliseconds</option>
                          <option value="s">Seconds</option>
                          <option value="m">Minutes</option>
                          <option value="h">Hours</option>
                        </select>
                      </div>
                    </div>
                  )}
                  {editingNode.type === 'condition' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm text-gray-300 mb-1">Field</label>
                        <input className="input-field" value={editingNode.config?.field || ''} onChange={e => updateNodeConfig(editingNode._id, { field: e.target.value })} placeholder="e.g. contact.tags" />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-300 mb-1">Operator</label>
                        <select className="input-field" value={editingNode.config?.operator || 'equals'} onChange={e => updateNodeConfig(editingNode._id, { operator: e.target.value })}>
                          <option value="equals">Equals</option>
                          <option value="contains">Contains</option>
                          <option value="greater_than">Greater than</option>
                          <option value="less_than">Less than</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-300 mb-1">Value</label>
                        <input className="input-field" value={editingNode.config?.value || ''} onChange={e => updateNodeConfig(editingNode._id, { value: e.target.value })} />
                      </div>
                    </div>
                  )}
                  {editingNode.type === 'add_tag' && (
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Tag</label>
                      <input className="input-field" value={editingNode.config?.tag || ''} onChange={e => updateNodeConfig(editingNode._id, { tag: e.target.value })} placeholder="e.g. vip" />
                    </div>
                  )}
                  {editingNode.type === 'webhook' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm text-gray-300 mb-1">URL</label>
                        <input className="input-field" value={editingNode.config?.url || ''} onChange={e => updateNodeConfig(editingNode._id, { url: e.target.value })} placeholder="https://..." />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-300 mb-1">Method</label>
                        <select className="input-field" value={editingNode.config?.method || 'POST'} onChange={e => updateNodeConfig(editingNode._id, { method: e.target.value })}>
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                          <option value="PUT">PUT</option>
                        </select>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          ) : (
            <div className="glass-card p-12 text-center">
              <FaProjectDiagram className="text-6xl text-purple-400/30 mx-auto mb-4" />
              <h3 className="text-white font-semibold text-lg mb-2">Select a Flow</h3>
              <p className="text-gray-400 text-sm mb-4">Choose a flow from the left to edit its workflow, or create a new flow.</p>
              <button onClick={() => setShowNewFlow(true)} className="btn-primary px-4 py-2 rounded-xl text-white text-sm">Create New Flow</button>
            </div>
          )}
        </div>
      </div>

      {showNewFlow && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowNewFlow(false)}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-md border border-white/10" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">Create Automation Flow</h2>
            <form onSubmit={createFlow} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-300 mb-2">Flow Name</label><input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
              <div><label className="block text-sm font-medium text-gray-300 mb-2">Description</label><textarea className="input-field h-20" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div><label className="block text-sm font-medium text-gray-300 mb-2">Trigger</label>
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
                <button type="button" onClick={() => setShowNewFlow(false)} className="px-6 py-2 rounded-xl border border-white/10 text-gray-300">Cancel</button>
                <button type="submit" className="btn-primary px-6 py-2 rounded-xl text-white">Create</button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}

      {showNodePicker && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowNodePicker(false)}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-lg border border-white/10" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">Add Node</h2>
            <div className="grid grid-cols-2 gap-3">
              {NODE_TYPES.map((nt, idx) => {
                const Icon = nt.icon;
                return (
                  <button key={nt.type} onClick={() => addNode(nt)}
                    className="flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 text-left transition-all">
                    <div className={`w-10 h-10 rounded-xl ${nt.bgClass} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`${nt.iconClass}`} />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{nt.label}</p>
                      <p className="text-gray-500 text-xs">{nt.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
