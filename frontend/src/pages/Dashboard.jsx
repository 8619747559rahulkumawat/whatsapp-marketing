import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Line, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import API from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { HiOutlineMail, HiOutlineCheckCircle, HiOutlineXCircle, HiOutlinePhone } from 'react-icons/hi';
import { FaWhatsapp, FaRocket, FaUsers, FaChartBar } from 'react-icons/fa';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement);

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [monthlyStats, setMonthlyStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchStats(), fetchMonthly()]).finally(() => setLoading(false));
  }, []);

  const fetchStats = async () => {
    try {
      const { data } = await API.get('/reports/dashboard');
      if (data.success) setStats(data.stats);
    } catch { }
  };

  const fetchMonthly = async () => {
    try {
      const { data } = await API.get('/reports/monthly');
      if (data.success) setMonthlyStats(data.stats);
    } catch { }
  };

  const statCards = [
    { label: 'Total Messages', value: stats?.totalMessages || 0, icon: HiOutlineMail, color: 'from-blue-500 to-blue-600', bg: 'bg-blue-500/10' },
    { label: 'Delivered', value: stats?.deliveredMessages || 0, icon: HiOutlineCheckCircle, color: 'from-green-500 to-green-600', bg: 'bg-green-500/10' },
    { label: 'Failed', value: stats?.failedMessages || 0, icon: HiOutlineXCircle, color: 'from-red-500 to-red-600', bg: 'bg-red-500/10' },
    { label: 'Active Sessions', value: stats?.activeSessions || 0, icon: HiOutlinePhone, color: 'from-purple-500 to-purple-600', bg: 'bg-purple-500/10' },
  ];

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const lineData = {
    labels: monthlyStats.length > 0
      ? monthlyStats.map(m => `${monthNames[m._id.month - 1]} ${m._id.year}`)
      : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Messages',
        data: monthlyStats.length > 0 ? monthlyStats.map(m => m.total) : [0, 0, 0, 0, 0, 0],
        borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,0.1)', fill: true, tension: 0.4
      },
      {
        label: 'Delivered',
        data: monthlyStats.length > 0 ? monthlyStats.map(m => m.delivered) : [0, 0, 0, 0, 0, 0],
        borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)', fill: true, tension: 0.4
      }
    ]
  };

  const doughnutData = {
    labels: ['Delivered', 'Failed', 'Pending'],
    datasets: [{ data: [stats?.deliveredMessages || 0, stats?.failedMessages || 0, (stats?.totalMessages || 0) - (stats?.deliveredMessages || 0) - (stats?.failedMessages || 0)], backgroundColor: ['#22c55e', '#ef4444', '#6b7280'], borderWidth: 0 }]
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">Welcome back, {user?.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/campaigns" className="btn-primary px-3 sm:px-4 py-2 rounded-xl text-white text-xs sm:text-sm font-medium flex items-center gap-2">
            <FaRocket size={14} /> New Campaign
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="glass-card p-6 glass-card-hover"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">{card.label}</p>
                  <p className="text-2xl font-bold text-white mt-1">{card.value.toLocaleString()}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl ${card.bg} flex items-center justify-center`}>
                  <Icon className={`text-2xl text-${card.color.split(' ')[0].replace('from-', '')}`} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 glass-card p-6"
        >
          <h3 className="text-white font-semibold mb-4 text-sm sm:text-base">Message Analytics</h3>
          <div className="min-h-[200px] sm:min-h-[300px]">
            <Line data={lineData} options={{ responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af', boxWidth: 12, padding: 12, font: { size: 11 } } } }, scales: { x: { ticks: { color: '#9ca3af', font: { size: 10 } } }, y: { ticks: { color: '#9ca3af', font: { size: 10 } } } } }} />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-card p-6"
        >
          <h3 className="text-white font-semibold mb-4 text-sm sm:text-base">Delivery Rate</h3>
          <div className="flex flex-col items-center">
            <div className="w-full max-w-[220px] sm:max-w-[260px]">
              <Doughnut data={doughnutData} options={{ cutout: '70%', responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af', padding: 12, boxWidth: 12, font: { size: 11 } } } } }} />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-white mt-4">{stats?.deliveryRate || 0}%</p>
            <p className="text-gray-400 text-xs sm:text-sm">Delivery Rate</p>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Campaigns', value: stats?.totalCampaigns || 0, icon: FaRocket, color: 'text-purple-400' },
          { label: 'Total Contacts', value: stats?.totalContacts || 0, icon: FaUsers, color: 'text-blue-400' },
          { label: 'Sent Messages', value: stats?.sentMessages || 0, icon: FaWhatsapp, color: 'text-green-400' },
          { label: 'Delivery Rate', value: `${stats?.deliveryRate || 0}%`, icon: FaChartBar, color: 'text-yellow-400' },
        ].map((item, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 + idx * 0.1 }}
            className="glass-card p-4 flex items-center gap-4 glass-card-hover"
          >
            <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
              <item.icon className={item.color} />
            </div>
            <div>
              <p className="text-gray-400 text-xs">{item.label}</p>
              <p className="text-white font-bold text-lg">{item.value}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
