import { useState, useEffect, useCallback } from 'react';
import API from '../utils/api';
import { HiOutlinePlus, HiOutlineTrash, HiOutlineX, HiOutlineDocument, HiOutlineDownload } from 'react-icons/hi';
import { useToast } from '../contexts/ToastContext';

export default function Contracts() {
  const toast = useToast();
  const [contracts, setContracts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', contractNumber: '', value: '', contactName: '', status: 'draft', notes: '' });

  const fetch = useCallback(async () => {
    const r = await API.get('/contracts');
    if (r.data.success) setContracts(r.data.contracts);
  }, []);
  useEffect(() => { fetch(); }, [fetch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await API.post('/contracts', { ...form, value: parseFloat(form.value) || 0 });
      toast.success('Contract created');
      setShowForm(false);
      setForm({ title: '', contractNumber: '', value: '', contactName: '', status: 'draft', notes: '' });
      fetch();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const updateStatus = async (id, status) => {
    await API.put(`/contracts/${id}`, { status });
    fetch();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this contract?')) return;
    await API.delete(`/contracts/${id}`);
    fetch();
  };

  const statusColor = { draft: 'text-gray-400 bg-gray-500/20', active: 'text-green-400 bg-green-500/20', completed: 'text-blue-400 bg-blue-500/20', terminated: 'text-red-400 bg-red-500/20' };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><HiOutlineDocument /> Contracts</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm"><HiOutlinePlus /> New Contract</button>
      </div>
      <div className="space-y-3">
        {contracts.map(c => (
          <div key={c._id} className="glass-card rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-white font-semibold">{c.title}</h3>
                {c.contractNumber && <span className="text-xs text-gray-500">#{c.contractNumber}</span>}
              </div>
              <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                {c.contactName && <span>{c.contactName}</span>}
                {c.value > 0 && <span className="text-green-400 font-semibold">₹{c.value?.toLocaleString()}</span>}
              </div>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[c.status] || 'text-gray-400'}`}>{c.status}</span>
            <div className="flex gap-2">
              {c.status === 'draft' && <button onClick={() => updateStatus(c._id, 'active')} className="text-xs px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400">Activate</button>}
              <button onClick={() => handleDelete(c._id)} className="text-gray-500 hover:text-red-400"><HiOutlineTrash size={16} /></button>
            </div>
          </div>
        ))}
        {contracts.length === 0 && <p className="text-gray-500 text-center py-8">No contracts yet</p>}
      </div>
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-bold text-white">New Contract</h2><button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white p-1"><HiOutlineX size={20} /></button></div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" placeholder="Contract Title *" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required className="input-field w-full" />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="Contract #" value={form.contractNumber} onChange={e => setForm({...form, contractNumber: e.target.value})} className="input-field" />
                <input type="number" placeholder="Value" value={form.value} onChange={e => setForm({...form, value: e.target.value})} className="input-field" />
              </div>
              <input type="text" placeholder="Contact Name" value={form.contactName} onChange={e => setForm({...form, contactName: e.target.value})} className="input-field w-full" />
              <textarea placeholder="Notes" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className="input-field w-full resize-none" />
              <button type="submit" className="btn-primary w-full py-3 rounded-xl font-semibold">Create Contract</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
