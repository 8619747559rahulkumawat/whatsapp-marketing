import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import API from '../utils/api';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineCheck, HiOutlineX, HiOutlineSearch, HiOutlineDuplicate } from 'react-icons/hi';
import { FaWhatsapp } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';

export default function Templates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', category: 'general', content: '', variables: [], language: 'en' });
  const [previewContent, setPreviewContent] = useState('');

  const categories = ['general', 'marketing', 'utility', 'authentication', 'alert', 'notification', 'reminder', 'promotional'];
  const statusColors = { draft: 'badge-warning', pending_approval: 'badge-info', approved: 'badge-success', rejected: 'badge-danger' };

  useEffect(() => { fetchTemplates(); }, []);

  const fetchTemplates = async () => {
    try {
      const { data } = await API.get('/templates');
      if (data.success) setTemplates(data.templates);
    } catch { console.error('Operation failed'); } finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', category: 'general', content: '', variables: [], language: 'en' });
    setShowModal(true);
  };

  const openEdit = (tmpl) => {
    setEditing(tmpl);
    setForm({ name: tmpl.name, category: tmpl.category, content: tmpl.content, variables: tmpl.variables || [], language: tmpl.language });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await API.put(`/templates/${editing._id}`, form);
      } else {
        await API.post('/templates', form);
      }
      setShowModal(false);
      fetchTemplates();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save template');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this template?')) return;
    try { await API.delete(`/templates/${id}`); fetchTemplates(); } catch { console.error('Operation failed'); }
  };

  const handleSubmitApproval = async (id) => {
    try { await API.post(`/templates/${id}/submit-for-approval`); fetchTemplates(); } catch { console.error('Operation failed'); }
  };

  const handleApprove = async (id) => {
    try { await API.post(`/templates/${id}/approve`); fetchTemplates(); } catch { console.error('Operation failed'); }
  };

  const handleReject = async (id) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    try { await API.post(`/templates/${id}/reject`, { reason }); fetchTemplates(); } catch { console.error('Operation failed'); }
  };

  const extractVariables = (content) => {
    const vars = content.match(/{{\d+}}/g) || [];
    return [...new Set(vars)];
  };

  const handleContentChange = (val) => {
    setForm({ ...form, content: val, variables: extractVariables(val) });
    let preview = val;
    extractVariables(val).forEach((v, i) => { preview = preview.replace(v, `[Var ${i + 1}]`); });
    setPreviewContent(preview);
  };

  const duplicateTemplate = async (tmpl) => {
    try {
      await API.post('/templates', {
        name: `${tmpl.name} (Copy)`,
        category: tmpl.category,
        content: tmpl.content,
        variables: tmpl.variables,
        language: tmpl.language
      });
      fetchTemplates();
    } catch { console.error('Operation failed'); }
  };

  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.category.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Message Templates</h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">Create and manage WhatsApp message templates</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 sm:flex-none">
            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input-field pl-10 py-2 w-full sm:w-64" placeholder="Search templates..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={openCreate} className="btn-primary px-3 sm:px-4 py-2 rounded-xl text-white text-xs sm:text-sm font-medium flex items-center justify-center gap-1 sm:gap-2">
            <HiOutlinePlus /> <span className="hidden sm:inline">Create Template</span><span className="sm:hidden">Create</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((tmpl, idx) => (
          <motion.div key={tmpl._id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} className="glass-card p-4 sm:p-5 glass-card-hover">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <FaWhatsapp className="text-purple-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">{tmpl.name}</h3>
                  <span className={`badge ${statusColors[tmpl.status] || 'badge-info'} text-xs`}>{tmpl.status?.replace('_', ' ')}</span>
                </div>
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 mb-3">
              <p className="text-gray-300 text-sm line-clamp-3">{tmpl.content}</p>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
              <span className="badge badge-purple">{tmpl.category}</span>
              <span>{tmpl.variables?.length || 0} variables</span>
              <span>{tmpl.language}</span>
            </div>
            {tmpl.rejectedReason && (
              <div className="text-xs text-red-400 bg-red-500/10 rounded-lg p-2 mb-3">{tmpl.rejectedReason}</div>
            )}
            <div className="flex items-center gap-2 pt-3 border-t border-white/5">
              <button onClick={() => openEdit(tmpl)} className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20" title="Edit"><HiOutlinePencil size={14} /></button>
              <button onClick={() => duplicateTemplate(tmpl)} className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20" title="Duplicate"><HiOutlineDuplicate size={14} /></button>
              {tmpl.status === 'draft' && (
                <button onClick={() => handleSubmitApproval(tmpl._id)} className="text-xs px-2 py-1 rounded-lg bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20">Submit</button>
              )}
              {tmpl.status === 'pending_approval' && (user?.role === 'admin' || user?.role === 'super_admin') && (
                <>
                  <button onClick={() => handleApprove(tmpl._id)} className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20" title="Approve"><HiOutlineCheck size={14} /></button>
                  <button onClick={() => handleReject(tmpl._id)} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20" title="Reject"><HiOutlineX size={14} /></button>
                </>
              )}
              <button onClick={() => handleDelete(tmpl._id)} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 ml-auto" title="Delete"><HiOutlineTrash size={14} /></button>
            </div>
          </motion.div>
        ))}
        {filtered.length === 0 && <div className="col-span-full text-center py-12 text-gray-500">No templates found. Create your first template!</div>}
      </div>

      {showModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#1a1a2e] rounded-2xl p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/10" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">{editing ? 'Edit Template' : 'Create Template'}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Template Name</label>
                  <input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Category</label>
                  <select className="input-field" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Message Content (use {'{{1}}'}, {'{{2}}'} for variables)</label>
                <textarea className="input-field h-32 resize-none font-mono text-sm" value={form.content} onChange={e => handleContentChange(e.target.value)} required />
              </div>
              {previewContent && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                  <p className="text-xs text-green-400 mb-1">Preview:</p>
                  <p className="text-sm text-gray-300">{previewContent}</p>
                </div>
              )}
              {form.variables.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.variables.map((v, i) => (
                    <span key={v} className="badge badge-info text-xs">{'{{'}{v}{'}'}</span>
                  ))}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Language</label>
                <select className="input-field" value={form.language} onChange={e => setForm({ ...form, language: e.target.value })}>
                  {['en', 'hi', 'es', 'fr', 'de', 'pt', 'ar', 'bn', 'mr', 'ta', 'te', 'gu'].map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
                </select>
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 sm:px-6 py-2 rounded-xl border border-white/10 text-gray-300 text-xs sm:text-sm">Cancel</button>
                <button type="submit" className="btn-primary px-4 sm:px-6 py-2 rounded-xl text-white text-xs sm:text-sm">{editing ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
