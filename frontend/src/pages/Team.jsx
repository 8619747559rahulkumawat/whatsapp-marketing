import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import API from '../utils/api';
import { HiOutlinePlus, HiOutlineTrash, HiOutlineUserGroup, HiOutlineShieldCheck } from 'react-icons/hi';

export default function Team() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ userId: '', role: 'agent', permissions: [] });
  const [users, setUsers] = useState([]);

  const roleColors = { agent: 'badge-info', viewer: 'badge-warning', admin: 'badge-purple' };

  useEffect(() => { fetchMembers(); fetchUsers(); }, []);

  const fetchMembers = async () => {
    try {
      const { data } = await API.get('/team');
      if (data.success) setMembers(data.members);
    } catch { console.error('Operation failed'); } finally { setLoading(false); }
  };

  const fetchUsers = async () => {
    try {
      const { data } = await API.get('/admin/users?limit=100');
      if (data.success) setUsers(data.users);
    } catch { console.error('Operation failed'); }
  };

  const addMember = async (e) => {
    e.preventDefault();
    try {
      await API.post('/team', form);
      setShowModal(false);
      setForm({ userId: '', role: 'agent', permissions: [] });
      fetchMembers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add member');
    }
  };

  const removeMember = async (id) => {
    if (!confirm('Remove this team member?')) return;
    try { await API.delete(`/team/${id}`); fetchMembers(); } catch { console.error('Operation failed'); }
  };

  const updateRole = async (id, role) => {
    try { await API.put(`/team/${id}`, { role }); fetchMembers(); } catch { console.error('Operation failed'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Team Management</h1>
          <p className="text-gray-400 text-sm mt-1">Manage your team members and roles</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary px-4 py-2 rounded-xl text-white text-sm font-medium flex items-center gap-2">
          <HiOutlinePlus /> Add Member
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5 text-center">
          <HiOutlineUserGroup className="text-3xl text-purple-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{members.length}</p>
          <p className="text-gray-400 text-sm">Team Members</p>
        </div>
        <div className="glass-card p-5 text-center">
          <HiOutlineShieldCheck className="text-3xl text-green-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{members.filter(m => m.role === 'agent').length}</p>
          <p className="text-gray-400 text-sm">Agents</p>
        </div>
        <div className="glass-card p-5 text-center">
          <HiOutlineShieldCheck className="text-3xl text-blue-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{members.filter(m => m.role === 'viewer').length}</p>
          <p className="text-gray-400 text-sm">Viewers</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="table-header">
              <th className="p-4 text-left">Member</th>
              <th className="p-4 text-left">Email</th>
              <th className="p-4 text-left">Role</th>
              <th className="p-4 text-left">Status</th>
              <th className="p-4 text-left">Joined</th>
              <th className="p-4 text-left">Actions</th>
            </tr></thead>
            <tbody>
              {members.map((m, idx) => (
                <tr key={m._id} className="table-row">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-300 text-sm font-bold">
                        {m.userId?.name?.charAt(0) || '?'}
                      </div>
                      <span className="text-white font-medium">{m.userId?.name || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="p-4 text-gray-300 text-sm">{m.userId?.email || '-'}</td>
                  <td className="p-4">
                    <select value={m.role} onChange={e => updateRole(m._id, e.target.value)}
                      className="bg-transparent text-sm border border-white/10 rounded-lg px-2 py-1 text-gray-300">
                      <option value="agent">Agent</option>
                      <option value="viewer">Viewer</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="p-4">
                    <span className={`badge text-xs ${m.isActive ? 'badge-success' : 'badge-danger'}`}>
                      {m.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-4 text-gray-400 text-sm">{new Date(m.joinedAt).toLocaleDateString()}</td>
                  <td className="p-4">
                    <button onClick={() => removeMember(m._id)} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20">
                      <HiOutlineTrash size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {members.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-500">No team members yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-md border border-white/10" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">Add Team Member</h2>
            <form onSubmit={addMember} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Select User</label>
                <select className="input-field" value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} required>
                  <option value="">Choose a user...</option>
                  {users.filter(u => u.role !== 'super_admin' && u.role !== 'admin').map(u => (
                    <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Role</label>
                <select className="input-field" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="agent">Agent - Can manage campaigns and contacts</option>
                  <option value="viewer">Viewer - Can only view reports</option>
                  <option value="admin">Admin - Full access to all features</option>
                </select>
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2 rounded-xl border border-white/10 text-gray-300">Cancel</button>
                <button type="submit" className="btn-primary px-6 py-2 rounded-xl text-white">Add Member</button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
