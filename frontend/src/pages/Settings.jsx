import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import API from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { HiOutlineUser, HiOutlineLockClosed, HiOutlineSaveAs, HiOutlineCash } from 'react-icons/hi';
import { FaWhatsapp } from 'react-icons/fa';

export default function Settings() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [creditAmount, setCreditAmount] = useState('');
  const [creditRate, setCreditRate] = useState('0.15');
  const [newRate, setNewRate] = useState('0.15');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'super_admin') {
      API.get('/admin/settings').then(({ data }) => {
        if (data.success && data.settings.creditRate) {
          setCreditRate(data.settings.creditRate);
          setNewRate(data.settings.creditRate);
        }
      }).catch(() => {});
    }
  }, [user]);

  const handleRateUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await API.put('/admin/settings', { key: 'creditRate', value: newRate });
      setCreditRate(newRate);
      setMessage({ type: 'success', text: `Credit rate set to 1 Credit = ${newRate} Rs` });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update rate' });
    } finally { setSaving(false); }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const { data } = await API.put('/auth/profile', profile);
      if (data.success) {
        updateUser(data.user);
        setMessage({ type: 'success', text: 'Profile updated successfully' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Update failed' });
    } finally { setSaving(false); }
  };

  const handleCreditUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      await API.put('/admin/my-credits', { credits: parseInt(creditAmount) });
      setMessage({ type: 'success', text: `Credits updated to ${parseInt(creditAmount).toLocaleString()}` });
      if (updateUser) updateUser({ ...user, credits: parseInt(creditAmount) });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Update failed' });
    } finally { setSaving(false); }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (password.newPassword !== password.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const { data } = await API.put('/auth/change-password', {
        currentPassword: password.currentPassword,
        newPassword: password.newPassword
      });
      if (data.success) {
        setMessage({ type: 'success', text: 'Password changed successfully' });
        setPassword({ currentPassword: '', newPassword: '', confirmPassword: '' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Password change failed' });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 text-xs sm:text-sm mt-1">Manage your account settings</p>
      </div>

      {message.text && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl ${message.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}
        >
          {message.text}
        </motion.div>
      )}

      <div className="flex gap-2 flex-wrap">
        {['profile', 'password', ...(user?.role === 'admin' || user?.role === 'super_admin' ? ['credits'] : [])].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium capitalize transition-all ${activeTab === tab ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
            {tab === 'profile' ? <span className="flex items-center gap-2"><HiOutlineUser /> Profile</span> : tab === 'password' ? <span className="flex items-center gap-2"><HiOutlineLockClosed /> Password</span> : <span className="flex items-center gap-2"><HiOutlineCash /> Credits</span>}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-4 sm:p-6 max-w-lg">
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
              <input className="input-field" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
              <input className="input-field opacity-50" value={user?.email} disabled />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Phone</label>
              <input className="input-field" value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} />
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-500/10 text-purple-300 text-sm">
              <FaWhatsapp /> Credits: {user?.credits?.toLocaleString() || 0}
            </div>
            <button type="submit" disabled={saving} className="btn-primary px-4 sm:px-6 py-2 rounded-xl text-white flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <HiOutlineSaveAs /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </motion.div>
      )}

      {activeTab === 'password' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-4 sm:p-6 max-w-lg">
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Current Password</label>
              <input type="password" className="input-field" value={password.currentPassword} onChange={e => setPassword({ ...password, currentPassword: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">New Password</label>
              <input type="password" className="input-field" value={password.newPassword} onChange={e => setPassword({ ...password, newPassword: e.target.value })} required minLength={6} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Confirm New Password</label>
              <input type="password" className="input-field" value={password.confirmPassword} onChange={e => setPassword({ ...password, confirmPassword: e.target.value })} required />
            </div>
            <button type="submit" disabled={saving} className="btn-primary px-4 sm:px-6 py-2 rounded-xl text-white text-xs sm:text-sm">
              {saving ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </motion.div>
      )}

      {activeTab === 'credits' && (user?.role === 'admin' || user?.role === 'super_admin') && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 max-w-lg">
          <div className="glass-card p-4 sm:p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><HiOutlineCash /> Credit Price Settings</h3>
            <div className="p-4 rounded-xl bg-purple-500/10 text-purple-300 mb-4 text-sm">
              Current Rate: <strong>1 Credit = {creditRate} Rs</strong>
            </div>
            <form onSubmit={handleRateUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Set Credit Rate (Rs per Credit)</label>
                <input type="number" step="0.01" min="0.01" className="input-field" value={newRate} onChange={e => setNewRate(e.target.value)} required />
              </div>
              <p className="text-gray-400 text-xs">Example: 0.15 means client pays 150 Rs for 1000 Credits</p>
              <button type="submit" disabled={saving} className="btn-primary px-4 sm:px-6 py-2 rounded-xl text-white text-xs sm:text-sm">
                {saving ? 'Saving...' : 'Save Rate'}
              </button>
            </form>
          </div>

          <div className="glass-card p-4 sm:p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><HiOutlineCash /> Admin Credits</h3>
            <div className="p-4 rounded-xl bg-purple-500/10 text-purple-300 mb-4 text-sm">
              Your Credits: <strong>{user?.credits?.toLocaleString() || 0}</strong>
            </div>
            <form onSubmit={handleCreditUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Set Credits Amount</label>
                <input type="number" className="input-field" value={creditAmount} onChange={e => setCreditAmount(e.target.value)} placeholder="Enter new credit amount" required min="0" />
              </div>
              {creditAmount && (
                <div className="p-3 rounded-xl bg-green-500/10 text-green-300 text-sm">
                  Price: <strong>{(parseFloat(creditAmount) * parseFloat(creditRate)).toLocaleString()} Rs</strong>
                </div>
              )}
              <button type="submit" disabled={saving} className="btn-primary px-4 sm:px-6 py-2 rounded-xl text-white text-xs sm:text-sm">
                {saving ? 'Updating...' : 'Update Credits'}
              </button>
            </form>
          </div>
        </motion.div>
      )}
    </div>
  );
}
