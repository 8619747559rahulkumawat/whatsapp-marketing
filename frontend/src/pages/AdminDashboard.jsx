import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Line, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import API from '../utils/api';
import { HiOutlineUsers, HiOutlinePhone, HiOutlineMail, HiOutlineCollection, HiOutlineShieldCheck, HiOutlineCreditCard } from 'react-icons/hi';
import { FaRocket, FaChartBar } from 'react-icons/fa';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement);

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [subStats, setSubStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { Promise.all([fetchData(), fetchSubStats()]); }, []);

  const fetchData = async () => {
    try {
      const { data: res } = await API.get('/admin/dashboard');
      if (res.success) setData(res);
    } catch { console.error("API Error"); } finally { setLoading(false); }
  };

  const fetchSubStats = async () => {
    try {
      const { data: res } = await API.get('/admin/subscriptions/stats');
      if (res.success) setSubStats(res.stats);
    } catch (err) { console.error(err); }
  };

  const stats = data?.stats || {};
  const recentUsers = data?.recentUsers || [];
  const recentCampaigns = data?.recentCampaigns || [];

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers || 0, icon: HiOutlineUsers, color: 'text-blue-400' },
    { label: 'Active Sessions', value: stats.activeSessions || 0, icon: HiOutlinePhone, color: 'text-green-400' },
    { label: 'Total Campaigns', value: stats.totalCampaigns || 0, icon: FaRocket, color: 'text-purple-400' },
    { label: 'Total Messages', value: stats.totalMessages || 0, icon: HiOutlineMail, color: 'text-yellow-400' },
    { label: 'Total Contacts', value: stats.totalContacts || 0, icon: FaChartBar, color: 'text-pink-400' },
    { label: 'Revenue (Credits)', value: stats.totalRevenue?.toLocaleString() || '0', icon: HiOutlineShieldCheck, color: 'text-orange-400' },
  ];

  const planColors = { free: 'text-gray-400', starter: 'text-blue-400', professional: 'text-purple-400', enterprise: 'text-amber-400' };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">Platform overview and monitoring</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Link to="/admin/users" className="btn-primary px-3 sm:px-4 py-2 rounded-xl text-white text-xs sm:text-sm font-medium">
            Manage Users
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <motion.div key={idx} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} className="glass-card p-5 glass-card-hover">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">{card.label}</p>
                  <p className={`text-xl sm:text-2xl font-bold ${card.color} mt-1`}>{card.value.toLocaleString()}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                  <Icon className={`text-xl sm:text-2xl ${card.color}`} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {subStats && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card p-4 sm:p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <HiOutlineCreditCard className="text-purple-400" /> Subscription Overview
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 rounded-xl bg-white/5 text-center">
              <p className="text-xl sm:text-2xl font-bold text-white">{subStats.total || 0}</p>
              <p className="text-gray-400 text-xs mt-1">Total Subscriptions</p>
            </div>
            {['free', 'starter', 'professional', 'enterprise'].map(plan => (
              <div key={plan} className="p-4 rounded-xl bg-white/5 text-center">
                <p className={`text-xl sm:text-2xl font-bold capitalize ${planColors[plan]}`}>{subStats.byPlan?.[plan] || 0}</p>
                <p className="text-gray-400 text-xs mt-1 capitalize">{plan}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 text-sm text-gray-400">
            Total Revenue: <span className="text-green-400 font-bold">₹{subStats.totalRevenue?.toLocaleString() || 0}</span>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-4 sm:p-6">
          <h3 className="text-white font-semibold mb-4">Recent Users</h3>
          <div className="space-y-3">
            {recentUsers.map(u => (
              <div key={u._id} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-300 text-sm font-bold">{u.name?.charAt(0)}</div>
                  <div>
                    <p className="text-white text-sm font-medium">{u.name}</p>
                    <p className="text-gray-400 text-xs">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${u.isActive ? 'badge-success' : 'badge-danger'} text-xs`}>{u.isActive ? 'Active' : 'Blocked'}</span>
                  <span className="text-gray-400 text-xs capitalize">{u.role}</span>
                </div>
              </div>
            ))}
            {recentUsers.length === 0 && <p className="text-gray-500 text-sm text-center py-4">No users yet</p>}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-4 sm:p-6">
          <h3 className="text-white font-semibold mb-4">Recent Campaigns</h3>
          <div className="space-y-3">
            {recentCampaigns.map(c => (
              <div key={c._id} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                <div>
                  <p className="text-white text-sm font-medium">{c.name}</p>
                  <p className="text-gray-400 text-xs">{c.userId?.name || c.userId?.email || 'Unknown'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${c.status === 'completed' ? 'badge-success' : c.status === 'running' ? 'badge-info' : c.status === 'failed' ? 'badge-danger' : 'badge-warning'} text-xs`}>
                    {c.status}
                  </span>
                  <span className="text-gray-400 text-xs">{c.sentCount}/{c.totalContacts}</span>
                </div>
              </div>
            ))}
            {recentCampaigns.length === 0 && <p className="text-gray-500 text-sm text-center py-4">No campaigns yet</p>}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
