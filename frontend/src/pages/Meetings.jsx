import { useState, useEffect, useCallback } from 'react';
import API from '../utils/api';
import { HiOutlinePlus, HiOutlineTrash, HiOutlineVideoCamera, HiOutlinePhone, HiOutlineUser, HiOutlineX, HiOutlineClock } from 'react-icons/hi';

export default function Meetings() {
  const [meetings, setMeetings] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', startTime: '', duration: 30, type: 'video', contactName: '', contactEmail: '', contactPhone: '', meetingLink: '', location: '' });
  const [filterStatus, setFilterStatus] = useState('');

  const fetch = useCallback(async () => {
    const r = await API.get(`/meetings${filterStatus ? `?status=${filterStatus}` : ''}`);
    if (r.data.success) setMeetings(r.data.meetings);
  }, [filterStatus]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await API.post('/meetings', form);
      setShowForm(false);
      setForm({ title: '', description: '', startTime: '', duration: 30, type: 'video', contactName: '', contactEmail: '', contactPhone: '', meetingLink: '', location: '' });
      fetch();
    } catch (err) { console.error(err); }
  };

  const updateStatus = async (id, status) => {
    await API.put(`/meetings/${id}`, { status });
    fetch();
  };

  const handleDelete = async (id) => {
    if (!confirm('Cancel this meeting?')) return;
    await API.delete(`/meetings/${id}`);
    fetch();
  };

  const typeIcon = { video: HiOutlineVideoCamera, phone: HiOutlinePhone, in_person: HiOutlineUser };
  const statusClass = { scheduled: 'text-yellow-400 bg-yellow-500/20', confirmed: 'text-blue-400 bg-blue-500/20', completed: 'text-green-400 bg-green-500/20', cancelled: 'text-red-400 bg-red-500/20' };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Meetings</h1>
        <div className="flex gap-3">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input-field text-sm">
            <option value="">All</option><option value="scheduled">Scheduled</option><option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
          </select>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm whitespace-nowrap"><HiOutlinePlus /> Schedule</button>
        </div>
      </div>

      <div className="space-y-3">
        {meetings.map(m => {
          const TypeIcon = typeIcon[m.type] || HiOutlineVideoCamera;
          return (
            <div key={m._id} className="glass-card rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <TypeIcon className="text-purple-400" size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-white font-semibold">{m.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusClass[m.status] || 'text-gray-400 bg-gray-500/20'}`}>{m.status}</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><HiOutlineClock size={12} />{new Date(m.startTime).toLocaleString()}</span>
                  {m.contactName && <span className="flex items-center gap-1"><HiOutlineUser size={12} />{m.contactName}</span>}
                  <span className="capitalize">{m.type.replace('_', ' ')}</span>
                  {m.duration && <span>{m.duration} min</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {m.status === 'scheduled' && (
                  <>
                    <button onClick={() => updateStatus(m._id, 'confirmed')} className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">Confirm</button>
                    <button onClick={() => updateStatus(m._id, 'completed')} className="text-xs px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30">Done</button>
                  </>
                )}
                <button onClick={() => handleDelete(m._id)} className="text-gray-500 hover:text-red-400 p-1.5"><HiOutlineTrash size={16} /></button>
              </div>
            </div>
          );
        })}
        {meetings.length === 0 && <p className="text-gray-500 text-center py-8">No meetings scheduled</p>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Schedule Meeting</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white p-1"><HiOutlineX size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" placeholder="Meeting Title *" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required className="input-field w-full" />
              <textarea placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} className="input-field w-full resize-none" />
              <div className="grid grid-cols-2 gap-3">
                <input type="datetime-local" value={form.startTime} onChange={e => setForm({...form, startTime: e.target.value})} required className="input-field" />
                <input type="number" placeholder="Duration (min)" value={form.duration} onChange={e => setForm({...form, duration: e.target.value})} className="input-field" />
              </div>
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="input-field w-full">
                <option value="video">Video Call</option><option value="phone">Phone Call</option><option value="in_person">In Person</option>
              </select>
              <input type="text" placeholder="Meeting Link (Google Meet / Zoom)" value={form.meetingLink} onChange={e => setForm({...form, meetingLink: e.target.value})} className="input-field w-full" />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="Contact Name" value={form.contactName} onChange={e => setForm({...form, contactName: e.target.value})} className="input-field" />
                <input type="email" placeholder="Contact Email" value={form.contactEmail} onChange={e => setForm({...form, contactEmail: e.target.value})} className="input-field" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1 py-3 rounded-xl font-semibold">Schedule Meeting</button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
