import { useState, useEffect, useCallback } from 'react';
import API from '../utils/api';
import { HiOutlineShieldCheck, HiOutlineUserGroup } from 'react-icons/hi';
import { useToast } from '../contexts/ToastContext';

const roleColors = { super_admin: 'text-red-400 bg-red-500/20', admin: 'text-purple-400 bg-purple-500/20', manager: 'text-blue-400 bg-blue-500/20', agent: 'text-green-400 bg-green-500/20', user: 'text-gray-400 bg-gray-500/20' };

export default function Roles() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [permissions, setPermissions] = useState({});

  const fetch = useCallback(async () => {
    const [u, p] = await Promise.all([API.get('/roles/team'), API.get('/roles/permissions').catch(() => ({ data: { permissions: {} } }))]);
    if (u.data.success) setUsers(u.data.users);
    if (p.data?.permissions) setPermissions(p.data.permissions);
  }, []);
  useEffect(() => { fetch(); }, [fetch]);

  const updateRole = async (userId, role) => {
    try {
      await API.put(`/roles/${userId}`, { role });
      toast.success('Role updated');
      fetch();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2"><HiOutlineUserGroup /> Role-based Access</h1>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 border-b border-white/10">
              <th className="text-left py-3 px-4">Name</th>
              <th className="text-left py-3 px-4">Email</th>
              <th className="text-left py-3 px-4">Current Role</th>
              <th className="text-left py-3 px-4">Change Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u._id} className="border-b border-white/5 hover:bg-white/5">
                <td className="py-3 px-4 text-white">{u.name}</td>
                <td className="py-3 px-4 text-gray-400">{u.email}</td>
                <td className="py-3 px-4"><span className={`text-xs px-2 py-0.5 rounded-full capitalize ${roleColors[u.role] || 'text-gray-400'}`}>{u.role}</span></td>
                <td className="py-3 px-4">
                  <select value={u.role} onChange={e => updateRole(u._id, e.target.value)} className="input-field text-xs py-1 px-2 w-auto">
                    <option value="admin">Admin</option><option value="manager">Manager</option><option value="agent">Agent</option><option value="user">User</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="glass-card rounded-xl p-5 border border-white/5">
        <h2 className="text-lg font-semibold text-white mb-3">Role Permissions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(permissions).map(([role, perms]) => (
            <div key={role} className="bg-white/5 rounded-xl p-4">
              <h3 className={`font-semibold capitalize mb-2 ${roleColors[role]?.split(' ')[0] || 'text-white'}`}>{role}</h3>
              <ul className="space-y-1">
                {(perms || []).map(p => <li key={p} className="text-xs text-gray-400 flex items-center gap-1"><span className="text-green-400">✓</span> {p.replace(/_/g, ' ')}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
