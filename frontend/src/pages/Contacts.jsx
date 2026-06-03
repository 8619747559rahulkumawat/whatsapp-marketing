import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import API from '../utils/api';
import { HiOutlinePlus, HiOutlineUpload, HiOutlineDownload, HiOutlineSearch, HiOutlineTrash } from 'react-icons/hi';
import { FaUsers, FaTag } from 'react-icons/fa';

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', groups: [] });
  const [groupForm, setGroupForm] = useState({ name: '', description: '' });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => { fetchData(); }, [page, search]);

  const fetchData = async () => {
    try {
      const [contRes, grpRes] = await Promise.all([
        API.get(`/contacts?page=${page}&limit=20&search=${search}`),
        API.get('/contacts/groups')
      ]);
      if (contRes.data.success) { setContacts(contRes.data.contacts); setTotalPages(contRes.data.pagination.pages); }
      if (grpRes.data.success) setGroups(grpRes.data.groups);
    } catch { } finally { setLoading(false); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await API.post('/contacts', form);
      setShowModal(false);
      setForm({ name: '', phone: '', email: '', groups: [] });
      fetchData();
    } catch { }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this contact?')) return;
    try { await API.delete(`/contacts/${id}`); fetchData(); } catch { }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const { data } = await API.post('/contacts/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      alert(`Imported: ${data.imported}, Skipped: ${data.skipped}`);
      fetchData();
    } catch { }
    e.target.value = '';
  };

  const handleExport = async () => {
    try {
      const { data } = await API.get('/contacts/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'contacts.csv';
      a.click();
    } catch { }
  };

  const createGroup = async (e) => {
    e.preventDefault();
    try { await API.post('/contacts/groups', groupForm); setShowGroupModal(false); setGroupForm({ name: '', description: '' }); fetchData(); } catch { }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Contacts</h1>
          <p className="text-gray-400 text-sm mt-1">Manage your contact list and groups</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input-field pl-10 py-2 w-48" placeholder="Search..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <label className="btn-primary px-4 py-2 rounded-xl text-white text-sm font-medium flex items-center gap-2 cursor-pointer">
            <HiOutlineUpload /> Import
            <input type="file" accept=".csv" onChange={handleImport} className="hidden" />
          </label>
          <button onClick={handleExport} className="px-4 py-2 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 text-sm flex items-center gap-2"><HiOutlineDownload /> Export</button>
          <button onClick={() => setShowGroupModal(true)} className="px-4 py-2 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 text-sm flex items-center gap-2"><FaTag /> Groups</button>
          <button onClick={() => setShowModal(true)} className="btn-primary px-4 py-2 rounded-xl text-white text-sm font-medium flex items-center gap-2"><HiOutlinePlus /> Add</button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="table-header">
              <th className="p-4 text-left">Name</th>
              <th className="p-4 text-left">Phone</th>
              <th className="p-4 text-left">Email</th>
              <th className="p-4 text-left">Groups</th>
              <th className="p-4 text-left">Added</th>
              <th className="p-4 text-left">Actions</th>
            </tr></thead>
            <tbody>
              {contacts.map((c, idx) => (
                <motion.tr key={c._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.03 }} className="table-row">
                  <td className="p-4"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-300 text-sm font-bold">{c.name?.charAt(0) || '?'}</div><span className="text-white">{c.name || 'Unknown'}</span></div></td>
                  <td className="p-4 text-gray-300">{c.phone}</td>
                  <td className="p-4 text-gray-400 text-sm">{c.email || '-'}</td>
                  <td className="p-4"><div className="flex gap-1 flex-wrap">
                    {c.groups?.map(g => <span key={g._id} className="badge badge-purple text-xs">{g.name}</span>)}
                    {(!c.groups || c.groups.length === 0) && <span className="text-gray-500 text-xs">No groups</span>}
                  </div></td>
                  <td className="p-4 text-gray-400 text-sm">{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td className="p-4"><button onClick={() => handleDelete(c._id)} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"><HiOutlineTrash size={16} /></button></td>
                </motion.tr>
              ))}
              {contacts.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-500">No contacts found</td></tr>}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && <div className="flex items-center justify-center gap-2 p-4 border-t border-white/5">
          {Array.from({ length: totalPages }, (_, i) => (
            <button key={i} onClick={() => setPage(i + 1)} className={`w-8 h-8 rounded-lg text-sm ${page === i + 1 ? 'bg-purple-600 text-white' : 'text-gray-400 hover:bg-white/5'}`}>{i + 1}</button>
          ))}
        </div>}
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-md border border-white/10" onClick={e => e.stopPropagation()}>
              <h2 className="text-xl font-bold text-white mb-4">Add Contact</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div><label className="block text-sm font-medium text-gray-300 mb-2">Name</label><input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div><label className="block text-sm font-medium text-gray-300 mb-2">Phone *</label><input className="input-field" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required /></div>
                <div><label className="block text-sm font-medium text-gray-300 mb-2">Email</label><input className="input-field" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                <div className="flex gap-3 justify-end pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2 rounded-xl border border-white/10 text-gray-300">Cancel</button>
                  <button type="submit" className="btn-primary px-6 py-2 rounded-xl text-white">Save</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {showGroupModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowGroupModal(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-md border border-white/10" onClick={e => e.stopPropagation()}>
              <h2 className="text-xl font-bold text-white mb-4">Manage Groups</h2>
              <div className="space-y-2 mb-4">
                {groups.map(g => <div key={g._id} className="flex items-center justify-between p-3 rounded-lg bg-white/5"><span className="text-gray-300">{g.name} ({g.contactCount})</span></div>)}
              </div>
              <form onSubmit={createGroup} className="flex gap-2">
                <input className="input-field flex-1" placeholder="Group name" value={groupForm.name} onChange={e => setGroupForm({ ...groupForm, name: e.target.value })} required />
                <button type="submit" className="btn-primary px-4 py-2 rounded-xl text-white text-sm">Create</button>
              </form>
              <button onClick={() => setShowGroupModal(false)} className="mt-4 w-full px-6 py-2 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5">Close</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
