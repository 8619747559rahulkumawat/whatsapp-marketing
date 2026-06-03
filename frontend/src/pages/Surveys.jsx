import { useState, useEffect, useCallback } from 'react';
import API from '../utils/api';
import { HiOutlinePlus, HiOutlineTrash, HiOutlineX, HiOutlineHeart, HiOutlineChartBar } from 'react-icons/hi';
import { useToast } from '../contexts/ToastContext';

export default function Surveys() {
  const toast = useToast();
  const [surveys, setSurveys] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'nps', description: '', questions: [{ question: 'How likely are you to recommend us?', type: 'rating', order: 0 }] });

  const fetch = useCallback(async () => {
    const r = await API.get('/surveys');
    if (r.data.success) setSurveys(r.data.surveys);
  }, []);
  useEffect(() => { fetch(); }, [fetch]);

  const addQuestion = () => setForm({ ...form, questions: [...form.questions, { question: '', type: 'text', options: [], order: form.questions.length }] });
  const updateQuestion = (i, field, value) => {
    const qs = [...form.questions]; qs[i] = { ...qs[i], [field]: value }; setForm({ ...form, questions: qs });
  };
  const removeQuestion = (i) => setForm({ ...form, questions: form.questions.filter((_, idx) => idx !== i) });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await API.post('/surveys', form);
      toast.success('Survey created');
      setShowForm(false);
      setForm({ title: '', type: 'nps', description: '', questions: [{ question: 'How likely are you to recommend us?', type: 'rating', order: 0 }] });
      fetch();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const updateStatus = async (id, status) => {
    await API.put(`/surveys/${id}`, { status });
    fetch();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this survey?')) return;
    await API.delete(`/surveys/${id}`);
    fetch();
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><HiOutlineHeart /> Surveys & NPS</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm"><HiOutlinePlus /> New Survey</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {surveys.map(s => (
          <div key={s._id} className="glass-card rounded-xl p-5 border border-white/5">
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-white font-semibold">{s.title}</h3>
              <button onClick={() => handleDelete(s._id)} className="text-gray-500 hover:text-red-400"><HiOutlineTrash size={15} /></button>
            </div>
            <p className="text-xs text-gray-500 capitalize mb-2">{s.type} • {s.questions?.length} questions</p>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-400">Responses: <strong className="text-white">{s.responseCount || 0}</strong></span>
              {s.averageScore > 0 && <span className="text-green-400">Avg: {s.averageScore}/10</span>}
            </div>
            <div className="flex gap-2 mt-3">
              {s.status === 'draft' && <button onClick={() => updateStatus(s._id, 'active')} className="text-xs px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400">Activate</button>}
              <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>{s.status}</span>
            </div>
          </div>
        ))}
        {surveys.length === 0 && <p className="text-gray-500 col-span-full text-center py-8">No surveys yet</p>}
      </div>
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowForm(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-lg my-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-bold text-white">New Survey</h2><button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white p-1"><HiOutlineX size={20} /></button></div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" placeholder="Survey Title *" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required className="input-field w-full" />
              <textarea placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} className="input-field w-full resize-none" />
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="input-field w-full">
                <option value="nps">NPS (Net Promoter Score)</option><option value="csat">CSAT</option><option value="custom">Custom</option>
              </select>
              <div className="space-y-2">
                {form.questions.map((q, i) => (
                  <div key={i} className="flex gap-2 items-start bg-white/5 p-3 rounded-xl">
                    <input type="text" placeholder="Question" value={q.question} onChange={e => updateQuestion(i, 'question', e.target.value)} className="input-field flex-1 text-sm" />
                    <select value={q.type} onChange={e => updateQuestion(i, 'type', e.target.value)} className="input-field text-sm w-24">
                      <option value="rating">Rating</option><option value="text">Text</option><option value="yesno">Yes/No</option>
                    </select>
                    {form.questions.length > 1 && <button type="button" onClick={() => removeQuestion(i)} className="text-red-400 p-1"><HiOutlineX size={16} /></button>}
                  </div>
                ))}
                <button type="button" onClick={addQuestion} className="text-xs text-purple-400 hover:text-purple-300">+ Add Question</button>
              </div>
              <button type="submit" className="btn-primary w-full py-3 rounded-xl font-semibold">Create Survey</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
