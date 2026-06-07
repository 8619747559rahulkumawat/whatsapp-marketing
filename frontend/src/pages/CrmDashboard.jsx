import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API from '../utils/api';
import {
  HiOutlineTrendingUp, HiOutlineClipboardCheck, HiOutlineMail, HiOutlineCalendar,
  HiOutlineTag, HiOutlineCurrencyDollar, HiOutlineTemplate, HiOutlineSparkles,
  HiOutlineLightningBolt, HiOutlineChatAlt2, HiOutlineRefresh, HiOutlineUserGroup,
  HiOutlineBell, HiOutlineViewGrid, HiOutlineCode, HiOutlineDeviceMobile,
  HiOutlineUpload, HiOutlineDocumentText, HiOutlineFlag, HiOutlineDocument,
  HiOutlineHeart, HiOutlineClock
} from 'react-icons/hi';

const allFeatures = [
  { path: '/deals', label: 'Deal Pipeline', desc: 'Kanban board — drag & drop deals across stages', icon: HiOutlineTrendingUp, color: 'from-blue-500 to-blue-600', tag: 'Core' },
  { path: '/tasks', label: 'Tasks & Reminders', desc: 'Assign tasks, set due dates, never miss follow-ups', icon: HiOutlineClipboardCheck, color: 'from-orange-500 to-red-500', tag: 'Core' },
  { path: '/email', label: 'Email Integration', desc: 'SendGrid se directly CRM se email bhejo', icon: HiOutlineMail, color: 'from-yellow-500 to-yellow-600', tag: 'Core' },
  { path: '/meetings', label: 'Meeting Scheduler', desc: 'Schedule & manage meetings with clients', icon: HiOutlineCalendar, color: 'from-green-500 to-green-600', tag: 'Core' },
  { path: '/webforms', label: 'Web Forms', desc: 'Embeddable forms — visitors auto-save as contacts', icon: HiOutlineTemplate, color: 'from-purple-500 to-purple-600', tag: 'Core' },
  { path: '/products', label: 'Products Catalog', desc: 'Products/services with pricing', icon: HiOutlineTag, color: 'from-pink-500 to-pink-600', tag: 'Core' },
  { path: '/quotes', label: 'Quotes', desc: 'Generate & send quotes with payment links', icon: HiOutlineCurrencyDollar, color: 'from-cyan-500 to-cyan-600', tag: 'Core' },
  { path: '/lead-scoring', label: 'AI Lead Scoring', desc: 'Auto-predict kaunse lead convert honge (ML-based)', icon: HiOutlineSparkles, color: 'from-violet-500 to-violet-600', tag: 'New' },
  { path: '/email-campaigns', label: 'Email Campaigns', desc: 'Bulk email + open/click tracking (SendGrid)', icon: HiOutlineLightningBolt, color: 'from-blue-500 to-blue-600', tag: 'New' },
  { path: '/sms-campaigns', label: 'SMS Campaigns', desc: 'Non-WA SMS via Twilio/textlocal gateways', icon: HiOutlineChatAlt2, color: 'from-teal-500 to-teal-600', tag: 'New' },
  { path: '#', label: 'Two-way Email Sync', desc: 'Gmail/Outlook se email auto-sync CRM mein', icon: HiOutlineRefresh, color: 'from-indigo-500 to-indigo-600', tag: 'New' },
  { path: '/roles', label: 'Role-based Access', desc: 'Admin, Manager, Agent — alag permissions', icon: HiOutlineUserGroup, color: 'from-gray-500 to-gray-600', tag: 'New' },
  { path: '#', label: 'Smart Notifications', desc: 'Real-time alerts for lead/deal/task activity', icon: HiOutlineBell, color: 'from-red-500 to-red-600', tag: 'New' },
  { path: '#', label: 'Custom Dashboards', desc: 'Widget-based dashboard — apne hisaab se set karo', icon: HiOutlineViewGrid, color: 'from-purple-500 to-purple-600', tag: 'New' },
  { path: '/webhooks', label: 'API & Webhooks', desc: 'Third-party apps se connect (Zapier-style)', icon: HiOutlineCode, color: 'from-cyan-500 to-cyan-600', tag: 'New' },
  { path: '#', label: 'Mobile App (PWA)', desc: 'Phone par app jaisa experience, offline support', icon: HiOutlineDeviceMobile, color: 'from-green-500 to-green-600', tag: 'New' },
  { path: '#', label: 'Import/Export', desc: 'CSV/Excel bulk import/export for all data', icon: HiOutlineUpload, color: 'from-yellow-500 to-yellow-600', tag: 'New' },
  { path: '/email-templates', label: 'Email Templates', desc: 'Ready-to-use email templates with variables', icon: HiOutlineDocumentText, color: 'from-orange-500 to-orange-600', tag: 'New' },
  { path: '/goals', label: 'Goal Tracking', desc: 'Team targets + progress bars', icon: HiOutlineFlag, color: 'from-red-500 to-red-600', tag: 'New' },
  { path: '/contracts', label: 'Contract Management', desc: 'Upload, manage & track contracts', icon: HiOutlineDocument, color: 'from-blue-500 to-blue-600', tag: 'New' },
  { path: '/surveys', label: 'Survey / NPS', desc: 'Customer satisfaction score + feedback', icon: HiOutlineHeart, color: 'from-pink-500 to-pink-600', tag: 'New' },
  { path: '#', label: 'Activity Timeline', desc: 'Har contact ki poori history ek jagah', icon: HiOutlineClock, color: 'from-teal-500 to-teal-600', tag: 'Core' },
];

export default function CrmDashboard() {
  const [filter, setFilter] = useState('all');
  const [stats, setStats] = useState({ deals: 0, tasks: 0, meetings: 0, products: 0 });

  useEffect(() => {
    Promise.all([
      API.get('/deals/stats').catch(() => ({ data: { stageStats: [] } })),
      API.get('/tasks/stats').catch(() => ({ data: { stats: [], overdue: 0 } })),
      API.get('/meetings').catch(() => ({ data: { meetings: [] } })),
      API.get('/products').catch(() => ({ data: { products: [] } })),
    ]).then(([deals, tasks, meetings, products]) => {
      setStats({
        deals: deals.data.stageStats?.reduce((s, st) => s + st.count, 0) || 0,
        tasks: tasks.data.stats?.find(s => s._id !== 'completed')?.count || 0,
        meetings: meetings.data.meetings?.filter(m => m.status !== 'completed').length || 0,
        products: products.data.products?.length || 0,
      });
    }).catch(() => {});
  }, []);

  const filtered = filter === 'all' ? allFeatures : filter === 'core' ? allFeatures.filter(f => f.tag === 'Core') : allFeatures.filter(f => f.tag === 'New');

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">CRM Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Customer Relationship Management — 22 features, sab kuch ek jagah</p>
        </div>
        <div className="flex gap-2 bg-white/5 rounded-xl p-1">
          {['all', 'core', 'new'].map(tab => (
            <button key={tab} onClick={() => setFilter(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${filter === tab ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              {tab === 'all' ? 'All' : tab === 'core' ? 'Core CRM' : 'New Features'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-card rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-400">{stats.deals}</p>
          <p className="text-xs text-gray-500 mt-0.5">Active Deals</p>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-orange-400">{stats.tasks}</p>
          <p className="text-xs text-gray-500 mt-0.5">Pending Tasks</p>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{stats.meetings}</p>
          <p className="text-xs text-gray-500 mt-0.5">Upcoming Meetings</p>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-purple-400">{stats.products}</p>
          <p className="text-xs text-gray-500 mt-0.5">Products</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(f => {
          const Icon = f.icon;
          const isLive = !f.path.startsWith('#');
          return isLive ? (
            <Link key={f.label} to={f.path} className="glass-card rounded-xl p-5 border border-white/5 hover:border-purple-500/40 transition-all group relative overflow-hidden">
              {f.tag === 'New' && <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">NEW</span>}
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                  <Icon className="text-white" size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold group-hover:text-purple-300 transition-colors">{f.label}</h3>
                  <p className="text-gray-400 text-xs mt-1">{f.desc}</p>
                </div>
              </div>
            </Link>
          ) : (
            <div key={f.label} className="glass-card rounded-xl p-5 border border-white/5 opacity-75 relative overflow-hidden">
              {f.tag === 'New' && <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">NEW</span>}
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="text-white" size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold">{f.label}</h3>
                  <p className="text-gray-400 text-xs mt-1">{f.desc}</p>
                  <span className="text-[10px] text-purple-400 mt-1 inline-block">In-page feature ✓</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
