import { useState, useEffect, useCallback } from 'react';
import API from '../utils/api';
import { HiOutlinePlus, HiOutlineTrash, HiOutlinePencil, HiOutlineX, HiOutlineCode, HiOutlineExternalLink } from 'react-icons/hi';
import { useToast } from '../contexts/ToastContext';

export default function WebForms() {
  const toast = useToast();
  const [forms, setForms] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [embedCode, setEmbedCode] = useState('');
  const [form, setForm] = useState({
    name: '', slug: '', fields: [{ label: 'Full Name', name: 'name', type: 'text', required: true, placeholder: 'Your Name', order: 0 }],
    submitButtonText: 'Submit', successMessage: 'Thank you! We will contact you soon.',
    theme: { primaryColor: '#7c3aed', bgColor: '#ffffff', textColor: '#1f2937' }
  });

  const fetchForms = useCallback(async () => {
    const r = await API.get('/webforms');
    if (r.data.success) setForms(r.data.forms);
  }, []);

  useEffect(() => { fetchForms(); }, [fetchForms]);

  const addField = () => setForm({ ...form, fields: [...form.fields, { label: '', name: '', type: 'text', required: false, placeholder: '', order: form.fields.length }] });
  const removeField = (i) => setForm({ ...form, fields: form.fields.filter((_, idx) => idx !== i) });
  const updateField = (i, field, value) => {
    const fields = [...form.fields];
    fields[i] = { ...fields[i], [field]: value };
    if (field === 'label') fields[i].name = value.toLowerCase().replace(/\s+/g, '_');
    setForm({ ...form, fields });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) await API.put(`/webforms/${editing._id}`, form);
      else await API.post('/webforms', form);
      toast.success(editing ? 'Form updated' : 'Form created');
      setShowForm(false); setEditing(null);
      fetchForms();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this form permanently?')) return;
    try {
      await API.delete(`/webforms/${id}`);
      toast.success('Form deleted');
      fetchForms();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error deleting form');
    }
  };

  const viewEmbed = (form) => {
    const code = `<form action="${window.location.origin}/f/${form.slug}" method="POST" style="max-width:500px;margin:0 auto;padding:20px;background:${form.theme?.bgColor || '#fff'};border-radius:12px;color:${form.theme?.textColor || '#333'}">
  ${form.fields.map(f => `<div style="margin-bottom:15px">
    <label style="display:block;margin-bottom:5px;font-weight:500">${f.label}${f.required ? ' *' : ''}</label>
    ${f.type === 'textarea' ? `<textarea name="${f.name}" placeholder="${f.placeholder || ''}" ${f.required ? 'required' : ''} style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:14px" rows="4"></textarea>`
    : f.type === 'select' ? `<select name="${f.name}" ${f.required ? 'required' : ''} style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:14px">${(f.options || []).map(o => `<option value="${o}">${o}</option>`).join('')}</select>`
    : f.type === 'checkbox' ? `<input type="checkbox" name="${f.name}" value="yes" style="width:18px;height:18px" />`
    : `<input type="${f.type}" name="${f.name}" placeholder="${f.placeholder || ''}" ${f.required ? 'required' : ''} style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:14px" />`}
  </div>`).join('')}
  <button type="submit" style="width:100%;padding:12px;background:${form.theme?.primaryColor || '#7c3aed'};color:#fff;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer">${form.submitButtonText || 'Submit'}</button>
</form>`;
    setEmbedCode(code);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Web Forms</h1>
        <button onClick={() => { setEditing(null); setForm({ name: '', slug: '', fields: [{ label: 'Full Name', name: 'name', type: 'text', required: true, placeholder: 'Your Name', order: 0 }], submitButtonText: 'Submit', successMessage: 'Thank you! We will contact you soon.', theme: { primaryColor: '#7c3aed', bgColor: '#ffffff', textColor: '#1f2937' } }); setShowForm(true); }} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm whitespace-nowrap">
          <HiOutlinePlus /> New Form
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {forms.map(f => (
          <div key={f._id} className="glass-card rounded-xl p-5 border border-white/5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-white font-semibold">{f.name}</h3>
                <p className="text-gray-500 text-xs">/{f.slug}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => viewEmbed(f)} className="text-gray-500 hover:text-purple-400 p-1" title="Embed Code"><HiOutlineCode size={16} /></button>
                <a href={`/f/${f.slug}`} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-blue-400 p-1"><HiOutlineExternalLink size={16} /></a>
                <button onClick={() => handleDelete(f._id)} className="text-gray-500 hover:text-red-400 p-1"><HiOutlineTrash size={15} /></button>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>{f.fields?.length || 0} fields</span>
              <span>{f.submissions || 0} submissions</span>
              <span className={f.isActive ? 'text-green-400' : 'text-red-400'}>{f.isActive ? 'Active' : 'Inactive'}</span>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => { setEditing(f); setForm({ name: f.name, slug: f.slug, fields: f.fields, submitButtonText: f.submitButtonText, successMessage: f.successMessage, theme: f.theme }); setShowForm(true); }} className="text-xs px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30">Edit</button>
            </div>
          </div>
        ))}
        {forms.length === 0 && <p className="text-gray-500 col-span-full text-center py-8">No web forms yet</p>}
      </div>

      {embedCode && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setEmbedCode('')}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Embed Code</h2>
              <button onClick={() => setEmbedCode('')} className="text-gray-500 hover:text-white p-1"><HiOutlineX size={20} /></button>
            </div>
            <textarea value={embedCode} readOnly rows={12} className="input-field w-full resize-none font-mono text-xs" onClick={e => e.target.select()} />
            <button onClick={() => { navigator.clipboard.writeText(embedCode); toast.success('Copied to clipboard!'); }} className="btn-primary mt-3 px-4 py-2 rounded-xl text-sm">Copy to Clipboard</button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowForm(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-2xl my-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">{editing ? 'Edit Form' : 'New Web Form'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white p-1"><HiOutlineX size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="Form Name *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="input-field" />
                <input type="text" placeholder="Slug *" value={form.slug} onChange={e => setForm({...form, slug: e.target.value})} required className="input-field font-mono" />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-300">Form Fields</h3>
                  <button type="button" onClick={addField} className="text-xs text-purple-400 hover:text-purple-300">+ Add Field</button>
                </div>
                {form.fields.map((field, i) => (
                  <div key={i} className="flex gap-2 items-start bg-white/5 p-3 rounded-xl">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <input type="text" placeholder="Label" value={field.label} onChange={e => updateField(i, 'label', e.target.value)} className="input-field text-sm" />
                      <select value={field.type} onChange={e => updateField(i, 'type', e.target.value)} className="input-field text-sm">
                        <option value="text">Text</option><option value="email">Email</option><option value="phone">Phone</option>
                        <option value="textarea">Textarea</option><option value="select">Select</option><option value="number">Number</option>
                      </select>
                    </div>
                    <label className="flex items-center gap-1 text-xs text-gray-400 whitespace-nowrap">
                      <input type="checkbox" checked={field.required} onChange={e => updateField(i, 'required', e.target.checked)} className="accent-purple-500" /> Req
                    </label>
                    {form.fields.length > 1 && <button type="button" onClick={() => removeField(i)} className="text-red-400 hover:text-red-300 p-1"><HiOutlineX size={16} /></button>}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <input type="text" placeholder="Submit Text" value={form.submitButtonText} onChange={e => setForm({...form, submitButtonText: e.target.value})} className="input-field" />
                <input type="color" value={form.theme.primaryColor} onChange={e => setForm({...form, theme: {...form.theme, primaryColor: e.target.value}})} className="input-field h-full" />
                <input type="text" placeholder="Success Message" value={form.successMessage} onChange={e => setForm({...form, successMessage: e.target.value})} className="input-field" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1 py-3 rounded-xl font-semibold">{editing ? 'Update' : 'Create'} Form</button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
