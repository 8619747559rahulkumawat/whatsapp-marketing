import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import API from '../utils/api';
import { HiOutlineSearch, HiOutlineTrash, HiOutlineBan, HiOutlineCheck, HiOutlineCreditCard, HiOutlinePlus, HiOutlineCash, HiOutlineCollection, HiOutlineUserCircle } from 'react-icons/hi';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [creditForm, setCreditForm] = useState({ amount: '', description: '' });
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditRate, setCreditRate] = useState('0.15');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', credits: '', role: 'user' });
  const [showTxModal, setShowTxModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planForm, setPlanForm] = useState({ plan: 'free' });
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [planUpdating, setPlanUpdating] = useState(false);

  useEffect(() => { fetchUsers(); }, [page, search]);

  const fetchUsers = async () => {
    try {
      const { data } = await API.get(`/admin/users?page=${page}&limit=20&search=${search}`);
      if (data.success) { setUsers(data.users); setTotalPages(data.pagination.pages); }
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => {
    API.get('/admin/settings').then(({ data }) => {
      if (data.success && data.settings.creditRate) setCreditRate(data.settings.creditRate);
    }).catch(() => {});
  }, []);

  const toggleUserStatus = async (id, isActive) => {
    try {
      await API.put(`/admin/users/${id}`, { isActive: !isActive });
      fetchUsers();
    } catch { }
  };

  const deleteUser = async (id) => {
    if (!confirm('Delete this user and all associated data permanently?')) return;
    try { await API.delete(`/admin/users/${id}`); fetchUsers(); } catch { }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await API.post('/admin/users', {
        name: createForm.name,
        email: createForm.email,
        password: createForm.password,
        credits: parseInt(createForm.credits) || 0,
        role: createForm.role
      });
      setShowCreateModal(false);
      setCreateForm({ name: '', email: '', password: '', credits: '', role: 'user' });
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create user');
    } finally { setCreating(false); }
  };

  const fetchTransactions = async (user) => {
    setTxLoading(true);
    setSelectedUser(user);
    setShowTxModal(true);
    try {
      const { data } = await API.get(`/admin/transactions?userId=${user._id}`);
      if (data.success) setTransactions(data.transactions);
    } catch { setTransactions([]); } finally { setTxLoading(false); }
  };

  const handleAddCredits = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      await API.post('/wallet/add', {
        userId: selectedUser._id,
        amount: parseInt(creditForm.amount),
        description: creditForm.description
      });
      setShowCreditModal(false);
      setCreditForm({ amount: '', description: '' });
      fetchUsers();
    } catch { }
  };

  const handlePlanChange = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    setPlanUpdating(true);
    try {
      await API.put(`/admin/users/${selectedUser._id}/plan`, { plan: planForm.plan });
      setShowPlanModal(false);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update plan');
    } finally { setPlanUpdating(false); }
  };

  const planColors = {
    free: 'badge-gray',
    starter: 'badge-info',
    professional: 'badge-purple',
    enterprise: 'badge-warning'
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">User Management</h1>
          <p className="text-gray-400 text-sm mt-1">Manage all platform users</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowCreateModal(true)} className="btn-primary px-4 py-2 rounded-xl text-white text-sm font-medium flex items-center gap-2">
            <HiOutlinePlus /> Create User
          </button>
          <div className="relative">
            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input-field pl-10 py-2 w-64" placeholder="Search users..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="table-header">
              <th className="p-4 text-left">User</th>
              <th className="p-4 text-left">Email</th>
              <th className="p-4 text-left">Role</th>
              <th className="p-4 text-left">Plan</th>
              <th className="p-4 text-left">Credits</th>
              <th className="p-4 text-left">Status</th>
              <th className="p-4 text-left">Joined</th>
              <th className="p-4 text-left">Actions</th>
            </tr></thead>
            <tbody>
              {users.map((u, idx) => (
                <motion.tr key={u._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.03 }} className="table-row">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-300 text-sm font-bold">{u.name?.charAt(0)}</div>
                      <span className="text-white font-medium">{u.name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-gray-300 text-sm">{u.email}</td>
                  <td className="p-4"><span className={`badge ${u.role === 'admin' || u.role === 'super_admin' ? 'badge-purple' : u.role === 'reseller' ? 'badge-info' : 'badge-success'} text-xs capitalize`}>{u.role === 'super_admin' ? 'super admin' : u.role}</span></td>
                  <td className="p-4">
                    <span className={`badge ${planColors[u.plan] || 'badge-gray'} text-xs capitalize`}>{u.plan || 'free'}</span>
                  </td>
                  <td className="p-4 text-gray-300">{u.credits?.toLocaleString()}</td>
                  <td className="p-4">
                    <button onClick={() => toggleUserStatus(u._id, u.isActive)} className={`badge ${u.isActive ? 'badge-success' : 'badge-danger'} text-xs`}>
                      {u.isActive ? 'Active' : 'Blocked'}
                    </button>
                  </td>
                  <td className="p-4 text-gray-400 text-sm">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setSelectedUser(u); setPlanForm({ plan: u.plan || 'free' }); setShowPlanModal(true); }} className="p-2 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20" title="Change Plan">
                        <HiOutlineCollection size={16} />
                      </button>
                      <button onClick={() => fetchTransactions(u)} className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20" title="View Transactions">
                        <HiOutlineCash size={16} />
                      </button>
                      <button onClick={() => { setSelectedUser(u); setShowCreditModal(true); }} className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20" title="Add Credits">
                        <HiOutlineCreditCard size={16} />
                      </button>
                      <button onClick={() => deleteUser(u._id)} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20" title="Delete">
                        <HiOutlineTrash size={16} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
              {users.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-gray-500">No users found</td></tr>}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-4 border-t border-white/5">
            {Array.from({ length: totalPages }, (_, i) => (
              <button key={i} onClick={() => setPage(i + 1)} className={`w-8 h-8 rounded-lg text-sm ${page === i + 1 ? 'bg-purple-600 text-white' : 'text-gray-400 hover:bg-white/5'}`}>{i + 1}</button>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateModal(false)}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-md border border-white/10" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">Create Client Account</h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-300 mb-2">Name</label><input className="input-field" value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} required /></div>
              <div><label className="block text-sm font-medium text-gray-300 mb-2">Email</label><input type="email" className="input-field" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} required /></div>
              <div><label className="block text-sm font-medium text-gray-300 mb-2">Password</label><input type="password" className="input-field" value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} required /></div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Role</label>
                <div className="flex gap-2">
                  {['user', 'reseller', 'admin'].map(r => (
                    <button key={r} type="button" onClick={() => setCreateForm({ ...createForm, role: r })}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium capitalize transition-all ${createForm.role === r ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div><label className="block text-sm font-medium text-gray-300 mb-2">Initial Credits</label><input type="number" className="input-field" value={createForm.credits} onChange={e => setCreateForm({ ...createForm, credits: e.target.value })} min="0" /></div>
              <div className="flex gap-3 justify-end pt-4">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-6 py-2 rounded-xl border border-white/10 text-gray-300">Cancel</button>
                <button type="submit" disabled={creating} className="btn-primary px-6 py-2 rounded-xl text-white">{creating ? 'Creating...' : 'Create Account'}</button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}

      {showCreditModal && selectedUser && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowCreditModal(false)}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-md border border-white/10" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-2">Add Credits</h2>
            <p className="text-gray-400 text-sm mb-4">User: {selectedUser.name} ({selectedUser.email})<br />Current Credits: {selectedUser.credits}</p>
            <form onSubmit={handleAddCredits} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-300 mb-2">Amount</label><input type="number" className="input-field" value={creditForm.amount} onChange={e => setCreditForm({ ...creditForm, amount: e.target.value })} required min="1" /></div>
              {creditForm.amount && (
                <div className="p-3 rounded-xl bg-green-500/10 text-green-300 text-sm text-center">
                  Client Pay: <strong>{(parseInt(creditForm.amount) * parseFloat(creditRate)).toLocaleString()} Rs</strong>
                  <span className="text-gray-400 text-xs block">(1 Credit = {creditRate} Rs)</span>
                </div>
              )}
              <div><label className="block text-sm font-medium text-gray-300 mb-2">Description</label><input className="input-field" value={creditForm.description} onChange={e => setCreditForm({ ...creditForm, description: e.target.value })} /></div>
              <div className="flex gap-3 justify-end pt-4">
                <button type="button" onClick={() => setShowCreditModal(false)} className="px-6 py-2 rounded-xl border border-white/10 text-gray-300">Cancel</button>
                <button type="submit" className="btn-primary px-6 py-2 rounded-xl text-white">Add Credits</button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}

      {showPlanModal && selectedUser && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowPlanModal(false)}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-md border border-white/10" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-2">Change Plan</h2>
            <p className="text-gray-400 text-sm mb-4">User: {selectedUser.name} ({selectedUser.email})</p>
            <form onSubmit={handlePlanChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Select Plan</label>
                <div className="grid grid-cols-2 gap-2">
                  {['free', 'starter', 'professional', 'enterprise'].map(p => (
                    <button key={p} type="button" onClick={() => setPlanForm({ plan: p })}
                      className={`py-3 rounded-xl text-sm font-medium capitalize transition-all ${planForm.plan === p ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="pt-4">
                <p className="text-xs text-gray-500 mb-4">Changing the plan will update tenant limits and features.</p>
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowPlanModal(false)} className="px-6 py-2 rounded-xl border border-white/10 text-gray-300">Cancel</button>
                <button type="submit" disabled={planUpdating} className="btn-primary px-6 py-2 rounded-xl text-white">
                  {planUpdating ? 'Updating...' : 'Update Plan'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}

      {showTxModal && selectedUser && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowTxModal(false)}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto border border-white/10" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-white">Transactions</h2>
                <p className="text-gray-400 text-sm">{selectedUser.name} ({selectedUser.email})</p>
              </div>
              <button onClick={() => setShowTxModal(false)} className="text-gray-400 hover:text-white">Close</button>
            </div>
            {txLoading ? (
              <div className="text-center py-8 text-gray-400">Loading...</div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No transactions yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="table-header">
                    <th className="p-3 text-left text-xs">Type</th>
                    <th className="p-3 text-left text-xs">Amount</th>
                    <th className="p-3 text-left text-xs">Balance Before</th>
                    <th className="p-3 text-left text-xs">Balance After</th>
                    <th className="p-3 text-left text-xs">Description</th>
                    <th className="p-3 text-left text-xs">Date</th>
                  </tr></thead>
                  <tbody>
                    {transactions.map((tx, idx) => (
                      <tr key={tx._id || idx} className="table-row">
                        <td className="p-3"><span className={`badge text-xs ${tx.type === 'credit' ? 'badge-success' : 'badge-danger'}`}>{tx.type}</span></td>
                        <td className="p-3 text-gray-300">{tx.amount}</td>
                        <td className="p-3 text-gray-400 text-xs">{tx.balanceBefore}</td>
                        <td className="p-3 text-gray-400 text-xs">{tx.balanceAfter}</td>
                        <td className="p-3 text-gray-400 text-xs max-w-[200px] truncate">{tx.description}</td>
                        <td className="p-3 text-gray-400 text-xs">{new Date(tx.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
