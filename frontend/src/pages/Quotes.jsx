import { useState, useEffect, useCallback } from 'react';
import API from '../utils/api';
import { HiOutlinePlus, HiOutlineTrash, HiOutlineX, HiOutlineDocumentText, HiOutlineEye, HiOutlineDownload, HiOutlinePencil } from 'react-icons/hi';
import { useToast } from '../contexts/ToastContext';

export default function Quotes() {
  const toast = useToast();
  const [quotes, setQuotes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState({ contactName: '', contactPhone: '', contactEmail: '', items: [{ productName: '', quantity: 1, unitPrice: 0, taxRate: 0 }], notes: '', validUntil: '' });

  const fetchQuotes = useCallback(async () => {
    const r = await API.get(`/quotes${filter ? `?status=${filter}` : ''}`);
    if (r.data.success) setQuotes(r.data.quotes);
  }, [filter]);

  useEffect(() => { fetchQuotes(); }, [fetchQuotes]);

  const addItem = () => setForm({ ...form, items: [...form.items, { productName: '', quantity: 1, unitPrice: 0, taxRate: 0 }] });
  const removeItem = (i) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });
  const updateItem = (i, field, value) => {
    const items = [...form.items];
    items[i] = { ...items[i], [field]: value };
    setForm({ ...form, items });
  };

  const calcTotals = (items) => {
    let subtotal = 0, tax = 0;
    items.forEach(item => {
      const s = (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0);
      subtotal += s;
      tax += s * ((parseFloat(item.taxRate) || 0) / 100);
    });
    return { subtotal, tax, total: subtotal + tax };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        items: form.items.map(item => ({
          productName: item.productName,
          quantity: parseInt(item.quantity) || 1,
          unitPrice: parseFloat(item.unitPrice) || 0,
          taxRate: parseFloat(item.taxRate) || 0
        }))
      };
      if (editing) await API.put(`/quotes/${editing._id}`, payload);
      else await API.post('/quotes', payload);
      toast.success(editing ? 'Quote updated' : 'Quote created');
      setShowForm(false); setEditing(null);
      setForm({ contactName: '', contactPhone: '', contactEmail: '', items: [{ productName: '', quantity: 1, unitPrice: 0, taxRate: 0 }], notes: '', validUntil: '' });
      fetchQuotes();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const updateStatus = async (id, status) => {
    await API.patch(`/quotes/${id}/status`, { status });
    fetchQuotes();
  };

  const editQuote = (q) => {
    setForm({ contactName: q.contactName || '', contactPhone: q.contactPhone || '', contactEmail: q.contactEmail || '', items: q.items || [{ productName: '', quantity: 1, unitPrice: 0, taxRate: 0 }], notes: q.notes || '', validUntil: q.validUntil ? q.validUntil.split('T')[0] : '' });
    setEditing(q);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this quote?')) return;
    await API.delete(`/quotes/${id}`);
    fetchQuotes();
  };

  const statusClass = { draft: 'text-gray-400 bg-gray-500/20', sent: 'text-blue-400 bg-blue-500/20', viewed: 'text-purple-400 bg-purple-500/20', accepted: 'text-green-400 bg-green-500/20', rejected: 'text-red-400 bg-red-500/20', expired: 'text-yellow-400 bg-yellow-500/20' };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><HiOutlineDocumentText /> Quotes</h1>
        <div className="flex gap-3">
          <select value={filter} onChange={e => setFilter(e.target.value)} className="input-field text-sm">
            <option value="">All</option><option value="draft">Draft</option><option value="sent">Sent</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option>
          </select>
          <button onClick={() => { setEditing(null); setForm({ contactName: '', contactPhone: '', contactEmail: '', items: [{ productName: '', quantity: 1, unitPrice: 0, taxRate: 0 }], notes: '', validUntil: '' }); setShowForm(true); }} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm whitespace-nowrap">
            <HiOutlinePlus /> New Quote
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {quotes.map(q => {
          const t = calcTotals(q.items);
          return (
            <div key={q._id} className="glass-card rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h3 className="text-white font-semibold">{q.quoteNumber}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusClass[q.status]}`}>{q.status}</span>
                </div>
                <p className="text-gray-400 text-sm">{q.contactName || 'No contact'}</p>
                <div className="flex gap-4 mt-1 text-xs text-gray-500">
                  <span>Items: {q.items?.length}</span>
                  <span className="text-green-400 font-semibold">₹{q.grandTotal?.toLocaleString() || t.total.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {q.status === 'draft' && <button onClick={() => updateStatus(q._id, 'sent')} className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">Send</button>}
                {q.status === 'sent' && <button onClick={() => updateStatus(q._id, 'accepted')} className="text-xs px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30">Accept</button>}
                <button onClick={() => editQuote(q)} className="text-gray-500 hover:text-purple-400 p-1.5"><HiOutlinePencil size={16} /></button>
                <button onClick={() => handleDelete(q._id)} className="text-gray-500 hover:text-red-400 p-1.5"><HiOutlineTrash size={16} /></button>
              </div>
            </div>
          );
        })}
        {quotes.length === 0 && <p className="text-gray-500 text-center py-8">No quotes yet</p>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowForm(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-2xl my-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">{editing ? 'Edit Quote' : 'New Quote'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white p-1"><HiOutlineX size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <input type="text" placeholder="Contact Name" value={form.contactName} onChange={e => setForm({...form, contactName: e.target.value})} className="input-field col-span-2" />
                <input type="date" value={form.validUntil} onChange={e => setForm({...form, validUntil: e.target.value})} className="input-field" />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-300">Items</h3>
                  <button type="button" onClick={addItem} className="text-xs text-purple-400 hover:text-purple-300">+ Add Item</button>
                </div>
                {form.items.map((item, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <input type="text" placeholder="Product name" value={item.productName} onChange={e => updateItem(i, 'productName', e.target.value)} required className="input-field flex-1 text-sm" />
                    <input type="number" placeholder="Qty" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} className="input-field w-16 text-sm" />
                    <input type="number" placeholder="Price" value={item.unitPrice} onChange={e => updateItem(i, 'unitPrice', e.target.value)} className="input-field w-24 text-sm" />
                    <input type="number" placeholder="Tax %" value={item.taxRate} onChange={e => updateItem(i, 'taxRate', e.target.value)} className="input-field w-16 text-sm" />
                    {form.items.length > 1 && <button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-300 p-2"><HiOutlineX size={16} /></button>}
                  </div>
                ))}
                <div className="text-right text-sm text-gray-400">
                  Total: <span className="text-green-400 font-bold text-lg">₹{calcTotals(form.items).total.toLocaleString()}</span>
                </div>
              </div>
              <textarea placeholder="Notes" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className="input-field w-full resize-none" />
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1 py-3 rounded-xl font-semibold">{editing ? 'Update' : 'Create'} Quote</button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
