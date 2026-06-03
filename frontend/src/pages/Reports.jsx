import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import API from '../utils/api';
import { HiOutlineDownload } from 'react-icons/hi';
import { FaChartBar } from 'react-icons/fa';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement);

export default function Reports() {
  const [stats, setStats] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [statsRes, campRes] = await Promise.all([API.get('/reports/dashboard'), API.get('/reports/campaigns')]);
      if (statsRes.data.success) setStats(statsRes.data.stats);
      if (campRes.data.success) setCampaigns(campRes.data.campaigns);
    } catch { console.error("API Error"); } finally { setLoading(false); }
  };

  const handleExport = async (type, campaignId) => {
    try {
      const params = new URLSearchParams({ type: type || 'all' });
      if (campaignId) params.append('campaignId', campaignId);
      const { data } = await API.get(`/reports/export?${params}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${Date.now()}.csv`;
      a.click();
    } catch (err) { console.error(err); }
  };

  const tabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Messages', value: stats?.totalMessages || 0, color: 'text-blue-400' },
                { label: 'Sent', value: stats?.sentMessages || 0, color: 'text-green-400' },
                { label: 'Delivered', value: stats?.deliveredMessages || 0, color: 'text-purple-400' },
                { label: 'Failed', value: stats?.failedMessages || 0, color: 'text-red-400' },
              ].map((item, idx) => (
                <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} className="glass-card p-4 text-center">
                  <p className={`text-xl sm:text-2xl font-bold ${item.color}`}>{item.value.toLocaleString()}</p>
                  <p className="text-gray-400 text-sm mt-1">{item.label}</p>
                </motion.div>
              ))}
            </div>
            <div className="glass-card p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Delivery Performance</h3>
                <button onClick={() => handleExport('all')} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 text-sm"><HiOutlineDownload /> Export All</button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <span className="text-gray-300">Delivery Rate</span>
                  <span className="text-white font-bold">{stats?.deliveryRate || 0}%</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-purple-500 to-green-500 rounded-full transition-all duration-500" style={{ width: `${stats?.deliveryRate || 0}%` }} />
                </div>
              </div>
            </div>
          </div>
        );
      case 'campaigns':
        return (
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="table-header">
                  <th className="p-2 sm:p-4 text-left whitespace-nowrap">Campaign</th>
                  <th className="p-2 sm:p-4 text-left whitespace-nowrap">Type</th>
                  <th className="p-2 sm:p-4 text-left whitespace-nowrap">Status</th>
                  <th className="p-2 sm:p-4 text-left whitespace-nowrap">Sent</th>
                  <th className="p-2 sm:p-4 text-left whitespace-nowrap">Delivered</th>
                  <th className="p-2 sm:p-4 text-left whitespace-nowrap">Failed</th>
                  <th className="p-2 sm:p-4 text-left whitespace-nowrap">Export</th>
                </tr></thead>
                <tbody>
                  {campaigns.map((c, idx) => (
                    <motion.tr key={c._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.05 }} className="table-row">
                      <td className="p-2 sm:p-4 text-white whitespace-nowrap">{c.name}</td>
                      <td className="p-2 sm:p-4 capitalize text-gray-300 whitespace-nowrap">{c.type}</td>
                      <td className="p-2 sm:p-4 whitespace-nowrap"><span className={`badge ${c.status === 'completed' ? 'badge-success' : c.status === 'running' ? 'badge-info' : 'badge-warning'}`}>{c.status}</span></td>
                      <td className="p-2 sm:p-4 text-gray-300 whitespace-nowrap">{c.sentCount}</td>
                      <td className="p-2 sm:p-4 text-gray-300 whitespace-nowrap">{c.deliveredCount}</td>
                      <td className="p-2 sm:p-4 text-gray-300 whitespace-nowrap">{c.failedCount}</td>
                      <td className="p-2 sm:p-4 whitespace-nowrap"><button onClick={() => handleExport('campaign', c._id)} className="p-2 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20"><HiOutlineDownload size={16} /></button></td>
                    </motion.tr>
                  ))}
                  {campaigns.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-gray-500">No campaigns yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Reports</h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">Campaign and delivery analytics</p>
        </div>
      </div>

      <div className="flex gap-2">
        {['overview', 'campaigns'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium capitalize transition-all ${activeTab === tab ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
            {tab}
          </button>
        ))}
      </div>

      {tabContent()}
    </div>
  );
}
