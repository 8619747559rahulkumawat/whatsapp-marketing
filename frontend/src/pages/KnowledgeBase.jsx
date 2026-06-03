import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import API from '../utils/api';
import { HiOutlinePlus, HiOutlineTrash, HiOutlineSearch, HiOutlineDocument, HiOutlineUpload, HiOutlineBookOpen, HiOutlineChip, HiOutlineEye } from 'react-icons/hi';
import { FaRobot, FaBrain } from 'react-icons/fa';

export default function KnowledgeBase() {
  const [kbs, setKbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedKb, setSelectedKb] = useState(null);
  const [kbChunks, setKbChunks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });

  useEffect(() => { fetchKbs(); fetchAnalytics(); checkOpenAI(); }, []);

  const fetchKbs = async () => {
    try {
      const { data } = await API.get('/ai/knowledge-base');
      if (data.success) setKbs(data.knowledgeBases || data.kbs || []);
    } catch { console.error('Operation failed'); } finally { setLoading(false); }
  };

  const fetchAnalytics = async () => {
    try {
      const { data } = await API.get('/ai/analytics');
      if (data.success) setAnalytics(data.analytics || data.stats);
    } catch { console.error('Operation failed'); }
  };

  const checkOpenAI = async () => {
    try {
      const { data } = await API.get('/ai/openai-status');
      if (data.success && data.hasKey) setOpenaiKey('configured');
    } catch { console.error('Operation failed'); }
  };

  const createKb = async (e) => {
    e.preventDefault();
    try {
      await API.post('/ai/knowledge-base', form);
      setShowCreate(false);
      setForm({ name: '', description: '' });
      fetchKbs();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create knowledge base');
    }
  };

  const deleteKb = async (id) => {
    if (!confirm('Delete this knowledge base and all its chunks?')) return;
    try { await API.delete(`/ai/knowledge-base/${id}`); fetchKbs(); if (selectedKb?._id === id) { setSelectedKb(null); setKbChunks([]); } } catch { console.error('Operation failed'); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedKb) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('knowledgeBaseId', selectedKb._id);
    try {
      await API.post('/ai/knowledge-base/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setShowUpload(false);
      fetchChunks(selectedKb._id);
    } catch (err) {
      alert(err.response?.data?.message || 'Upload failed');
    }
  };

  const fetchChunks = async (kbId) => {
    try {
      const { data } = await API.get(`/ai/knowledge-base/${kbId}/chunks`);
      if (data.success) setKbChunks(data.chunks || []);
    } catch { console.error('Operation failed'); }
  };

  const selectKb = (kb) => {
    setSelectedKb(kb);
    fetchChunks(kb._id);
  };

  const saveOpenAIKey = async () => {
    try {
      await API.post('/ai/openai-key', { key: openaiKey });
      setShowKeyInput(false);
      setOpenaiKey('configured');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save key');
    }
  };

  const searchKnowledge = async () => {
    if (!searchQuery.trim() || !selectedKb) return;
    try {
      const { data } = await API.post('/ai/knowledge-base/search', { query: searchQuery, knowledgeBaseId: selectedKb._id });
      if (data.success) setSearchResult(data.result || data.answer || 'No relevant information found.');
    } catch (err) {
      setSearchResult(`Error: ${err.response?.data?.message || err.message}`);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Knowledge Base</h1>
          <p className="text-gray-400 text-sm mt-1">Train AI on your documents and data for smart responses</p>
        </div>
        <div className="flex gap-2">
          {openaiKey !== 'configured' && (
            <button onClick={() => setShowKeyInput(true)} className="btn-primary px-4 py-2 rounded-xl text-white text-sm font-medium flex items-center gap-2 bg-orange-600 hover:bg-orange-500">
              <HiOutlineChip /> Set OpenAI Key
            </button>
          )}
          <button onClick={() => setShowCreate(true)} className="btn-primary px-4 py-2 rounded-xl text-white text-sm font-medium flex items-center gap-2">
            <HiOutlinePlus /> Create Knowledge Base
          </button>
        </div>
      </div>

      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-card p-5 text-center">
            <FaBrain className="text-3xl text-purple-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{analytics.totalKnowledgeBases || analytics.totalKbs || kbs.length}</p>
            <p className="text-gray-400 text-sm">Knowledge Bases</p>
          </div>
          <div className="glass-card p-5 text-center">
            <HiOutlineDocument className="text-3xl text-blue-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{analytics.totalChunks || analytics.totalDocuments || 0}</p>
            <p className="text-gray-400 text-sm">Total Chunks</p>
          </div>
          <div className="glass-card p-5 text-center">
            <HiOutlineBookOpen className="text-3xl text-green-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{analytics.totalQueries || 0}</p>
            <p className="text-gray-400 text-sm">AI Queries</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-white font-semibold">Your Knowledge Bases</h2>
          {kbs.map((kb, idx) => (
            <motion.div key={kb._id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}
              className={`glass-card p-4 cursor-pointer glass-card-hover ${selectedKb?._id === kb._id ? 'border-purple-500/50' : ''}`}
              onClick={() => selectKb(kb)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <FaBrain className="text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm">{kb.name}</h3>
                    <p className="text-gray-400 text-xs">{kb.chunkCount || kb.chunks?.length || 0} chunks</p>
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); deleteKb(kb._id); }} className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20">
                  <HiOutlineTrash size={14} />
                </button>
              </div>
              {kb.description && <p className="text-gray-500 text-xs mt-2">{kb.description}</p>}
            </motion.div>
          ))}
          {kbs.length === 0 && <div className="text-center py-8 text-gray-500">No knowledge bases yet</div>}
        </div>

        <div className="lg:col-span-2 space-y-4">
          {selectedKb ? (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-white font-semibold">{selectedKb.name} - Documents</h2>
                <button onClick={() => setShowUpload(true)} className="btn-primary px-3 py-1.5 rounded-xl text-white text-xs font-medium flex items-center gap-1">
                  <HiOutlineUpload size={14} /> Upload PDF
                </button>
              </div>

              <div className="glass-card p-4">
                <div className="flex gap-3 mb-4">
                  <input className="input-field flex-1" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search your knowledge base..." />
                  <button onClick={searchKnowledge} className="btn-primary px-4 py-2 rounded-xl text-white flex items-center gap-2">
                    <HiOutlineSearch /> Search
                  </button>
                </div>
                {searchResult && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                    <p className="text-sm text-white">{searchResult}</p>
                  </motion.div>
                )}
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {kbChunks.map((chunk, idx) => (
                  <motion.div key={chunk._id || idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }}
                    className="glass-card p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <HiOutlineDocument className="text-purple-400 text-xs" />
                      <span className="text-xs text-gray-500">{chunk.source || 'Manual Input'}</span>
                      {chunk.embedding && <span className="badge badge-info text-[10px] ml-auto">Vector Indexed</span>}
                    </div>
                    <p className="text-sm text-gray-300 line-clamp-3">{chunk.text || chunk.content}</p>
                  </motion.div>
                ))}
                {kbChunks.length === 0 && <div className="text-center py-8 text-gray-500">No chunks in this knowledge base. Upload a PDF or add text.</div>}
              </div>
            </>
          ) : (
            <div className="glass-card p-12 text-center">
              <FaBrain className="text-6xl text-purple-400/30 mx-auto mb-4" />
              <h3 className="text-white font-semibold text-lg mb-2">Select a Knowledge Base</h3>
              <p className="text-gray-400 text-sm">Choose a knowledge base from the left to view its contents, upload documents, and search.</p>
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-md border border-white/10" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">Create Knowledge Base</h2>
            <form onSubmit={createKb} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-300 mb-2">Name</label><input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
              <div><label className="block text-sm font-medium text-gray-300 mb-2">Description</label><textarea className="input-field h-20" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div className="flex gap-3 justify-end pt-4">
                <button type="button" onClick={() => setShowCreate(false)} className="px-6 py-2 rounded-xl border border-white/10 text-gray-300">Cancel</button>
                <button type="submit" className="btn-primary px-6 py-2 rounded-xl text-white">Create</button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}

      {showUpload && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowUpload(false)}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-md border border-white/10" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">Upload Document</h2>
            <p className="text-gray-400 text-sm mb-4">Upload a PDF to add to "{selectedKb?.name}"</p>
            <input type="file" accept=".pdf,.txt,.md,.csv" onChange={handleFileUpload} className="w-full text-white" />
            <div className="flex gap-3 justify-end pt-4">
              <button type="button" onClick={() => setShowUpload(false)} className="px-6 py-2 rounded-xl border border-white/10 text-gray-300">Cancel</button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {showKeyInput && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowKeyInput(false)}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-md border border-white/10" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">Set OpenAI API Key</h2>
            <p className="text-gray-400 text-sm mb-4">Required for AI-powered knowledge base features (embeddings & search)</p>
            <input className="input-field mb-4" type="password" value={openaiKey} onChange={e => setOpenaiKey(e.target.value)} placeholder="sk-..." />
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowKeyInput(false)} className="px-6 py-2 rounded-xl border border-white/10 text-gray-300">Cancel</button>
              <button onClick={saveOpenAIKey} className="btn-primary px-6 py-2 rounded-xl text-white">Save</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
