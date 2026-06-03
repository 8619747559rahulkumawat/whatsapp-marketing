import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import API from '../utils/api';
import { HiOutlineDownload, HiOutlineChartBar, HiOutlineChartSquareBar, HiOutlineTrendingUp, HiOutlineMail, HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineEye } from 'react-icons/hi';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement);

export default function Analytics() {
  const [activeTab, setActiveTab] = useState('realtime');
  const [stats, setStats] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [statsRes, funnelRes, timelineRes, campaignRes] = await Promise.all([
        API.get('/analytics/realtime'),
        API.get('/analytics/funnel'),
        API.get('/analytics/timeline?days=30'),
        API.get('/analytics/campaigns')
      ]);
      if (statsRes.data.success) setStats(statsRes.data.stats);
      if (funnelRes.data.success) setFunnel(funnelRes.data.funnel);
      if (timelineRes.data.success) setTimeline(timelineRes.data.stats);
      if (campaignRes.data.success) setCampaigns(campaignRes.data.analytics);
    } catch { console.error('Operation failed'); } finally { setLoading(false); }
  };

  const exportReport = async () => {
    try {
      const { data } = await API.get('/analytics/export?format=csv');
      const blob = new Blob([data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'analytics-report.csv'; a.click();
    } catch { console.error('Operation failed'); }
  };

  const lineData = {
    labels: timeline.map(t => t._id),
    datasets: [
      { label: 'Sent', data: timeline.map(t => t.sent || 0), borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,0.1)', fill: true, tension: 0.4 },
      { label: 'Delivered', data: timeline.map(t => t.delivered || 0), borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)', fill: true, tension: 0.4 },
      { label: 'Failed', data: timeline.map(t => t.failed || 0), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: 0.4 }
    ]
  };

  const doughnutData = {
    labels: ['Sent', 'Delivered', 'Failed'],
    datasets: [{
      data: [stats?.sentMessages || 0, stats?.deliveredMessages || 0, stats?.failedMessages || 0],
      backgroundColor: ['#7c3aed', '#22c55e', '#ef4444'],
      borderWidth: 0
    }]
  };

  const funnelData = funnel ? {
    labels: funnel.stages.map(s => s.name),
    datasets: [{ label: 'Conversion', data: funnel.stages.map(s => s.value), backgroundColor: ['#7c3aed', '#22c55e', '#3b82f6', '#f59e0b'] }]
  } : null;

  const tabs = [
    { id: 'realtime', label: 'Real-time', icon: HiOutlineTrendingUp },
    { id: 'funnel', label: 'Conversion Funnel', icon: HiOutlineChartSquareBar },
    { id: 'campaigns', label: 'Campaign Reports', icon: HiOutlineChartBar }
  ];

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Real-time metrics and campaign performance</p>
        </div>
        <button onClick={exportReport} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/10 text-green-400 text-sm hover:bg-green-500/20">
          <HiOutlineDownload /> Export Report
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
              <Icon /> {tab.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Messages', value: stats?.totalMessages || 0, icon: HiOutlineMail, color: 'text-blue-400' },
          { label: 'Delivered', value: stats?.deliveredMessages || 0, icon: HiOutlineCheckCircle, color: 'text-green-400' },
          { label: 'Failed', value: stats?.failedMessages || 0, icon: HiOutlineXCircle, color: 'text-red-400' },
          { label: 'Delivery Rate', value: `${stats?.deliveryRate || 0}%`, icon: HiOutlineEye, color: 'text-purple-400' }
        ].map((card, idx) => {
          const Icon = card.icon;
          return (
            <motion.div key={idx} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} className="glass-card p-5 glass-card-hover">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">{card.label}</p>
                  <p className={`text-2xl font-bold ${card.color} mt-1`}>{card.value.toLocaleString()}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center"><Icon className={`text-2xl ${card.color}`} /></div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card p-6">
          <h3 className="text-white font-semibold mb-4">Message Timeline (30 days)</h3>
          {timeline.length > 0 ? (
            <Line data={lineData} options={{ responsive: true, plugins: { legend: { labels: { color: '#9ca3af' } } }, scales: { x: { ticks: { color: '#9ca3af' } }, y: { ticks: { color: '#9ca3af' } } } }} />
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-500">No data available</div>
          )}
        </div>
        <div className="glass-card p-6">
          <h3 className="text-white font-semibold mb-4">Message Distribution</h3>
          <Doughnut data={doughnutData} options={{ cutout: '70%', plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af', padding: 16 } } } }} />
          <div className="text-center mt-4">
            <p className="text-2xl font-bold text-white">{stats?.deliveryRate || 0}%</p>
            <p className="text-gray-400 text-sm">Overall Delivery Rate</p>
          </div>
        </div>
      </div>

      {activeTab === 'funnel' && funnelData && (
        <div className="glass-card p-6">
          <h3 className="text-white font-semibold mb-4">Conversion Funnel</h3>
          <Bar data={funnelData} options={{ responsive: true, plugins: { legend: { labels: { color: '#9ca3af' } } }, scales: { x: { ticks: { color: '#9ca3af' } }, y: { ticks: { color: '#9ca3af' } } } }} />
        </div>
      )}

      {activeTab === 'campaigns' && campaigns?.campaigns && (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="table-header">
                <th className="p-4 text-left">Campaign</th>
                <th className="p-4 text-left">Status</th>
                <th className="p-4 text-left">Sent</th>
                <th className="p-4 text-left">Delivered</th>
                <th className="p-4 text-left">Failed</th>
                <th className="p-4 text-left">Rate</th>
              </tr></thead>
              <tbody>
                {campaigns.campaigns.map((c, idx) => (
                  <tr key={c._id} className="table-row">
                    <td className="p-4 text-white font-medium">{c.name}</td>
                    <td className="p-4"><span className={`badge text-xs ${c.status === 'completed' ? 'badge-success' : c.status === 'running' ? 'badge-info' : c.status === 'failed' ? 'badge-danger' : 'badge-warning'}`}>{c.status}</span></td>
                    <td className="p-4 text-gray-300">{c.sentCount || 0}</td>
                    <td className="p-4 text-gray-300">{c.deliveredCount || 0}</td>
                    <td className="p-4 text-gray-300">{c.failedCount || 0}</td>
                    <td className="p-4">{c.sentCount > 0 ? `${Math.round(((c.deliveredCount || 0) / c.sentCount) * 100)}%` : '-'}</td>
                  </tr>
                ))}
                {(!campaigns.campaigns || campaigns.campaigns.length === 0) && <tr><td colSpan={6} className="p-8 text-center text-gray-500">No campaigns yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
