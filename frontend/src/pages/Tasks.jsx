import { useState, useEffect, useCallback } from 'react';
import API from '../utils/api';
import { HiOutlinePlus, HiOutlineTrash, HiOutlineCheckCircle, HiOutlineClock, HiOutlineUser, HiOutlineX, HiOutlineFlag } from 'react-icons/hi';

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({ stats: [], overdue: 0, dueToday: 0 });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', dueDate: '', assignedTo: '', contactId: '' });

  const fetchTasks = useCallback(async () => {
    const [t, s] = await Promise.all([API.get(`/tasks?status=${filter}`), API.get('/tasks/stats')]);
    if (t.data.success) setTasks(t.data.tasks);
    if (s.data.success) setStats(s.data);
  }, [filter]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) await API.put(`/tasks/${editing._id}`, form);
      else await API.post('/tasks', form);
      setShowForm(false); setEditing(null);
      setForm({ title: '', description: '', priority: 'medium', dueDate: '', assignedTo: '', contactId: '' });
      fetchTasks();
    } catch (err) { console.error(err); }
  };

  const updateStatus = async (id, status) => {
    await API.put(`/tasks/${id}`, { status });
    fetchTasks();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this task?')) return;
    await API.delete(`/tasks/${id}`);
    fetchTasks();
  };

  const priorityClass = { low: 'border-l-gray-500', medium: 'border-l-yellow-500', high: 'border-l-orange-500', urgent: 'border-l-red-500' };
  const statusClass = { pending: 'bg-yellow-500/20 text-yellow-400', in_progress: 'bg-blue-500/20 text-blue-400', completed: 'bg-green-500/20 text-green-400' };
  const priorityBadge = { low: 'bg-gray-500', medium: 'bg-yellow-500', high: 'bg-orange-500', urgent: 'bg-red-500' };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Tasks & Reminders</h1>
          <div className="flex gap-4 mt-1 text-sm">
            <span className="text-red-400">{stats.overdue} overdue</span>
            <span className="text-yellow-400">{stats.dueToday} due today</span>
            <span className="text-gray-400">{stats.stats.find(s => s._id === 'completed')?.count || 0} completed</span>
          </div>
        </div>
        <div className="flex gap-3">
          <select value={filter} onChange={e => setFilter(e.target.value)} className="input-field text-sm">
            <option value="all">All</option><option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="completed">Completed</option>
          </select>
          <button onClick={() => { setEditing(null); setForm({ title: '', description: '', priority: 'medium', dueDate: '', assignedTo: '', contactId: '' }); setShowForm(true); }} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm whitespace-nowrap">
            <HiOutlinePlus /> New Task
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {tasks.map(task => (
          <div key={task._id} className={`glass-card rounded-xl p-4 border-l-4 ${priorityClass[task.priority]} flex flex-col sm:flex-row sm:items-center gap-3`}>
            <button onClick={() => updateStatus(task._id, task.status === 'completed' ? 'pending' : 'completed')} className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${task.status === 'completed' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-500 hover:border-purple-400'}`}>
              {task.status === 'completed' && <HiOutlineCheckCircle size={14} />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-white font-medium ${task.status === 'completed' ? 'line-through text-gray-500' : ''}`}>{task.title}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full text-white ${priorityBadge[task.priority]}`}>{task.priority}</span>
              </div>
              {task.description && <p className="text-gray-400 text-xs mt-0.5 truncate">{task.description}</p>}
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                {task.dueDate && <span className="flex items-center gap-1"><HiOutlineClock size={12} />{new Date(task.dueDate).toLocaleDateString()}</span>}
                {task.assignedTo?.name && <span className="flex items-center gap-1"><HiOutlineUser size={12} />{task.assignedTo.name}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${statusClass[task.status] || 'text-gray-400'}`}>{task.status?.replace('_', ' ')}</span>
              <button onClick={() => handleDelete(task._id)} className="text-gray-500 hover:text-red-400 p-1.5"><HiOutlineTrash size={16} /></button>
            </div>
          </div>
        ))}
        {tasks.length === 0 && <p className="text-gray-500 text-center py-8">No tasks found</p>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">{editing ? 'Edit Task' : 'New Task'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white p-1"><HiOutlineX size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" placeholder="Task Title *" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required className="input-field w-full" />
              <textarea placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} className="input-field w-full resize-none" />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})} className="input-field">
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
                </select>
                <input type="date" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})} className="input-field" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1 py-3 rounded-xl font-semibold">{editing ? 'Update' : 'Create'} Task</button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl font-semibold bg-white/5 text-gray-300 hover:bg-white/10">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
