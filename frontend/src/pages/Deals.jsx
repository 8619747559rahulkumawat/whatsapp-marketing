import { useState, useEffect, useCallback } from 'react';
import API from '../utils/api';
import { HiOutlinePlus, HiOutlineDotsVertical, HiOutlinePhone, HiOutlineMail, HiOutlineTrash, HiOutlineCurrencyRupee, HiOutlineUser, HiOutlineTag, HiOutlineX, HiOutlinePencil } from 'react-icons/hi';

const STAGES = [
  { key: 'new', label: 'New', color: 'bg-blue-500' },
  { key: 'contacted', label: 'Contacted', color: 'bg-yellow-500' },
  { key: 'qualified', label: 'Qualified', color: 'bg-purple-500' },
  { key: 'proposal', label: 'Proposal', color: 'bg-orange-500' },
  { key: 'won', label: 'Won', color: 'bg-green-500' },
  { key: 'lost', label: 'Lost', color: 'bg-red-500' }
];

export default function Deals() {
  const [deals, setDeals] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', value: '', contactName: '', contactPhone: '', contactEmail: '', stage: 'new', priority: 'medium', notes: '', expectedCloseDate: '' });
  const [dragItem, setDragItem] = useState(null);
  const [stats, setStats] = useState({ stageStats: [], totalPipeline: 0 });
  const [search, setSearch] = useState('');

  const fetchDeals = useCallback(async () => {
    const [d, s] = await Promise.all([
      API.get(`/deals${search ? `?search=${search}` : ''}`),
      API.get('/deals/stats')
    ]);
    if (d.data.success) setDeals(d.data.deals);
    if (s.data.success) setStats(s.data);
  }, [search]);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, value: parseFloat(form.value) || 0 };
      if (editing) {
        await API.put(`/deals/${editing._id}`, payload);
      } else {
        await API.post('/deals', payload);
      }
      setShowForm(false);
      setEditing(null);
      setForm({ title: '', value: '', contactName: '', contactPhone: '', contactEmail: '', stage: 'new', priority: 'medium', notes: '', expectedCloseDate: '' });
      fetchDeals();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this deal?')) return;
    await API.delete(`/deals/${id}`);
    fetchDeals();
  };

  const handleDragStart = (deal, e) => {
    setDragItem(deal);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async (stage, e) => {
    e.preventDefault();
    if (!dragItem) return;
    try {
      await API.patch(`/deals/${dragItem._id}/stage`, { stage });
      setDragItem(null);
      fetchDeals();
    } catch (err) { console.error(err); }
  };

  const handleDragOver = (e) => e.preventDefault();

  const editDeal = (deal) => {
    setForm({ title: deal.title, value: deal.value, contactName: deal.contactName || '', contactPhone: deal.contactPhone || '', contactEmail: deal.contactEmail || '', stage: deal.stage, priority: deal.priority, notes: deal.notes || '', expectedCloseDate: deal.expectedCloseDate ? deal.expectedCloseDate.split('T')[0] : '' });
    setEditing(deal);
    setShowForm(true);
  };

  const groupedDeals = {};
  STAGES.forEach(s => { groupedDeals[s.key] = []; });
  deals.forEach(d => {
    if (groupedDeals[d.stage]) groupedDeals[d.stage].push(d);
  });

  const stageTotals = {};
  stats.stageStats.forEach(s => { stageTotals[s._id] = s.total; });

  const priorityColor = { low: 'bg-gray-500', medium: 'bg-yellow-500', high: 'bg-red-500' };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Deal Pipeline</h1>
          <p className="text-gray-400 text-sm">Total Pipeline: <span className="text-green-400 font-semibold">₹{stats.totalPipeline?.toLocaleString()}</span></p>
        </div>
        <div className="flex gap-3">
          <input type="text" placeholder="Search deals..." value={search} onChange={e => setSearch(e.target.value)} className="input-field flex-1 sm:w-48" />
          <button onClick={() => { setEditing(null); setForm({ title: '', value: '', contactName: '', contactPhone: '', contactEmail: '', stage: 'new', priority: 'medium', notes: '', expectedCloseDate: '' }); setShowForm(true); }} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm whitespace-nowrap">
            <HiOutlinePlus /> New Deal
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {STAGES.map(stage => (
          <div key={stage.key} onDragOver={handleDragOver} onDrop={(e) => handleDrop(stage.key, e)} className="glass-card rounded-xl p-3 min-h-[200px]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
                <h3 className="text-white font-semibold text-sm">{stage.label}</h3>
              </div>
              <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{groupedDeals[stage.key]?.length || 0}</span>
            </div>
            <div className="space-y-2">
              {groupedDeals[stage.key]?.map(deal => (
                <div key={deal._id} draggable onDragStart={(e) => handleDragStart(deal, e)} className="bg-white/5 hover:bg-white/10 rounded-lg p-3 cursor-grab active:cursor-grabbing transition-all border border-white/5">
                  <div className="flex items-start justify-between">
                    <h4 className="text-white text-sm font-medium truncate flex-1">{deal.title}</h4>
                    <div className="flex gap-1 ml-1">
                      <button onClick={() => editDeal(deal)} className="text-gray-500 hover:text-purple-400 p-0.5"><HiOutlinePencil size={14} /></button>
                      <button onClick={() => handleDelete(deal._id)} className="text-gray-500 hover:text-red-400 p-0.5"><HiOutlineTrash size={14} /></button>
                    </div>
                  </div>
                  {deal.contactName && <p className="text-gray-400 text-xs mt-1 flex items-center gap-1"><HiOutlineUser size={12} />{deal.contactName}</p>}
                  <div className="flex items-center justify-between mt-2">
                    {deal.value > 0 && <span className="text-green-400 text-xs font-semibold">₹{deal.value.toLocaleString()}</span>}
                    <span className={`${priorityColor[deal.priority]} text-white text-[10px] px-1.5 py-0.5 rounded-full`}>{deal.priority}</span>
                  </div>
                </div>
              ))}
              {(!groupedDeals[stage.key] || groupedDeals[stage.key].length === 0) && (
                <p className="text-gray-600 text-xs text-center py-4">Drop deals here</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">{editing ? 'Edit Deal' : 'New Deal'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white p-1"><HiOutlineX size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" placeholder="Deal Title *" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required className="input-field w-full" />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" placeholder="Value" value={form.value} onChange={e => setForm({...form, value: e.target.value})} className="input-field" />
                <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})} className="input-field">
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                </select>
              </div>
              <input type="text" placeholder="Contact Name" value={form.contactName} onChange={e => setForm({...form, contactName: e.target.value})} className="input-field w-full" />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="Phone" value={form.contactPhone} onChange={e => setForm({...form, contactPhone: e.target.value})} className="input-field" />
                <input type="email" placeholder="Email" value={form.contactEmail} onChange={e => setForm({...form, contactEmail: e.target.value})} className="input-field" />
              </div>
              <select value={form.stage} onChange={e => setForm({...form, stage: e.target.value})} className="input-field w-full">
                {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <input type="date" value={form.expectedCloseDate} onChange={e => setForm({...form, expectedCloseDate: e.target.value})} className="input-field w-full" />
              <textarea placeholder="Notes..." value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={3} className="input-field w-full resize-none" />
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1 py-3 rounded-xl font-semibold">{editing ? 'Update' : 'Create'} Deal</button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl font-semibold bg-white/5 text-gray-300 hover:bg-white/10">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
