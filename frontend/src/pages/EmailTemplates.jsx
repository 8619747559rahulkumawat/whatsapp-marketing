import { useState, useEffect, useCallback } from 'react';
import API from '../utils/api';
import { HiOutlinePlus, HiOutlineTrash, HiOutlinePencil, HiOutlineX, HiOutlineDuplicate } from 'react-icons/hi';
import { useToast } from '../contexts/ToastContext';

export default function EmailTemplates() {
  const toast = useToast();
  const [templates, setTemplates] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', subject: '', body: '', category: 'general' });

  const fetch = useCallback(async () => {
    const r = await API.get('/email-templates');
    if (r.data.success) setTemplates(r.data.templates);
  }, []);
  useEffect(() => { fetch(); }, [fetch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) await API.put(`/email-templates/${editing._id}`, form);
      else await API.post('/email-templates', form);
      toast.success(editing ? 'Template updated' : 'Template created');
      setShowForm(false); setEditing(null);
      setForm({ name: '', subject: '', body: '', category: 'general' });
      fetch();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const useTemplate = (t) => {
    setForm({ name: t.name + ' (copy)', subject: t.subject, body: t.body, category: t.category });
    setEditing(null);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this template?')) return;
    await API.delete(`/email-templates/${id}`);
    fetch();
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Email Templates</h1>
        <button onClick={() => { setEditing(null); setForm({ name: '', subject: '', body: '', category: 'general' }); setShowForm(true); }} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm"><HiOutlinePlus /> New Template</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(t => (
          <div key={t._id} className="glass-card rounded-xl p-5 border border-white/5">
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-white font-semibold">{t.name}</h3>
              <div className="flex gap-1">
                <button onClick={() => useTemplate(t)} className="text-gray-500 hover:text-purple-400 p-1"><HiOutlineDuplicate size={15} /></button>
                <button onClick={() => handleDelete(t._id)} className="text-gray-500 hover:text-red-400 p-1"><HiOutlineTrash size={15} /></button>
              </div>
            </div>
            <p className="text-gray-400 text-sm truncate">{t.subject}</p>
            <div className="flex gap-2 mt-2 text-xs text-gray-500">
              <span className="bg-white/5 px-2 py-0.5 rounded-full">{t.category}</span>
              {t.variables?.length > 0 && <span>{t.variables.length} variables</span>}
            </div>
          </div>
        ))}
        {templates.length === 0 && <p className="text-gray-500 col-span-full text-center py-8">No templates yet</p>}
      </div>
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-bold text-white">{editing ? 'Edit' : 'New'} Template</h2><button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white p-1"><HiOutlineX size={20} /></button></div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" placeholder="Template Name *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="input-field w-full" />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="Subject" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} className="input-field" />
                <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="input-field">
                  <option value="general">General</option><option value="marketing">Marketing</option><option value="followup">Follow-up</option><option value="welcome">Welcome</option>
                </select>
              </div>
              <textarea placeholder="Email body (HTML) — use {{name}}, {{email}} for variables" value={form.body} onChange={e => setForm({...form, body: e.target.value})} rows={8} className="input-field w-full resize-none font-mono text-sm" />
              <button type="submit" className="btn-primary w-full py-3 rounded-xl font-semibold">{editing ? 'Update' : 'Create'} Template</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
